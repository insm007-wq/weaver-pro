export default function ProgressDonut({ percent = 0 }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const angle = clamped * 3.6;
  const style = {
    background: `conic-gradient(rgb(79 70 229) ${angle}deg, #EEF2FF 0deg)`,
  };
  return (
    <div
      className="w-40 h-40 rounded-full grid place-items-center"
      style={style}
    >
      <div className="w-36 h-36 rounded-full bg-white grid place-items-center shadow-inner">
        <div className="text-2xl font-semibold text-slate-800">{clamped}%</div>
      </div>
    </div>
  );
}
