// src/components/assemble/parts/TimelineView.jsx
// -----------------------------------------------------------------------------
// 타임라인 뷰 (클릭/드래그 스크럽 + 선택)
// - 기존 API 유지 + 몇 가지 확장(터치 지원, 외부 absoluteTime 반영 등)
// - props:
//   * scenes: [{ id, start, end, text? }]
//   * selectedIndex: number
//   * onSelect?: (index:number) => void
//   * onScrub?: (offsetSec:number, sceneIndex:number, absoluteSec:number) => void
//   * offsetSec?: number                     // 현재 선택 씬 내 오프셋(초) → 플레이헤드 표시용
//   * absoluteTime?: number                  // (선택) 외부 비디오의 절대시간이 있을 때 우선 사용
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
function fmt(s) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function TimelineView({
  scenes = [],
  selectedIndex = -1,
  onSelect,
  onScrub,
  offsetSec = 0,
  absoluteTime, // ✅ 외부 비디오 현재시간(초). 주어지면 이것을 플레이헤드로 사용
}) {
  // 총 길이는 마지막 end 대신 "최대 end" 기반(뒤죽박죽 케이스 방어)
  const total = useMemo(
    () => (scenes.length ? Math.max(...scenes.map((s) => s.end || 0)) : 0),
    [scenes]
  );

  const barRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // ✅ 플레이헤드 절대시간: absoluteTime 우선, 없으면 selectedIndex + offsetSec
  const absHead = useMemo(() => {
    if (Number.isFinite(absoluteTime)) {
      return clamp(absoluteTime, 0, total);
    }
    const cur = scenes[selectedIndex];
    if (!cur) return 0;
    return clamp((cur.start || 0) + (offsetSec || 0), 0, total);
  }, [absoluteTime, scenes, selectedIndex, offsetSec, total]);

  // x좌표 → 절대시간 → 씬/오프셋 계산
  const updateFromClientX = useCallback(
    (clientX) => {
      const el = barRef.current;
      if (!el || !total) return;
      const r = el.getBoundingClientRect();
      const ratio = clamp((clientX - r.left) / r.width, 0, 1);
      const t = ratio * total; // 절대 시간(초)

      let idx = scenes.findIndex((sc) => t >= sc.start && t < sc.end);
      if (idx < 0) idx = scenes.length - 1; // 끝점 보정
      const sc = scenes[idx];
      const off = clamp(t - sc.start, 0, sc.end - sc.start || 0);
      onSelect?.(idx);
      onScrub?.(off, idx, t);
    },
    [onSelect, onScrub, scenes, total]
  );

  // 마우스 드래그
  useEffect(() => {
    const onMove = (e) => dragging && updateFromClientX(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, updateFromClientX]);

  // 터치 드래그 (모바일/트랙패드)
  useEffect(() => {
    const onTouchMove = (e) => {
      if (!dragging) return;
      const t = e.touches?.[0];
      if (!t) return;
      updateFromClientX(t.clientX);
    };
    const onTouchEnd = () => setDragging(false);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [dragging, updateFromClientX]);

  // 눈금 갯수(5초 간격) — 길이에 따라 최소 1개 보장
  const tickCount = useMemo(
    () => Math.max(1, Math.ceil(total / 5)) + 1,
    [total]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">타임라인</div>
        <div className="text-xs text-slate-500">
          총 길이 {fmt(total)} · 드래그/클릭으로 이동
        </div>
      </div>

      {/* 눈금 */}
      <div className="relative h-8 mb-2">
        <div className="absolute inset-0 flex">
          {Array.from({ length: tickCount }).map((_, i) => (
            <div key={i} className="flex-1 relative">
              <div className="absolute top-0 left-0 w-px h-3 bg-slate-300" />
              <div className="absolute top-3 left-0 text-[10px] text-slate-500">
                {i * 5}s
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 클릭/드래그 가능한 트랙 */}
      <div
        ref={barRef}
        className={`relative select-none ${
          dragging ? "cursor-grabbing" : "cursor-pointer"
        }`}
        onMouseDown={(e) => {
          setDragging(true);
          updateFromClientX(e.clientX);
        }}
        onClick={(e) => updateFromClientX(e.clientX)}
        onTouchStart={(e) => {
          setDragging(true);
          const t = e.touches?.[0];
          if (t) updateFromClientX(t.clientX);
        }}
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
                className={`h-7 rounded border px-1 text-[11px] truncate transition-colors
                  ${
                    active
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-slate-100 hover:bg-slate-50"
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
