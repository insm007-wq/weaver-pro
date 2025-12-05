// electron/utils/encryption.js
const crypto = require('crypto');

// 고정된 암호화 키 (배포판에 하드코딩됨)
const ENCRYPTION_KEY = 'weaver-pro-v1-key-2024';
const ENCRYPTION_IV = 'weaver-pro-v1-iv';

/**
 * 문자열을 AES-256-CBC로 암호화
 * @param {string} text - 암호화할 텍스트
 * @returns {string} 암호화된 텍스트 (base64)
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

/**
 * 암호화된 문자열을 복호화
 * @param {string} encrypted - 암호화된 텍스트 (hex)
 * @returns {string|null} 복호화된 텍스트 또는 실패 시 null
 */
function decrypt(encrypted) {
  if (!encrypted) return null;

  try {
    const hash = crypto.createHash('sha256');
    hash.update(ENCRYPTION_KEY);
    const key = hash.digest();

    const iv = Buffer.from(ENCRYPTION_IV.padEnd(16, '0').slice(0, 16));
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    // 복호화 결과가 유효한지 검증
    if (!decrypted || decrypted.trim() === '') {
      console.error('❌ 복호화 결과가 비어있습니다');
      return null;
    }

    return decrypted;
  } catch (error) {
    console.error('❌ 복호화 실패:', error.message);
    return null;
  }
}

module.exports = { encrypt, decrypt };
