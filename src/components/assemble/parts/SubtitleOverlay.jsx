// 자막 오버레이: 비디오 위에 예쁘게 표시
export default function SubtitleOverlay({ text = "", options = {} }) {
  if (!text) return null;

  const {
    mode = "overlay", // overlay | banner | below | karaoke
    position = "bottom", // overlay일 때 top/bottom
    fontSize = 20,
    lineClamp = 2,
    color = "#FFFFFF",
    bgColor = "#000000",
    bgOpacity = 0.25,
    outline = true,
    maxWidthPct = 78, // 텍스트 박스 가로폭 %
    vOffsetPct = 8, // 화면 하단에서 띄우는 정도(%)
    safeMarginPct = 5, // 좌우 세이프 마진(%)
    bgStyle = "pill", // pill | box | none
  } = options || {};

  // 배경 스타일
  const bg =
    bgStyle === "none" ? "transparent" : `${bgColor}${toAlphaHex(bgOpacity)}`;

  const radius =
    bgStyle === "pill" ? "9999px" : bgStyle === "box" ? "12px" : "0";

  const containerStyle = {
    position: "absolute",
    left: `${safeMarginPct}%`,
    right: `${safeMarginPct}%`,
    width: `${maxWidthPct}%`,
    transform: "translateX(-50%)",
    fontSize: `${fontSize}px`,
    color,
    lineHeight: 1.35,
    textAlign: "left",
    ...(position === "bottom"
      ? { bottom: `${vOffsetPct}%`, left: "50%" }
      : { top: `${vOffsetPct}%`, left: "50%" }),
    ...(mode === "below"
      ? { position: "relative", transform: "none", left: 0, right: 0 }
      : {}),
    filter: outline ? "drop-shadow(0 1px 1px rgba(0,0,0,0.7))" : "none",
  };

  const boxStyle = {
    background: bg,
    borderRadius: radius,
    padding: "10px 14px",
    WebkitLineClamp: lineClamp,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  // 오버레이/배너가 아니면 비디오 위에 올리지 않음(아래 배치 모드는 컨테이너 측에서 사용)
  if (mode === "below") return null;

  return (
    <div style={containerStyle} className="pointer-events-none">
      <div style={boxStyle}>{text}</div>
    </div>
  );
}

function toAlphaHex(opacity = 0.25) {
  const v = Math.round(Math.min(1, Math.max(0, opacity)) * 255);
  return (v | (1 << 8)).toString(16).slice(1).toUpperCase().padStart(2, "0");
}
