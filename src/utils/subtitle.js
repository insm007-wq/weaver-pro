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

/** 고정 글자 수로 하드랩(공백/단어경계 고려 X, 단순 슬라이스) */
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

/**
 * 씬 → 자막 큐 (표시 모드 지원)
 * mode: "twoLine" | "sentence"
 *  - twoLine: 항상 2줄 이하가 되도록 문장을 묶거나 나눔
 *  - sentence: 문장 단위로 그대로(길면 3줄 이상도 가능; 줄바꿈은 CSS에 맡김)
 */
export function splitSceneToCuesByMode(scene, mode = "twoLine", opts = {}) {
  const start = Number(scene?.start) || 0;
  const end = Number(scene?.end) || 0;
  const dur = Math.max(0, end - start);
  const text = String(scene?.text || "").trim();
  if (!dur || !text) return [];

  const MIN_SEG_SEC = Number(opts.minSegSec ?? 0.6);
  const MAX_LINE_CHARS = Number(opts.maxLineChars ?? 38);
  const MAX_TWO_LINES = MAX_LINE_CHARS * 2;

  // 1) 문장 분해
  let parts = [];
  const m = text.match(SENTENCE_RE);
  parts = m && m.length ? m.map((s) => s.trim()).filter(Boolean) : [text];

  if (mode === "sentence") {
    // 문장 단위 그대로 시간을 길이 비례로 분배
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

  // mode === "twoLine"
  // 2) 먼저 각 문장을 '2줄 길이' 단위로 쪼개서 아톰 배열 구성
  const atoms = [];
  for (const p of parts) {
    const c = charCountKo(p);
    if (c <= MAX_TWO_LINES) atoms.push(p);
    else atoms.push(...hardWrapByChars(p, MAX_TWO_LINES));
  }

  // 3) 아톰을 이어붙여 '항상 2줄 이하' 그룹으로 합치기
  const groups = [];
  let buf = "";
  let count = 0;
  for (const a of atoms) {
    const cc = charCountKo(a);
    const needsSpace = buf ? 1 : 0; // 공백 1칸
    if (count + needsSpace + cc <= MAX_TWO_LINES) {
      buf += (buf ? " " : "") + a;
      count += needsSpace + cc;
    } else {
      if (buf) groups.push(buf);
      buf = a;
      count = cc;
    }
  }
  if (buf) groups.push(buf);

  // 4) 그룹 길이 비례로 시간 배분(최소 길이 보장 + 전체 합 보정)
  const counts = groups.map(charCountKo);
  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  let alloc = counts.map((n) => Math.max(MIN_SEG_SEC, (dur * n) / sum));
  const total = alloc.reduce((a, b) => a + b, 0);
  const scale = total ? dur / total : 1;
  alloc = alloc.map((x) => x * scale);

  const cues = [];
  let t = start;
  for (let i = 0; i < groups.length; i++) {
    const st = t;
    const en = i === groups.length - 1 ? end : t + alloc[i];
    cues.push({ start: st, end: en, text: groups[i] });
    t = en;
  }
  return cues;
}

/**
 * 기존 API 유지: 씬 → 자막 큐
 * (이제 기본적으로 '2줄 이하(twoLine)' 모드로 동작)
 */
export function splitSceneToCues(scene, opts = {}) {
  return splitSceneToCuesByMode(scene, "twoLine", opts);
}
