import { secToTime } from "../utils/metrics";

export default function TimelineBar({
  duration,
  scenes,
  currentTime,
  onSeek,
  onNudge,
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="w-full">
      {/* 눈금/배경 */}
      <div className="relative h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
        {/* 씬 블록 */}
        {scenes.map((s, i) => {
          const left = (s.start / duration) * 100;
          const width = ((s.end - s.start) / duration) * 100;
          return (
            <div
              key={s.id}
              className="absolute top-0 bottom-0 bg-indigo-200/50 border-r border-white"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`#${i + 1} ${secToTime(s.start, true)} ~ ${secToTime(
                s.end,
                true
              )}`}
            />
          );
        })}
        {/* 플레이헤드 */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-indigo-600"
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* 컨트롤 */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <div>0s</div>
        <div>{secToTime(duration, true)}</div>
      </div>

      <div className="mt-2 flex gap-2">
        <button
          className="h-8 px-3 rounded-lg border border-slate-300 hover:bg-slate-50"
          onClick={() => onNudge(-0.1)}
        >
          -0.1s
        </button>
        <button
          className="h-8 px-3 rounded-lg border border-slate-300 hover:bg-slate-50"
          onClick={() => onNudge(0.1)}
        >
          +0.1s
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.round(duration * 10))}
          value={Math.round(currentTime * 10)}
          onChange={(e) => onSeek(Number(e.target.value) / 10)}
          className="flex-1"
        />
      </div>
    </div>
  );
}
