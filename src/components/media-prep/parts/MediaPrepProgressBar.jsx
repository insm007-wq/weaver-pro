import { memo, useState, useCallback } from "react";
import { Text, Button, tokens } from "@fluentui/react-components";
import { ChevronUpRegular, ChevronDownRegular } from "@fluentui/react-icons";

/**
 * 미디어 준비 하단 고정 진행바
 * 키워드 추출 완료 시 표시
 */
const MediaPrepProgressBar = memo(({ assets, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 키워드가 없으면 숨김
  if (!assets || assets.length === 0) {
    return null;
  }

  return (
    <>
      {/* 하단 고정 바 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: tokens.colorNeutralBackground1,
          borderTop: `2px solid ${tokens.colorPaletteGreenBorder2}`,
          boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
        }}
      >
        {/* 미니 바 */}
        <div
          onClick={toggleExpand}
          style={{
            padding: "12px 20px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* 왼쪽: 상태 정보 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: tokens.colorPaletteGreenBackground3,
              }}
            />

            <Text size={300} weight="semibold">
              ✅ 키워드 추출 완료 ({assets.length}개)
            </Text>
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              appearance="primary"
              size="medium"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(new CustomEvent("navigate-to-download"));
              }}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: 8,
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
              }}
            >
              ➡️ 다음 단계: 미디어 다운로드
            </Button>

            <Button appearance="subtle" size="small" icon={isExpanded ? <ChevronDownRegular /> : <ChevronUpRegular />}>
              {isExpanded ? "접기" : "상세보기"}
            </Button>
          </div>
        </div>

        {/* 확장된 상세 패널 */}
        {isExpanded && (
          <div
            style={{
              maxHeight: "50vh",
              overflowY: "auto",
              borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
              background: tokens.colorNeutralBackground2,
              padding: "16px 20px",
              animation: "slideUp 0.3s ease",
            }}
          >
            <Text size={300} weight="semibold" style={{ marginBottom: 12, display: "block" }}>
              📝 추출된 키워드
            </Text>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {assets.map((asset, index) => (
                <div
                  key={index}
                  style={{
                    padding: "8px 12px",
                    background: tokens.colorNeutralBackground1,
                    borderRadius: 6,
                    border: `1px solid ${tokens.colorNeutralStroke1}`,
                  }}
                >
                  <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                    {asset.keyword || asset}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
});

MediaPrepProgressBar.displayName = "MediaPrepProgressBar";

export default MediaPrepProgressBar;
