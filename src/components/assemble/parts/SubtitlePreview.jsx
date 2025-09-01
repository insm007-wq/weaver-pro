import { useEffect, useMemo, useRef } from "react";

// - 글자 13px, line-height 타이트
// - maxHeight: number(px) | string('calc(...)' | '100%')
// - 활성 항목 자동 스크롤

export default function SubtitlePreview({
  scenes = [],
  activeIndex = -1,
  onJump,
  maxHeight = 180,
  embedded = false,
  autoScrollToActive = true,
}) {
  const scrollRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!autoScrollToActive) return;
    const el = itemRefs.current?.[activeIndex];
    const wrap = scrollRef.current;
    if (el && wrap) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex, autoScrollToActive]);

  const styleForBox =
    typeof maxHeight === "number"
      ? { height: maxHeight, maxHeight }
      : { height: maxHeight, maxHeight };

  const list = (
    <div
      ref={scrollRef}
      className="pr-2 overflow-y-auto overflow-x-hidden w-full flex-1 min-h-0"
      style={styleForBox}
    >
      <div className="space-y-2 pb-2">
        {scenes.map((sc, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={sc.id || i}
              ref={(el) => (itemRefs.current[i] = el)}
              type="button"
              onClick={() => onJump?.(i)}
              className={`w-full text-left rounded-lg border p-2 transition ${
                active
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
              title={`${mmss(sc.start)} ~ ${mmss(sc.end)}`}
            >
              <div className="text-[11px] text-slate-500 mb-1">
                {mmss(sc.start)} – {mmss(sc.end)}
              </div>
              <div className="text-slate-700 text-[13px] leading-snug line-clamp-3">
                {sc.text || `씬 ${i + 1}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (embedded)
    return <div className="p-3 h-full min-h-0 flex flex-col">{list}</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">자막 미리보기</div>
        <div className="text-xs text-slate-500">
          {scenes.length}개 라인 · 스크롤로 확인
        </div>
      </div>
      {list}
    </div>
  );
}

function mmss(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
