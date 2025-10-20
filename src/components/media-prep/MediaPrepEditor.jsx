import React, { useMemo, useEffect, useRef, useCallback, useState } from "react";
import { tokens, useId, Text } from "@fluentui/react-components";
import { Target24Regular } from "@fluentui/react-icons";

// Hooks
import { useFileManagement, useKeywordExtraction, useWizardStep, useVoiceSettings, useApi } from "../../hooks";

// Utils
import { useContainerStyles, useHeaderStyles } from "../../styles/commonStyles";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import { generateAudioAndSubtitles } from "../../utils/audioSubtitleGenerator";
import { showSuccess, showError } from "../common/GlobalToast";

// Wizard Components
import StepProgress from "./parts/StepProgress";
import Step1FileUpload from "./parts/Step1FileUpload";
import Step2KeywordExtraction from "./parts/Step2KeywordExtraction";
import BottomFixedBar from "../common/BottomFixedBar";

/**
 * MediaPrepEditor (위저드 스타일로 전면 개편)
 * - 2단계 진행 방식 (파일 업로드 → 키워드 추출)
 * - 진행률 표시 및 단계별 UI 전환
 * - 직관적이고 세련된 사용자 경험
 */
function MediaPrepEditor() {
  const containerStyles = useContainerStyles();
  const headerStyles = useHeaderStyles();
  const srtInputId = useId("srt-input");
  const initialAutoLoadRef = useRef(false); // 처음 자동 로드 1회만 실행

  // Custom Hooks
  const fileManagement = useFileManagement();
  const keywordExtraction = useKeywordExtraction();
  const wizardStep = useWizardStep({
    totalSteps: 2,
    initialStep: 1,
  });
  const api = useApi();

  // 음성 생성 상태
  const [voiceForm, setVoiceForm] = useState({
    voice: "",
    speed: "1.0",
    pitch: "-1",
  });
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const { voices, voiceLoading, voiceError } = useVoiceSettings(voiceForm);

  // Derived values
  const totalDur = useMemo(() => {
    if (!fileManagement.scenes.length) return 0;
    const first = Number(fileManagement.scenes[0].start) || 0;
    const last = Number(fileManagement.scenes[fileManagement.scenes.length - 1].end) || 0;
    return Math.max(0, last - first);
  }, [fileManagement.scenes]);

  // 페이지 진입 시 상태 초기화 (수동 모드)
  useEffect(() => {
    const initializeState = () => {
      // 이미 실행되었으면 스킵
      if (initialAutoLoadRef.current) return;
      initialAutoLoadRef.current = true;

      // 모든 상태 초기화 - 사용자가 수동으로 업로드/가져오기 하기까지 대기
      fileManagement.setScenes([]);
      fileManagement.setSrtConnected(false);
      fileManagement.setMp3Connected(false);
      fileManagement.setAudioDur(0);
      fileManagement.setSrtFilePath("");
      fileManagement.setMp3FilePath("");
      fileManagement.setSrtSource(null);
      keywordExtraction.clearAssets();
      wizardStep.reset();
    };

    initializeState();
  }, []); // 마운트 시 1회만 실행

  // 자동 단계 진행 로직 - 키워드 추출 완료 시만 자동 이동
  useEffect(() => {
    // 2단계: 키워드 추출 완료 시 2단계를 완료로 표시
    if (wizardStep.currentStep === 2 && keywordExtraction.assets.length > 0) {
      wizardStep.completeStep(2);
    }
  }, [
    wizardStep.currentStep,
    keywordExtraction.assets.length,
  ]);

  // 대본 & 음성 생성에서 이동 - 자막 자동 삽입 후 Step 2로 자동 이동
  const handleNavigateToAssemble = useCallback(async () => {
    try {
      console.log("🔄 자막 자동 삽입 시작");

      // 자막 자동 삽입 (대본에서 생성된 SRT 파일 가져오기)
      await fileManagement.handleInsertFromScript();

      console.log("✅ 자막 자동 삽입 완료");

      // 상태 업데이트 후 즉시 Step 2로 이동 (setTimeout 제거)
      wizardStep.completeStep(1);
      wizardStep.nextStep();
    } catch (error) {
      console.error("❌ 자막 자동 삽입 실패:", error);
      // 실패 시에도 Step 진행 (사용자가 수동으로 조정 가능)
      wizardStep.completeStep(1);
      wizardStep.nextStep();
    }
  }, [fileManagement, wizardStep]);

  useEffect(() => {
    window.addEventListener("navigate-to-assemble", handleNavigateToAssemble);

    return () => {
      window.removeEventListener("navigate-to-assemble", handleNavigateToAssemble);
    };
  }, [handleNavigateToAssemble]);

  // 음성 변경 핸들러
  const handleVoiceChange = useCallback((key, value) => {
    setVoiceForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 음성 생성 핸들러
  const handleGenerateAudio = useCallback(async (scenes) => {
    if (!scenes || scenes.length === 0) {
      showError("처리할 씬이 없습니다.");
      return;
    }

    if (!voiceForm.voice) {
      showError("목소리를 선택해주세요.");
      return;
    }

    setIsGeneratingAudio(true);

    try {
      console.log("🎵 음성 생성 시작");

      // SRT 자막 데이터를 대본 형식으로 변환
      const scriptData = {
        scenes: scenes.map((scene, index) => ({
          id: index,
          text: scene.text || "",
          duration: (Number(scene.end) - Number(scene.start)) / 1000,
        })),
      };

      await generateAudioAndSubtitles(scriptData, "manual_mode", {
        form: { voice: voiceForm.voice, speed: voiceForm.speed, pitch: voiceForm.pitch },
        voices,
        api,
      });

      showSuccess(`음성 생성이 완료되었습니다. (${scenes.length}개 씬)`);
      console.log("✅ 음성 생성 완료");
    } catch (error) {
      console.error("❌ 음성 생성 실패:", error);
      showError("음성 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [voiceForm, voices, api]);

  // 키워드 추출 초기화 이벤트 리스너
  useEffect(() => {
    const handleResetKeywordExtraction = () => {
      // 키워드 초기화
      keywordExtraction.clearAssets();

      // SRT 파일 연결 상태 초기화
      fileManagement.setScenes([]);
      fileManagement.setSrtConnected(false);
      fileManagement.setSrtFilePath("");
      fileManagement.setSrtSource(null);

      // 위저드를 1단계로 초기화
      wizardStep.reset();

      // 자동 로드 플래그 리셋
      initialAutoLoadRef.current = false;

      // 음성 상태도 초기화
      setVoiceForm({ voice: "", speed: "1.0", pitch: "-1" });
      setIsGeneratingAudio(false);
    };

    window.addEventListener("reset-keyword-extraction", handleResetKeywordExtraction);

    return () => {
      window.removeEventListener("reset-keyword-extraction", handleResetKeywordExtraction);
    };
  }, [keywordExtraction, fileManagement, wizardStep]);

  // 단계별 렌더링 (메모화)
  const renderCurrentStep = useCallback(() => {
    switch (wizardStep.currentStep) {
      case 1:
        return (
          <Step1FileUpload
            // File selection props
            srtConnected={fileManagement.srtConnected}
            srtFilePath={fileManagement.srtFilePath}
            scenes={fileManagement.scenes}
            totalDur={totalDur}
            getFileInfo={fileManagement.getFileInfo}
            openSrtPicker={fileManagement.openSrtPicker}
            srtInputRef={fileManagement.srtInputRef}
            handleSrtUpload={fileManagement.handleSrtUpload}
            srtInputId={srtInputId}
            handleInsertFromScript={fileManagement.handleInsertFromScript}
            handleReset={fileManagement.handleReset}
            onNext={wizardStep.nextStep}
            canProceed={wizardStep.isCurrentStepCompleted}
            // Voice generation props
            voices={voices}
            voiceLoading={voiceLoading}
            voiceError={voiceError}
            form={voiceForm}
            onChange={handleVoiceChange}
            setForm={setVoiceForm}
            onGenerateAudio={handleGenerateAudio}
            isGeneratingAudio={isGeneratingAudio}
          />
        );

      case 2:
        return (
          <Step2KeywordExtraction
            srtConnected={fileManagement.srtConnected}
            isExtracting={keywordExtraction.isExtracting}
            handleExtractKeywords={keywordExtraction.handleExtractKeywords}
            assets={keywordExtraction.assets}
            scenes={fileManagement.scenes}
            currentLlmModel={keywordExtraction.currentLlmModel}
            getLlmDisplayName={keywordExtraction.getLlmDisplayName}
            onPrev={wizardStep.prevStep}
            canProceed={wizardStep.isCurrentStepCompleted}
          />
        );

      default:
        return null;
    }
  }, [
    wizardStep.currentStep,
    fileManagement,
    keywordExtraction,
    totalDur,
    srtInputId,
    wizardStep.nextStep,
    wizardStep.prevStep,
    wizardStep.isCurrentStepCompleted,
  ]);

  // BottomFixedBar 조건 단순화
  const hasAssets = Array.isArray(keywordExtraction.assets) && keywordExtraction.assets.length > 0;
  const isExtracting = keywordExtraction.isExtracting;
  const showBottomBar = isExtracting || hasAssets;

  return (
    <div className={containerStyles.container} style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Header */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <Target24Regular />
          미디어 준비
        </div>
        <div className={headerStyles.pageDescription}>
          단계별로 파일을 업로드하고 AI로 키워드를 추출하여 영상 제작을 준비하세요.
        </div>
        <div className={headerStyles.divider} />
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
        {/* 진행률 표시 */}
        <StepProgress
          currentStep={wizardStep.currentStep}
          totalSteps={2}
          completedSteps={wizardStep.completedSteps}
          stepLabels={["파일 업로드", "키워드 추출"]}
          onStepClick={wizardStep.goToStep}
        />

        {/* 현재 단계 렌더링 */}
        <div
          style={{
            transition: "opacity 300ms ease",
            opacity: wizardStep.isTransitioning ? 0.5 : 1,
          }}
        >
          {renderCurrentStep()}
        </div>
      </div>

      {/* 하단 고정 진행바 */}
      {showBottomBar && (
        <BottomFixedBar
          isComplete={hasAssets && !isExtracting}
          isLoading={isExtracting}
          statusText={
            isExtracting
              ? "🤖 키워드 추출 중..."
              : `✅ 키워드 추출 완료 (${keywordExtraction.assets.length}개)`
          }
          nextStepButton={
            hasAssets && !isExtracting
              ? {
                  text: "➡️ 다음 단계: 미디어 다운로드",
                  eventName: "navigate-to-download",
                }
              : undefined
          }
          expandedContent={
            hasAssets ? (
              <div style={{ padding: "12px 16px" }}>
                <Text size={300} weight="semibold" style={{ marginBottom: 12, display: "block" }}>
                  📝 추출된 키워드 ({keywordExtraction.assets.length}개)
                </Text>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                    gap: 8,
                  }}
                >
                  {keywordExtraction.assets.map((asset, index) => (
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
            ) : isExtracting ? (
              <div style={{ padding: "12px 16px", textAlign: "center" }}>
                <Text size={300} weight="semibold" style={{ marginBottom: 8, display: "block" }}>
                  🤖 AI가 키워드를 추출하고 있습니다...
                </Text>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  잠시만 기다려주세요
                </Text>
              </div>
            ) : null
          }
        />
      )}
    </div>
  );
}

export default function MediaPrepEditorWithBoundary() {
  return (
    <PageErrorBoundary>
      <MediaPrepEditor />
    </PageErrorBoundary>
  );
}
