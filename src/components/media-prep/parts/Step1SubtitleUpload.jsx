import React, { memo, useMemo, useState, useEffect } from "react";
import { tokens, Text, Card, Button } from "@fluentui/react-components";
import { ArrowRight24Regular } from "@fluentui/react-icons";
import FileSelection from "./FileSelection";
import VoiceSelector from "../../common/VoiceSelector";

/**
 * 1단계: 자막 업로드
 * - 자막 파일 선택 및 업로드
 * - 대본에서 자동 삽입
 * - 음성 선택 (수동 모드일 때만)
 */
const Step1SubtitleUpload = memo(
  ({
    // FileSelection props
    srtConnected,
    srtFilePath,
    srtSource = null,
    scenes = [],
    totalDur = 0,
    getFileInfo,
    openSrtPicker,
    srtInputRef,
    handleSrtUpload,
    srtInputId,
    handleInsertFromScript,
    // Step navigation
    onNext,
    canProceed,
    // Voice settings
    voices = [],
    voiceLoading = false,
    voiceError = null,
    form = {},
    onChange = () => {},
    setForm = () => {},
    onPreviewVoice = () => {},
    onStopVoice = () => {},
    onRetryVoiceLoad = () => {},
    isGeneratingAudio = false,
  }) => {
    // 음성 생성 UI 표시 여부 (수동 모드일 때만)
    const [showVoiceUI, setShowVoiceUI] = useState(false);

    // 다음 단계 진행 가능 여부 (SRT 파일이 업로드되어야 함)
    const isReadyToNext = useMemo(
      () => srtConnected && scenes.length > 0,
      [srtConnected, scenes.length]
    );

    // SRT 수동 삽입 시만 음성 UI 자동 표시
    useEffect(() => {
      setShowVoiceUI(
        srtConnected && scenes.length > 0 && srtSource === "manual"
      );
    }, [srtConnected, scenes.length, srtSource]);


    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacingVerticalM,
          animation: "fadeIn 400ms ease-out",
          justifyContent: "space-between",
        }}
      >
        {/* 단계 설명 카드 */}
        <Card
          style={{
            padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
            borderRadius: "8px",
            border: `1px solid ${tokens.colorBrandStroke1}`,
            backgroundColor: tokens.colorBrandBackground2,
            minHeight: "40px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, justifyContent: "space-between", height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS }}>
              <div style={{ fontSize: "18px", lineHeight: 1 }}>📁</div>
              <Text size={300} weight="semibold">
                파일을 업로드해주세요
              </Text>
            </div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              자막(SRT) 파일을 드래그하거나 클릭하여 업로드하세요
            </Text>
          </div>
        </Card>

        {/* 파일 선택 섹션 */}
        <FileSelection
          srtConnected={srtConnected}
          srtFilePath={srtFilePath}
          scenes={scenes}
          totalDur={totalDur}
          getFileInfo={getFileInfo}
          openSrtPicker={openSrtPicker}
          srtInputRef={srtInputRef}
          handleSrtUpload={handleSrtUpload}
          srtInputId={srtInputId}
          handleInsertFromScript={handleInsertFromScript}
        />

        {/* 음성 선택 섹션 (SRT 삽입 후 자동 표시) */}
        {showVoiceUI && (
          <VoiceSelector
            form={form}
            voices={voices}
            voiceLoading={voiceLoading}
            voiceError={voiceError}
            onChange={onChange}
            setForm={setForm}
            onPreviewVoice={onPreviewVoice}
            onStopVoice={onStopVoice}
            onRetryVoiceLoad={onRetryVoiceLoad}
            disabled={isGeneratingAudio}
            showPreview={true}
            title="음성 선택"
            description="업로드된 SRT 자막에 사용할 나레이션 목소리를 선택합니다."
          />
        )}

        {/* 다음 단계 버튼 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: tokens.spacingHorizontalM,
            paddingTop: tokens.spacingVerticalM,
            borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
            marginTop: "auto",
          }}
        >
          <div style={{ minWidth: "120px" }}></div>

          {isReadyToNext ? (
            <Button
              appearance="primary"
              size="medium"
              icon={<ArrowRight24Regular />}
              iconPosition="after"
              onClick={onNext}
              style={{
                minWidth: "220px",
                height: "40px",
                fontSize: "14px",
                fontWeight: 600,
                boxShadow: `0 2px 8px ${tokens.colorBrandBackground}60`,
              }}
            >
              다음 단계: 키워드 추출
            </Button>
          ) : (
            <div
              style={{
                padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
                backgroundColor: tokens.colorNeutralBackground3,
                borderRadius: "8px",
                border: `1px dashed ${tokens.colorNeutralStroke2}`,
              }}
            >
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                💡 SRT 파일을 업로드하면 다음 단계로 진행할 수 있습니다
              </Text>
            </div>
          )}
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>
    );
  }
);

Step1SubtitleUpload.displayName = "Step1SubtitleUpload";

export default Step1SubtitleUpload;
