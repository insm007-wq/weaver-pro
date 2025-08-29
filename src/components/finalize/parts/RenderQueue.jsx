export default function RenderQueue({ items = [] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-slate-200 shadow-sm p-4 text-sm text-slate-600">
        렌더 큐가 비어 있습니다.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">렌더 큐</h2>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium text-slate-800">{it.label}</div>
              <StatusBadge status={it.status} />
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${barColor(it.status)}`}
                style={{
                  width: `${it.progress ?? (it.status === "done" ? 100 : 10)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    running: "bg-amber-100 text-amber-700",
    done: "bg-emerald-100 text-emerald-700",
    canceled: "bg-slate-100 text-slate-700",
    error: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      className={`px-2 py-1 rounded text-xs ${
        map[status] || "bg-slate-100 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}
function barColor(status) {
  switch (status) {
    case "running":
      return "bg-indigo-500";
    case "done":
      return "bg-emerald-500";
    case "error":
      return "bg-rose-500";
    default:
      return "bg-slate-300";
  }
}
