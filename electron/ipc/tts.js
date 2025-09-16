// electron/ipc/tts.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_VOICES_URL = "https://texttospeech.googleapis.com/v1/voices";
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_VOICES_URL = "https://api.elevenlabs.io/v1/voices";

ipcMain.handle("tts/synthesizeByScenes", async (_evt, { doc, tts }) => {
  const { engine, voiceId, voiceName, speakingRate, pitch, provider } = tts || {};
  const scenes = doc?.scenes || [];
  
  // voiceId나 voiceName에서 제공자 추출
  const detectedProvider = provider || detectProviderFromVoice(voiceId || voiceName);
  
  console.log(`🎤 TTS 생성 시작: ${detectedProvider} 엔진, ${scenes.length}개 장면`);
  
  switch (detectedProvider) {
    case 'Google':
      return await synthesizeWithGoogle(scenes, { voiceId: voiceId || voiceName, speakingRate, pitch });
    
    case 'ElevenLabs':
      return await synthesizeWithElevenLabs(scenes, { voiceId: voiceId || voiceName, speakingRate });
    
    
    default:
      throw new Error(`지원하지 않는 TTS 엔진입니다: ${detectedProvider}`);
  }
});

// 제공자 감지 함수
function detectProviderFromVoice(voiceId) {
  if (!voiceId) return 'Google'; // 기본값
  
  if (voiceId.startsWith('ko-KR-')) return 'Google';
  if (voiceId.length === 20) return 'ElevenLabs'; // ElevenLabs voice ID는 20자
  
  return 'Google';
}

// Google TTS 음성 합성
async function synthesizeWithGoogle(scenes, options) {
  const apiKey = await getSecret("googleTtsApiKey");
  if (!apiKey) throw new Error("Google TTS API Key가 설정되지 않았습니다.");

  const { voiceId, speakingRate, pitch } = options;
  console.log("🔍 Google TTS 설정 (원본):", { voiceId, speakingRate, pitch });
  console.log("🔍 Google TTS options 전체:", JSON.stringify(options, null, 2));
  
  const lang = (() => {
    const parts = String(voiceId || "").split("-");
    return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "ko-KR";
  })();
  
  console.log("🎤 Google TTS 사용할 목소리:", { lang, voiceId, finalVoiceName: voiceId || "ko-KR-Neural2-A" });

  const parts = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const finalVoiceName = voiceId || "ko-KR-Neural2-A";
    
    console.log(`🎵 장면 ${i + 1} - 사용할 목소리: ${finalVoiceName}, 언어: ${lang}`);
    
    const body = {
      input: { text: String(sc.text || "") },
      voice: { languageCode: lang, name: finalVoiceName },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Number(speakingRate ?? 1.05), // 기본 속도를 조금 빠르게
        pitch: Number(pitch ?? -1), // 피치를 약간 낮춰 자연스럽게
        volumeGainDb: 2.0, // 볼륨을 약간 높여 명확하게
        sampleRateHertz: 24000, // 고품질 샘플레이트
        effectsProfileId: ["handset-class-device"] // 모바일/데스크톱 최적화
      },
    };
    
    console.log(`📋 장면 ${i + 1} - Google TTS 요청 Body:`, JSON.stringify(body, null, 2));

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
    
    parts.push({
      fileName: `scene-${String(i + 1).padStart(3, "0")}.mp3`,
      base64,
      mime: "audio/mpeg",
    });
  }

  return { ok: true, partsCount: parts.length, parts, provider: 'Google' };
}

