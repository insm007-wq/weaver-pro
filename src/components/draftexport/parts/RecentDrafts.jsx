// 최근 초안 리스트 (간단한 플레이스홀더)
// props: { items?: Array<{title?:string, path?:string, url?:string}>, onSelect?: (item)=>void }
export default function RecentDrafts({ items = [], onSelect }) {
  if (!items.length) {
    return (
      <div className="text-sm text-slate-500">최근 초안 기록이 없습니다.</div>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((it, i) => (
        <button
          key={i}
          onClick={() => onSelect && onSelect(it)}
          className="w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-slate-50"
          title={it.path || it.url || ""}
        >
          <span className="truncate">{it.title || `초안 ${i + 1}`}</span>
          <span className="text-xs text-slate-400 ml-2">
            {it.path ? "파일" : it.url ? "미리보기" : ""}
          </span>
        </button>
      ))}
    </div>
  );
}
