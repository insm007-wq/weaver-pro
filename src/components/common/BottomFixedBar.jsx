import { memo, useState, useCallback, useEffect, useMemo } from "react";
import { Text, Button, tokens } from "@fluentui/react-components";
import { ChevronUpRegular, ChevronDownRegular, DismissRegular } from "@fluentui/react-icons";

// ============================================================================
// 🎨 스타일 및 설정 상수
// ============================================================================

const LAYOUT = {
  PADDING: "16px 24px",
  GAP: 12,
  BUTTON_GAP: 8,
  Z_INDEX: 1000,
  BORDER_WIDTH: 2,
  TOP_BORDER_WIDTH: 1,
};

const SIZES = {
  STATUS_ICON_SIZE: 10,
  PROGRESS_BAR_HEIGHT: 6,
  PROGRESS_BAR_RADIUS: 3,
  PROGRESS_MAX_WIDTH: 200,
  EXPANDED_HEIGHT: 380,
  BUTTON_MIN_WIDTH: 100,
  CLOSE_BUTTON_WIDTH: 80,
  NEXT_BUTTON_WIDTH: 180,
  PROGRESS_TEXT_MIN_WIDTH: 40,
};

const COLORS = {
  LOADING_DOT: "#667eea",
  GRADIENT_START: "#667eea",
  GRADIENT_END: "#764ba2",
  BUTTON_SHADOW_LIGHT: "rgba(102, 126, 234, 0.4)",
  BUTTON_SHADOW_DARK: "rgba(102, 126, 234, 0.6)",
  BOX_SHADOW: "0 -4px 12px rgba(0,0,0,0.1)",
};

const ANIMATIONS = {
  TRANSITION_SPEED: "0.3s",
  EASING: "ease",
  SLIDE_IN_DURATION: "0.5s",        // 진입 애니메이션 (부드러움)
  SLIDE_OUT_DURATION: "0.5s",       // 나가기 애니메이션
  EXPAND_DURATION: "0.35s",         // 펼치기 애니메이션 (빠름)
  COLLAPSE_DURATION: "0.35s",       // 접기 애니메이션 (빠르고 부드러움)
  LOADING_ANIMATION_SPEED: "2s",
  CUBIC_EASING: "cubic-bezier(0.34, 1.56, 0.64, 1)",  // 더 부드러운 easing (bounce)
  EASE_IN_OUT: "cubic-bezier(0.4, 0, 0.2, 1)",        // 표준 easing
  EASE_OUT: "cubic-bezier(0, 0, 0.2, 1)",             // 종료 애니메이션용
};

