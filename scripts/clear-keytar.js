#!/usr/bin/env node

/**
 * scripts/clear-keytar.js
 *
 * keytar에 저장된 모든 ContentWeaverPro 자격증명을 삭제합니다.
 * 테스트 환경 초기화용
 */

const keytar = require('keytar');

const SERVICE = 'ContentWeaverPro';
const keys = [
  'anthropicKey',
  'replicateKey',
  'pexelsApiKey',
  'pixabayApiKey',
  'googleTtsApiKey',
];

async function clearKeytar() {
  console.log(`🗑️ ${SERVICE} 자격증명 삭제 시작...\n`);

  for (const key of keys) {
    try {
      const password = await keytar.getPassword(SERVICE, key);
      if (password) {
        await keytar.deletePassword(SERVICE, key);
        console.log(`✅ ${key} 삭제됨`);
      } else {
        console.log(`⏭️ ${key} - 저장된 값 없음`);
      }
    } catch (error) {
      console.log(`⚠️ ${key} - 삭제 실패: ${error.message}`);
    }
  }

  console.log(`\n✨ keytar 초기화 완료!`);
  console.log(`이제 앱을 다시 실행하면 .env 또는 config.js의 키를 사용합니다.`);
}

clearKeytar().catch(error => {
  console.error('❌ 오류 발생:', error);
  process.exit(1);
});
