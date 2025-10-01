// electron/ipc/tts.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_VOICES_URL = "https://texttospeech.googleapis.com/v1/voices";

// 새로운 tts:synthesize 핸들러 (ScriptVoiceGenerator에서 사용)
ipcMain.handle("tts:synthesize", async (event, { scenes, ttsEngine, voiceId, speed }) => {
  try {
    if (!scenes || scenes.length === 0) {
      throw new Error("장면 데이터가 없습니다.");
    }

    // Google TTS만 사용
    const speakingRate = parseFloat(speed) || 1.0;

    // 진행률 콜백 함수
    const progressCallback = (current, total) => {
      const progress = Math.round((current / total) * 100);
      event.sender.send('tts:progress', { current, total, progress });
    };

    const result = await synthesizeWithGoogle(scenes, { voiceId, speakingRate }, progressCallback);

    // 파일 저장 처리
    if (result.ok && result.parts) {
      const store = require('../services/store');
      const path = require('path');
      const fs = require('fs').promises;

      // 현재 프로젝트 시스템을 사용하여 audio/parts 경로 생성
      const { getProjectManager } = require('../services/projectManager');
      const currentProjectId = store.getCurrentProjectId();

      let audioPartsDir;
      if (currentProjectId) {
        // 현재 프로젝트 기반 경로 사용
        const projectManager = getProjectManager();
        let currentProject = store.getCurrentProject();

        if (!currentProject) {
          currentProject = await projectManager.findProjectById(currentProjectId);
          if (currentProject) {
            projectManager.setCurrentProject(currentProject);
          }
        }

        if (currentProject && currentProject.paths && currentProject.paths.audio) {
          audioPartsDir = path.join(currentProject.paths.audio, 'parts');
        } else {
          throw new Error(`현재 프로젝트 경로를 찾을 수 없습니다: ${currentProjectId}`);
        }
      } else {
        // 폴백: 기본 경로 사용
        const projectRoot = store.get('projectRootFolder') || 'C:\\WeaverPro';
        const defaultProjectName = store.get('defaultProjectName') || 'default';
        audioPartsDir = path.join(projectRoot, defaultProjectName, 'audio', 'parts');
      }

      // 디렉토리 생성 (없는 경우)
      await fs.mkdir(audioPartsDir, { recursive: true });

      const audioFiles = [];

      for (let i = 0; i < result.parts.length; i++) {
        const part = result.parts[i];
        const audioFilePath = path.join(audioPartsDir, part.fileName);

        // base64를 Buffer로 변환하여 파일 저장
        const audioBuffer = Buffer.from(part.base64, 'base64');
        await fs.writeFile(audioFilePath, audioBuffer);

        audioFiles.push({
          sceneIndex: i,
          audioUrl: audioFilePath,
          fileName: part.fileName,
          provider: result.provider,
          duration: part.duration || 0  // 실제 측정된 오디오 길이 추가
        });
      }
      
      return { ok: true, audioFiles, provider: result.provider };
    }
    
    return result;
  } catch (error) {
    console.error("❌ TTS 합성 실패:", error);
    console.error("❌ 오류 스택:", error.stack);
    console.error("❌ 오류 상세:", {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return { ok: false, error: error.message, details: error.toString() };
  }
});

ipcMain.handle("tts/synthesizeByScenes", async (_evt, { doc, tts }) => {
  const { engine, voiceId, voiceName, speakingRate, pitch, provider } = tts || {};
  const scenes = doc?.scenes || [];

  // Google TTS만 사용
  return await synthesizeWithGoogle(scenes, { voiceId: voiceId || voiceName, speakingRate, pitch });
});

// Google TTS 음성 합성
async function synthesizeWithGoogle(scenes, options, progressCallback = null) {
  const apiKey = await getSecret("googleTtsApiKey");
  if (!apiKey) {
    console.error("❌ Google TTS API Key가 없습니다");
    throw new Error("Google TTS API Key가 설정되지 않았습니다. 설정 > API 키에서 설정해주세요.");
  }

  const { voiceId, speakingRate, pitch } = options;

  const lang = (() => {
    const parts = String(voiceId || "").split("-");
    return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "ko-KR";
  })();

  const parts = [];
  const path = require('path');
  const fs = require('fs').promises;
  const os = require('os');
  const { execSync } = require('child_process');

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const finalVoiceName = voiceId || "ko-KR-Neural2-A";

    // 진행률 업데이트
    if (progressCallback) {
      progressCallback(i, scenes.length);
    }

    // 요청 전 대기 (API 안정성을 위해)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const body = {
      input: { text: String(sc.text || "") },
      voice: { languageCode: lang, name: finalVoiceName },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Number(speakingRate ?? 1.05),
        pitch: Number(pitch ?? -1),
        volumeGainDb: 2.0,
        sampleRateHertz: 24000,
        effectsProfileId: ["handset-class-device"]
      },
    };

    const res = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Google TTS 실패(${i + 1}): ${res.status} ${txt}`);
    }

    const data = await res.json();
    const base64 = data?.audioContent;
    if (!base64) throw new Error(`Google TTS 응답 오류(${i + 1})`);

    // 실제 오디오 duration 측정을 위해 임시 파일 생성
    let actualDuration = 0;
    try {
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `temp-audio-${i}.mp3`);

      // base64를 파일로 저장
      const buffer = Buffer.from(base64, 'base64');
      await fs.writeFile(tempFile, buffer);

      // ffprobe로 실제 duration 측정
      const ffprobeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempFile}"`;
      const durationOutput = execSync(ffprobeCmd, { encoding: 'utf-8' }).trim();
      actualDuration = parseFloat(durationOutput);

      // 임시 파일 삭제
      await fs.unlink(tempFile).catch(() => {});
    } catch (error) {
      // 폴백: 글자 수 기반 추정 (한국어 TTS speakingRate 1.05 기준)
      // speakingRate 1.05 = 약 240-260자/분 = 4-4.3자/초
      const charCount = (sc.text || "").length;
      actualDuration = charCount / (240 / 60); // 240자/분 = 4자/초
    }

    parts.push({
      fileName: `scene-${String(i + 1).padStart(3, "0")}.mp3`,
      base64,
      mime: "audio/mpeg",
      duration: actualDuration, // 실제 측정된 duration 추가
    });
  }

  return { ok: true, partsCount: parts.length, parts, provider: 'Google' };
}



