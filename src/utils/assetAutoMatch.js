// src/utils/assetAutoMatch.js
// 씬 배열과 에셋, 옵션을 받아 '배치된 새로운 씬 배열'을 돌려줌(순수 함수)

function getAssetKey(a) {
  // 에셋을 고유하게 식별할 수 있는 키
  return a?.id ?? a?.path ?? a?.fileName ?? a?.name ?? null;
}

function norm(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, " ") // 문자/숫자/공백/언더/하이픈 외 제거
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  const n = norm(s);
  if (!n) return [];
  // 공백/하이픈/언더스코어 기준 토큰화
  const toks = n.split(/[\s_-]+/g).filter((t) => t.length >= 2);
  // 중복 제거
  return Array.from(new Set(toks));
}

function toTagTokens(a) {
  // tags(Array|string) + name/title/fileName 등에서 토큰 추출
  const bag = [];
  if (Array.isArray(a?.tags)) bag.push(...a.tags.map((t) => String(t)));
  else if (typeof a?.tags === "string") bag.push(a.tags);

  if (a?.name) bag.push(a.name);
  if (a?.title) bag.push(a.title);
  if (a?.fileName) bag.push(a.fileName);

  // 흔한 접두어/기호(#tag 형태) 정리
  const tokens = bag.flatMap((v) => tokenize(String(v).replace(/^#/, ""))).filter(Boolean);

  return Array.from(new Set(tokens));
}

function sceneTokens(scene) {
  // 씬 텍스트 토큰화
  return tokenize(scene?.text ?? "");
}

function scoreIntersection(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const setB = new Set(bTokens);
  let score = 0;
  for (const t of aTokens) if (setB.has(t)) score++;
  return score;
}

/**
 * @param {Array} scenes - [{ text, assetId, ... }]
 * @param {Array} assets - [{ id|path|fileName, tags?: string[], name?, title? }, ...]
 * @param {Object} opts
 *  - emptyOnly: 빈 칸만 채울지 (default: true)
 *  - byKeywords: 태그 키워드 매칭 (default: true)
 *  - byOrder: 순서대로 채우기 (default: true)
 *  - overwrite: 기존 배치 덮어쓰기 (default: false)
 * @returns {Array} newScenes
 */
export function autoAssignAssets(scenes, assets, opts = {}) {
  const { emptyOnly = true, byKeywords = true, byOrder = true, overwrite = false } = opts;

  if (!Array.isArray(scenes) || !scenes.length) return scenes ?? [];
  if (!Array.isArray(assets) || !assets.length) return scenes;

  // 사본 생성
  const next = scenes.map((s) => ({ ...s }));

  // 현재 이미 배치된 에셋들 (덮어쓰지 않는 경우 재사용 금지)
  const used = new Set(next.map((s) => (s.assetId ? String(s.assetId) : null)).filter(Boolean));

  // 채울 대상 인덱스 수집
  const targetIdxs = next
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (emptyOnly ? !s.assetId : true))
    .map(({ i }) => i);

  if (!targetIdxs.length) return next;

  // 후보 에셋(아직 사용되지 않은 것 위주)
  const candidates = assets
    .map((a) => ({ raw: a, key: getAssetKey(a) }))
    .filter((x) => x.key) // 키 없는 에셋 제외
    .filter((x) => !used.has(String(x.key)));

  if (!candidates.length) return next;

  // 에셋 토큰 캐시
  const assetTokenCache = new Map(); // key -> tokens
  const getAssetTokens = (key, raw) => {
    if (!assetTokenCache.has(key)) {
      assetTokenCache.set(key, toTagTokens(raw));
    }
    return assetTokenCache.get(key);
  };

  // 1) 키워드 기반 매칭
  if (byKeywords) {
    for (const i of targetIdxs) {
      const sc = next[i];
      if (sc.assetId && !overwrite) continue;

      const sTokens = sceneTokens(sc);
      if (!sTokens.length) continue;

      let best = null; // { key, raw, score }
      for (const c of candidates) {
        if (used.has(String(c.key))) continue; // 이미 사용된 후보 제외(중복 배치 방지)
        const aTokens = getAssetTokens(c.key, c.raw);
        const score = scoreIntersection(sTokens, aTokens);
        if (score > 0 && (!best || score > best.score)) {
          best = { key: c.key, raw: c.raw, score };
          if (score >= 3) break; // 충분히 높은 매치면 조기 종료(가벼운 최적화)
        }
      }

      if (best) {
        sc.assetId = best.key;
        used.add(String(best.key));
      }
    }
  }

  // 2) 순차 배치 (남은 씬 메꿈)
  if (byOrder) {
    for (const i of targetIdxs) {
      const sc = next[i];
      if (sc.assetId && !overwrite) continue;

      const hit = candidates.find((c) => !used.has(String(c.key)));
      if (!hit) break;

      sc.assetId = hit.key;
      used.add(String(hit.key));
    }
  }

  return next;
}

export default autoAssignAssets;
