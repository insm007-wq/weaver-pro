// 자막 오버레이: 비디오 위에 예쁘게 표시 (문장 바뀔 때 부드럽게 페이드)
export default function SubtitleOverlay({ text = "", options = {} }) {
  if (!text) return null;

  const {
    mode = "overlay", // overlay | banner | below
    position = "bottom", // overlay일 때 top/bottom
    fontSize = 26, // 살짝 키움
    lineClamp = 2,
    color = "#FFFFFF",
    bgColor = "#000000",
    bgOpacity = 0.35, // 가독성↑
    outline = true,
    maxWidthPct = 90, // 중앙 정렬 + 내부 박스는 내용폭만큼
    vOffsetPct = 8,
    safeMarginPct = 5,
    bgStyle = "pill", // pill 느낌
    lineHeight = 1.35,
  } = options || {};

  // 배경 색상 투명도 → 16진수
  const toAlphaHex = (opacity = 0.35) => {
    const v = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
    return (v | (1 << 8)).toString(16).slice(1).toUpperCase().padStart(2, "0");
  };

  // 전체 컨테이너: 중앙 정렬(가로는 꽉, 내부 박스만 내용폭)
  const containerStyle = {
    position: mode === "below" ? "relative" : "absolute",
    inset: "auto 0",
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
    ...(position === "bottom"
      ? { bottom: `${vOffsetPct}%` }
      : { top: `${vOffsetPct}%` }),
    paddingLeft: `${safeMarginPct}%`,
    paddingRight: `${safeMarginPct}%`,
    maxWidth: `${maxWidthPct}%`,
    margin: "0 auto",
  };

  // 내용 박스: 텍스트 길이에 맞춰 배경이 줄어듦
  const bgWrapStyle = {
    display: "inline-block",
    background:
      bgStyle === "none" ? "transparent" : `${bgColor}${toAlphaHex(bgOpacity)}`,
    borderRadius:
      bgStyle === "pill" ? "9999px" : bgStyle === "box" ? "12px" : 0,
    padding: "10px 16px",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    backdropFilter: "blur(2px)",
    boxShadow: "0 2px 10px rgba(0,0,0,.25)",
  };

  // 텍스트: 가운데 정렬 + 2줄 클램프
  const textStyle = {
    color,
    fontSize: `${fontSize}px`,
    fontWeight: 500,
    lineHeight,
    letterSpacing: ".2px",
    textAlign: "center",
    display: "-webkit-box",
    WebkitLineClamp: lineClamp,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    wordBreak: "keep-all",
    whiteSpace: "pre-wrap",
    textWrap: "balance",
    filter: outline ? "drop-shadow(0 1px 1px rgba(0,0,0,.9))" : "none",
    WebkitTextStroke: outline ? "0.15px rgba(0,0,0,.25)" : "none",
  };

  if (mode === "below") return null;

  return (
    <div style={containerStyle} className="subtitle-overlay">
      <div style={bgWrapStyle}>
        <div style={textStyle}>{text}</div>
      </div>
      <style>{`
        .subtitle-overlay {
          /* 새 자막이 뜰 때 살짝 위에서 페이드인 */
          animation: subtFade .2s ease-out;
        }
        @keyframes subtFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
