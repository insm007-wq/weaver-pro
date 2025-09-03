// src/utils/safeChars.js
// 공백 포함 글자수(한글 결합문자 안전) 계산 유틸

/** 내부 정규화: CRLF → LF, Zero-Width 제거, NFC 정규화 */
export function normalizeForCount(s) {
  let t = String(s ?? "");
  try {
    t = t.normalize("NFC");
  } catch {}
  return t.replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

/** 공백 포함 글자수(유니코드 code point 기준) */
export function safeCharCount(s) {
  return Array.from(normalizeForCount(s)).length;
}
