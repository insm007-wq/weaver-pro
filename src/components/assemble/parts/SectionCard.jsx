export default function SectionCard({
  title,
  right,
  children,
  className = "",
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl ${className}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="text-sm font-semibold">{title}</div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
