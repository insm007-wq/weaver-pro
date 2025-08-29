import { secToTime, timeToSec, calcCPS, calcCPL } from "../utils/metrics";

export default function SubtitleList({
  scenes,
  selectedIdx,
  onSelect,
  onChangeText,
  onChangeTime,
  onSplit,
  onMerge,
}) {
  return (
    <ol className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
      {scenes.map((s, i) => {
        const active = i === selectedIdx;
        const dur = Math.max(0.01, s.end - s.start);
        const cps = calcCPS(s.text, dur);
        const cpl = calcCPL(s.text);
        return (
          <li key={s.id}>
            <div
              className={`rounded-xl border p-3 transition ${
                active
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
              onClick={() => onSelect(i)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-between text-xs text-slate-600">
                <div className="font-semibold">
                  #{String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    {secToTime(s.start, true)} → {secToTime(s.end, true)}
                  </span>
                  <span className={`${cps > 17 ? "text-amber-600" : ""}`}>
                    CPS {cps.toFixed(1)}
                  </span>
                  <span className={`${cpl > 18 ? "text-amber-600" : ""}`}>
                    CPL {cpl}
                  </span>
                </div>
              </div>

              <textarea
                className="mt-2 w-full min-h-[64px] resize-y rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 p-2 text-sm"
                value={s.text}
                onChange={(e) => onChangeText(i, e.target.value)}
              />

              <div className="mt-2 grid grid-cols-2 gap-2">
                <TimeField
                  label="시작"
                  value={secToTime(s.start, true)}
                  onCommit={(val) => onChangeTime(i, { start: timeToSec(val) })}
                />
                <TimeField
                  label="끝"
                  value={secToTime(s.end, true)}
                  onCommit={(val) => onChangeTime(i, { end: timeToSec(val) })}
                />
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSplit(i);
                  }}
                >
                  분할(S)
                </button>
                <button
                  className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMerge(i);
                  }}
                >
                  다음과 병합(M)
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TimeField({ label, value, onCommit }) {
  return (
    <label className="block text-xs">
      <span className="text-slate-600">{label}</span>
      <input
        className="mt-1 w-full h-9 rounded-lg border border-slate-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        defaultValue={value}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder="00:00:00,000"
      />
    </label>
  );
}
