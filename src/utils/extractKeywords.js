// src/utils/extractKeywords.js
const KO_STOP = new Set([
  "그리고",
  "그러나",
  "하지만",
  "또한",
  "그래서",
  "이것",
  "저것",
  "그것",
  "어떤",
  "하는",
  "하면",
  "하여",
  "에서",
  "으로",
  "에게",
  "까지",
  "부터",
  "보다",
  "같은",
  "또",
  "더",
  "수",
  "등",
  "들",
  "는",
  "은",
  "이",
  "가",
  "을",
  "를",
  "에",
  "도",
  "만",
  "요",
  "다",
  "의",
]);
const EN_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "if",
  "so",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "this",
  "that",
  "these",
  "those",
  "we",
  "you",
  "they",
]);

export function extractKeywords(
  text,
  { topK = 8, minLen = 2, extraStopwords = [] } = {}
) {
  if (!text) return [];
  const STOP = new Set([
    ...KO_STOP,
    ...EN_STOP,
    ...extraStopwords.map((s) => s.toLowerCase()),
  ]);
  const cleaned = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[()[\]{}"“”'‘’.,!?…:;~`^=+*|\\/<>#%$@_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(" ")
    .map((w) => w.toLowerCase())
    .filter((w) => w && w.length >= minLen && !STOP.has(w));
  const freq = new Map();
  for (const w of tokens) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([w]) => w);
}