// ElevenLabs TTS 음성 합성
async function synthesizeWithElevenLabs(scenes, options) {
  const apiKey = await getSecret("elevenlabsApiKey");
  if (!apiKey) throw new Error("ElevenLabs API Key가 설정되지 않았습니다.");

  const { voiceId, speakingRate } = options;
  const parts = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    // 한국어 텍스트 감지
    const text = String(sc.text || "");
    const hasKorean = /[가-힣]/.test(text);
    
    const body = {
      text,
      model_id: "eleven_multilingual_v2", // 다국어 지원 고품질 모델
      voice_settings: {
        stability: 0.48,        // 최적화된 안정성 (가장 자연스러운 설정)
        similarity_boost: hasKorean ? 0.92 : 0.90, // 한국어: 0.92, 영어: 0.90
        style: hasKorean ? 0.30 : 0.35, // 한국어: 0.30, 영어: 0.35
        use_speaker_boost: true
      },
      output_format: "mp3_44100_128" // 고품질 오디오 포맷
    };

    const res = await fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`ElevenLabs TTS 실패(${i + 1}): ${res.status} ${txt}`);
    }
    
    const audioBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString('base64');
    
    parts.push({
      fileName: `scene-${String(i + 1).padStart(3, "0")}.mp3`,
      base64,
      mime: "audio/mpeg",
    });
  }

  return { ok: true, partsCount: parts.length, parts, provider: 'ElevenLabs' };
}


