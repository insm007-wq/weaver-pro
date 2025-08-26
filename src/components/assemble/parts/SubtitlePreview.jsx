// src/components/assemble/parts/SubtitlePreview.jsx
// -----------------------------------------------------------------------------
// 자막 미리보기 (우측 패널 전체 높이 채우기 + 활성 라인 하이라이트 + 점프)
// - props:
//   * scenes: [{ id, start, end, text }]
//   * currentTime?: number
//   * onJump?: (sec:number) => void
//   * className?: string  // 외부에서 높이 제어용 (예: h-full)
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef } from "react";

export default function SubtitlePreview({
  scenes = [],
  currentTime = 0,
  onJump,
  className = "",
}) {
  const containerRef = useRef(null);
  const activeIdRef = useRef(null);

  const activeIndex = useMemo(() => {
    if (!Array.isArray(scenes) || scenes.length === 0) return -1;
    const t = Number.isFinite(currentTime) ? currentTime : 0;
    return scenes.findIndex((sc) => t >= sc.start && t < sc.end);
  }, [scenes, currentTime]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const id = scenes[activeIndex]?.id;
    if (!id) return;
    if (activeIdRef.current === id) return;
    activeIdRef.current = id;

    const el = containerRef.current?.querySelector(`[data-sub-id="${id}"]`);
    if (!el) return;

    const parent = containerRef.current;
    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const offset =
      rect.top - parentRect.top - parent.clientHeight / 2 + rect.height / 2;
    parent.scrollBy({ top: offset, behavior: "smooth" });
  }, [activeIndex, scenes]);

  const handleClick = (sec) => typeof onJump === "function" && onJump(sec);

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl p-3 flex flex-col ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">자막 미리보기</div>
        <div className="text-xs text-slate-500">
          {scenes.length}개 라인 · 스크롤로 확인
        </div>
      </div>

      {/* 핵심: flex-1 + min-h-0 로 부모 높이를 꽉 채우면서 내부만 스크롤 */}
      <div ref={containerRef} className="flex-1 min-h-0 overflow-auto pr-1">
        <div className="space-y-2">
          {scenes.map((sc, i) => {
            const isActive =
              activeIndex >= 0 && scenes[activeIndex]?.id === sc.id;
            return (
              <button
                key={sc.id || i}
                type="button"
                data-sub-id={sc.id}
                onClick={() => handleClick(sc.start)}
                className={[
                  "w-full text-left rounded-lg p-2 text-sm border transition-colors",
                  isActive
                    ? "border-blue-400 bg-blue-50/70"
                    : "border-slate-200 hover:bg-slate-50",
                ].join(" ")}
                title="클릭하여 해당 시점으로 이동"
              >
                <div
                  className={[
                    "text-[11px] mb-1",
                    isActive ? "text-blue-600" : "text-slate-500",
                  ].join(" ")}
                >
                  {mmss(sc.start)} – {mmss(sc.end)}
                </div>
                <div className={isActive ? "text-slate-900" : "text-slate-700"}>
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
