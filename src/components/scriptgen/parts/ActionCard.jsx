import { memo, useMemo, useCallback, useState, useEffect } from "react";
import { Card, Text, Button, tokens } from "@fluentui/react-components";
import { DocumentEditRegular, SparkleRegular, PlayRegular, WarningRegular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { AI_ENGINE_OPTIONS } from "../../../constants/scriptSettings";
import { generateAudioAndSubtitles } from "../../../utils/audioSubtitleGenerator";

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
    const settingsStyles = useSettingsStyles();

    // 작업 취소를 위한 AbortController 관리
    const [currentOperation, setCurrentOperation] = useState(null);

    // 실시간 시간 업데이트를 위한 상태
    const [remainingTime, setRemainingTime] = useState("");

    // 실시간 시간 업데이트 (1초마다)
    useEffect(() => {
      if (!fullVideoState?.isGenerating || !fullVideoState?.startTime) {
        setRemainingTime("");
        return;
      }

      const updateTime = () => {
        const now = new Date();
        const startTime = new Date(fullVideoState.startTime);
        const elapsedSec = Math.floor((now - startTime) / 1000);

        const durationMin = form?.durationMin || 3;
        const currentStep = fullVideoState.currentStep;

        // 각 단계별 예상 시간 (초)
        const scriptEstimatedSec = durationMin <= 3 ? 40 : durationMin <= 5 ? 60 : durationMin <= 10 ? 90 : 120;
        const audioEstimatedSec = durationMin * 60 * 0.3;
        const subtitleEstimatedSec = 10;
        const totalEstimatedSec = scriptEstimatedSec + audioEstimatedSec + subtitleEstimatedSec;

        // 전체 남은 시간 = 전체 예상 시간 - 경과 시간
        const remainingSec = Math.max(0, totalEstimatedSec - elapsedSec);
        const remainingMin = Math.floor(remainingSec / 60);
        const remainingSecOnly = Math.floor(remainingSec % 60);

        setRemainingTime(`${String(remainingMin).padStart(2, "0")}:${String(remainingSecOnly).padStart(2, "0")}`);
      };

      updateTime(); // 즉시 실행
      const interval = setInterval(updateTime, 1000); // 1초마다 업데이트

      return () => clearInterval(interval);
    }, [fullVideoState?.isGenerating, fullVideoState?.startTime, form?.durationMin]);

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
          loadingText: "대본 생성 중",
          completedText: "✅ 대본 생성 완료",
          icon: DocumentEditRegular,
          gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
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
        <>
          <style>{loadingAnimation}</style>
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
                <span className={fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? "loading-text" : ""}>
                  {fullVideoState.currentStep === "completed"
                    ? "🔄 새 대본 생성"
                    : chunkProgress
                    ? `청크 ${chunkProgress.current}/${chunkProgress.total} 생성 중... (${chunkProgress.progress}%)`
                    : fullVideoState.isGenerating && fullVideoState.currentStep && remainingTime
                    ? `${getStepDisplayName(fullVideoState.currentStep)} ${remainingTime}`
                    : fullVideoState.isGenerating
                    ? currentMode.loadingText
                    : currentMode.buttonText}
                </span>
              </Button>

              {/* 중지 버튼 (생성 중일 때만 표시) */}
              {fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" && (
                <Button
                  appearance="outline"
                  onClick={() => {
                    // 상태 초기화 (컨펌 없이 바로 실행)
                    setFullVideoState(prev => ({
                      ...prev,
                      isGenerating: false,
                      currentStep: "idle",
                      progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 }
                    }));
                    setIsLoading(false);
                    setDoc(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: "bold",
                    backgroundColor: "transparent",
                    color: "white",
                    border: "2px solid white",
                    boxShadow: "none",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "rgba(220, 53, 69, 0.2)";
                    e.currentTarget.style.borderColor = "#dc3545";
                    e.currentTarget.style.color = "#ff6b6b";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "white";
                    e.currentTarget.style.color = "white";
                  }}
                >
                  ⏹️ 생성 중지
                </Button>
              )}
            </div>


          {/* 설명 영역 */}
          <div style={styles.descriptionContainer}>
            {fullVideoState.error ? (
              <Text style={{ color: "#ffcccc", fontWeight: 600, fontSize: "14px", lineHeight: "1.4" }}>
                ❌ 오류: {fullVideoState.error}
              </Text>
            ) : fullVideoState.currentStep === "completed" ? (
              <Text style={{ color: "#ccffcc", fontWeight: 600, fontSize: "14px", lineHeight: "1.4" }}>
                ✅ 대본 생성이 완료되었습니다! 새로운 주제로 다시 생성하시겠습니까?
              </Text>
            ) : (
              <Text style={{ color: "rgba(255,255,255,0.95)", fontSize: "14px", lineHeight: "1.4" }}>
                {currentMode.description}
              </Text>
            )}
          </div>
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
