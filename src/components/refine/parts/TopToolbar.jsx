export default function TopToolbar({
  onImport,
  onExport,
  onSplit,
  onMerge,
  normalizeText,
  toggleOutline,
}) {
  const Btn = ({ children, onClick }) => (
    <button
      className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className="flex gap-2">
      <Btn onClick={onImport}>SRT 불러오기</Btn>
      <Btn onClick={onExport}>SRT 내보내기</Btn>
      <span className="w-px bg-slate-200 mx-1" />
      <Btn onClick={onSplit}>분할(S)</Btn>
      <Btn onClick={onMerge}>병합(M)</Btn>
      <Btn onClick={normalizeText}>맞춤법/문장부호 정리</Btn>
      <Btn onClick={toggleOutline}>하드번 미리보기</Btn>
    </div>
  );
}