const TEXT_SIZES = {
  STATUS: 300,
  PROGRESS: 200,
};

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
  const [shouldRenderPanel, setShouldRenderPanel] = useState(false);  // 패널 렌더링 상태

  // isLoading이 true로 변경되면 (다시 시작하면) isClosed를 false로 리셋
  useEffect(() => {
    if (isLoading) {
      setIsClosed(false);
    }
  }, [isLoading]);

  // 펼침/접음 애니메이션 타이밍 처리
  useEffect(() => {
    if (isExpanded) {
      // 펼칠 때는 즉시 패널 렌더링
      setShouldRenderPanel(true);
    } else {
      // 접힐 때는 애니메이션 시간(0.35초) 후에 패널 제거
      const timer = setTimeout(() => {
        setShouldRenderPanel(false);
      }, 350);  // ANIMATIONS.COLLAPSE_DURATION = 0.35s = 350ms
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const toggleExpand = useCallback(() => {
    try {
      setIsExpanded((prev) => !prev);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[BottomFixedBar] 펼치기 토글 에러:', error);
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    try {
      setIsClosed(true);
      onClose?.();
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[BottomFixedBar] 닫기 핸들러 에러:', error);
      }
    }
  }, [onClose]);

  // 닫힌 상태면 숨김
  if (isClosed) {
    return null;
  }

  // 기본 보더 색상 설정 (메모이제이션)
  const finalBorderColor = useMemo(() => {
    return borderColor || (isComplete ? tokens.colorPaletteGreenBorder2 : COLORS.LOADING_DOT);
  }, [borderColor, isComplete]);

  // 상태 아이콘 배경색 (메모이제이션)
  const statusIconBg = useMemo(() => {
    if (isComplete) return tokens.colorPaletteGreenBackground3;
    if (isLoading) return COLORS.LOADING_DOT;
    return tokens.colorNeutralBackground3;
  }, [isComplete, isLoading]);

  // 상태 아이콘 애니메이션 (메모이제이션)
  const statusIconAnimation = useMemo(() => {
    return isLoading && !isComplete ? "pulse 2s infinite" : "none";
  }, [isLoading, isComplete]);

  // 상태 텍스트 애니메이션 (메모이제이션)
  const statusTextAnimation = useMemo(() => {
    return isLoading && !isComplete ? "textBlink 2s ease-in-out infinite" : "none";
  }, [isLoading, isComplete]);

  // 진행률 표시 여부 (메모이제이션)
  const shouldShowProgress = useMemo(() => {
    return isLoading && !isComplete && progress !== undefined;
  }, [isLoading, isComplete, progress]);

  // 확장/축소 애니메이션 상태 (메모이제이션)
  const expandedPanelAnimation = useMemo(() => {
    return isExpanded ? `slideDown ${ANIMATIONS.EXPAND_DURATION} ${ANIMATIONS.EASE_OUT}`
                      : `slideUp ${ANIMATIONS.COLLAPSE_DURATION} ${ANIMATIONS.EASE_OUT}`;
  }, [isExpanded]);

  return (
    <>
      {/* 하단 고정 바 */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: LAYOUT.Z_INDEX,
          background: tokens.colorNeutralBackground1,
          borderTop: `${LAYOUT.BORDER_WIDTH}px solid ${finalBorderColor}`,
          boxShadow: COLORS.BOX_SHADOW,
          transition: `all ${ANIMATIONS.TRANSITION_SPEED} ${ANIMATIONS.EASING}`,
          animation: `slideInUp ${ANIMATIONS.SLIDE_IN_DURATION} ${ANIMATIONS.EASE_OUT} both`,
          willChange: "transform, opacity",  // GPU 가속 활성화
        }}
      >
        {/* 미니 바 (항상 표시) */}
        <div
          onClick={toggleExpand}
          style={{
            padding: LAYOUT.PADDING,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: LAYOUT.GAP,
          }}
        >
          {/* 왼쪽: 상태 정보 */}
          <div style={{ display: "flex", alignItems: "center", gap: LAYOUT.GAP, flex: 1 }}>
            {/* 상태 아이콘 */}
            <div
              style={{
                width: SIZES.STATUS_ICON_SIZE,
                height: SIZES.STATUS_ICON_SIZE,
                borderRadius: "50%",
                background: statusIconBg,
                animation: statusIconAnimation,
              }}
            />

            {/* 상태 텍스트 (로딩 중일 때 깜빡임) */}
            <Text
              size={TEXT_SIZES.STATUS}
              weight="semibold"
              style={{
                animation: statusTextAnimation
              }}
            >
              {statusText}
            </Text>

            {/* 진행률 바 (로딩 중일 때만) */}
            {shouldShowProgress && (
              <>
                <div
                  style={{
                    flex: 1,
                    maxWidth: SIZES.PROGRESS_MAX_WIDTH,
                    height: SIZES.PROGRESS_BAR_HEIGHT,
                    background: tokens.colorNeutralBackground3,
                    borderRadius: SIZES.PROGRESS_BAR_RADIUS,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${COLORS.GRADIENT_START} 0%, ${COLORS.GRADIENT_END} 100%)`,
                      transition: `width ${ANIMATIONS.TRANSITION_SPEED} ${ANIMATIONS.EASING}`,
                    }}
                  />
                </div>

                {/* 진행률 텍스트 */}
                <Text size={TEXT_SIZES.PROGRESS} style={{ color: tokens.colorNeutralForeground3, minWidth: SIZES.PROGRESS_TEXT_MIN_WIDTH }}>
                  {progress}%
                </Text>
              </>
            )}
          </div>

          {/* 오른쪽: 액션 버튼들 */}
          <div style={{ display: "flex", alignItems: "center", gap: LAYOUT.BUTTON_GAP }}>
            {/* 다음 단계 버튼 (완료 시) */}
            {isComplete && nextStepButton && (
              <Button
                appearance="primary"
                size="medium"
                onClick={(e) => {
                  try {
                    e?.stopPropagation?.();

                    // 이벤트 이름이 있으면 이벤트 발생
                    if (nextStepButton?.eventName && typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent(nextStepButton.eventName));
                    }

                    // onClick 콜백도 실행
                    nextStepButton?.onClick?.();
                  } catch (error) {
                    if (process.env.NODE_ENV === 'development') {
                      console.error('[BottomFixedBar] 다음 단계 버튼 클릭 에러:', error);
                    }
                  }
                }}
                className="next-step-button-pulse"
                style={{
                  background: `linear-gradient(135deg, ${COLORS.GRADIENT_START} 0%, ${COLORS.GRADIENT_END} 100%)`,
                  borderRadius: 8,
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  minWidth: SIZES.NEXT_BUTTON_WIDTH,
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
              style={{ minWidth: SIZES.BUTTON_MIN_WIDTH }}
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
                  try {
                    e?.stopPropagation?.();
                    handleClose();
                  } catch (error) {
                    if (process.env.NODE_ENV === 'development') {
                      console.error('[BottomFixedBar] 닫기 버튼 클릭 에러:', error);
                    }
                  }
                }}
                style={{ minWidth: SIZES.CLOSE_BUTTON_WIDTH }}
              >
                닫기
              </Button>
            )}
          </div>
        </div>

        {/* 확장된 상세 패널 */}
        {expandedContent && shouldRenderPanel && (
          <div
            style={{
              maxHeight: isExpanded ? SIZES.EXPANDED_HEIGHT : 0,
              height: isExpanded ? SIZES.EXPANDED_HEIGHT : 0,
              overflowY: "hidden",
              borderTop: `${LAYOUT.TOP_BORDER_WIDTH}px solid ${tokens.colorNeutralStroke2}`,
              background: tokens.colorNeutralBackground2,
              animation: expandedPanelAnimation,
              opacity: isExpanded ? 1 : 0,
              transition: `opacity ${ANIMATIONS.COLLAPSE_DURATION} ${ANIMATIONS.EASE_OUT}, max-height ${ANIMATIONS.COLLAPSE_DURATION} ${ANIMATIONS.EASE_OUT}, height ${ANIMATIONS.COLLAPSE_DURATION} ${ANIMATIONS.EASE_OUT}`,
              willChange: "max-height, height, opacity",  // GPU 가속 활성화
            }}
          >
            <div style={{ overflowY: "auto", height: "100%" }}>
              {expandedContent}
            </div>
          </div>
        )}
      </div>

      {/* 애니메이션 스타일 */}
      <style>{`
        /* ============================================
           부드러운 진입 애니메이션
           ============================================ */
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

        /* ============================================
           상세 패널 펼치기 애니메이션 (부드러움)
           ============================================ */
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
            transform: scaleY(0.95);
          }
          to {
            opacity: 1;
            max-height: ${SIZES.EXPANDED_HEIGHT}px;
            transform: scaleY(1);
          }
        }

        /* ============================================
           상세 패널 접기 애니메이션 (부드러움)
           ============================================ */
        @keyframes slideUp {
          from {
            opacity: 1;
            max-height: ${SIZES.EXPANDED_HEIGHT}px;
            transform: scaleY(1);
          }
          to {
            opacity: 0;
            max-height: 0;
            transform: scaleY(0.95);
          }
        }

        /* ============================================
           로딩 중 상태 표시
           ============================================ */
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.2);
          }
        }

        @keyframes textBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* ============================================
           버튼 펄스 애니메이션
           ============================================ */
        @keyframes buttonPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 16px ${COLORS.BUTTON_SHADOW_LIGHT};
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 6px 24px ${COLORS.BUTTON_SHADOW_DARK};
          }
        }

        /* ============================================
           다음 단계 버튼 스타일
           ============================================ */
        .next-step-button-pulse {
          animation: buttonPulse ${ANIMATIONS.LOADING_ANIMATION_SPEED} ease-in-out infinite;
          box-shadow: 0 4px 16px ${COLORS.BUTTON_SHADOW_LIGHT};
          transition: all ${ANIMATIONS.TRANSITION_SPEED} ${ANIMATIONS.EASING};
          transform: translateZ(0);  /* GPU 가속 활성화 */
        }

        .next-step-button-pulse:hover {
          transform: translateY(-2px) translateZ(0);
          box-shadow: 0 6px 24px ${COLORS.BUTTON_SHADOW_DARK};
        }

        .next-step-button-pulse:active {
          transform: translateY(0) translateZ(0);
        }
      `}</style>
    </>
  );
});

BottomFixedBar.displayName = "BottomFixedBar";

export default BottomFixedBar;
