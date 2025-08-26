// src/components/assemble/parts/SubtitlePreview.jsx
// - 우측 사이드에서 보기 좋은 리스트형 자막 미리보기
// - 높이를 maxHeight로 제한하고 내부 스크롤
// - 현재 재생 중인 씬은 강조, 클릭 시 onJump(i)로 점프

export default function SubtitlePreview({
  scenes = [],
  activeIndex = -1,
  onJump,
  maxHeight = 280, // ← 필요하면 숫자만 바꿔서 높이 조정
  embedded = false, // 호환용
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">자막 미리보기</div>
        <div className="text-xs text-slate-500">
          {scenes.length}개 라인 · 스크롤로 확인
        </div>
      </div>

      <div className="pr-1 overflow-auto" style={{ maxHeight }}>
        <div className="space-y-2">
          {scenes.map((sc, i) => {
            const active = i === activeIndex;
            return (
              <button
                key={sc.id || i}
                type="button"
                onClick={() => onJump?.(i)}
                className={`w-full text-left rounded-lg border p-2 transition
                  ${
                    active
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                title={`${mmss(sc.start)} ~ ${mmss(sc.end)}`}
              >
                <div className="text-[11px] text-slate-500 mb-1">
                  {mmss(sc.start)} – {mmss(sc.end)}
                </div>
                {/* 한 항목이 너무 커지지 않게 3줄까지만 보여줌 */}
                <div className="text-slate-700 line-clamp-3">
                  {sc.text || `씬 ${i + 1}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function mmss(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
