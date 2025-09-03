// src/utils/charBudget.js
// 분량(문자수) 예산 계산

const CHAR_BUDGETS = {
  auto: { perMinMin: 300, perMinMax: 400 },
  perSceneFallback: { min: 500, max: 900 },
};

/**
 * @param {Object} args
 * @param {"auto"|"ref"} args.tab
 * @param {number} args.durationMin
 * @param {number} args.maxScenes
 */
export function computeCharBudget({ tab, durationMin, maxScenes }) {
  const duration = Number(durationMin) || 0;
  const scenes = Math.max(1, Number(maxScenes) || 1);
  const totalSeconds = duration * 60;

  if (tab === "auto") {
    const { perMinMin, perMinMax } = CHAR_BUDGETS.auto;
    const minCharacters = Math.max(0, Math.round(duration * perMinMin));
    const maxCharacters = Math.max(
      minCharacters,
      Math.round(duration * perMinMax)
    );
    const avgCharactersPerScene = Math.max(
      1,
      Math.round((minCharacters + maxCharacters) / 2 / scenes)
    );
    return {
      totalSeconds,
      minCharacters,
      maxCharacters,
      avgCharactersPerScene,
      cpmMin: perMinMin,
      cpmMax: perMinMax,
    };
  }

  const { min, max } = CHAR_BUDGETS.perSceneFallback;
  const minCharacters = scenes * min;
  const maxCharacters = scenes * max;
  const avgCharactersPerScene = Math.max(
    1,
    Math.round((minCharacters + maxCharacters) / 2 / scenes)
  );
  return { totalSeconds, minCharacters, maxCharacters, avgCharactersPerScene };
}
