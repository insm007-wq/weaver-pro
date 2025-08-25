import { useEffect, useMemo, useRef, useState } from "react";

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
function fmt(s) {
  const m = Math.floor(s / 60),
    ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function TimelineView({
  scenes = [],
  selectedIndex = -1,
  // 선택 변경
  onSelect,
  // 스크럽 결과 전달: (offsetSec:number, sceneIndex:number, absoluteSec:number)
  onScrub,
  // 현재 선택 씬의 오프셋(플레이헤드 표시용)
  offsetSec = 0,
}) {
  const total = scenes.length ? scenes[scenes.length - 1].end : 0;
  const barRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // 현재 플레이헤드의 "절대 시간"
  const absHead = useMemo(() => {
    const cur = scenes[selectedIndex];
    if (!cur) return 0;
    return clamp((cur.start || 0) + (offsetSec || 0), 0, total);
  }, [scenes, selectedIndex, offsetSec, total]);

  // x좌표 → 절대시간 → 씬/오프셋 계산
  const updateFromClientX = (clientX) => {
    const el = barRef.current;
    if (!el || !total) return;
    const r = el.getBoundingClientRect();
    const ratio = clamp((clientX - r.left) / r.width, 0, 1);
    const t = ratio * total; // 절대 시간(초)

    let idx = scenes.findIndex((sc) => t >= sc.start && t < sc.end);
    if (idx < 0) idx = scenes.length - 1; // 끝점 보정
    const sc = scenes[idx];
    const off = clamp(t - sc.start, 0, sc.end - sc.start);
    onSelect?.(idx);
    onScrub?.(off, idx, t);
  };

  useEffect(() => {
    const onMove = (e) => dragging && updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">타임라인</div>

      {/* 눈금 */}
      <div className="relative h-8 mb-2">
        <div className="absolute inset-0 flex">
          {Array.from({ length: Math.max(1, Math.ceil(total / 5)) + 1 }).map(
            (_, i) => (
              <div key={i} className="flex-1 relative">
                <div className="absolute top-0 left-0 w-px h-3 bg-slate-300" />
                <div className="absolute top-3 left-0 text-[10px] text-slate-500">
                  {i * 5}s
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* 클릭/드래그 가능한 트랙 */}
      <div
        ref={barRef}
        className="relative select-none"
        onMouseDown={(e) => {
          setDragging(true);
          updateFromClientX(e.clientX);
        }}
        onClick={(e) => updateFromClientX(e.clientX)}
      >
        {/* 씬 블록들 */}
        <div className="relative flex gap-1">
          {scenes.map((sc, i) => {
            const w = total ? ((sc.end - sc.start) / total) * 100 : 0;
            const active = i === selectedIndex;
            return (
              <button
                key={sc.id || i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(i);
                }}
                title={`${fmt(sc.start)} ~ ${fmt(sc.end)}`}
                className={`h-7 rounded border px-1 text-[11px] truncate
                  ${
                    active
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-slate-100"
                  }`}
                style={{ width: `${w}%` }}
              >
                씬 {String(i + 1).padStart(2, "0")}
              </button>
            );
          })}
        </div>

        {/* 플레이헤드 */}
        {total > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-blue-500"
            style={{ left: `${(absHead / total) * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}
