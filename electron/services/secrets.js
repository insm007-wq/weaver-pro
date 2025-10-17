// electron/services/secrets.js
const keytar = require("keytar");
const SERVICE = "ContentWeaverPro";

const getSecret = (key) => keytar.getPassword(SERVICE, key);
const setSecret = (key, value) => keytar.setPassword(SERVICE, key, value || "");

/**
 * 기본 API 키 설정 (첫 실행 시 자동 설정)
 * electron/config.js에서 기본값을 가져와서 keytar에 없으면 자동으로 설정
 */
async function initializeDefaultKeys() {
  let config = {};

  // config.js 파일 로드 시도
  try {
    config = require("../config.js");
  } catch (error) {
    console.warn("⚠️ config.js 파일을 찾을 수 없습니다. 기본 API 키가 설정되지 않습니다.");
    return;
  }

  const defaults = {
    anthropicKey: config.DEFAULT_ANTHROPIC_KEY,
    replicateKey: config.DEFAULT_REPLICATE_KEY,
    pexelsApiKey: config.DEFAULT_PEXELS_KEY,
    pixabayApiKey: config.DEFAULT_PIXABAY_KEY,
    googleTtsApiKey: config.DEFAULT_GOOGLE_TTS_KEY,
  };

  for (const [key, defaultValue] of Object.entries(defaults)) {
    // 기본값이 설정되어 있고, 아직 keytar에 저장되지 않은 경우에만 설정
    if (defaultValue && defaultValue !== "your-default-key-here") {
      try {
        const existing = await getSecret(key);
        if (!existing) {
          await setSecret(key, defaultValue);
          console.warn(`✅ ${key} 기본값 자동 설정 완료`);
        }
      } catch (error) {
        console.error(`❌ ${key} 기본값 설정 실패:`, error);
      }
    }
  }
}

module.exports = { SERVICE, getSecret, setSecret, initializeDefaultKeys };
