// src/components/assemble/parts/TimelineView.jsx
// -----------------------------------------------------------------------------
// 타임라인 뷰 (멀티 스킨)
// - 기존 API 100% 호환: scenes, selectedIndex, onSelect, onScrub, absoluteTime 등
// - 추가: variant = "sleek" | "glass" | "segmented" | "minimal"  (기본: sleek)
//   * sleek     : 파스텔 그라디언트 + 미세/메이저 눈금 + 진행 라인 + 핸들/시간 배지
//   * glass     : 유리(Glassmorphism) 스타일, 반투명/블러 + 더 굵은 핸들
//   * segmented : 씬 경계선을 트랙에 직접 표시(세로 바)하는 분절형
//   * minimal   : 아주 얇은 바 + 점 핸들, 눈금 최소화
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
  absoluteTime,
  variant = "sleek",
}) {
  const total = useMemo(
    () => (scenes.length ? Math.max(...scenes.map((s) => s.end || 0)) : 0),
    [scenes]
  );

  const wrapRef = useRef(null);
  const ticksRef = useRef(null);
  const barRef = useRef(null);

  const [dragging, setDragging] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [hoverPct, setHoverPct] = useState(null); // 0~100

  // 절대 플레이헤드(초)
  const absHead = useMemo(() => {
    if (Number.isFinite(absoluteTime)) return clamp(absoluteTime, 0, total);
    const cur = scenes[selectedIndex];
    if (!cur) return 0;
    return clamp((cur.start || 0) + (offsetSec || 0), 0, total);
  }, [absoluteTime, scenes, selectedIndex, offsetSec, total]);

  const headPct = total > 0 ? (absHead / total) * 100 : 0;

  // x좌표 → 절대시간/씬 계산
  const seekByClientX = useCallback(
    (clientX, hostEl) => {
      const host = hostEl || ticksRef.current || barRef.current;
      if (!host || !total) return;
      const r = host.getBoundingClientRect();
      const ratio = clamp((clientX - r.left) / r.width, 0, 1);
      const t = ratio * total;

      let idx = scenes.findIndex((sc) => t >= sc.start && t < sc.end);
      if (idx < 0) idx = scenes.length - 1;
      const sc = scenes[idx] || { start: 0, end: total };
      const off = clamp(t - sc.start, 0, sc.end - sc.start || 0);

      onSelect?.(idx);
      onScrub?.(off, idx, t);
    },
    [onSelect, onScrub, scenes, total]
  );

  const startDrag = useCallback(
    (clientX, hostEl) => {
      setDragging(true);
      seekByClientX(clientX, hostEl);
    },
    [seekByClientX]
  );

  // 드래그(마우스/터치)
  useEffect(() => {
    const onMove = (e) => dragging && seekByClientX(e.clientX);
    const onUp = () => setDragging(false);
    const onTouchMove = (e) => {
      if (!dragging) return;
      const t = e.touches?.[0];
      if (t) seekByClientX(t.clientX);
    };
    const onTouchEnd = () => setDragging(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [dragging, seekByClientX]);

  // 키보드 ←/→ : 0.1s, Shift+←/→ : 1s
  const handleKey = useCallback(
    (e) => {
      if (!total) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const step = e.shiftKey ? 1 : 0.1;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = clamp(absHead + dir * step, 0, total);

      let idx = scenes.findIndex((sc) => next >= sc.start && next < sc.end);
      if (idx < 0) idx = scenes.length - 1;
      const sc = scenes[idx] || { start: 0, end: total };
      const off = clamp(next - sc.start, 0, sc.end - sc.start || 0);

      e.preventDefault();
      onSelect?.(idx);
      onScrub?.(off, idx, next);
    },
    [absHead, onScrub, onSelect, scenes, total]
  );

  // 메이저 눈금(5초 간격)
  const majorCount = useMemo(
    () => Math.max(1, Math.ceil(total / 5)) + 1,
    [total]
  );

  // 호버 가이드 업데이트
  const handleHoverMove = (clientX) => {
    const host = ticksRef.current;
    if (!host || !total) return setHoverPct(null);
    const r = host.getBoundingClientRect();
    const pct = clamp(((clientX - r.left) / r.width) * 100, 0, 100);
    setHoverPct(pct);
  };

  /* ---------- 스킨별 공통 요소: 시간배지/가이드/핸들 ---------- */
  const TimeBadge = () => (
    <div
      className={`absolute -top-7 px-2 py-0.5 rounded-md text-[11px] font-medium
                  bg-slate-900/80 text-white shadow-md transition-opacity duration-150
                  ${
                    dragging || hovering
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
      style={{ left: `${headPct}%`, transform: "translateX(-50%)" }}
    >
      {fmt(absHead)}
      <span
        className="absolute left-1/2 top-full w-2 h-2 bg-slate-900/80 rotate-45 -translate-x-1/2"
        aria-hidden
      />
    </div>
  );

  const HoverGuide = () =>
    hovering && hoverPct != null ? (
      <div
        className="absolute top-0 bottom-0 w-px bg-slate-500/40"
        style={{ left: `${hoverPct}%` }}
      />
    ) : null;

  const Handle = ({ className = "", size = 24 }) => (
    <button
      type="button"
      className={`pointer-events-auto absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${className}`}
      style={{ left: `${headPct}%`, width: size, height: size }}
      aria-label={`현재 시간 ${fmt(absHead)}`}
      onMouseDown={(e) => startDrag(e.clientX, ticksRef.current)}
      onTouchStart={(e) => {
        const t = e.touches?.[0];
        if (t) startDrag(t.clientX, ticksRef.current);
      }}
    />
  );

  /* -------------------------- 스킨: 렌더러들 -------------------------- */
  const renderTrack = () => {
    if (variant === "glass") {
      return (
        <div
          className="relative mb-2 group"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => {
            setHovering(false);
            setHoverPct(null);
          }}
          onMouseMove={(e) => handleHoverMove(e.clientX)}
        >
          <div
            ref={ticksRef}
            tabIndex={0}
            onKeyDown={handleKey}
            className={`relative h-14 rounded-3xl overflow-hidden border
                        border-white/30 bg-white/10 backdrop-blur-md
                        ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
            onMouseDown={(e) => startDrag(e.clientX, ticksRef.current)}
            onClick={(e) => seekByClientX(e.clientX, ticksRef.current)}
            onTouchStart={(e) => {
              const t = e.touches?.[0];
              if (t) startDrag(t.clientX, ticksRef.current);
            }}
          >
            {/* 미세 눈금 */}
            <div
              className="absolute inset-0 opacity-60 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, rgba(255,255,255,0.8) 0 2px, transparent 2px 18px)",
              }}
            />
            {/* 메이저 눈금 */}
            <div className="absolute inset-0 flex pointer-events-none">
              {Array.from({ length: majorCount }).map((_, i) => (
                <div key={i} className="flex-1 relative">
                  <div
                    className={`absolute bottom-4 left-0 w-[2px] ${
                      i % 2 === 0 ? "h-8" : "h-6"
                    } bg-white`}
                  />
                </div>
              ))}
            </div>

            {/* 진행 그라디언트 */}
            <div
              className="absolute inset-y-0 left-0 rounded-3xl
                         bg-gradient-to-r from-sky-400/70 via-indigo-500/70 to-fuchsia-500/70
                         transition-[width] duration-150 ease-out"
              style={{ width: `${headPct}%` }}
            />

            {/* 하단 진행 라인 */}
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/30" />
            <div
              className="absolute bottom-0 left-0 h-[3px] bg-white transition-[width] duration-150"
              style={{ width: `${headPct}%` }}
            />
          </div>

          <div className="pointer-events-none absolute inset-0">
            <TimeBadge />
            <HoverGuide />
            <Handle
              className="rounded-full bg-white/90 border-2 border-white shadow-[0_0_0_8px_rgba(255,255,255,0.25)] active:scale-95"
              size={28}
            />
          </div>
        </div>
      );
    }

    if (variant === "segmented") {
      return (
        <div
          className="relative mb-2 group"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => {
            setHovering(false);
            setHoverPct(null);
          }}
          onMouseMove={(e) => handleHoverMove(e.clientX)}
        >
          <div
            ref={ticksRef}
            tabIndex={0}
            onKeyDown={handleKey}
            className={`relative h-12 rounded-2xl overflow-hidden border
                        border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100
                        ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
            onMouseDown={(e) => startDrag(e.clientX, ticksRef.current)}
            onClick={(e) => seekByClientX(e.clientX, ticksRef.current)}
            onTouchStart={(e) => {
              const t = e.touches?.[0];
              if (t) startDrag(t.clientX, ticksRef.current);
            }}
          >
            {/* 씬 경계선(세로 바) */}
            <div className="absolute inset-0 pointer-events-none">
              {scenes.map((sc, i) => {
                const left = total ? (sc.start / total) * 100 : 0;
                return (
                  <div
                    key={i}
                    className="absolute top-2 bottom-2 w-[2px] bg-slate-300"
                    style={{ left: `${left}%` }}
                  />
                );
              })}
              {/* 마지막 끝점 */}
              <div
                className="absolute top-2 bottom-2 w-[2px] bg-slate-300"
                style={{ left: "100%" }}
              />
            </div>

            {/* 진행 채움(단색) */}
            <div
              className="absolute inset-y-0 left-0 bg-indigo-400/50 transition-[width] duration-150"
              style={{ width: `${headPct}%` }}
            />

            {/* 하단 라인 */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-200" />
            <div
              className="absolute bottom-0 left-0 h-[2px] bg-indigo-600 transition-[width] duration-150"
              style={{ width: `${headPct}%` }}
            />
          </div>

          <div className="pointer-events-none absolute inset-0">
            <TimeBadge />
            <HoverGuide />
            <Handle
              className="rounded-full bg-white border-2 border-indigo-600 shadow-[0_0_0_6px_rgba(79,70,229,0.15)] active:scale-95"
              size={24}
            />
          </div>
        </div>
      );
    }

    if (variant === "minimal") {
      return (
        <div
          className="relative mb-2 group"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => {
            setHovering(false);
            setHoverPct(null);
          }}
          onMouseMove={(e) => handleHoverMove(e.clientX)}
        >
          <div
            ref={ticksRef}
            tabIndex={0}
            onKeyDown={handleKey}
            className={`relative h-8 rounded-xl overflow-hidden
                        ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
            onMouseDown={(e) => startDrag(e.clientX, ticksRef.current)}
            onClick={(e) => seekByClientX(e.clientX, ticksRef.current)}
            onTouchStart={(e) => {
              const t = e.touches?.[0];
              if (t) startDrag(t.clientX, ticksRef.current);
            }}
          >
            {/* 얇은 바 + 희미한 미세 눈금 */}
            <div className="absolute inset-0 flex items-center">
              <div className="w-full h-[4px] rounded-full bg-slate-200" />
            </div>
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, rgba(2,6,23,0.25) 0 1px, transparent 1px 16px)",
              }}
            />
            {/* 진행 바 */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[4px] rounded-full bg-blue-600"
              style={{ width: `${headPct}%` }}
            />
          </div>

          <div className="pointer-events-none absolute inset-0">
            <TimeBadge />
            <HoverGuide />
            <Handle
              className="rounded-full bg-blue-600 shadow-[0_0_0_6px_rgba(37,99,235,0.15)]"
              size={16}
            />
          </div>
        </div>
      );
    }

    // 기본: sleek
    return (
      <div
        className="relative mb-2 group"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => {
          setHovering(false);
          setHoverPct(null);
        }}
        onMouseMove={(e) => handleHoverMove(e.clientX)}
      >
        <div
          ref={ticksRef}
          tabIndex={0}
          onKeyDown={handleKey}
          className={`relative h-12 rounded-3xl border overflow-hidden shadow-inner
                      bg-gradient-to-r from-indigo-50 to-indigo-100/70 border-indigo-200
                      ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
          onMouseDown={(e) => startDrag(e.clientX, ticksRef.current)}
          onClick={(e) => seekByClientX(e.clientX, ticksRef.current)}
          onTouchStart={(e) => {
            const t = e.touches?.[0];
            if (t) startDrag(t.clientX, ticksRef.current);
          }}
        >
          {/* 미세 눈금 */}
          <div
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(255,255,255,0.9) 0 2px, transparent 2px 20px)",
            }}
          />
          {/* 메이저 눈금 */}
          <div className="absolute inset-0 flex pointer-events-none">
            {Array.from({ length: majorCount }).map((_, i) => (
              <div key={i} className="flex-1 relative">
                <div
                  className={`absolute bottom-3 left-0 w-[2px] ${
                    i % 2 === 0 ? "h-7" : "h-5"
                  } bg-white/90`}
                />
              </div>
            ))}
          </div>

          {/* 진행 그라디언트 */}
          <div
            className="absolute inset-y-0 left-0 rounded-3xl
                       bg-gradient-to-r from-sky-400/60 via-indigo-500/60 to-fuchsia-500/60
                       transition-[width] duration-150 ease-out"
            style={{ width: `${headPct}%` }}
          />
          {/* 하단 라인 */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-indigo-200/60" />
          <div
            className="absolute bottom-0 left-0 h-[3px] bg-blue-600/80 transition-[width] duration-150"
            style={{ width: `${headPct}%` }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0">
          <TimeBadge />
          <HoverGuide />
          <Handle
            className="rounded-full bg-white border-2 border-blue-600 shadow-[0_0_0_6px_rgba(59,130,246,0.15)] active:scale-95"
            size={24}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">타임라인</div>
        <div className="text-xs text-slate-500">
          총 길이 {fmt(total)} · 드래그/클릭/키보드로 이동
        </div>
      </div>

      {/* 트랙(스킨) */}
      {renderTrack()}

      {/* 씬 버튼 트랙 (기존 그대로, 약간 미니멀 스타일) */}
      <div
        ref={barRef}
        className={`relative select-none ${
          dragging ? "cursor-grabbing" : "cursor-pointer"
        }`}
        onMouseDown={(e) => startDrag(e.clientX, barRef.current)}
        onClick={(e) => seekByClientX(e.clientX, barRef.current)}
        onTouchStart={(e) => {
          const t = e.touches?.[0];
          if (t) startDrag(t.clientX, barRef.current);
        }}
      >
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
                className={`h-7 rounded-xl border px-2 text-[11px] truncate transition-colors
                  ${
                    active
                      ? "border-blue-400 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                style={{ width: `${w}%` }}
              >
                씬 {String(i + 1).padStart(2, "0")}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
