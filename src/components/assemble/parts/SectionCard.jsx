export default function SectionCard({
  title,
  right,
  children,
  className = "",
}) {
  return (
    <div className={`bg-white border border-neutral-200 rounded-xl force-text-dark ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <div className="text-sm font-semibold text-neutral-900" style={{ color: '#0f172a !important' }}>{title}</div>
        {right}
      </div>
      <div className="p-4 force-text-dark">{children}</div>
    </div>
  );
}
