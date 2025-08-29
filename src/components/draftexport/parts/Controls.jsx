export function Label({ children, className = "" }) {
  return (
    <div className={`text-sm font-medium text-slate-700 ${className}`}>
      {children}
    </div>
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented({ items, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            className={`px-3 h-10 rounded-lg text-sm font-medium transition ${
              active
                ? "bg-white shadow-sm text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => onChange(it.value)}
            type="button"
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition border ${
        checked
          ? "bg-indigo-600 border-indigo-600"
          : "bg-slate-200 border-slate-200"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function RadioRow({ items, value, onChange, name }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((it) => (
        <label
          key={it.value}
          className="flex items-center gap-2 text-sm text-slate-700"
        >
          <input
            type="radio"
            name={name}
            value={it.value}
            checked={value === it.value}
            onChange={(e) => onChange(e.target.value)}
            className="h-4 w-4 text-indigo-600 border-slate-300"
          />
          <span>{it.label}</span>
        </label>
      ))}
    </div>
  );
}