// Google TTS 목소리 목록을 가져오는 핸들러
ipcMain.handle("tts:listVoices", async (_evt, options = {}) => {
  const voices = [];

  try {
      // Google TTS 목소리 로드
      try {
        const googleApiKey = await getSecret("googleTtsApiKey");

        if (googleApiKey) {
          const googleVoices = await loadGoogleVoices(googleApiKey);
          voices.push(...googleVoices);
        }
      } catch (error) {
        console.error('❌ Google TTS 목소리 로드 실패:', error);
      }

    if (voices.length === 0) {
      return {
        ok: false,
        code: 1004,
        message: "API 키가 설정되지 않았습니다. 설정 탭에서 TTS API 키를 설정해주세요."
      };
    }

    // 목소리들을 이름순으로 정렬
    voices.sort((a, b) => a.name.localeCompare(b.name, 'en'));

    return {
      ok: true,
      data: voices
    };
  } catch (error) {
    console.error('❌ TTS 목소리 로드 전체 실패:', error);
    return {
      ok: false,
      code: 1005,
      message: `TTS 목소리 로드 실패: ${error.message}`
    };
  }
});

// Google TTS 목소리 로드 함수
async function loadGoogleVoices(apiKey) {
  const res = await fetch(`${GOOGLE_VOICES_URL}?key=${apiKey}`);
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Google TTS API 호출 실패: ${res.status} - ${errorText}`);
    throw new Error(`Google TTS API 오류: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const allVoices = data.voices || [];

  const koreanVoices = allVoices.filter(voice =>
    voice.languageCodes && voice.languageCodes.includes('ko-KR')
  );
  
  const processedVoices = koreanVoices.map(voice => ({
    id: voice.name,
    name: formatVoiceName(voice.name, voice.ssmlGender),
    gender: voice.ssmlGender || 'NEUTRAL',
    type: voice.name.includes('Wavenet') ? 'Wavenet' :
          voice.name.includes('Neural2') ? 'Neural2' :
          voice.name.includes('Standard') ? 'Standard' : 'Unknown',
    language: 'ko-KR',
    provider: 'Google'
  }))
  .sort((a, b) => {
    const typeOrder = { 'Neural2': 0, 'Wavenet': 1, 'Standard': 2, 'Unknown': 3 };
    const typeComparison = typeOrder[a.type] - typeOrder[b.type];
    if (typeComparison !== 0) return typeComparison;
    
    const genderOrder = { 'FEMALE': 0, 'MALE': 1, 'NEUTRAL': 2 };
    const genderComparison = genderOrder[a.gender] - genderOrder[b.gender];
    if (genderComparison !== 0) return genderComparison;
    
    return a.name.localeCompare(b.name, 'ko');
  });

  return processedVoices;
}


