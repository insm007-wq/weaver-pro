// electron/ipc/tts.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");
const { getDefaultProjectRoot } = require("../utils/pathHelper");
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_VOICES_URL = "https://texttospeech.googleapis.com/v1/voices";

// 임시 파일 정리 유틸리티
async function cleanupTempFiles() {
  try {
    const tempDir = os.tmpdir();
    const files = await fs.readdir(tempDir);

    // temp-audio로 시작하는 파일들만 정리
    const tempAudioFiles = files.filter(f => f.startsWith('temp-audio-'));

    // 1시간 이상 된 파일만 삭제
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    for (const file of tempAudioFiles) {
      try {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < oneHourAgo) {
          await fs.unlink(filePath);
        }
      } catch (err) {
        // 파일이 이미 삭제되었거나 접근 불가능한 경우 무시
      }
    }
  } catch (err) {
    // 임시 파일 정리 실패는 무시
  }
}

// 주기적 임시 파일 정리 (30분마다)
setInterval(cleanupTempFiles, 30 * 60 * 1000);

// 앱 시작 시 한 번 정리
cleanupTempFiles();

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
        const projectRoot = store.get('projectRootFolder') || getDefaultProjectRoot();
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

// Google TTS 음성 합성 (병렬 처리 + 재시도)
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

  const { execSync } = require('child_process');

  // 병렬 처리 설정 (동시 3개씩 처리)
  const BATCH_SIZE = 3;
  const parts = new Array(scenes.length);
  let completedCount = 0;

  // 단일 씬 TTS 생성 함수 (재시도 로직 포함)
  async function synthesizeScene(sceneIndex, maxRetries = 3) {
    const sc = scenes[sceneIndex];
    const finalVoiceName = voiceId || "ko-KR-Neural2-A";

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

    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 재시도 시 지수 백오프
        if (attempt > 0) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ 씬 ${sceneIndex + 1} 재시도 ${attempt}/${maxRetries} (${backoffMs}ms 대기)`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        // 타임아웃 설정 (30초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const res = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Google TTS 실패(${sceneIndex + 1}): ${res.status} ${txt}`);
        }

        const data = await res.json();
        const base64 = data?.audioContent;
        if (!base64) throw new Error(`Google TTS 응답 오류(${sceneIndex + 1})`);

        // 실제 오디오 duration 측정
        let actualDuration = 0;
        try {
          const tempDir = os.tmpdir();
          const tempFile = path.join(tempDir, `temp-audio-${sceneIndex}-${Date.now()}.mp3`);

          const buffer = Buffer.from(base64, 'base64');
          await fs.writeFile(tempFile, buffer);

          const ffprobeCmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempFile}"`;
          const durationOutput = execSync(ffprobeCmd, { encoding: 'utf-8' }).trim();
          actualDuration = parseFloat(durationOutput);

          await fs.unlink(tempFile).catch(() => {});
        } catch (error) {
          const charCount = (sc.text || "").length;
          actualDuration = charCount / (240 / 60);
        }

        return {
          fileName: `scene-${String(sceneIndex + 1).padStart(3, "0")}.mp3`,
          base64,
          mime: "audio/mpeg",
          duration: actualDuration,
        };
      } catch (error) {
        lastError = error;
        console.warn(`❌ 씬 ${sceneIndex + 1} 시도 ${attempt + 1}/${maxRetries} 실패:`, error.message);

        // 마지막 시도가 아니면 계속
        if (attempt < maxRetries - 1) continue;
      }
    }

    throw new Error(`씬 ${sceneIndex + 1} TTS 생성 실패 (${maxRetries}회 재시도): ${lastError?.message}`);
  }

  // 배치 단위로 병렬 처리
  for (let batchStart = 0; batchStart < scenes.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, scenes.length);
    const batchPromises = [];

    // 배치 내 씬들을 병렬로 처리
    for (let i = batchStart; i < batchEnd; i++) {
      batchPromises.push(
        synthesizeScene(i).then(result => {
          parts[i] = result;
          completedCount++;

          // 진행률 업데이트
          if (progressCallback) {
            progressCallback(completedCount, scenes.length);
          }
        })
      );
    }

    // 현재 배치 완료 대기
    await Promise.all(batchPromises);

    // 배치 간 짧은 대기 (API 부하 방지)
    if (batchEnd < scenes.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  console.log(`✅ TTS 생성 완료: ${parts.length}개 씬`);
  return { ok: true, partsCount: parts.length, parts, provider: 'Google' };
}



// TTS 엔진별 목소리 목록을 가져오는 핸들러
ipcMain.handle("tts:listVoices", async (_evt, options = {}) => {
  const { engine = "google" } = options;
  const voices = [];

  try {
    // 엔진별 분기 처리 (확장 가능한 구조)
    switch (engine) {
      case "google":
        try {
          const googleApiKey = await getSecret("googleTtsApiKey");
          if (!googleApiKey) {
            return {
              ok: false,
              code: 1004,
              message: "Google TTS API 키가 설정되지 않았습니다. 설정 > API 키에서 설정해주세요."
            };
          }
          const googleVoices = await loadGoogleVoices(googleApiKey);
          voices.push(...googleVoices);
        } catch (error) {
          console.error('❌ Google TTS 목소리 로드 실패:', error);
          return {
            ok: false,
            code: 1005,
            message: `Google TTS 목소리 로드 실패: ${error.message}`
          };
        }
        break;

      // 향후 추가될 TTS 엔진들
      // case "amazon":
      //   const amazonVoices = await loadAmazonVoices(apiKey);
      //   voices.push(...amazonVoices);
      //   break;
      // case "kt":
      //   const ktVoices = await loadKTVoices(apiKey);
      //   voices.push(...ktVoices);
      //   break;

      default:
        return {
          ok: false,
          code: 1007,
          message: `지원하지 않는 TTS 엔진입니다: ${engine}`
        };
    }

    if (voices.length === 0) {
      return {
        ok: false,
        code: 1004,
        message: "사용 가능한 음성이 없습니다."
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
  // 예: ko-KR-Wavenet-A -> 목소리 1 (여성)

  // 실제 Google API의 성별 정보 사용
  const genderKorean = {
    'MALE': '남성',
    'FEMALE': '여성',
    'NEUTRAL': '중성'
  };
  const gender = genderKorean[ssmlGender] || '중성';

  const parts = voiceName.split('-');
  if (parts.length >= 4) {
    const type = parts[2]; // Wavenet, Neural2, Standard
    const variant = parts[3]; // A, B, C, D

    // Wavenet만 사용하고 A, B, C, D를 1, 2, 3, 4로 매핑
    const voiceMap = {
      'Wavenet-A': 1,
      'Wavenet-B': 2,
      'Wavenet-C': 3,
      'Wavenet-D': 4,
    };

    const voiceKey = `${type}-${variant}`;
    const voiceNumber = voiceMap[voiceKey] || variant.charCodeAt(0) - 64;

    return `목소리 ${voiceNumber} (${gender})`;
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
        const projectRoot = store.get('projectRootFolder') || getDefaultProjectRoot();
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
