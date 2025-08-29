// src/components/draftexport/parts/RenderOptions.jsx
import SectionCard from "../../assemble/parts/SectionCard";

const PRESETS = [
  { id: "540p", label: "540p · 1.5Mbps", w: 960, h: 540, bitrateK: 1500 },
  { id: "720p", label: "720p · 2.5Mbps", w: 1280, h: 720, bitrateK: 2500 },
  {
    id: "1080p",
    label: "1080p · 4Mbps (느림)",
    w: 1920,
    h: 1080,
    bitrateK: 4000,
  },
];

function secs(n = 0) {
  const s = Math.max(0, Math.floor(+n || 0));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function RenderOptions({
  scenes,
  totalSec,
  missing,
  preset,
  setPreset,
  range,
  setRange,
  burnSubs,
  setBurnSubs,
  watermark,
  setWatermark,
  busy,
  onStart,
  onCancel,
  progress,
  selectedSceneIdx,
}) {
  const chosen = PRESETS.find((p) => p.id === preset.id) || PRESETS[1];

  return (
    <SectionCard
      className="lg:col-span-4"
      title="초안 옵션"
      right={<span className="text-xs text-slate-500">빠른 렌더</span>}
    >
      <div className="space-y-4 text-sm">
        {/* 프리셋 */}
        <div>
          <div className="text-xs font-medium text-slate-700 mb-1">
            품질 프리셋
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p)}
                disabled={busy}
                className={`h-9 px-3 rounded-lg border ${
                  preset.id === p.id
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-1 text-[12px] text-slate-500">
            해상도{" "}
            <b>
              {chosen.w}×{chosen.h}
            </b>{" "}
            · 비트레이트 <b>{Math.round(chosen.bitrateK / 100) / 10}Mbps</b>
          </div>
        </div>

        {/* 범위 */}
        <div>
          <div className="text-xs font-medium text-slate-700 mb-1">
            렌더 범위
          </div>
          <div className="flex gap-3">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="range"
                value="all"
                checked={range === "all"}
                onChange={() => setRange("all")}
                disabled={busy}
              />
              전체 타임라인 ({secs(totalSec)})
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="range"
                value="scene"
                checked={range === "scene"}
                onChange={() => setRange("scene")}
                disabled={busy}
              />
              선택 씬만 #{selectedSceneIdx + 1}
            </label>
          </div>
        </div>

        {/* 옵션 */}
        <div className="grid grid-cols-1 gap-2">
          <label className="inline-flex items-center justify-between">
            <span>자막 하드번</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={burnSubs}
              onChange={(e) => setBurnSubs(!!e.target.checked)}
              disabled={busy}
            />
          </label>
          <label className="inline-flex items-center justify-between">
            <span>워터마크 “DRAFT”</span>
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={watermark}
              onChange={(e) => setWatermark(!!e.target.checked)}
              disabled={busy}
            />
          </label>
        </div>

        {/* 프리플라이트 */}
        <div className="mt-2 p-2 rounded-lg bg-slate-50 border text-[12px]">
          <div className="font-medium mb-1">프리플라이트</div>
          <div>
            씬 수: <b>{scenes.length}</b> · 총 길이: <b>{secs(totalSec)}</b>
          </div>
          {missing.length ? (
            <div className="mt-1 text-amber-700">
              빈 씬(소스 없음): #{missing.map((i) => i + 1).join(", ")}
            </div>
          ) : (
            <div className="mt-1 text-emerald-700">
              모든 씬에 소스가 있습니다.
            </div>
          )}
        </div>

        {/* 액션 */}
        <div className="flex items-center gap-2">
          <button
            className="h-10 px-4 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60"
            onClick={onStart}
            disabled={busy}
          >
            {busy ? "렌더링 중…" : "초안 렌더 시작"}
          </button>
          <button
            className="h-10 px-4 rounded-lg border text-sm disabled:opacity-60"
            onClick={onCancel}
            disabled={!busy}
          >
            취소
          </button>
        </div>

        {/* 진행률 */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[12px] text-slate-600 mb-1">
            <span>{progress.msg || (busy ? "작업 중…" : "대기")}</span>
            <span>{progress.pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded bg-slate-100 overflow-hidden">
            <div
              className="h-1.5 bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
