// src/utils/scenes.js
// -----------------------------------------------------------------------------
// 씬 관련 유틸(기본값, 텍스트 블롭, 점유 여부)
// -----------------------------------------------------------------------------
export function ensureSceneDefaults(sc) {
  if (!sc) return sc;
  return {
    fit: "cover",
    kenBurns: false,
    transition: "none",
    ...sc,
    asset: {
      type: sc?.asset?.type || null,
      path: sc?.asset?.path || null,
      ...sc?.asset,
    },
  };
}

export const sceneTextBlob = (sc) => {
  const list = [];
  if (Array.isArray(sc?.keywords)) list.push(sc.keywords.join(" "));
  if (sc?.text) list.push(sc.text);
  if (sc?.title) list.push(sc.title);
  if (sc?.hint) list.push(sc.hint);
  return list.join(" ").toLowerCase();
};

export const isOccupied = (sc) => !!sc?.asset?.path;
