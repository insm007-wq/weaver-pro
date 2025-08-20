export default function SceneList({ scenes, selected, onSelect }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">
        씬 목록{" "}
        <span className="text-xs text-slate-400 ml-1">{scenes.length}개</span>
      </div>
      <div className="flex flex-col gap-2 max-h-[480px] overflow-auto pr-1">
        {scenes.map((sc, i) => (
          <button
            key={sc.id}
            onClick={() => onSelect(i)}
            className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${
              selected === i
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "bg-white border-slate-200 hover:bg-slate-50"
            }`}
          >
            <div className="font-medium">
              씬 {String(i + 1).padStart(2, "0")}
            </div>
            <div className="text-xs text-slate-500">
              {sec(sc.start)} – {sec(sc.end)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function sec(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
