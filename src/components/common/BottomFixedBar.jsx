import { memo, useState, useCallback, useEffect } from "react";
import { Text, Button, tokens } from "@fluentui/react-components";
import { ChevronUpRegular, ChevronDownRegular, DismissRegular } from "@fluentui/react-icons";

/**
 * 공용 하단 고정 바 컴포넌트
 *
 * @param {Object} props
 * @param {boolean} props.isComplete - 완료 상태
 * @param {boolean} props.isLoading - 로딩 중 상태
 * @param {string} props.statusText - 상태 텍스트 (예: "✅ 대본 생성 완료")
 * @param {number} props.progress - 진행률 (0-100)
 * @param {string} props.borderColor - 상단 보더 색상
 * @param {React.ReactNode} props.expandedContent - 펼쳐졌을 때 표시할 내용
 * @param {Object} props.nextStepButton - 다음 단계 버튼 설정 { text, eventName }
 * @param {Function} props.onClose - 닫기 콜백 (완료 시에만 표시)
 */
const BottomFixedBar = memo(({
  isComplete = false,
  isLoading = false,
  statusText,
  progress = 0,
  borderColor,
  expandedContent,
  nextStepButton,
  onClose,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // isLoading이 true로 변경되면 (다시 시작하면) isClosed를 false로 리셋
  useEffect(() => {
    if (isLoading) {
      setIsClosed(false);
    }
  }, [isLoading]);

  // 완료 상태 로깅 (디버깅용)
  useEffect(() => {
    if (isComplete) {
      console.log("✅ BottomFixedBar 완료 상태 감지 - 다음 단계 버튼 표시됨");
    }
  }, [isComplete]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosed(true);
    onClose?.();
  }, [onClose]);

  // 닫힌 상태면 숨김
  if (isClosed) {
    return null;
  }

  // 기본 보더 색상 설정
  const finalBorderColor = borderColor || (isComplete ? tokens.colorPaletteGreenBorder2 : "#667eea");

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
          borderTop: `2px solid ${finalBorderColor}`,
          boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
          transition: "all 0.3s ease",
          animation: "slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) both",
        }}
      >
        {/* 미니 바 (항상 표시) */}
        <div
          onClick={toggleExpand}
          style={{
            padding: "16px 24px",
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
                  : isLoading
                  ? "#667eea"
                  : tokens.colorNeutralBackground3,
                animation: isLoading && !isComplete ? "pulse 2s infinite" : "none",
              }}
            />

            {/* 상태 텍스트 (로딩 중일 때 깜빡임) */}
            <Text
              size={300}
              weight="semibold"
              style={{
                animation: isLoading && !isComplete ? "textBlink 2s ease-in-out infinite" : "none"
              }}
            >
              {statusText}
            </Text>

            {/* 진행률 바 (로딩 중일 때만) */}
            {isLoading && !isComplete && progress !== undefined && (
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
                      width: `${progress}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #667eea 0%, #764ba2 100%)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>

                {/* 진행률 텍스트 */}
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, minWidth: 40 }}>
                  {progress}%
                </Text>
              </>
            )}
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* 다음 단계 버튼 (완료 시) */}
            {isComplete && nextStepButton && (
              <Button
                appearance="primary"
                size="medium"
                onClick={(e) => {
                  console.log("🔘 다음 단계 버튼 클릭됨!");
                  e.stopPropagation();

                  // 이벤트 이름이 있으면 먼저 이벤트 발생
                  if (nextStepButton.eventName) {
                    console.log("📤 이벤트 발생:", nextStepButton.eventName);
                    // 작은 딜레이를 두어 리스너가 준비될 수 있도록 함
                    setTimeout(() => {
                      console.log("📤 dispatchEvent 실행:", nextStepButton.eventName);
                      window.dispatchEvent(new CustomEvent(nextStepButton.eventName));
                    }, 100);
                  }

                  // onClick 콜백도 실행
                  nextStepButton.onClick?.();
                }}
                className="next-step-button-pulse"
                style={{
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  borderRadius: 8,
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  minWidth: "180px",
                }}
              >
                {nextStepButton.text}
              </Button>
            )}

            {/* 상세보기/접기 버튼 */}
            <Button
              appearance="subtle"
              size="medium"
              icon={isExpanded ? <ChevronDownRegular /> : <ChevronUpRegular />}
              style={{ minWidth: "100px" }}
            >
              {isExpanded ? "접기" : "상세보기"}
            </Button>

            {/* 닫기 버튼 (완료 시에만 표시) */}
            {isComplete && (
              <Button
                appearance="subtle"
                size="medium"
                icon={<DismissRegular />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                style={{ minWidth: "80px" }}
              >
                닫기
              </Button>
            )}
          </div>
        </div>

        {/* 확장된 상세 패널 */}
        {isExpanded && expandedContent && (
          <div
            style={{
              height: "380px",
              overflowY: "auto",
              borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
              background: tokens.colorNeutralBackground2,
              animation: "slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {expandedContent}
          </div>
        )}
      </div>

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
        @keyframes textBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            height: 0;
          }
          to {
            opacity: 1;
            height: 380px;
          }
        }
        @keyframes buttonPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 6px 24px rgba(102, 126, 234, 0.6);
          }
        }
        .next-step-button-pulse {
          animation: buttonPulse 2s ease-in-out infinite;
          box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
        }
        .next-step-button-pulse:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(102, 126, 234, 0.5);
        }
      `}</style>
    </>
  );
});

BottomFixedBar.displayName = "BottomFixedBar";

export default BottomFixedBar;
