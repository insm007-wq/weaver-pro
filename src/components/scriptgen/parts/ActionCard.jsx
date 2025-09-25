import { memo, useMemo, useCallback, useState } from "react";
import { Card, Text, Button, tokens } from "@fluentui/react-components";
import { VideoRegular, DocumentEditRegular, SparkleRegular, PlayRegular, WarningRegular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { AI_ENGINE_OPTIONS } from "../../../constants/scriptSettings";
import { generateAudioAndSubtitles } from "../../../utils/audioSubtitleGenerator";
import { generateAudioStep, generateImagesStep, generateVideoStep } from "../../../utils/automationSteps";

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

    // 완전 자동화 영상 생성 함수
    const runFullVideoGeneration = useCallback(async () => {
      if (currentOperation) {
        currentOperation.abort();
      }

      const abortController = new AbortController();
      setCurrentOperation(abortController);

      setDoc(null);
      setError("");
      setIsLoading(true);

      setFullVideoState({
        isGenerating: true,
        mode: "automation_mode",
        currentStep: "script",
        progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
        results: { script: null, audio: null, images: [], video: null },
        streamingScript: "",
        error: null,
        startTime: new Date(),
        logs: [],
      });

      addLog("🎬 완전 자동화 영상 생성을 시작합니다...");

      try {
        addLog("📁 전역 설정에서 영상 폴더 경로 확인 중...");

        // 프로젝트 설정 확인
        if (!window.api?.getSetting) {
          throw new Error("API를 사용할 수 없습니다.");
        }

        try {
          const videoSaveFolderResult = await window.api.getSetting("videoSaveFolder");
          const videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;
          const currentProjectIdResult = await window.api.getSetting("currentProjectId");
          const currentProjectId = currentProjectIdResult?.value || currentProjectIdResult;

          if (videoSaveFolder && currentProjectId) {
            addLog(`🎯 현재 프로젝트: ${currentProjectId}`);
            addLog(`📂 프로젝트 폴더 구조 사용 모드`);
          } else {
            throw new Error("프로젝트 설정이 없습니다.");
          }
        } catch (settingsError) {
          addLog(`❌ 프로젝트 설정 가져오기 실패: ${settingsError.message}`, "error");
          throw new Error("프로젝트 설정을 가져올 수 없습니다.");
        }

        addLog("📝 AI 대본 생성 중...");
        const script = await runGenerate(form);
        if (!script || !script.scenes || script.scenes.length === 0) {
          throw new Error("대본 생성에 실패했습니다.");
        }

        updateFullVideoState({ currentStep: "audio", progress: { script: 100 } });
        addLog("🎤 음성 생성 중...");
        const audio = await generateAudioStep(script, form, addLog, setFullVideoState, api);

        updateFullVideoState({ currentStep: "images", progress: { audio: 100 } });
        addLog("🖼️ 이미지 생성 중...");
        const images = await generateImagesStep(script, form, addLog, updateFullVideoState, api);

        updateFullVideoState({ currentStep: "video", progress: { images: 100 } });
        addLog("🎬 영상 합성 중...");
        const video = await generateVideoStep(script, audio, images, addLog, setFullVideoState, api);

        updateFullVideoState({
          currentStep: "complete",
          progress: { video: 100 },
          results: { script, audio, images, video },
          isGenerating: false,
        });
        addLog("✅ 완전 자동화 영상 생성이 완료되었습니다!", "success");
        addLog(`📁 영상 파일: ${video.videoPath}`, "info");

        // 출력 폴더 자동 열기
        try {
          await window.electronAPI.project.openOutputFolder();
          addLog("📂 출력 폴더를 열었습니다.", "success");
        } catch (error) {
          addLog("❌ 출력 폴더 열기 실패: " + error.message, "error");
        }
      } catch (error) {
        if (error.name === "AbortError") {
          addLog("⏹️ 작업이 취소되었습니다.", "info");
          updateFullVideoState({
            currentStep: "cancelled",
            isGenerating: false,
          });
        } else {
          updateFullVideoState({
            currentStep: "error",
            failedStep: fullVideoState?.currentStep || "unknown",
            error: error.message,
            isGenerating: false,
          });
          addLog(`❌ 오류 발생: ${error.message}`, "error");
        }
      } finally {
        setCurrentOperation(null);
      }
    }, [
      currentOperation,
      setDoc,
      setError,
      setIsLoading,
      setFullVideoState,
      addLog,
      api,
      runGenerate,
      form,
      updateFullVideoState,
      fullVideoState?.currentStep,
    ]);

    // 모드 설정 메모화
    const modes = useMemo(
      () => ({
        automation_mode: {
          title: "🎬 완전 자동화 영상 생성",
          description: "AI가 대본부터 최종 영상까지 모든 과정을 자동으로 처리합니다",
          buttonText: "🚀 완전 자동화 시작",
          loadingText: "자동화 생성 중...",
          icon: VideoRegular,
          gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          estimatedTime: "8-12분",
          outputFormat: "MP4 영상 파일 + 음성 + 자막",
          onGenerate: runFullVideoGeneration,
        },
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
      [runFullVideoGeneration, runScriptMode, form]
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
          padding: tokens.spacingVerticalM,
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
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: "bold",
          backgroundColor: "rgba(255,255,255,0.9)",
          color: "#333",
          border: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        },
        descriptionContainer: {
          marginTop: tokens.spacingVerticalS,
          padding: tokens.spacingVerticalS,
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
          <div style={{ marginBottom: tokens.spacingVerticalS }}>
            <Text size={400} weight="semibold" style={{ color: "white" }}>
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

          {/* 설명 영역 */}
          <div style={styles.descriptionContainer}>
            <Text size={200} style={{ color: "rgba(255,255,255,0.95)" }}>
              {currentMode.description}
            </Text>
          </div>
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
