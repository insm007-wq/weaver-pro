// src/utils/extract.js
// 자유 서술형 텍스트에서 분량/씬수 추출

export function extractDurationMinFromText(s) {
  const t = String(s || "");
  const m1 = t.match(/(\d+(?:\.\d+)?)\s*분/);
  const m2 = t.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/i);
  const v = m1 ? parseFloat(m1[1]) : m2 ? parseFloat(m2[1]) : NaN;
  if (!Number.isFinite(v)) return null;
  return Math.max(1, Math.round(v));
}

export function extractMaxScenesFromText(s) {
  const t = String(s || "");
  const m =
    t.match(/최대\s*장면\s*수\s*[:=]?\s*(\d+)/) ||
    t.match(/최대\s*장면수\s*[:=]?\s*(\d+)/) ||
    t.match(/max\s*scenes?\s*[:=]?\s*(\d+)/i);
  const v = m ? parseInt(m[1], 10) : NaN;
  if (!Number.isFinite(v)) return null;
  return Math.max(1, v);
}