// 목소리 이름을 사용자 친화적으로 포맷
function formatVoiceName(voiceName, ssmlGender) {
  // 예: ko-KR-Wavenet-A -> 한국어 여성 (Wavenet A)
  // 예: ko-KR-Neural2-B -> 한국어 남성 (Neural2 B)
  const parts = voiceName.split('-');
  if (parts.length >= 4) {
    const type = parts[2]; // Wavenet, Neural2, Standard
    const variant = parts[3]; // A, B, C, etc.

    // 실제 Google API의 성별 정보 사용
    const genderKorean = {
      'MALE': '남성',
      'FEMALE': '여성',
      'NEUTRAL': '중성'
    };
    const gender = genderKorean[ssmlGender] || '중성';

    return `한국어 ${gender} (${type} ${variant})`;
  }
  return voiceName;
}

// 단일 씬 TTS 재생성 API (VREW 스타일)
ipcMain.handle("tts:regenerateScene", async (event, { sceneIndex, sceneText, voiceSettings = {} }) => {
  try {
    if (!sceneText || sceneText.trim().length === 0) {
      throw new Error("씬 텍스트가 비어있습니다.");
    }

    // 기본 음성 설정
    const {
      voiceId = "ko-KR-Standard-A",
      speakingRate = 1.0,
      pitch = -1,
      volumeGainDb = 2.0
    } = voiceSettings;

    // 단일 씬 데이터 구성
    const singleScene = {
      id: `scene_${sceneIndex + 1}`,
      text: sceneText.trim(),
      start: 0, // 단일 씬이므로 시작 시간은 0
      end: 0    // 시작 시간은 무관
    };

    // 기존 synthesizeWithGoogle 함수 재사용
    const result = await synthesizeWithGoogle([singleScene], {
      voiceId,
      speakingRate,
      pitch
    });

    if (result.ok && result.parts && result.parts.length > 0) {
      // 파일 저장 처리
      const store = require('../services/store');
      const path = require('path');
      const fs = require('fs').promises;

      // 현재 프로젝트 기반 audio/parts 경로 생성
      const { getProjectManager } = require('../services/projectManager');
      const currentProjectId = store.getCurrentProjectId();

      let audioPartsDir;
      if (currentProjectId) {
        const projectManager = getProjectManager();
        let currentProject = store.getCurrentProject();

        if (!currentProject) {
          currentProject = await projectManager.findProjectById(currentProjectId);
          if (currentProject) {
            projectManager.setCurrentProject(currentProject);
          }
        }

        if (currentProject && currentProject.paths && currentProject.paths.audio) {
          audioPartsDir = path.join(currentProject.paths.audio, 'parts');
        } else {
          throw new Error(`현재 프로젝트 경로를 찾을 수 없습니다: ${currentProjectId}`);
        }
      } else {
        // 폴백: 기본 경로 사용
        const projectRoot = store.get('projectRootFolder') || 'C:\\WeaverPro';
        audioPartsDir = path.join(projectRoot, 'audio', 'parts');
      }

      // 디렉토리 생성 (없는 경우)
      await fs.mkdir(audioPartsDir, { recursive: true });

      const part = result.parts[0];
      const audioFilePath = path.join(audioPartsDir, `scene-${String(sceneIndex + 1).padStart(3, "0")}.mp3`);

      // base64를 Buffer로 변환하여 파일 저장
      const audioBuffer = Buffer.from(part.base64, 'base64');
      await fs.writeFile(audioFilePath, audioBuffer);

      return {
        ok: true,
        audioFile: {
          sceneIndex: sceneIndex,
          audioUrl: audioFilePath,
          fileName: `scene-${String(sceneIndex + 1).padStart(3, "0")}.mp3`,
          provider: result.provider,
          duration: part.duration || 0  // 실제 측정된 오디오 길이 추가
        }
      };
    }

    return result;
  } catch (error) {
    console.error(`❌ 단일 씬 TTS 재생성 실패 (씬 ${sceneIndex + 1}):`, error);
    return { ok: false, error: error.message, details: error.toString() };
  }
});
