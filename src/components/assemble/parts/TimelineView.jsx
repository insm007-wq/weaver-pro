function secLabel(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function TimelineView({
  scenes = [],
  selectedIndex = -1,
  onSelect, // (i:number)=>void
}) {
  const total = scenes.length ? scenes[scenes.length - 1].end : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">타임라인</div>

      {/* 눈금 */}
      <div className="relative h-8 mb-2">
        <div className="absolute inset-0 flex">
          {Array.from({ length: Math.max(1, Math.ceil(total / 5)) + 1 }).map(
            (_, i) => (
              <div key={i} className="flex-1 relative">
                <div className="absolute top-0 left-0 w-px h-3 bg-slate-300" />
                <div className="absolute top-3 left-0 text-[10px] text-slate-500">
                  {i * 5}s
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 씬 블록들 */}
      <div className="relative flex gap-1">
        {scenes.map((sc, i) => {
          const w = total ? ((sc.end - sc.start) / total) * 100 : 0;
          const active = i === selectedIndex;
          return (
            <button
              key={sc.id || i}
              type="button"
              onClick={() => onSelect?.(i)}
              title={`${secLabel(sc.start)} ~ ${secLabel(sc.end)}`}
              className={`h-7 rounded border px-1 text-[11px] truncate
                ${
                  active
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 bg-slate-100"
                }
              `}
              style={{ width: `${w}%` }}
            >
              씬 {String(i + 1).padStart(2, "0")}
            </button>
          );
        })}
      </div>

      {/* 추가 트랙 자리 (VO, 자막 등) 필요 시 이어서 렌더 */}
    </div>
  );
}
