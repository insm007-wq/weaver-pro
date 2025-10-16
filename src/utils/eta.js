// src/utils/eta.js
// 진행 단계별 ETA(초) 추정

export function estimateEtaSec({ phase, progress, elapsed, plan }) {
  const { current, total } = progress || {};

  // 결정형(progress.total>0): 실측 기반
  if (total > 0 && current > 0) {
    const per = elapsed / current; // sec per unit
    const eta = Math.round(per * (total - current));
    return eta > 0 ? eta : null; // 0초는 표기하지 않음
  }

  // 비결정형 휴리스틱
  if (phase === "SCRIPT") {
    const expect = Math.round(
      (plan?.durationMin || 0) * 5 + (plan?.maxScenes || 0) * 1
    );
    const eta = expect - elapsed;
    return eta > 0 ? eta : null;
  }
  if (phase === "SRT") {
    const expect = Math.min(15, Math.round(1 + (plan?.maxScenes || 0) * 0.2));
    const eta = expect - elapsed;
    return eta > 0 ? eta : null;
  }
  if (phase === "MERGE") {
    const expect = 3;
    const eta = expect - elapsed;
    return eta > 0 ? eta : null;
  }
  if (phase === "완료") return 0;

  return null;
}