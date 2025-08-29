export default function Checklist({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });

  return (
    <section className="rounded-2xl border border-slate-200 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">
        최종 체크리스트
      </h2>

      <Item
        label="라우드니스(-14 LUFS ±1)"
        checked={value.loudness}
        onChange={(v) => set("loudness", v)}
      />
      <Item
        label="안전 마진(타이틀/액션)"
        checked={value.safeMargin}
        onChange={(v) => set("safeMargin", v)}
      />
      <Item
        label="맞춤법/띄어쓰기"
        checked={value.spelling}
        onChange={(v) => set("spelling", v)}
      />
      <Item
        label="브랜드 워터마크(최종본)"
        checked={value.brandWatermark}
        onChange={(v) => set("brandWatermark", v)}
      />

      <div className="mt-3">
        <label className="block text-xs text-slate-600">컬러 스페이스</label>
        <select
          className="mt-1 w-full h-9 rounded-lg border border-slate-300 px-2 text-sm"
          value={value.colorSpace}
          onChange={(e) => set("colorSpace", e.target.value)}
        >
          {["sRGB", "Rec.709", "DCI-P3"].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function Item({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        className={`h-7 w-12 rounded-full border transition ${
          checked
            ? "bg-indigo-600 border-indigo-600"
            : "bg-slate-200 border-slate-200"
        }`}
        onClick={() => onChange(!checked)}
        type="button"
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-6 w-6 bg-white rounded-full shadow transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}
