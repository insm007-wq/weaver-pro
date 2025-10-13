import { useEffect, useState } from "react";
import { splitBalancedLines } from "../utils/metrics";

// 화면 비율에 따른 aspect ratio 계산
const getAspectRatioStyle = (aspectRatio) => {
  switch (aspectRatio) {
    case "9:16": return { aspectRatio: "9 / 16" };
    case "1:1": return { aspectRatio: "1 / 1" };
    case "4:3": return { aspectRatio: "4 / 3" };
    case "16:9":
    default:
      return { aspectRatio: "16 / 9" };
  }
};

export default function PreviewPlayer({
  currentTime,
  onSeek,
  scene,
  styleOpt,
  aspectRatio = "16:9", // 기본값 16:9
}) {
  const aspectStyle = getAspectRatioStyle(aspectRatio);
  const [subtitleSettings, setSubtitleSettings] = useState(null);

  // 전역 자막 설정 로드
  useEffect(() => {
    const loadSubtitleSettings = async () => {
      try {
        const settings = await window.api.getSetting("subtitleSettings");
        console.log("🎬 편집 및 다듬기 - 로드된 자막 설정:", settings);

        // 전역 설정이 있으면 사용, 없으면 기본값 사용
        if (settings) {
          setSubtitleSettings(settings);
        } else {
          // 기본값 (유튜브 표준 스타일 - SubtitleTab과 동일)
          const defaultSettings = {
            fontFamily: "noto-sans",
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: 0,
            textColor: "#FFFFFF",
            backgroundColor: "#000000",
            backgroundOpacity: 75,
            outlineColor: "#000000",
            outlineWidth: 3,
            shadowColor: "#000000",
            shadowOffset: 0,
            shadowBlur: 0,
            position: "bottom",
            horizontalAlign: "center",
            verticalPadding: 60,
            horizontalPadding: 24,
            maxWidth: 90,
            useBackground: true,
            backgroundRadius: 4,
            useOutline: true,
            useShadow: false,
            maxLines: 2,
          };
          console.log("📝 기본값 사용:", defaultSettings);
          setSubtitleSettings(defaultSettings);
        }
      } catch (error) {
        console.error("자막 설정 로드 실패:", error);
        // 에러 시에도 전체 기본값 사용
        setSubtitleSettings({
          fontFamily: "noto-sans",
          fontSize: 24,
          fontWeight: 600,
          lineHeight: 1.4,
          letterSpacing: 0,
          textColor: "#FFFFFF",
          backgroundColor: "#000000",
          backgroundOpacity: 80,
          outlineColor: "#000000",
          outlineWidth: 2,
          shadowColor: "#000000",
          shadowOffset: 2,
          shadowBlur: 4,
          position: "bottom",
          horizontalAlign: "center",
          verticalPadding: 40,
          horizontalPadding: 20,
          maxWidth: 80,
          useBackground: true,
          backgroundRadius: 8,
          useOutline: true,
          useShadow: true,
          maxLines: 2,
        });
      }
    };

    loadSubtitleSettings();

    // 설정 변경 이벤트 리스너
    const handleSettingsChanged = () => {
      console.log("🔄 설정 변경 이벤트 수신 - 자막 설정 재로드");
      loadSubtitleSettings();
    };

    window.addEventListener("settingsChanged", handleSettingsChanged);

    return () => {
      window.removeEventListener("settingsChanged", handleSettingsChanged);
    };
  }, []);

  return (
    <div
      className="relative w-full rounded-xl bg-slate-100 overflow-hidden"
      style={aspectStyle}
    >
      {/* (영상이 있다면 <video>로 교체) */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-slate-500 text-sm">미리보기 ({aspectRatio})</div>
      </div>

      {/* 자막 오버레이 - 전역 설정 적용 */}
      {scene && subtitleSettings && (
        <CaptionOverlay
          text={scene.text}
          subtitleSettings={subtitleSettings}
          aspectRatio={aspectRatio}
        />
      )}

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

function CaptionOverlay({ text, subtitleSettings, aspectRatio = "16:9" }) {
  if (!text || !subtitleSettings) return null;

  // 전역 설정 값 추출
  const {
    fontSize = 24,
    position = "bottom",
    horizontalAlign = "center",
    useOutline = true,
    outlineWidth = 2,
    useShadow = false,
    verticalPadding = 40,
    maxLines = 2,
    fontFamily = "malgun-gothic",
    fontWeight = 600,
    lineHeight = 1.4,
    letterSpacing = 0,
    textColor = "#FFFFFF",
    backgroundColor = "#000000",
    backgroundOpacity = 80,
    outlineColor = "#000000",
    shadowColor = "#000000",
    shadowOffset = 2,
    shadowBlur = 4,
    useBackground = true,
    backgroundRadius = 8,
    maxWidth = 80,
  } = subtitleSettings;

  // 프리뷰 크기 비율 계산 (1920x1080 기준 -> 프리뷰 크기로 스케일링)
  // RefineEditor 프리뷰는 상대적으로 작으므로 더 작은 스케일 사용
  const SCALE_FACTOR = 0.4; // 프리뷰 화면 비율 (실제 1920x1080의 40%)

  const scaledFontSize = fontSize * SCALE_FACTOR;
  const scaledOutlineWidth = outlineWidth * SCALE_FACTOR;
  const scaledShadowOffset = shadowOffset * SCALE_FACTOR;
  const scaledShadowBlur = shadowBlur * SCALE_FACTOR;
  const scaledBackgroundRadius = backgroundRadius * SCALE_FACTOR;
  const scaledLetterSpacing = letterSpacing * SCALE_FACTOR;

  // 폰트 패밀리 매핑
  const fontFamilyMap = {
    "noto-sans": "'Noto Sans KR', sans-serif",
    "malgun-gothic": "'Malgun Gothic', sans-serif",
    "apple-sd-gothic": "'Apple SD Gothic Neo', sans-serif",
    "nanumgothic": "'Nanum Gothic', sans-serif",
    "arial": "Arial, sans-serif",
    "helvetica": "Helvetica, sans-serif",
    "roboto": "'Roboto', sans-serif"
  };
  const fontFamilyStyle = fontFamilyMap[fontFamily] || "'Malgun Gothic', sans-serif";

  // 텍스트를 최대 줄 수에 맞게 분할
  // splitBalancedLines를 사용하여 maxLines에 맞게 균형있게 분할
  const lines = splitBalancedLines(text, maxLines);

  // 위치 계산 (FFmpeg MarginV와 동일하게)
  // 1080p 기준으로 verticalPadding을 픽셀로 계산
  // 프리뷰는 작으므로 비율로 변환
  const marginVPercent = (verticalPadding / 1080) * 100; // 예: 40px = 3.7%

  const positionStyle = {};
  if (position === "bottom") {
    positionStyle.bottom = `${marginVPercent}%`;
  } else if (position === "top") {
    positionStyle.top = `${marginVPercent}%`;
  } else {
    positionStyle.top = "50%";
    positionStyle.transform = horizontalAlign === "center" ? "translateY(-50%)" : "";
  }

  // 정렬 스타일
  const textAlignStyle = horizontalAlign === "left" ? "left" : horizontalAlign === "right" ? "right" : "center";
  const justifyContent = horizontalAlign === "left" ? "flex-start" : horizontalAlign === "right" ? "flex-end" : "center";

  // 외곽선 스타일 (사용자 설정 색상 적용 + 스케일링)
  const textShadowParts = [];
  if (useOutline && scaledOutlineWidth > 0) {
    // 8방향 외곽선 효과 (사용자 설정 outlineColor 사용)
    for (let angle = 0; angle < 360; angle += 45) {
      const x = Math.cos((angle * Math.PI) / 180) * scaledOutlineWidth;
      const y = Math.sin((angle * Math.PI) / 180) * scaledOutlineWidth;
      textShadowParts.push(`${x}px ${y}px 0 ${outlineColor}`);
    }
  }
  if (useShadow) {
    // 사용자 설정 그림자 색상, 오프셋, 블러 적용 (스케일링)
    textShadowParts.push(`${scaledShadowOffset}px ${scaledShadowOffset}px ${scaledShadowBlur}px ${shadowColor}`);
  }
  const textShadow = textShadowParts.length > 0 ? textShadowParts.join(", ") : "none";

  // 배경색 스타일 (투명도 적용)
  const bgOpacity = backgroundOpacity / 100;
  const bgColorRgb = backgroundColor.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [0, 0, 0];
  const backgroundColorStyle = useBackground
    ? `rgba(${bgColorRgb[0]}, ${bgColorRgb[1]}, ${bgColorRgb[2]}, ${bgOpacity})`
    : "transparent";

  return (
    <div
      className="absolute inset-x-0 flex"
      style={{
        ...positionStyle,
        justifyContent,
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          color: textColor,
          fontFamily: fontFamilyStyle,
          fontSize: `${scaledFontSize}px`,
          fontWeight,
          textAlign: textAlignStyle,
          textShadow,
          lineHeight,
          letterSpacing: `${scaledLetterSpacing}px`,
          maxWidth: `${maxWidth}%`,
          wordBreak: "keep-all",
          whiteSpace: maxLines > 1 ? "pre-wrap" : "nowrap",
          backgroundColor: backgroundColorStyle,
          padding: useBackground ? `${4 * SCALE_FACTOR}px ${8 * SCALE_FACTOR}px` : "0",
          borderRadius: useBackground ? `${scaledBackgroundRadius}px` : "0",
        }}
      >
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
