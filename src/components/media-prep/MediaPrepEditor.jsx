import React, { useMemo, useEffect } from "react";
import { tokens, useId } from "@fluentui/react-components";
import { Target24Regular } from "@fluentui/react-icons";

// Hooks
import { useFileManagement, useKeywordExtraction, useWizardStep } from "../../hooks";

// Utils
import { useContainerStyles, useHeaderStyles } from "../../styles/commonStyles";
import { PageErrorBoundary } from "../common/ErrorBoundary";

// Wizard Components
import StepProgress from "./parts/StepProgress";
import Step1FileUpload from "./parts/Step1FileUpload";
import Step2KeywordExtraction from "./parts/Step2KeywordExtraction";
import Step3Complete from "./parts/Step3Complete";

/**
 * MediaPrepEditor (위저드 스타일로 전면 개편)
 * - 3단계 진행 방식 (파일 업로드 → 키워드 추출 → 완료)
 * - 진행률 표시 및 단계별 UI 전환
 * - 직관적이고 세련된 사용자 경험
 */
function MediaPrepEditor() {
  const containerStyles = useContainerStyles();
  const headerStyles = useHeaderStyles();
  const srtInputId = useId("srt-input");
  const mp3InputId = useId("mp3-input");

  // Custom Hooks
  const fileManagement = useFileManagement();
  const keywordExtraction = useKeywordExtraction();
  const wizardStep = useWizardStep({
    totalSteps: 3,
    initialStep: 1,
  });

  // Derived values
  const totalDur = useMemo(() => {
    if (!fileManagement.scenes.length) return 0;
    const first = Number(fileManagement.scenes[0].start) || 0;
    const last = Number(fileManagement.scenes[fileManagement.scenes.length - 1].end) || 0;
    return Math.max(0, last - first);
  }, [fileManagement.scenes]);

  // 자동 단계 진행 로직
  useEffect(() => {
    // 1단계: SRT 파일 업로드 완료 시 1단계를 완료로 표시
    if (wizardStep.currentStep === 1 && fileManagement.srtConnected && fileManagement.scenes.length > 0) {
      wizardStep.completeStep(1);
    }

    // 2단계: 키워드 추출 완료 시 2단계를 완료로 표시
    if (wizardStep.currentStep === 2 && keywordExtraction.assets.length > 0) {
      wizardStep.completeStep(2);
    }

    // 3단계: 자동으로 완료로 표시
    if (wizardStep.currentStep === 3) {
      wizardStep.completeStep(3);
    }
  }, [
    wizardStep.currentStep,
    fileManagement.srtConnected,
    fileManagement.scenes.length,
    keywordExtraction.assets.length,
  ]);

  // 단계별 렌더링
  const renderCurrentStep = () => {
    switch (wizardStep.currentStep) {
      case 1:
        return (
          <Step1FileUpload
            // FileSelection props
            srtConnected={fileManagement.srtConnected}
            srtFilePath={fileManagement.srtFilePath}
            scenes={fileManagement.scenes}
            totalDur={totalDur}
            getFileInfo={fileManagement.getFileInfo}
            openSrtPicker={fileManagement.openSrtPicker}
            srtInputRef={fileManagement.srtInputRef}
            handleSrtUpload={fileManagement.handleSrtUpload}
            srtInputId={srtInputId}
            mp3Connected={fileManagement.mp3Connected}
            mp3FilePath={fileManagement.mp3FilePath}
            audioDur={fileManagement.audioDur}
            openMp3Picker={fileManagement.openMp3Picker}
            mp3InputRef={fileManagement.mp3InputRef}
            handleMp3Upload={fileManagement.handleMp3Upload}
            mp3InputId={mp3InputId}
            handleInsertFromScript={fileManagement.handleInsertFromScript}
            handleReset={fileManagement.handleReset}
            // Navigation
            onNext={wizardStep.nextStep}
            canProceed={wizardStep.isCurrentStepCompleted}
          />
        );

      case 2:
        return (
          <Step2KeywordExtraction
            // Keyword extraction props
            srtConnected={fileManagement.srtConnected}
            isExtracting={keywordExtraction.isExtracting}
            handleExtractKeywords={keywordExtraction.handleExtractKeywords}
            assets={keywordExtraction.assets}
            scenes={fileManagement.scenes}
            currentLlmModel={keywordExtraction.currentLlmModel}
            getLlmDisplayName={keywordExtraction.getLlmDisplayName}
            // Navigation
            onNext={wizardStep.nextStep}
            onPrev={wizardStep.prevStep}
            canProceed={wizardStep.isCurrentStepCompleted}
          />
        );

      case 3:
        return (
          <Step3Complete
            // Summary data
            srtConnected={fileManagement.srtConnected}
            mp3Connected={fileManagement.mp3Connected}
            srtFilePath={fileManagement.srtFilePath}
            mp3FilePath={fileManagement.mp3FilePath}
            scenesCount={fileManagement.scenes.length}
            totalDuration={totalDur}
            keywordsCount={keywordExtraction.assets.length}
            getFileInfo={fileManagement.getFileInfo}
            // Navigation
            onPrev={wizardStep.prevStep}
            onReset={() => {
              wizardStep.reset();
              fileManagement.handleReset();
              keywordExtraction.clearAssets();
            }}
          />
        );

      default:
        return null;
    }
  };

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
          totalSteps={3}
          completedSteps={wizardStep.completedSteps}
          stepLabels={["파일 업로드", "키워드 추출", "완료"]}
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
