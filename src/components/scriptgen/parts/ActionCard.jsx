import { memo, useMemo, useCallback } from "react";
import { Card, Text, Button, tokens, Spinner } from "@fluentui/react-components";
import { DocumentEditRegular, PlayRegular, WarningRegular } from "@fluentui/react-icons";
import { useCardStyles } from "../../../styles/commonStyles";
import { useScriptGenerator } from "../../../hooks/useScriptGenerator";
import { useGenerationTimer } from "../../../hooks/useGenerationTimer";

// 로딩 애니메이션 스타일
const loadingAnimation = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .loading-text {
    animation: pulse 2s ease-in-out infinite;
    color: rgba(102, 126, 234, 0.8);
    display: inline-flex;
    align-items: center;
  }
`;

// 스텝 이름 변환
function getStepDisplayName(step) {
  const stepNames = {
    script: "대본 생성 중...",
    audio: "음성 합성 중...",
    images: "이미지 생성 중...",
    video: "영상 합성 중...",
    subtitle: "자막 생성 중...",
  };
  return stepNames[step] || step;
}

const ActionCard = memo(
  ({
    selectedMode,
    form,
    isLoading,
    fullVideoState,
    setFullVideoState,
    voices,
    api,
    runGenerate,
    setError,
    setIsLoading,
    setDoc,
    chunkProgress,
    centered = false,
  }) => {
    const cardStyles = useCardStyles();

    // 새 훅 사용
    const { runScriptMode, cancelGeneration, isCancelling } = useScriptGenerator();
    const { remainingTime } = useGenerationTimer(
      fullVideoState?.isGenerating,
      fullVideoState?.startTime,
      fullVideoState?.currentStep,
      form?.durationMin
    );

    // 안전한 폼 데이터 처리
    const safeForm = useMemo(
      () => ({
        topic: form?.topic || "",
        referenceScript: form?.referenceScript || "",
        promptName: form?.promptName || "",
        aiEngine: form?.aiEngine || "",
      }),
      [form?.topic, form?.referenceScript, form?.promptName, form?.aiEngine]
    );

    // 유효성 검사 메모화
    const validationState = useMemo(() => {
      const hasValidTopic = safeForm.topic.trim();
      const hasValidReference = safeForm.referenceScript.trim() && safeForm.referenceScript.trim().length >= 50;
      const isReferenceOnlyMode = hasValidReference && !hasValidTopic;

      const errors = [];
      if (!hasValidTopic && !hasValidReference) {
        errors.push("• 영상 주제 입력 또는 레퍼런스 대본 입력 (50자 이상)");
      }
      if (!isReferenceOnlyMode && !safeForm.promptName) {
        errors.push("• 대본 생성 프롬프트 선택");
      }

      return {
        hasValidTopic,
        hasValidReference,
        isReferenceOnlyMode,
        errors,
      };
    }, [safeForm.topic, safeForm.referenceScript, safeForm.promptName]);

    const isDisabled = useMemo(
      () => isLoading || validationState.errors.length > 0 || fullVideoState?.isGenerating,
      [isLoading, validationState.errors.length, fullVideoState?.isGenerating]
    );

    // 생성 시작 핸들러 (훅으로 위임)
    const handleStartGeneration = useCallback(async () => {
      await runScriptMode(form, {
        form,
        voices,
        api,
        runGenerate,
        setError,
        setIsLoading,
        setDoc,
        setFullVideoState,
      });
    }, [runScriptMode, form, voices, api, runGenerate, setError, setIsLoading, setDoc, setFullVideoState]);

    // 모드 설정 메모화
    const modes = useMemo(
      () => ({
        script_mode: {
          title: "📝 대본 생성 (기본 모드)",
          description: "빠르게 대본과 음성을 생성하여 콘텐츠 제작을 시작합니다",
          buttonText: "📝 대본 생성 시작",
          loadingText: "대본 생성 중",
          completedText: "✅ 대본 생성 완료",
          icon: DocumentEditRegular,
          gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          estimatedTime: "3-5분",
          outputFormat: "대본 텍스트 + 음성 파일 + SRT 자막",
          onGenerate: handleStartGeneration,
        },
      }),
      [handleStartGeneration]
    );

    const currentMode = useMemo(() => modes[selectedMode], [modes, selectedMode]);

    // 스타일 메모화
    const styles = useMemo(
      () => ({
        warningCard: {
          textAlign: "center",
          padding: tokens.spacingVerticalXL,
        },
        centeredCard: {
          padding: "12px 16px",
          borderRadius: "16px",
          border: `1px solid ${tokens.colorNeutralStroke2}`,
          backgroundColor: tokens.colorNeutralBackground1,
          height: "fit-content",
          display: "flex",
          flexDirection: "column",
          boxShadow: "none",
        },
        headerContainer: {
          marginBottom: tokens.spacingVerticalS,
        },
        headerContent: {
          display: "flex",
          alignItems: "center",
          gap: 8,
        },
        buttonContainer: {
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginTop: tokens.spacingVerticalS,
        },
        button: {
          width: "100%",
          padding: "12px 20px",
          fontSize: "14px",
          fontWeight: "bold",
        },
        descriptionContainer: {
          marginTop: tokens.spacingVerticalS,
          padding: tokens.spacingVerticalXS,
        },
      }),
      []
    );

    if (!selectedMode || !currentMode) {
      return (
        <Card className={cardStyles.settingsCard} style={styles.warningCard}>
          <WarningRegular style={{ fontSize: 48, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }} />
          <Text size={400} style={{ color: tokens.colorNeutralForeground3 }}>
            생성 모드를 선택해주세요
          </Text>
        </Card>
      );
    }

    // 중앙 배치 최적화 레이아웃
    if (centered) {
      return (
        <>
          <style>{loadingAnimation}</style>
          <Card className={cardStyles.settingsCard} style={styles.centeredCard}>
            {/* 헤더 */}
            <div style={styles.headerContainer}>
              <div style={styles.headerContent}>
                <PlayRegular />
                <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
                  {currentMode.title}
                </Text>
              </div>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                {currentMode.description}
              </Text>
            </div>

            {/* 실행 버튼 영역 */}
            <div style={styles.buttonContainer}>
              <Button
                appearance={isCancelling ? "secondary" : fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? "secondary" : "primary"}
                icon={isCancelling ? <Spinner size="tiny" /> : fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? null : <PlayRegular />}
                onClick={() => {
                  // 생성 중이면 중지, 아니면 생성 시작
                  if (fullVideoState.isGenerating && fullVideoState.currentStep !== "completed") {
                    cancelGeneration({
                      setFullVideoState,
                      setIsLoading,
                      setDoc,
                    });
                  } else {
                    // 생성 시작
                    currentMode.onGenerate();
                  }
                }}
                disabled={isCancelling || (!fullVideoState.isGenerating && isDisabled)}
                style={styles.button}
              >
                {isCancelling ? (
                  "⏳ 취소 중..."
                ) : fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? (
                  "⏹ 생성 중지"
                ) : (
                  <span className={fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? "loading-text" : ""}>
                    {fullVideoState.currentStep === "completed"
                      ? "🔄 새 대본 생성"
                      : currentMode.buttonText}
                  </span>
                )}
              </Button>

              {/* 생성 중 진행 상황 텍스트 */}
              {fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" && (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, textAlign: "center" }}>
                  {chunkProgress
                    ? `청크 ${chunkProgress.current}/${chunkProgress.total} 생성 중... (${chunkProgress.progress}%)`
                    : fullVideoState.currentStep
                    ? `${getStepDisplayName(fullVideoState.currentStep)} ${remainingTime || '진행 중...'}`
                    : currentMode.loadingText}
                </Text>
              )}
            </div>


          {/* 상태 메시지 영역 */}
          {fullVideoState.error ? (
            <div style={styles.descriptionContainer}>
              <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
                ❌ 오류: {fullVideoState.error}
              </Text>
            </div>
          ) : fullVideoState.currentStep === "completed" ? (
            <div style={styles.descriptionContainer}>
              <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
                ✅ 대본 생성이 완료되었습니다! 새로운 주제로 다시 생성하시겠습니까?
              </Text>
            </div>
          ) : isDisabled && validationState.errors.length > 0 ? (
            <div style={styles.descriptionContainer}>
              <Text size={200}>
                <span style={{ color: tokens.colorPaletteRedForeground1, fontWeight: 600 }}>💡 필수 입력:</span>
                <span style={{ color: tokens.colorNeutralForeground3 }}> {validationState.errors.join(", ")}</span>
              </Text>
            </div>
          ) : null}
        </Card>
        </>
      );
    }

    // 기본 레이아웃 (사용 안함 - centered만 사용)
    return null;
  }
);

// 컴포넌트 이름 설정 (개발자 도구에서 디버깅 편의)
ActionCard.displayName = "ActionCard";

export default ActionCard;
