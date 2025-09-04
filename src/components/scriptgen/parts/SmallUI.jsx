export function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
        active
          ? "bg-primary-100 text-primary-700 shadow-soft border border-primary-200"
          : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50"
      }`}
    >
      {label}
    </button>
  );
}

export function Card({ children, className = "" }) {
  return (
    <div
      className={`card card-body ${className}`}
    >
      {children}
    </div>
  );
}

export function FormGrid({ children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {children}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, disabled = false }) {
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 transition-colors duration-200 ${
        disabled ? 'text-neutral-400' : 'text-neutral-700'
      }`}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input-field transition-all duration-200 ${
          disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
        }`}
      />
    </div>
  );
}

export function SelectField({ label, value, options, onChange, disabled = false }) {
  return (
    <div>
      <label className={`block text-sm font-medium mb-2 transition-colors duration-200 ${
        disabled ? 'text-neutral-400' : 'text-neutral-700'
      }`}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`input-field transition-all duration-200 ${
          disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : ''
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2 text-xs font-medium text-neutral-700 ${className}`}>{children}</th>
  );
}
export function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 text-neutral-900 ${className}`}>{children}</td>;
}
