// src/utils/subtitle.js

/** 유틸: 정규화(한글 결합문자, 제로폭 문자 제거) */
export function normalizeForCount(s) {
  let t = String(s ?? "");
  try {
    t = t.normalize("NFC");
  } catch {}
  t = t.replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
  return t;
}

/** 유틸: 글자 수(한글 포함) */
export function charCountKo(s) {
  return Array.from(normalizeForCount(s)).length;
}

export const SENTENCE_RE = /([^.!?…]+[.!?…]+|\S+(?:\s+|$))/g;

export function hardWrapByChars(text, maxChars = 38) {
  const arr = [];
  let t = normalizeForCount(text).trim();
  while (t.length > maxChars) {
    arr.push(t.slice(0, maxChars));
    t = t.slice(maxChars);
  }
  if (t) arr.push(t);
  return arr;
}

/** 씬 → 자막 큐(문장 단위 → 길이 비례 시간 배분, 2줄 초과 시 하드랩) */
export function splitSceneToCues(scene, opts = {}) {
  const start = Number(scene.start) || 0;
  const end = Number(scene.end) || 0;
  const dur = Math.max(0, end - start);
  const text = String(scene.text || "").trim();
  if (!dur || !text) return [];

  const MIN_SEG_SEC = Number(opts.minSegSec ?? 0.6);
  const MAX_LINE_CHARS = Number(opts.maxLineChars ?? 38);

  let parts = [];
  const m = text.match(SENTENCE_RE);
  parts = m && m.length ? m.map((s) => s.trim()).filter(Boolean) : [text];

  // 2줄 넘으면 하드랩으로 강제 분할
  let refined = [];
  for (const p of parts) {
    if (charCountKo(p) > MAX_LINE_CHARS * 2) {
      refined = refined.concat(hardWrapByChars(p, MAX_LINE_CHARS));
    } else refined.push(p);
  }
  parts = refined.length ? refined : parts;

  const counts = parts.map(charCountKo);
  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  let alloc = counts.map((n) => Math.max(MIN_SEG_SEC, (dur * n) / sum));

  const total = alloc.reduce((a, b) => a + b, 0);
  const scale = total ? dur / total : 1;
  alloc = alloc.map((x) => x * scale);

  const cues = [];
  let t = start;
  for (let i = 0; i < parts.length; i++) {
    const st = t;
    const en = i === parts.length - 1 ? end : t + alloc[i];
    cues.push({ start: st, end: en, text: parts[i] });
    t = en;
  }
  return cues;
}
