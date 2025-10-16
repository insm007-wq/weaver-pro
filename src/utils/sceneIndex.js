// src/utils/sceneIndex.js
// 선택 인덱스가 범위 바깥이면 안전하게 보정하는 유틸

export function clampSelectedIndex(scenes, idx) {
  const n = Array.isArray(scenes) ? scenes.length : 0;
  if (n <= 0) return 0;
  if (!Number.isFinite(idx)) return 0;
  if (idx < 0) return 0;
  if (idx >= n) return n - 1;
  return idx;
}
