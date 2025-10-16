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

        // 각 단계별 예상 시간 (초) - 더 현실적인 공식
        const scriptEstimatedSec = Math.min(durationMin * 8, 600); // 최대 10분
        const audioEstimatedSec = durationMin * 60 * 0.2; // 병렬 처리로 더 빠름
        const subtitleEstimatedSec = 10;
        const totalEstimatedSec = scriptEstimatedSec + audioEstimatedSec + subtitleEstimatedSec;

        // 전체 남은 시간 = 전체 예상 시간 - 경과 시간
        const remainingSec = Math.max(0, totalEstimatedSec - elapsedSec);

        // 예상 시간을 초과하면 "생성 중..."만 표시
        if (remainingSec === 0 && elapsedSec > totalEstimatedSec) {
          setRemainingTime("생성 중...");
          return;
        }

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
            // ✅ 대본 생성 완료 시 미디어 관련 상태 초기화
            console.log("🔄 대본 생성 완료 - 미디어 상태 초기화");
            window.dispatchEvent(new CustomEvent("reset-keyword-extraction")); // 미디어 준비 초기화
            window.dispatchEvent(new CustomEvent("reset-media-download")); // 미디어 다운로드 초기화
            window.dispatchEvent(new CustomEvent("reset-media-edit")); // 편집 페이지 초기화

            setFullVideoState((prev) => ({
              ...prev,
              currentStep: "audio",
              progress: { ...prev.progress, script: 100, audio: 0 },
            }));

            // 음성 및 자막 생성
            await generateAudioAndSubtitles(scriptResult, "script_mode", {
              form,
              voices,
              setFullVideoState,
              api,
              addLog,
              abortSignal: abortController.signal,
            });

            // ✨ TTS 설정을 프로젝트 메타데이터에 저장
            try {
              // 현재 프로젝트 확인
              const currentProjectResult = await window.api.invoke("project:current");
              console.log("📂 현재 프로젝트 상태:", currentProjectResult);

              if (!currentProjectResult?.success || !currentProjectResult?.project) {
                console.error("❌ 현재 프로젝트가 없습니다. TTS 설정을 저장할 수 없습니다.");
                addLog("⚠️ 프로젝트가 설정되지 않았습니다", "warning");

                // 프로젝트가 없으면 전역 설정에 저장
                await window.api.invoke("settings:set", {
                  key: "lastUsedTtsSettings",
                  value: {
                    voiceId: form.voice || voices[0]?.id || "ko-KR-Standard-A",
                    speed: form.speed || "1.0",
                    pitch: form.pitch || "-1",
                    ttsEngine: form.ttsEngine || "google",
                    createdAt: new Date().toISOString()
                  }
                });
                console.log("✅ TTS 설정을 전역 설정에 저장했습니다 (fallback)");
                addLog("📝 TTS 설정 저장 완료 (전역)");
              } else {
                // 프로젝트에 TTS 설정 저장
                const ttsSettings = {
                  voiceId: form.voice || voices[0]?.id || "ko-KR-Standard-A",
                  speed: form.speed || "1.0",
                  pitch: form.pitch || "-1",
                  ttsEngine: form.ttsEngine || "google",
                  createdAt: new Date().toISOString()
                };

                console.log("💾 저장할 TTS 설정:", ttsSettings);

                const updateResult = await window.api.invoke("project:update", { ttsSettings });
                console.log("📂 프로젝트 업데이트 결과:", updateResult);

                if (updateResult?.success) {
                  console.log("✅ TTS 설정이 프로젝트에 저장되었습니다");
                  console.log("📋 저장된 프로젝트 정보:", updateResult.project);
                  addLog("📝 TTS 설정 저장 완료");
                } else {
                  throw new Error(updateResult?.message || "프로젝트 업데이트 실패");
                }
              }
            } catch (saveError) {
              console.error("❌ TTS 설정 저장 실패:", saveError);
              addLog("⚠️ TTS 설정 저장 실패", "error");
            }

            // 대본 데이터 저장
            setDoc(scriptResult);
          } else {
            throw new Error("대본이 생성되지 않았습니다. 먼저 대본을 생성해주세요.");
          }
        } catch (error) {
          if (error.name === "AbortError" || error.message === "작업이 취소되었습니다.") {
            console.log("⏹️ 작업 취소됨");
            addLog("⏹️ 작업이 취소되었습니다.", "info");
          } else {
            console.error("대본 생성 오류:", error);
            setError(error.message);
            setFullVideoState(prev => ({
              ...prev,
              error: error.message,
              isGenerating: false,
            }));
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
                appearance={fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? "secondary" : "primary"}
                icon={fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? null : <PlayRegular />}
                onClick={() => {
                  // 생성 중이면 중지, 아니면 생성 시작
                  if (fullVideoState.isGenerating && fullVideoState.currentStep !== "completed") {
                    // 중지 로직: AbortController로 실제 작업 중단
                    if (currentOperation) {
                      console.log("🛑 작업 중단 요청");
                      currentOperation.abort();
                      setCurrentOperation(null);
                    }

                    // 상태 초기화
                    setFullVideoState(prev => ({
                      ...prev,
                      isGenerating: false,
                      currentStep: "idle",
                      progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
                      error: null
                    }));
                    setIsLoading(false);
                    setDoc(null);
                  } else {
                    // 생성 시작
                    currentMode.onGenerate();
                  }
                }}
                disabled={!fullVideoState.isGenerating && isDisabled}
                style={{
                  ...styles.button,
                  ...(fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" && {
                    borderColor: tokens.colorPaletteRedBorder2,
                    color: tokens.colorPaletteRedForeground1,
                  })
                }}
              >
                {fullVideoState.isGenerating && fullVideoState.currentStep !== "completed" ? (
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
                    : fullVideoState.currentStep && remainingTime
                    ? `${getStepDisplayName(fullVideoState.currentStep)} ${remainingTime}`
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
