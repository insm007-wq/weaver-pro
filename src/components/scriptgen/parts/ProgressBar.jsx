// ./parts/ProgressBar.jsx
export function ProgressBar({
  current,
  total,
  etaSec,
  phase,
  elapsedSec,
  status,
}) {
  const pct =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const right = labelRight({ etaSec, phase, status, determinate: true });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">
          {phase ? phase : ""}
          {typeof elapsedSec === "number" ? ` · ${elapsedSec}s` : ""}
          {total > 0 ? ` · ${current}/${total}` : ""}
        </span>
        <span className="text-[11px] text-slate-500">{right}</span>
      </div>

      <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
        <div
          className="h-2 bg-blue-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function IndeterminateBar({ etaSec, phase, elapsedSec, status }) {
  const right = labelRight({ etaSec, phase, status, determinate: false });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">
          {phase ? phase : ""}
          {typeof elapsedSec === "number" ? ` · ${elapsedSec}s` : ""}
        </span>
        <span className="text-[11px] text-slate-500">{right}</span>
      </div>

      <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
        <div
          className={`h-2 ${
            status === "done" ? "" : "animate-pulse"
          } bg-blue-500`}
          style={{ width: status === "done" ? "100%" : "40%" }}
        />
      </div>
    </div>
  );
}

// ============== 우측 라벨 계산 ==============
function labelRight({ etaSec, phase, status, determinate }) {
  if (status === "done") return "완료";

  if (typeof etaSec === "number") {
    if (etaSec > 0) return `남음 ${formatEta(etaSec)}`;
    // 0초는 숨기고 단계별 문구로
    return phaseFallback(phase, determinate);
  }

  // ETA 계산 불가(null) → 단계별 문구
  return phaseFallback(phase, determinate);
}

function phaseFallback(phase, determinate) {
  // determinate/indeterminate 모두 공통적인 친숙한 문구
  if (phase === "MERGE") return "마무리 중…";
  if (phase === "SRT") return "자막 생성 중…";
  if (phase === "SCRIPT") return "대본 생성 중…";
  return determinate ? "처리 중…" : "예상 시간 계산 중…";
}

// ============== 유틸 ==============
export function formatEta(sec) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}초`;
  if (r === 0) return `${m}분`;
  return `${m}분 ${r}초`;
}
