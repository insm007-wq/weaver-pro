// src/components/assemble/parts/SubtitleControls.jsx
import React from "react";

/** 프리셋 */
export const PRESETS = {
  ytCompact: {
    label: "YouTube Compact",
    fontSizePx: 24,
    rows: 2,
    widthPct: 95,
    textColor: "#ffffff",
    bgColor: "#000000",
    bgAlpha: 0.45,
    outlineOn: true,
    boxStyle: "box", // box | pill | none
    safeMarginPct: 5,
    vAlign: "bottom", // top | middle | bottom
    vOffsetPct: 8,
  },
  lowerThird: {
    label: "Lower-Third",
    fontSizePx: 26,
    rows: 2,
    widthPct: 80,
    textColor: "#ffffff",
    bgColor: "#000000",
    bgAlpha: 0.5,
    outlineOn: true,
    boxStyle: "box",
    safeMarginPct: 5,
    vAlign: "bottom",
    vOffsetPct: 14,
  },
  cinematic: {
    label: "Cinematic",
    fontSizePx: 28,
    rows: 2,
    widthPct: 70,
    textColor: "#ffffff",
    bgColor: "#000000",
    bgAlpha: 0.4,
    outlineOn: false,
    boxStyle: "pill",
    safeMarginPct: 6,
    vAlign: "middle",
    vOffsetPct: 0,
  },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export default function SubtitleControls({ value, onChange }) {
  const v = { ...PRESETS.ytCompact, ...(value || {}) };
  const set = (patch) => onChange?.({ ...v, ...patch });

  // 현재 라벨과 동일한 프리셋을 찾아 기본값 리셋
  const resetToCurrentPreset = () => {
    const entry = Object.values(PRESETS).find((p) => p.label === v.label);
    onChange?.(entry || PRESETS.ytCompact);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200 font-medium flex items-center justify-between">
        <span>자막 설정</span>
        <button
          type="button"
          className="h-8 px-3 rounded-lg border border-slate-200 text-xs hover:bg-slate-50"
          onClick={resetToCurrentPreset}
          title="현재 프리셋의 기본값으로 초기화"
        >
          기본값
        </button>
      </div>

      <div className="p-4 space-y-3 text-sm">
        {/* 프리셋 */}
        <div>
          <div className="text-xs text-slate-500 mb-1">프리셋</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button
                key={k}
                type="button"
                className={`h-8 px-3 rounded-lg border text-xs ${
                  v.label === p.label ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 hover:bg-slate-50"
                }`}
                onClick={() => onChange?.({ ...p })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* 위치 */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">위치</div>
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
            {["top", "middle", "bottom"].map((pos) => (
              <button
                key={pos}
                type="button"
                className={`px-3 py-1 rounded-md ${v.vAlign === pos ? "bg-white shadow border border-slate-200" : "hover:bg-white/60"}`}
                onClick={() => set({ vAlign: pos })}
              >
                {pos === "top" ? "상단" : pos === "middle" ? "가운데" : "하단"}
              </button>
            ))}
          </div>
        </div>

        {/* 세로 오프셋(%) */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 w-28">세로 오프셋(%)</div>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={Number(v.vOffsetPct ?? 8)}
            onChange={(e) => set({ vOffsetPct: parseInt(e.target.value || 0, 10) })}
            className="flex-1"
          />
          <div className="w-10 text-right text-xs text-slate-600">{Number(v.vOffsetPct ?? 8)}%</div>
        </div>

        {/* 세이프 마진(%) */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500 w-28">세이프 마진(%)</div>
          <input
            type="range"
            min={0}
            max={12}
            step={1}
            value={Number(v.safeMarginPct ?? 5)}
            onChange={(e) => set({ safeMarginPct: parseInt(e.target.value || 0, 10) })}
            className="flex-1"
          />
          <div className="w-10 text-right text-xs text-slate-600">{Number(v.safeMarginPct ?? 5)}%</div>
        </div>

        {/* 폰트/줄수/가로폭 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">폰트(px)</div>
            <input
              type="number"
              className="w-full h-9 rounded-lg border border-slate-200 px-2"
              value={v.fontSizePx}
              min={12}
              max={72}
              onChange={(e) => set({ fontSizePx: clamp(parseInt(e.target.value || 0, 10), 12, 72) })}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">줄 수</div>
            <input
              type="number"
              className="w-full h-9 rounded-lg border border-slate-200 px-2"
              value={v.rows}
              min={1}
              max={4}
              onChange={(e) => set({ rows: clamp(parseInt(e.target.value || 0, 10), 1, 4) })}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">가로폭(%)</div>
            <input
              type="range"
              className="w-full"
              min={40}
              max={100}
              step={1}
              value={v.widthPct}
              onChange={(e) => set({ widthPct: clamp(parseInt(e.target.value || 0, 10), 40, 100) })}
            />
          </div>
        </div>

        {/* 색상/투명도 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">글자색</div>
            <input
              type="color"
              className="w-full h-9 rounded-lg border border-slate-200"
              value={v.textColor}
              onChange={(e) => set({ textColor: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">배경색</div>
            <input
              type="color"
              className="w-full h-9 rounded-lg border border-slate-200"
              value={v.bgColor}
              onChange={(e) => set({ bgColor: e.target.value })}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">배경 투명도</div>
            <input
              type="range"
              className="w-full"
              min={0}
              max={1}
              step={0.05}
              value={Number(v.bgAlpha)}
              onChange={(e) => set({ bgAlpha: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* 외곽선/배경형태 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">외곽선</div>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs">
              {[
                { label: "On", val: true },
                { label: "Off", val: false },
              ].map((o) => (
                <button
                  key={String(o.val)}
                  type="button"
                  className={`px-3 py-1 rounded-md ${
                    v.outlineOn === o.val ? "bg-white shadow border border-slate-200" : "hover:bg-white/60"
                  }`}
                  onClick={() => set({ outlineOn: o.val })}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">배경형태</div>
            <select
              className="w-full h-9 rounded-lg border border-slate-200 px-2"
              value={v.boxStyle}
              onChange={(e) => set({ boxStyle: e.target.value })}
            >
              <option value="box">Box</option>
              <option value="pill">Pill</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
