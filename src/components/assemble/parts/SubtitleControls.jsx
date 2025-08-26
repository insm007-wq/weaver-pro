// src/components/assemble/parts/SubtitleControls.jsx
import { useCallback } from "react";
import SectionCard from "./SectionCard";

/** 시청자 친화 프리셋 */
export const PRESETS = {
  ytCompact: {
    name: "YouTube Compact",
    mode: "overlay", // overlay | banner | below | karaoke
    position: "bottom", // overlay일 때 top | bottom
    fontSize: 20,
    lineClamp: 2, // 한 화면에 최대 줄 수
    color: "#FFFFFF",
    bgColor: "#000000",
    bgOpacity: 0.25,
    outline: true, // 얇은 외곽선(검은 테두리)
    maxWidthPct: 78, // 자막 최대 너비(%)
    vOffsetPct: 8, // 하단에서 띄우기(%)
    safeMarginPct: 5, // 좌우 세이프마진(%)
    bgStyle: "pill", // pill | box | none
  },
  lowerThird: {
    name: "Lower-Third",
    mode: "overlay",
    position: "bottom",
    fontSize: 22,
    lineClamp: 2,
    color: "#FFFFFF",
    bgColor: "#000000",
    bgOpacity: 0.45,
    outline: false,
    maxWidthPct: 70,
    vOffsetPct: 14,
    safeMarginPct: 6,
    bgStyle: "box",
  },
  cinematic: {
    name: "Cinematic",
    mode: "overlay",
    position: "bottom",
    fontSize: 28,
    lineClamp: 1,
    color: "#F8E29A",
    bgColor: "#000000",
    bgOpacity: 0.0,
    outline: true,
    maxWidthPct: 66,
    vOffsetPct: 10,
    safeMarginPct: 8,
    bgStyle: "none",
  },
};

export default function SubtitleControls({ value, onChange }) {
  const v = { ...PRESETS.ytCompact, ...(value || {}) };
  const apply = (patch) => onChange?.({ ...v, ...patch });

  const usePreset = useCallback((k) => apply({ ...PRESETS[k], preset: k }), []);

  const label = (t) => <div className="text-xs text-slate-500 mb-1">{t}</div>;
  const row = "flex flex-wrap items-center gap-2";
  const btn = (active) =>
    `h-8 px-3 rounded-lg text-xs border ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <SectionCard title="자막 설정">
      {/* 프리셋 */}
      {label("프리셋")}
      <div className={row}>
        <button
          className={btn(v.preset === "ytCompact")}
          onClick={() => usePreset("ytCompact")}
        >
          YouTube Compact
        </button>
        <button
          className={btn(v.preset === "lowerThird")}
          onClick={() => usePreset("lowerThird")}
        >
          Lower-Third
        </button>
        <button
          className={btn(v.preset === "cinematic")}
          onClick={() => usePreset("cinematic")}
        >
          Cinematic
        </button>
      </div>

      {/* 표시 방식 */}
      <div className="mt-3">
        {label("표시 방식")}
        <div className={row}>
          <button
            className={btn(v.mode === "overlay")}
            onClick={() => apply({ mode: "overlay", preset: "custom" })}
          >
            오버레이
          </button>
          <button
            className={btn(v.mode === "banner")}
            onClick={() => apply({ mode: "banner", preset: "custom" })}
          >
            배너
          </button>
          <button
            className={btn(v.mode === "below")}
            onClick={() => apply({ mode: "below", preset: "custom" })}
          >
            플레이어 아래
          </button>
          <button
            className={btn(v.mode === "karaoke")}
            onClick={() => apply({ mode: "karaoke", preset: "custom" })}
          >
            가라오케
          </button>
        </div>
      </div>

      {/* 크기/줄수/폭 */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          {label("폰트(px)")}
          <input
            type="number"
            min={12}
            max={48}
            value={v.fontSize}
            onChange={(e) =>
              apply({ fontSize: Number(e.target.value || 0), preset: "custom" })
            }
            className="w-full h-9 rounded-lg border border-slate-200 px-2 text-sm"
          />
        </div>
        <div>
          {label("줄 수")}
          <input
            type="number"
            min={1}
            max={4}
            value={v.lineClamp}
            onChange={(e) =>
              apply({
                lineClamp: Number(e.target.value || 2),
                preset: "custom",
              })
            }
            className="w-full h-9 rounded-lg border border-slate-200 px-2 text-sm"
          />
        </div>
        <div>
          {label("가로폭(%)")}
          <input
            type="range"
            min={40}
            max={95}
            value={v.maxWidthPct}
            onChange={(e) =>
              apply({ maxWidthPct: Number(e.target.value), preset: "custom" })
            }
            className="w-full"
          />
          <div className="text-[11px] text-slate-500 mt-1">
            {v.maxWidthPct}%
          </div>
        </div>
      </div>

      {/* 색/배경/외곽선 */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          {label("글자색")}
          <input
            type="color"
            value={v.color}
            onChange={(e) => apply({ color: e.target.value, preset: "custom" })}
            className="h-9 w-full rounded-lg border border-slate-200"
          />
        </div>
        <div>
          {label("배경색")}
          <input
            type="color"
            value={v.bgColor}
            onChange={(e) =>
              apply({ bgColor: e.target.value, preset: "custom" })
            }
            className="h-9 w-full rounded-lg border border-slate-200"
          />
        </div>
        <div>
          {label("배경 투명도")}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((v.bgOpacity ?? 0) * 100)}
            onChange={(e) =>
              apply({
                bgOpacity: Number(e.target.value) / 100,
                preset: "custom",
              })
            }
            className="w-full"
          />
          <div className="text-[11px] text-slate-500 mt-1">
            {Math.round((v.bgOpacity ?? 0) * 100)}%
          </div>
        </div>
      </div>

      {/* 위치/세이프마진/배경형태 */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          {label("세로 오프셋(%)")}
          <input
            type="range"
            min={0}
            max={20}
            value={v.vOffsetPct}
            onChange={(e) =>
              apply({ vOffsetPct: Number(e.target.value), preset: "custom" })
            }
            className="w-full"
          />
          <div className="text-[11px] text-slate-500 mt-1">{v.vOffsetPct}%</div>
        </div>
        <div>
          {label("세이프 마진(%)")}
          <input
            type="range"
            min={0}
            max={10}
            value={v.safeMarginPct}
            onChange={(e) =>
              apply({ safeMarginPct: Number(e.target.value), preset: "custom" })
            }
            className="w-full"
          />
          <div className="text-[11px] text-slate-500 mt-1">
            {v.safeMarginPct}%
          </div>
        </div>
        <div>
          {label("외곽선/배경형태")}
          <div className="flex gap-2">
            <button
              className={btn(v.outline)}
              onClick={() => apply({ outline: !v.outline, preset: "custom" })}
            >
              {v.outline ? "외곽선 On" : "외곽선 Off"}
            </button>
            <select
              value={v.bgStyle}
              onChange={(e) =>
                apply({ bgStyle: e.target.value, preset: "custom" })
              }
              className="h-8 rounded-lg border border-slate-200 text-xs px-2"
            >
              <option value="pill">Pill</option>
              <option value="box">Box</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
