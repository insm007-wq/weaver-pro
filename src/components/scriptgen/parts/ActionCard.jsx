import { memo, useMemo, useCallback, useState, useEffect } from "react";
import { Card, Text, Button, tokens } from "@fluentui/react-components";
import { DocumentEditRegular, SparkleRegular, PlayRegular, WarningRegular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { AI_ENGINE_OPTIONS } from "../../../constants/scriptSettings";
import { generateAudioAndSubtitles } from "../../../utils/audioSubtitleGenerator";

// 전체 작업 예상 시간 계산
function getTotalEstimatedTime(mode, fullVideoState) {
  if (!fullVideoState?.startTime) return "";

  const steps = mode === "automation_mode"
    ? ["script", "audio", "images", "video"]
    : ["script", "audio", "subtitle"];

  const now = new Date();
  const elapsedMs = now - new Date(fullVideoState.startTime);

  // 전체 평균 진행률
  const totalProgress = steps.reduce((acc, step) =>
    acc + (fullVideoState.progress?.[step] || 0), 0) / steps.length;

  if (totalProgress <= 0) {
    return ""; // 초기에는 표시 안함
  }

  if (totalProgress >= 100) return "";

  // 전체 작업 예상 시간
  const estimatedTotalMs = (elapsedMs / totalProgress) * 100;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  const remainingMin = Math.floor(remainingMs / 1000 / 60);
  const remainingSec = Math.floor((remainingMs / 1000) % 60);

  if (remainingMin > 0) {
    return `약 ${remainingMin}분 ${remainingSec}초 남음`;
  } else if (remainingSec > 10) {
    return `약 ${remainingSec}초 남음`;
  } else {
    return "곧 완료";
  }
}

// 스텝 이름 변환
function getStepDisplayName(step) {
  const stepNames = {
    script: "대본 생성 중",
    audio: "음성 합성 중",
    images: "이미지 생성 중",
    video: "영상 합성 중",
    subtitle: "자막 생성 중",
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
    centered = false,
  }) => {
    const cardStyles = useCardStyles();
    const settingsStyles = useSettingsStyles();

    // 작업 취소를 위한 AbortController 관리
    const [currentOperation, setCurrentOperation] = useState(null);

    // 실시간 시간 업데이트를 위한 상태
    const [estimatedTime, setEstimatedTime] = useState("");

    // 실시간 시간 업데이트 (1초마다)
    useEffect(() => {
      if (!fullVideoState?.isGenerating) {
        setEstimatedTime("");
        return;
      }

      const updateTime = () => {
        const time = getTotalEstimatedTime(fullVideoState.mode, fullVideoState);
        setEstimatedTime(time);
      };

      updateTime(); // 즉시 실행
      const interval = setInterval(updateTime, 1000); // 1초마다 업데이트

      return () => clearInterval(interval);
    }, [fullVideoState?.isGenerating, fullVideoState?.mode, fullVideoState?.startTime, fullVideoState?.progress]);

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

    const selectedEngine = useMemo(() => AI_ENGINE_OPTIONS.find((engine) => engine.key === safeForm.aiEngine), [safeForm.aiEngine]);

    // 로그 추가 헬퍼 함수
    const addLog = useCallback(
      (message, type = "info") => {
        const timestamp = new Date().toLocaleTimeString();
        setFullVideoState((prev) => ({
          ...prev,
          logs: [...(prev.logs || []), { timestamp, message, type }],
        }));
      },
      [setFullVideoState]
    );

    // 상태 업데이트 헬퍼 함수
    const updateFullVideoState = useCallback(
      (updates) => {
        setFullVideoState((prev) => ({
          ...prev,
          ...updates,
          logs: updates.logs ? [...(prev.logs || []), ...updates.logs] : prev.logs,
        }));
      },
      [setFullVideoState]
    );

    // 대본 생성 모드 실행 함수
    const runScriptMode = useCallback(
      async (formData) => {
        // 기존 작업이 진행 중이면 취소
        if (currentOperation) {
          currentOperation.abort();
        }

        const abortController = new AbortController();
        setCurrentOperation(abortController);

        setError("");
        setIsLoading(true);
        setDoc(null);

        setFullVideoState({
          isGenerating: true,
          mode: "script_mode",
          currentStep: "script",
          progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
          results: { script: null, audio: null, images: [], video: null },
          streamingScript: "",
          error: null,
          startTime: new Date(),
          logs: [],
        });

        try {
          // 전역 설정에서 영상 폴더 경로 가져오기
          let videoSaveFolder = null;
          if (!window.api?.getSetting) {
            throw new Error("API를 사용할 수 없습니다.");
          }

          try {
            const videoFolderSettingResult = await window.api.getSetting("videoSaveFolder");
            const videoFolderSetting = videoFolderSettingResult?.value || videoFolderSettingResult;
            if (videoFolderSetting) {
              videoSaveFolder = videoFolderSetting;
            }
          } catch (settingError) {
            console.warn("⚠️ 대본 모드 - 전역 설정 읽기 실패:", settingError.message);
          }

          addLog("📝 AI 대본 생성 중...");
          const scriptResult = await runGenerate(formData);

          if (scriptResult && scriptResult.scenes && Array.isArray(scriptResult.scenes) && scriptResult.scenes.length > 0) {
            setFullVideoState((prev) => ({
              ...prev,
              currentStep: "audio",
              progress: { ...prev.progress, script: 100, audio: 0 },
            }));

            await generateAudioAndSubtitles(scriptResult, "script_mode", {
              form,
              voices,
              setFullVideoState,
              api,
              addLog,
            });
          } else {
            throw new Error("대본이 생성되지 않았습니다. 먼저 대본을 생성해주세요.");
          }
        } catch (error) {
          if (error.name === "AbortError") {
            addLog("⏹️ 작업이 취소되었습니다.", "info");
          } else {
            console.error("대본 생성 오류:", error);
            setError(error.message);
          }
        } finally {
          setIsLoading(false);
          setCurrentOperation(null);
        }
      },
      [currentOperation, setError, setIsLoading, setDoc, setFullVideoState, addLog, runGenerate, form, voices, api]
    );

    // 모드 설정 메모화
    const modes = useMemo(
      () => ({
        script_mode: {
          title: "📝 대본 생성 (기본 모드)",
          description: "빠르게 대본과 음성을 생성하여 콘텐츠 제작을 시작합니다",
          buttonText: "📝 대본 생성 시작",
          loadingText: "대본 생성 중...",
          icon: DocumentEditRegular,
          gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
          estimatedTime: "3-5분",
          outputFormat: "대본 텍스트 + 음성 파일 + SRT 자막",
          onGenerate: () => runScriptMode(form),
        },
      }),
      [runScriptMode, form]
    );

    const currentMode = useMemo(() => modes[selectedMode], [modes, selectedMode]);
    const Icon = currentMode?.icon;

    // 스타일 메모화
    const styles = useMemo(
      () => ({
        warningCard: {
          textAlign: "center",
          padding: tokens.spacingVerticalXL,
        },
        centeredCard: {
          background: currentMode?.gradient || "transparent",
          border: "none",
          borderRadius: 12,
          padding: tokens.spacingVerticalS,
          color: "white",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          textAlign: "center",
          height: "fit-content",
          display: "flex",
          flexDirection: "column",
        },
        buttonContainer: {
          background: "rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: 4,
          gap: 4,
        },
        button: {
          width: "100%",
          padding: "10px 16px",
          fontSize: "14px",
          fontWeight: "bold",
          backgroundColor: "rgba(255,255,255,0.9)",
          color: "#333",
          border: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        },
        descriptionContainer: {
          marginTop: tokens.spacingVerticalXS,
          padding: tokens.spacingVerticalXS,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
      }),
      [currentMode?.gradient]
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
        <Card style={styles.centeredCard}>
          {/* 헤더 */}
          <div style={{ marginBottom: tokens.spacingVerticalXS }}>
            <Text size={300} weight="semibold" style={{ color: "white" }}>
              {currentMode.title}
            </Text>
          </div>

          {/* 실행 버튼 영역 */}
          <div style={styles.buttonContainer}>
            <Button
              appearance="primary"
              icon={fullVideoState.isGenerating ? <SparkleRegular /> : <PlayRegular />}
              onClick={currentMode.onGenerate}
              disabled={isDisabled}
              style={styles.button}
            >
              {fullVideoState.isGenerating ? currentMode.loadingText : currentMode.buttonText}
            </Button>
          </div>

          {/* 진행 상태 및 남은 시간 */}
          {fullVideoState?.isGenerating && fullVideoState?.currentStep && (
            <div style={{ marginTop: tokens.spacingVerticalXS }}>
              <Text size={300} weight="semibold" style={{ color: "white" }}>
                {getStepDisplayName(fullVideoState.currentStep)}
                {estimatedTime && ` · ${estimatedTime}`}
              </Text>
            </div>
          )}

          {/* 설명 영역 */}
          {!fullVideoState?.isGenerating && (
            <div style={styles.descriptionContainer}>
              <Text size={200} style={{ color: "rgba(255,255,255,0.95)" }}>
                {currentMode.description}
              </Text>
            </div>
          )}
        </Card>
      );
    }

    // 기본 레이아웃 (사용 안함 - centered만 사용)
    return null;
  }
);

// 컴포넌트 이름 설정 (개발자 도구에서 디버깅 편의)
ActionCard.displayName = "ActionCard";

export default ActionCard;
