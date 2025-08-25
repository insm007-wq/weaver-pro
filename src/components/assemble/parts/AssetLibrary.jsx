export default function AssetLibrary({ assets = [], onPick }) {
  const list = assets.length
    ? assets
    : Array.from({ length: 8 }).map((_, i) => ({
        id: "dummy-" + i,
        type: i % 3 === 0 ? "video" : "image",
        thumbUrl: "",
        label: i % 3 === 0 ? `Video ${i}` : `Image ${i}`,
      }));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {list.map((a) => (
        <button
          key={a.id}
          onClick={() => onPick?.(a)}
          className="aspect-video bg-slate-100 rounded-lg border border-slate-200 flex flex-col items-center justify-center text-[11px] text-slate-600 hover:bg-slate-50 px-2"
        >
          {a.thumbUrl ? (
            <img
              src={a.thumbUrl}
              alt={a.label || a.id}
              className="w-full h-full object-cover rounded"
            />
          ) : (
            <>
              <div className="text-xs font-medium mb-0.5">
                {a.label || a.id}
              </div>
              <div className="opacity-60">
                {a.type === "video" ? "비디오" : "이미지"}
              </div>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
