export default function Deliverables({ value = [], onChange }) {
  const toggle = (id, key, next) =>
    onChange(value.map((v) => (v.id === id ? { ...v, [key]: next } : v)));

  return (
    <ul className="space-y-3">
      {value.map((d) => (
        <li key={d.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-sm text-slate-800">{d.name}</div>
              <div className="mt-1 text-xs text-slate-500">
                {d.sidecar
                  ? `자막: 번인 ${
                      d.burnSubs ? "ON" : "OFF"
                    } + ${d.sidecar.toUpperCase()} 동봉`
                  : `자막: 번인 ${d.burnSubs ? "ON" : "OFF"}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`h-8 px-3 rounded-lg border text-sm ${
                  d.enabled
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
                onClick={() => toggle(d.id, "enabled", !d.enabled)}
              >
                {d.enabled ? "사용" : "미사용"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={d.burnSubs}
                onChange={(e) => toggle(d.id, "burnSubs", e.target.checked)}
              />
              <span>자막 번인</span>
            </label>
            <span className="text-slate-400">|</span>
            <span>사이드카:</span>
            {["none", "srt", "vtt"].map((k) => (
              <button
                key={k}
                className={`h-7 px-2 rounded border text-xs ${
                  getSidecar(d) === k
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
                onClick={() => toggle(d.id, "sidecar", k === "none" ? null : k)}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function getSidecar(d) {
  return d.sidecar ? d.sidecar : "none";
}
