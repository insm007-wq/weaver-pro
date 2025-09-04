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

export function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

export function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-2">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field"
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
