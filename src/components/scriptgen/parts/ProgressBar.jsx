export function ProgressBar({ current, total }) {
  const pct =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
      <div
        className="h-2 bg-blue-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
export function IndeterminateBar() {
  return (
    <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
      <div className="h-2 bg-blue-500 animate-pulse" style={{ width: "40%" }} />
    </div>
  );
}
