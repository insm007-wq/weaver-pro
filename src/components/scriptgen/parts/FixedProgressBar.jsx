import { memo, useState, useCallback } from "react";
import { Text, Button, tokens } from "@fluentui/react-components";
import { ChevronUpRegular, ChevronDownRegular, DismissRegular } from "@fluentui/react-icons";

/**
 * 화면 하단 고정 미니 진행바
 * ChatGPT/Notion AI 스타일
 */
const FixedProgressBar = memo(({ fullVideoState, doc, isLoading, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllScenes, setShowAllScenes] = useState(false);

  const isGenerating = fullVideoState?.isGenerating || isLoading;
  const currentStep = fullVideoState?.currentStep || "idle";
  const isComplete = ["complete", "completed"].includes(currentStep);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  // 표시할 내용이 없으면 숨김 (hooks 호출 후에 체크)
  if (!isGenerating && !isComplete && !doc) {
    return null;
  }

  // 전체 진행률 계산
  const steps = ["script", "audio", "subtitle"];
  const avgProgress = Math.round(
    steps.reduce((acc, k) => acc + (fullVideoState?.progress?.[k] || 0), 0) / steps.length
  );

  // 현재 단계 이름
  const getStepName = (step) => {
    const names = {
      script: "대본 생성",
      audio: "음성 합성",
      subtitle: "자막 생성",
      complete: "완료",
      completed: "완료",
      idle: "대기",
    };
    return names[step] || step;
  };

  return (
    <>
      {/* 하단 고정 미니 바 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: tokens.colorNeutralBackground1,
          borderTop: `2px solid ${isComplete ? tokens.colorPaletteGreenBorder2 : "#667eea"}`,
          boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
        }}
      >
        {/* 미니 바 (항상 표시) */}
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
            {/* 상태 아이콘 */}
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: isComplete
                  ? tokens.colorPaletteGreenBackground3
                  : isGenerating
                  ? "#667eea"
                  : tokens.colorNeutralBackground3,
                animation: isGenerating && !isComplete ? "pulse 2s infinite" : "none",
              }}
            />

            {/* 상태 텍스트 */}
            <Text size={300} weight="semibold">
              {isComplete ? "✅ 대본 생성 완료" : `🎬 ${getStepName(currentStep)}`}
            </Text>

            {/* 진행률 바 (생성 중일 때만) */}
            {isGenerating && !isComplete && (
              <>
                <div
                  style={{
                    flex: 1,
                    maxWidth: 200,
                    height: 6,
                    background: tokens.colorNeutralBackground3,
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${avgProgress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                {/* 진행률 텍스트 */}
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, minWidth: 40 }}>
                  {avgProgress}%
                </Text>
              </>
            )}
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isComplete && (
              <Button
                appearance="subtle"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose?.();
                }}
                icon={<DismissRegular />}
              >
                닫기
              </Button>
            )}

            <Button appearance="subtle" size="small" icon={isExpanded ? <ChevronDownRegular /> : <ChevronUpRegular />}>
              {isExpanded ? "접기" : "상세보기"}
            </Button>
          </div>
        </div>

        {/* 확장된 상세 패널 */}
        {isExpanded && (
          <div
            style={{
              maxHeight: "60vh",
              overflowY: "auto",
              borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
              background: tokens.colorNeutralBackground2,
              padding: "16px 20px",
              animation: "slideUp 0.3s ease",
            }}
          >
            {/* 완료된 대본 표시 */}
            {doc && (
              <div>
                <Text size={300} weight="semibold" style={{ marginBottom: 12, display: "block" }}>
                  📖 생성된 대본
                </Text>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(showAllScenes ? doc.scenes : doc.scenes?.slice(0, 5))?.map((scene, index) => (
                    <div
                      key={index}
                      style={{
                        padding: 12,
                        background: tokens.colorNeutralBackground1,
                        borderRadius: 8,
                        border: `1px solid ${tokens.colorNeutralStroke1}`,
                      }}
                    >
                      <Text size={250} weight="semibold" style={{ color: "#667eea", marginBottom: 4, display: "block" }}>
                        장면 {index + 1}
                      </Text>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground2, lineHeight: 1.5 }}>
                        {scene.text}
                      </Text>
                    </div>
                  ))}

                  {doc.scenes?.length > 5 && (
                    <Button
                      appearance="subtle"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllScenes((prev) => !prev);
                      }}
                      style={{
                        width: "100%",
                        marginTop: 4,
                      }}
                    >
                      {showAllScenes ? "접기" : `+ ${doc.scenes.length - 5}개 장면 더 보기`}
                    </Button>
                  )}
                </div>

                {/* 완료 시 다음 단계 버튼 */}
                {isComplete && (
                  <Button
                    appearance="primary"
                    size="large"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.dispatchEvent(new CustomEvent("navigate-to-assemble"));
                    }}
                    style={{
                      width: "100%",
                      marginTop: 12,
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      borderRadius: 8,
                      fontSize: "14px",
                      fontWeight: 600,
                      border: "none",
                    }}
                  >
                    ➡️ 다음 단계: 미디어 준비
                  </Button>
                )}
              </div>
            )}

            {/* 생성 중 메시지 */}
            {isGenerating && !doc && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <Text size={300} weight="semibold" style={{ marginBottom: 8, display: "block" }}>
                  🤖 AI가 대본을 생성하고 있습니다...
                </Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  잠시만 기다려주세요
                </Text>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
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

FixedProgressBar.displayName = "FixedProgressBar";

export default FixedProgressBar;
