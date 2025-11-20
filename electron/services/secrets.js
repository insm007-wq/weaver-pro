// electron/services/secrets.js
const keytar = require("keytar");
const { decrypt } = require("../utils/encryption");
const SERVICE = "ContentWeaverPro";

const getSecret = (key) => keytar.getPassword(SERVICE, key);
const setSecret = (key, value) => keytar.setPassword(SERVICE, key, value || "");

/**
 * 기본 API 키 설정 (첫 실행 시 자동 설정)
 *
 * 우선순위:
 * 1. 배포판 암호화 키 (electron/encrypted-keys.js) - 암호화되어 복호화됨
 * 2. 개발용 config.js - 로컬 개발 환경용
 */
async function initializeDefaultKeys() {
  const defaults = {};

  // 1단계: 배포판 암호화 키 시도
  try {
    const encryptedKeys = require("../encrypted-keys.js");
    if (encryptedKeys && Object.keys(encryptedKeys).length > 0) {
      // 암호화된 키들을 복호화
      defaults.anthropicKey = decrypt(encryptedKeys.anthropic);
      defaults.replicateKey = decrypt(encryptedKeys.replicate);
      defaults.pexelsApiKey = decrypt(encryptedKeys.pexels);
      defaults.pixabayApiKey = decrypt(encryptedKeys.pixabay);
      defaults.googleTtsApiKey = decrypt(encryptedKeys.googleTts);

      console.log("[secrets] 암호화된 기본 API 키 로드 완료");
    }
  } catch (error) {
    console.warn("[secrets] 암호화된 키 파일을 찾을 수 없습니다. config.js 시도...");
  }

  // 2단계: 개발용 config.js 시도 (폴백)
  try {
    const config = require("../config.js");
    if (config) {
      // config.js의 기본값이 있으면 그것을 사용 (개발 환경)
      if (config.DEFAULT_ANTHROPIC_KEY && !defaults.anthropicKey) {
        defaults.anthropicKey = config.DEFAULT_ANTHROPIC_KEY;
      }
      if (config.DEFAULT_REPLICATE_KEY && !defaults.replicateKey) {
        defaults.replicateKey = config.DEFAULT_REPLICATE_KEY;
      }
      if (config.DEFAULT_PEXELS_KEY && !defaults.pexelsApiKey) {
        defaults.pexelsApiKey = config.DEFAULT_PEXELS_KEY;
      }
      if (config.DEFAULT_PIXABAY_KEY && !defaults.pixabayApiKey) {
        defaults.pixabayApiKey = config.DEFAULT_PIXABAY_KEY;
      }
      if (config.DEFAULT_GOOGLE_TTS_KEY && !defaults.googleTtsApiKey) {
        defaults.googleTtsApiKey = config.DEFAULT_GOOGLE_TTS_KEY;
      }
    }
  } catch (error) {
    console.warn("[secrets] config.js 파일을 찾을 수 없습니다.");
  }

  // 3단계: keytar에 저장 (첫 실행 시만)
  const keyMap = {
    anthropicKey: "anthropicKey",
    replicateKey: "replicateKey",
    pexelsApiKey: "pexelsApiKey",
    pixabayApiKey: "pixabayApiKey",
    googleTtsApiKey: "googleTtsApiKey",
  };

  for (const [configKey, keystoreName] of Object.entries(keyMap)) {
    const defaultValue = defaults[configKey];
    if (defaultValue && defaultValue !== "your-default-key-here" && !defaultValue.includes("your-")) {
      try {
        const existing = await getSecret(keystoreName);
        if (!existing) {
          await setSecret(keystoreName, defaultValue);
          console.log(`✅ ${keystoreName} 기본값 자동 설정 완료`);
        }
      } catch (error) {
        console.error(`❌ ${keystoreName} 기본값 설정 실패:`, error);
      }
    }
  }
}

module.exports = { SERVICE, getSecret, setSecret, initializeDefaultKeys };