// 다중 TTS 엔진 목소리 목록을 가져오는 핸들러
ipcMain.handle("tts:listVoices", async (_evt, options = {}) => {
  const { engine } = options;
  const voices = [];

  try {
    if (engine === "elevenlabs" || !engine) {
      // ElevenLabs 목소리 로드
      try {
        console.log("🔍 tts:listVoices - ElevenLabs API 키 확인 중...");
        const elevenlabsApiKey = await getSecret("elevenlabsApiKey");
        
        if (elevenlabsApiKey) {
          console.log(`🔑 ElevenLabs API 키 발견: ${elevenlabsApiKey.substring(0, 10)}...`);
          const elevenlabsVoices = await loadElevenLabsVoices(elevenlabsApiKey);
          voices.push(...elevenlabsVoices);
          console.log(`✅ ElevenLabs 목소리 ${elevenlabsVoices.length}개 로드 완료`);
        } else {
          console.log("❌ ElevenLabs API Key가 설정되지 않음");
        }
      } catch (error) {
        console.error('❌ ElevenLabs 목소리 로드 실패:', error);
        console.error('오류 상세:', error.message, error.stack);
      }
    }

    if (engine === "google" || !engine) {
      // Google TTS 목소리 로드
      try {
        console.log("🔍 tts:listVoices - Google TTS API 키 확인 중...");
        const googleApiKey = await getSecret("googleTtsApiKey");
        
        if (googleApiKey) {
          console.log(`🔑 Google TTS API 키 발견: ${googleApiKey.substring(0, 10)}...`);
          const googleVoices = await loadGoogleVoices(googleApiKey);
          voices.push(...googleVoices);
          console.log(`✅ Google TTS 목소리 ${googleVoices.length}개 로드 완료`);
        } else {
          console.log("❌ Google TTS API Key가 설정되지 않음");
        }
      } catch (error) {
        console.error('❌ Google TTS 목소리 로드 실패:', error);
        console.error('오류 상세:', error.message, error.stack);
      }
    }
    
    if (voices.length === 0) {
      return {
        ok: false,
        code: 1004,
        message: "API 키가 설정되지 않았습니다. 설정 탭에서 TTS API 키를 설정해주세요."
      };
    }

    // 목소리들을 제공자별로 정렬 (ElevenLabs 우선, 그 다음 Google)
    voices.sort((a, b) => {
      if (a.provider !== b.provider) {
        if (a.provider === 'ElevenLabs') return -1;
        if (b.provider === 'ElevenLabs') return 1;
      }
      return a.name.localeCompare(b.name, 'en');
    });

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
  console.log(`🌐 Google TTS API 호출: ${GOOGLE_VOICES_URL}`);
  
  const res = await fetch(`${GOOGLE_VOICES_URL}?key=${apiKey}`);
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Google TTS API 호출 실패: ${res.status} - ${errorText}`);
    throw new Error(`Google TTS API 오류: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const allVoices = data.voices || [];
  console.log(`📊 전체 목소리 수: ${allVoices.length}`);
  
  const koreanVoices = allVoices.filter(voice => 
    voice.languageCodes && voice.languageCodes.includes('ko-KR')
  );
  console.log(`🇰🇷 한국어 목소리 수: ${koreanVoices.length}`);
  
  const processedVoices = koreanVoices.map(voice => ({
    id: voice.name,
    name: formatVoiceName(voice.name),
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
  
  console.log(`🎤 최종 처리된 목소리:`, processedVoices.slice(0, 3).map(v => v.name));
  return processedVoices;
}

// ElevenLabs 목소리 로드 함수
async function loadElevenLabsVoices(apiKey) {
  console.log(`🌐 ElevenLabs API 호출: ${ELEVENLABS_VOICES_URL}`);
  
  const res = await fetch(ELEVENLABS_VOICES_URL, {
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ ElevenLabs API 호출 실패: ${res.status} - ${errorText}`);
    throw new Error(`ElevenLabs API 오류: ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const allVoices = data.voices || [];
  console.log(`📊 전체 ElevenLabs 목소리 수: ${allVoices.length}`);
  
  // 모든 목소리를 표시 (언어 필터링 없음)
  const processedVoices = allVoices.map(voice => ({
    id: voice.voice_id,
    name: `${voice.name} (${voice.category || 'Custom'})`,
    gender: detectGender(voice.labels),
    type: voice.category || 'Custom',
    language: detectLanguage(voice.labels),
    provider: 'ElevenLabs',
    preview_url: voice.preview_url,
    description: voice.description || ''
  }))
  .sort((a, b) => {
    // Premade 우선, 그 다음 Custom
    const typeOrder = { 'premade': 0, 'cloned': 1, 'generated': 2, 'Custom': 3 };
    const typeA = a.type.toLowerCase();
    const typeB = b.type.toLowerCase();
    const typeComparison = (typeOrder[typeA] || 3) - (typeOrder[typeB] || 3);
    if (typeComparison !== 0) return typeComparison;
    
    return a.name.localeCompare(b.name, 'en');
  });
  
  console.log(`🎤 최종 처리된 ElevenLabs 목소리:`, processedVoices.slice(0, 3).map(v => v.name));
  return processedVoices;
}


// 성별 감지 (ElevenLabs용)
function detectGender(labels) {
  if (!labels) return 'NEUTRAL';
  
  const gender = labels.gender?.toLowerCase() || '';
  if (gender === 'male') return 'MALE';
  if (gender === 'female') return 'FEMALE';
  
  return 'NEUTRAL';
}

// 언어 감지 (ElevenLabs용)
function detectLanguage(labels) {
  if (!labels) return 'multilingual';
  
  const accent = labels.accent?.toLowerCase() || '';
  const description = labels.description?.toLowerCase() || '';
  
  if (accent.includes('korean') || description.includes('korean')) {
    return 'ko-KR';
  }
  
  return 'multilingual';
}

// 목소리 이름을 사용자 친화적으로 포맷
function formatVoiceName(voiceName) {
  // 예: ko-KR-Wavenet-A -> 한국어 (Wavenet A)
  // 예: ko-KR-Neural2-B -> 한국어 (Neural2 B)
  const parts = voiceName.split('-');
  if (parts.length >= 4) {
    const type = parts[2]; // Wavenet, Neural2, Standard
    const variant = parts[3]; // A, B, C, etc.
    const genderMap = {
      'A': '여성', 'B': '남성', 'C': '여성', 'D': '남성', 
      'E': '여성', 'F': '남성'
    };
    const gender = genderMap[variant] || variant;
    return `한국어 ${gender} (${type} ${variant})`;
  }
  return voiceName;
}
