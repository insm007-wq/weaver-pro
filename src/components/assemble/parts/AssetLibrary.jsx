export default function AssetLibrary({ assets = [], onPick }) {
  const list = assets.length
    ? assets
    : Array.from({ length: 8 }).map((_, i) => ({
        id: "dummy-" + i,
        type: i % 3 === 0 ? "video" : "image",
        thumbUrl: "",
      }));

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {list.map((a) => (
        <button
          key={a.id}
          onClick={() => onPick?.(a)}
          className="aspect-video bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-xs text-slate-500 hover:bg-slate-50"
        >
          {a.thumbUrl ? (
            // 실제 썸네일이 있으면 <img>로 교체
            <span>{a.type}</span>
          ) : (
            <span>{a.type === "video" ? "비디오" : "이미지"}</span>
          )}
        </button>
      ))}
    </div>
  );
}
