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
        setSubtitleSettings(settings || {
          fontFamily: "malgun-gothic",
          fontSize: 24,
          position: "bottom",
          horizontalAlign: "center",
          useOutline: true,
          outlineWidth: 2,
          useShadow: false,
          verticalPadding: 40,
          maxLines: 2
        });
      } catch (error) {
        console.error("자막 설정 로드 실패:", error);
        setSubtitleSettings({
          fontFamily: "malgun-gothic",
          fontSize: 24,
          position: "bottom",
          horizontalAlign: "center",
          useOutline: true,
          outlineWidth: 2,
          useShadow: false,
          verticalPadding: 40,
          maxLines: 2
        });
      }
    };
    loadSubtitleSettings();
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
  } = subtitleSettings;

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

  // 텍스트를 최대 줄 수에 맞게 분할 (간단하게 줄바꿈 기준)
  const lines = text.split('\n').slice(0, maxLines);

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

  // 외곽선 스타일 (FFmpeg Outline 효과 재현)
  const textShadowParts = [];
  if (useOutline && outlineWidth > 0) {
    // 4방향 외곽선 효과
    for (let angle = 0; angle < 360; angle += 45) {
      const x = Math.cos((angle * Math.PI) / 180) * outlineWidth;
      const y = Math.sin((angle * Math.PI) / 180) * outlineWidth;
      textShadowParts.push(`${x}px ${y}px 0 rgba(0,0,0,0.8)`);
    }
  }
  if (useShadow) {
    textShadowParts.push(`2px 2px 4px rgba(0,0,0,0.9)`);
  }
  const textShadow = textShadowParts.length > 0 ? textShadowParts.join(", ") : "none";

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
          color: "#FFFFFF",
          fontFamily: fontFamilyStyle,
          fontSize: `${fontSize}px`,
          fontWeight: 600,
          textAlign: textAlignStyle,
          textShadow,
          lineHeight: 1.4,
          maxWidth: "80%",
          wordBreak: "keep-all",
          whiteSpace: maxLines > 1 ? "pre-wrap" : "nowrap",
        }}
      >
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
