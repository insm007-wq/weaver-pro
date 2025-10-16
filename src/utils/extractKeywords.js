// 간단한 한국어/영어 키워드 추출기 (fallback 용)
// - 아주 가벼운 빈도 기반. 불용어/숫자/짧은 토큰 제거 후 상위 topK 반환
// - 대본이 길어도 빠르게 작동
const KO_STOP = new Set([
  "그리고",
  "그러나",
  "하지만",
  "또한",
  "그래서",
  "그런데",
  "때문에",
  "대한",
  "그것",
  "이것",
  "저것",
  "이런",
  "저런",
  "우리",
  "너희",
  "여러분",
  "정도",
  "사실",
  "먼저",
  "먼저는",
  "혹은",
  "또는",
  "하며",
  "하면서",
  "부터",
  "까지",
  "처럼",
  "같은",
  "등",
  "및",
  "더",
  "모두",
  "각",
  "매우",
  "아주",
  "가장",
  "듯",
  "수",
  "것",
  "거",
  "좀",
  "좀더",
  "좀더는",
  "요",
  "네",
  "음",
  "어",
  "에",
  "은",
  "는",
  "이",
  "가",
  "를",
  "을",
  "의",
  "로",
  "으로",
  "와",
  "과",
  "에의해",
  "안",
  "밖",
  "또",
  "또한",
  "그래도",
  "이번",
  "이번에",
  "다음",
  "최근",
  "오늘",
  "내일",
  "어제",
]);
const EN_STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "so",
  "because",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "as",
  "from",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "do",
  "does",
  "did",
  "have",
  "has",
  "had",
  "you",
  "we",
  "they",
  "he",
  "she",
  "i",
  "my",
  "our",
  "your",
  "their",
  "them",
  "his",
  "her",
  "there",
  "here",
  "then",
  "than",
  "very",
  "more",
  "most",
  "also",
  "just",
]);

export function extractKeywords(text, { topK = 60, minLen = 2 } = {}) {
  const t = String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!t) return [];

  const counts = new Map();
  for (const raw of t.split(" ")) {
    const w = raw.trim();
    if (!w) continue;
    if (/^\d+$/.test(w)) continue; // 숫자만
    if (w.length < minLen) continue;

    // 불용어 체크(한/영)
    const lower = w.toLowerCase();
    if (KO_STOP.has(w) || EN_STOP.has(lower)) continue;

    counts.set(w, (counts.get(w) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([w]) => w);
}

export default { extractKeywords };
