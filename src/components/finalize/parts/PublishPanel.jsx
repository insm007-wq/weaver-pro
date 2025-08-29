export default function PublishPanel({ meta, onChange }) {
  const set = (k, v) => onChange({ ...meta, [k]: v });

  return (
    <section className="rounded-2xl border border-slate-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">발행 설정</h2>

      <label className="block text-xs text-slate-600">제목</label>
      <input
        className="mt-1 w-full h-9 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={meta.title}
        onChange={(e) => set("title", e.target.value)}
        placeholder="최종 영상 제목"
      />

      <label className="block text-xs text-slate-600 mt-3">설명</label>
      <textarea
        className="mt-1 w-full min-h-[84px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={meta.description}
        onChange={(e) => set("description", e.target.value)}
        placeholder="설명 / 챕터 / 출처"
      />

      <label className="block text-xs text-slate-600 mt-3">
        태그(쉼표 구분)
      </label>
      <input
        className="mt-1 w-full h-9 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={meta.tags}
        onChange={(e) => set("tags", e.target.value)}
      />

      <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-600 mb-2">플랫폼</h3>
        <div className="grid grid-cols-3 gap-2">
          {["YouTube", "Instagram", "TikTok"].map((p) => (
            <button
              key={p}
              className="h-9 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
