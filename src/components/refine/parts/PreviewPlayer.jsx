import { splitBalancedLines } from "../utils/metrics";

export default function PreviewPlayer({
  currentTime,
  onSeek,
  scene,
  styleOpt,
}) {
  return (
    <div className="relative w-full aspect-video rounded-xl bg-slate-100 overflow-hidden">
      {/* (영상이 있다면 <video>로 교체) */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-slate-500 text-sm">미리보기</div>
      </div>

      {/* 자막 오버레이 */}
      {scene && <CaptionOverlay text={scene.text} styleOpt={styleOpt} />}

      {/* 단순 스크럽바 */}
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(currentTime * 20)}
        className="absolute left-4 right-4 bottom-4"
        onChange={(e) => onSeek(Number(e.target.value) / 20)}
      />
    </div>
  );
}

function CaptionOverlay({ text, styleOpt }) {
  const [l1, l2] = splitBalancedLines(text || "", styleOpt.maxLineChars);
  const base = "px-4 py-2 rounded-md";
  const outline = styleOpt.outline
    ? "drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
    : "";

  const alignClass =
    styleOpt.align === "left"
      ? "items-start text-left"
      : styleOpt.align === "right"
      ? "items-end text-right"
      : "items-center text-center";

  return (
    <div className={`absolute inset-x-0 bottom-[8%] grid ${alignClass}`}>
      <div className={`${base} ${outline}`}>
        <div
          className="text-white leading-tight"
          style={{ fontSize: `${styleOpt.fontSize}px`, lineHeight: 1.15 }}
        >
          <div>{l1}</div>
          {l2 ? <div>{l2}</div> : null}
        </div>
      </div>
    </div>
  );
}
