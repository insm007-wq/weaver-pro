#!/usr/bin/env node

/**
 * scripts/encrypt-keys.js
 *
 * .env 파일에서 API 키를 읽어서 암호화하고
 * electron/encrypted-keys.js로 저장합니다.
 *
 * 빌드 전에 자동으로 실행됩니다.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// 암호화 설정 (electron/utils/encryption.js와 동일)
const ENCRYPTION_KEY = 'weaver-pro-v1-key-2024';
const ENCRYPTION_IV = 'weaver-pro-v1-iv';

/**
 * 문자열을 AES-256-CBC로 암호화
 */
function encrypt(text) {
  if (!text) return '';

  const hash = crypto.createHash('sha256');
  hash.update(ENCRYPTION_KEY);
  const key = hash.digest();

  const iv = Buffer.from(ENCRYPTION_IV.padEnd(16, '0').slice(0, 16));
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted;
}

// .env에서 API 키 읽기
const keys = {
  anthropic: process.env.DEFAULT_ANTHROPIC_KEY || '',
  replicate: process.env.DEFAULT_REPLICATE_KEY || '',
  pexels: process.env.DEFAULT_PEXELS_KEY || '',
  pixabay: process.env.DEFAULT_PIXABAY_KEY || '',
  googleTts: process.env.DEFAULT_GOOGLE_TTS_KEY || '',
};

// 유효한 키 필터링 (기본값이 아닌 것들만)
const validKeys = {};
let keyCount = 0;

for (const [name, value] of Object.entries(keys)) {
  if (value && value !== `your-default-key-here` && !value.includes('your-')) {
    validKeys[name] = encrypt(value);
    keyCount++;
    console.log(`✅ ${name} 키 암호화 완료`);
  } else {
    console.log(`⚠️ ${name} 키가 설정되지 않았습니다 (기본값 또는 미설정)`);
  }
}

// 암호화된 키를 저장할 파일 경로
const outputPath = path.join(__dirname, '..', 'electron', 'encrypted-keys.js');

// 생성할 코드
const outputCode = `// electron/encrypted-keys.js
// ⚠️ 자동 생성된 파일입니다. 직접 수정하지 마세요.
// scripts/encrypt-keys.js 스크립트로 생성됩니다.

/**
 * 암호화된 API 키들
 * 앱 시작 시 복호화되어 keytar에 저장됩니다.
 */
const ENCRYPTED_KEYS = {
  anthropic: '${validKeys.anthropic || ''}',
  replicate: '${validKeys.replicate || ''}',
  pexels: '${validKeys.pexels || ''}',
  pixabay: '${validKeys.pixabay || ''}',
  googleTts: '${validKeys.googleTts || ''}',
};

module.exports = ENCRYPTED_KEYS;
`;

try {
  fs.writeFileSync(outputPath, outputCode, 'utf8');
  console.log(`\n✅ 암호화 완료!`);
  console.log(`   저장 위치: electron/encrypted-keys.js`);
  console.log(`   암호화된 키 개수: ${keyCount}개`);

  if (keyCount === 0) {
    console.log(`\n⚠️ 주의: 암호화된 키가 없습니다!`);
    console.log(`   .env 파일에서 API 키를 설정해주세요.`);
  }
} catch (error) {
  console.error(`❌ 파일 저장 실패:`, error.message);
  process.exit(1);
}
