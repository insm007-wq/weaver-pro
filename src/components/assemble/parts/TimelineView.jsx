export default function TimelineView({ scenes }) {
  const total = scenes.length ? scenes[scenes.length - 1].end : 30;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">타임라인</div>

      {/* 눈금 */}
      <div className="relative h-8 mb-2">
        <div className="absolute inset-0 flex">
          {Array.from({ length: Math.ceil(total / 5) + 1 }).map((_, i) => (
            <div key={i} className="flex-1 relative">
              <div className="absolute top-0 left-0 w-px h-3 bg-slate-300" />
              <div className="absolute top-3 left-0 text-[10px] text-slate-500">
                {i * 5}s
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 트랙 */}
      <Track label="VO 내레이션">
        <div className="h-6 bg-slate-200 rounded" />
      </Track>

      <Track label="BG 배경">
        <div className="flex gap-1">
          {scenes.map((sc) => (
            <div
              key={sc.id}
              className="h-6 bg-slate-100 border border-slate-200 rounded flex-1"
              title={`${sc.start}–${sc.end}`}
            />
          ))}
        </div>
      </Track>

      <Track label="CC 자막">
        <div className="h-6 bg-slate-100 rounded" />
      </Track>
    </div>
  );
}

function Track({ label, children }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {children}
    </div>
  );
}
