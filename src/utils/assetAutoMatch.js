// src/utils/assetAutoMatch.js
// 씬 배열과 에셋, 옵션을 받아 '배치된 새로운 씬 배열'을 돌려줌(순수 함수)

function includesText(haystack, needle) {
  if (!haystack || !needle) return false;
  return String(haystack).includes(String(needle));
}

/**
 * @param {Array} scenes - [{ text, assetId, ... }]
 * @param {Array} assets - [{ id, tags?: string[] }, ...]
 * @param {Object} opts
 *  - emptyOnly: 빈 칸만 채울지
 *  - byKeywords: 태그 키워드 매칭
 *  - byOrder: 순서대로 채우기
 *  - overwrite: 기존 배치 덮어쓰기
 * @returns {Array} newScenes
 */
export function autoAssignAssets(scenes, assets, opts = {}) {
  const { emptyOnly = true, byKeywords = true, byOrder = true, overwrite = false } = opts;

  if (!Array.isArray(scenes) || !scenes.length) return scenes;
  if (!Array.isArray(assets) || !assets.length) return scenes;

  const next = scenes.map((s) => ({ ...s }));
  const used = new Set(next.map((s) => s.assetId).filter(Boolean));

  const emptyIdxs = next
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => (emptyOnly ? !s.assetId : true))
    .map(({ i }) => i);

  if (!emptyIdxs.length) return next;

  const candidates = assets.filter((a) => !used.has(a.id));
  if (!candidates.length) return next;

  // 1) 키워드 매칭
  if (byKeywords) {
    for (const i of emptyIdxs) {
      const sc = next[i];
      if (sc.assetId && !overwrite) continue;
      const hit = candidates.find((a) => Array.isArray(a.tags) && a.tags.some((t) => includesText(sc.text, t)));
      if (hit) {
        sc.assetId = hit.id;
        used.add(hit.id);
      }
    }
  }

  // 2) 순차 배치
  if (byOrder) {
    for (const i of emptyIdxs) {
      const sc = next[i];
      if (sc.assetId && !overwrite) continue;
      const hit = candidates.find((a) => !used.has(a.id));
      if (!hit) break;
      sc.assetId = hit.id;
      used.add(hit.id);
    }
  }

  return next;
}
