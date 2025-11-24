// electron/services/secrets.js
const keytar = require("keytar");
const { decrypt } = require("../utils/encryption");
const SERVICE = "ContentWeaverPro";

const getSecret = (key) => keytar.getPassword(SERVICE, key);
const setSecret = (key, value) => {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    console.warn(`⚠️ setSecret: ${key}에 빈 값을 설정하려고 합니다`);
    return Promise.resolve();
  }
  return keytar.setPassword(SERVICE, key, value);
};

/**
 * API 키가 유효한지 검증
 * @param {string} key - 검증할 키
 * @returns {boolean} 유효 여부
 */
function isValidKey(key) {
  if (!key || typeof key !== 'string') return false;
  if (key.trim() === '') return false;
  if (key.includes('your-default-key-here') || key.includes('your-')) return false;
  return true;
}

/**
 * 기본 API 키 설정 (첫 실행 시 자동 설정)
 *
 * 우선순위:
 * 1. 배포판 암호화 키 (electron/encrypted-keys.js) - 암호화되어 복호화됨
 * 2. 개발용 config.js - 로컬 개발 환경용
 *
 * 기존 키가 있어도 유효하지 않으면 덮어씀 (Windows 환경 호환성)
 */
async function initializeDefaultKeys() {
  const defaults = {};
  const results = { success: true, initialized: [], failed: [] };

  // 1단계: 배포판 암호화 키 시도
  try {
    const encryptedKeys = require("../encrypted-keys.js");
    if (encryptedKeys && Object.keys(encryptedKeys).length > 0) {
      // 암호화된 키들을 복호화
      const anthropicDecrypted = decrypt(encryptedKeys.anthropic);
      const replicateDecrypted = decrypt(encryptedKeys.replicate);
      const pexelsDecrypted = decrypt(encryptedKeys.pexels);
      const pixabayDecrypted = decrypt(encryptedKeys.pixabay);
      const googleTtsDecrypted = decrypt(encryptedKeys.googleTts);

      // 복호화 결과 검증 (null이 아니고 유효한 경우만)
      if (isValidKey(anthropicDecrypted)) defaults.anthropicKey = anthropicDecrypted;
      if (isValidKey(replicateDecrypted)) defaults.replicateKey = replicateDecrypted;
      if (isValidKey(pexelsDecrypted)) defaults.pexelsApiKey = pexelsDecrypted;
      if (isValidKey(pixabayDecrypted)) defaults.pixabayApiKey = pixabayDecrypted;
      if (isValidKey(googleTtsDecrypted)) defaults.googleTtsApiKey = googleTtsDecrypted;

      const loadedCount = Object.keys(defaults).length;
      if (loadedCount > 0) {
        console.log(`[secrets] 암호화된 기본 API 키 로드 완료 (${loadedCount}개)`);
      } else {
        console.warn("[secrets] 암호화된 키들이 모두 유효하지 않습니다");
      }
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

  // 3단계: keytar에 저장 (강제 덮어쓰기 포함)
  const keyMap = {
    anthropicKey: "anthropicKey",
    replicateKey: "replicateKey",
    pexelsApiKey: "pexelsApiKey",
    pixabayApiKey: "pixabayApiKey",
    googleTtsApiKey: "googleTtsApiKey",
  };

  for (const [configKey, keystoreName] of Object.entries(keyMap)) {
    const defaultValue = defaults[configKey];

    // 기본값이 유효한지 확인
    if (!isValidKey(defaultValue)) {
      console.log(`⏭️ ${keystoreName}: 유효한 기본값이 없습니다`);
      results.failed.push(keystoreName);
      continue;
    }

    try {
      const existing = await getSecret(keystoreName);
      const isExistingValid = isValidKey(existing);

      if (!isExistingValid) {
        // 기존 키가 없거나 유효하지 않으므로 새로 설정
        await setSecret(keystoreName, defaultValue);

        // 검증: 설정된 키가 올바르게 저장되었는지 확인
        const verification = await getSecret(keystoreName);
        if (isValidKey(verification) && verification === defaultValue) {
          console.log(`✅ ${keystoreName} 설정 및 검증 완료`);
          results.initialized.push(keystoreName);
        } else {
          console.error(`❌ ${keystoreName} 검증 실패 (저장되었지만 읽기 불일치)`);
          results.failed.push(keystoreName);
          results.success = false;

          // 재시도
          try {
            await setSecret(keystoreName, defaultValue);
            const retry = await getSecret(keystoreName);
            if (isValidKey(retry) && retry === defaultValue) {
              console.log(`✅ ${keystoreName} 재설정 성공`);
              results.initialized.pop(); // failed에서 제거
              results.initialized.push(keystoreName);
              results.success = true;
            }
          } catch (retryError) {
            console.error(`❌ ${keystoreName} 재설정 실패:`, retryError);
          }
        }
      } else {
        // 기존 키가 유효하므로 스킵
        console.log(`ℹ️ ${keystoreName}: 유효한 기존 키 사용`);
        results.initialized.push(keystoreName);
      }
    } catch (error) {
      console.error(`❌ ${keystoreName} 설정 중 오류:`, error.message);
      results.failed.push(keystoreName);
      results.success = false;

      // 에러 복구: 손상된 항목 삭제 후 재설정 시도
      try {
        console.log(`🔄 ${keystoreName} 손상된 항목 삭제 후 재설정 시도...`);
        await keytar.deletePassword(SERVICE, keystoreName);
        await setSecret(keystoreName, defaultValue);

        const recovery = await getSecret(keystoreName);
        if (isValidKey(recovery) && recovery === defaultValue) {
          console.log(`✅ ${keystoreName} 복구 성공`);
          results.failed.pop();
          results.initialized.push(keystoreName);
        }
      } catch (recoveryError) {
        console.error(`❌ ${keystoreName} 복구 실패:`, recoveryError.message);
      }
    }
  }

  // 결과 로그 (강조 표시)
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 [SECRETS] API 키 초기화 완료`);
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ 설정된 키: ${results.initialized.length}개 (${results.initialized.join(', ') || 'N/A'})`);
  console.log(`❌ 실패한 키: ${results.failed.length}개 ${results.failed.length > 0 ? '(' + results.failed.join(', ') + ')' : ''}`);
  console.log(`📈 전체 성공 여부: ${results.success ? '✅ 성공' : '⚠️ 부분실패'}`);
  console.log(`${'='.repeat(50)}\n`);

  // 초기화 상태 저장 (재설치/업그레이드 추적용)
  try {
    const store = require('./store');
    const appVersion = require('../../package.json').version;

    if (results.success || results.initialized.length > 0) {
      store.set('keysInitialized', true);
      store.set('keysInitializedVersion', appVersion);
      store.set('keysInitializedAt', new Date().toISOString());
      console.log(`[secrets] 초기화 상태 저장: v${appVersion}`);
    }
  } catch (storeError) {
    console.warn('[secrets] 초기화 상태 저장 실패:', storeError.message);
  }

  return results;
}

module.exports = { SERVICE, getSecret, setSecret, initializeDefaultKeys };
