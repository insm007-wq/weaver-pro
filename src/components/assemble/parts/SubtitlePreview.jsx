export default function SubtitlePreview({ scenes }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">자막 미리보기</div>
        <div className="text-xs text-slate-500">
          {scenes.length}개 라인 · 스크롤로 확인
        </div>
      </div>

      <div className="max-h-64 overflow-auto pr-1">
        <div className="space-y-2">
          {scenes.map((sc, i) => (
            <div
              key={sc.id}
              className="border border-slate-200 rounded-lg p-2 text-sm"
            >
              <div className="text-[11px] text-slate-500 mb-1">
                {mmss(sc.start)} – {mmss(sc.end)}
              </div>
              <div className="text-slate-700">{sc.text || `씬 ${i + 1}`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function mmss(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
