import React, { useMemo } from "react";
import { tokens, useId } from "@fluentui/react-components";
import { Target24Regular } from "@fluentui/react-icons";

// Hooks
import { useFileManagement, useKeywordExtraction } from "../../hooks";

// Utils
import { useContainerStyles, useHeaderStyles } from "../../styles/commonStyles";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import FileSelection from "./parts/FileSelection";
import KeywordExtraction from "./parts/KeywordExtraction";
import ProjectStats from "./parts/ProjectStats";

/**
 * MediaPrepEditor (UI 개선: 모던, 간결, 시각적 위계 강화)
 * - Card 컴포넌트 활용 섹션 분리
 * - DropZone 디자인 간소화 및 상태 명확화
 * - 통계 칩 디자인 및 레이아웃 개선
 */
function MediaPrepEditor() {
  const containerStyles = useContainerStyles();
  const headerStyles = useHeaderStyles();
  const srtInputId = useId("srt-input");
  const mp3InputId = useId("mp3-input");

  // Custom Hooks
  const fileManagement = useFileManagement();
  const keywordExtraction = useKeywordExtraction();

  // Derived values using hook data
  const totalDur = useMemo(() => {
    if (!fileManagement.scenes.length) return 0;
    const first = Number(fileManagement.scenes[0].start) || 0;
    const last = Number(fileManagement.scenes[fileManagement.scenes.length - 1].end) || 0;
    return Math.max(0, last - first);
  }, [fileManagement.scenes]);

  return (
    <div className={containerStyles.container} style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      {/* Header */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <Target24Regular />
          미디어 준비
        </div>
        <div className={headerStyles.pageDescription}>자막과 오디오 파일을 업로드하고 AI로 키워드를 추출하여 영상 제작을 준비하세요.</div>
        <div className={headerStyles.divider} />
      </div>

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXL }}>
        <FileSelection
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
        />

        {/* 통계 요약 카드 */}
        <ProjectStats
          srtConnected={fileManagement.srtConnected}
          mp3Connected={fileManagement.mp3Connected}
          scenesCount={fileManagement.scenes.length}
          totalDuration={totalDur}
        />

        {/* 키워드 추출 섹션 */}
        <KeywordExtraction
          srtConnected={fileManagement.srtConnected}
          isExtracting={keywordExtraction.isExtracting}
          handleExtractKeywords={() => keywordExtraction.handleExtractKeywords(fileManagement.scenes)}
          assets={keywordExtraction.assets}
          scenes={fileManagement.scenes}
          currentLlmModel={keywordExtraction.currentLlmModel}
          getLlmDisplayName={keywordExtraction.getLlmDisplayName}
        />
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
