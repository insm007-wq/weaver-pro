import React, { memo, useMemo, useState, useCallback } from "react";
import { tokens, Text, Card, Button, Dropdown, Option, Field, Spinner } from "@fluentui/react-components";
import { ArrowRight24Regular, LinkSquare24Regular, DismissCircle24Regular, MicRegular } from "@fluentui/react-icons";
import FileSelection from "./FileSelection";

/**
 * 1단계: 파일 업로드
 */
const Step1FileUpload = memo(
  ({
    // FileSelection props
    srtConnected,
    srtFilePath,
    scenes,
    totalDur,
    getFileInfo,
    openSrtPicker,
    srtInputRef,
    handleSrtUpload,
    srtInputId,
    handleInsertFromScript,
    handleReset,
    // Step navigation
    onNext,
    canProceed,
    // Voice settings (새로 추가)
    voices = [],
    voiceLoading = false,
    voiceError = null,
    form = {},
    onChange = () => {},
    setForm = () => {},
    onGenerateAudio = () => {},
    isGeneratingAudio = false,
  }) => {
    // 음성 생성 UI 표시 여부
    const [showVoiceUI, setShowVoiceUI] = useState(false);

    // 다음 단계 진행 가능 여부 (SRT 파일이 업로드되어야 함)
    const isReadyToNext = useMemo(() => {
      return srtConnected && scenes.length > 0;
    }, [srtConnected, scenes.length]);

    // SRT 삽입 시 음성 UI 자동 표시
    React.useEffect(() => {
      if (srtConnected && scenes.length > 0) {
        setShowVoiceUI(true);
      } else {
        setShowVoiceUI(false);
      }
    }, [srtConnected, scenes.length]);

    // 초기화 핸들러 오버라이드
    const handleResetWithUI = useCallback(() => {
      handleReset();
      setShowVoiceUI(false);
    }, [handleReset]);

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
          handleReset={handleResetWithUI}
        />

        {/* 음성 생성 섹션 (SRT 삽입 후 자동 표시) */}
        {showVoiceUI && (
          <Card
            style={{
              padding: "12px 16px",
              borderRadius: 16,
              borderColor: tokens.colorNeutralStroke2,
              display: "flex",
              flexDirection: "column",
              animation: "fadeIn 300ms ease-out",
            }}
          >
            {/* 헤더 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <MicRegular />
                <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
                  음성 생성
                </Text>
              </div>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                업로드된 SRT 자막에 음성(나레이션)을 추가합니다.
              </Text>
            </div>

            {/* 음성 선택 드롭다운 */}
            <div style={{ marginBottom: tokens.spacingVerticalM }}>
              <Field
                label={
                  <Text size={300} weight="semibold">
                    목소리 선택
                  </Text>
                }
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Dropdown
                    value={form?.voice || "목소리 선택"}
                    selectedOptions={form?.voice ? [form.voice] : []}
                    onOptionSelect={(_, d) => onChange("voice", d.optionValue)}
                    size="medium"
                    disabled={voiceLoading || !!voiceError || isGeneratingAudio}
                    style={{ flex: 1, minHeight: 36 }}
                  >
                    {voices.map((v) => (
                      <Option key={v.id} value={v.id}>
                        {v.name || v.id}
                      </Option>
                    ))}
                  </Dropdown>
                  {voiceLoading && <Spinner size="tiny" />}
                </div>
              </Field>
            </div>

            {/* 음성 생성 버튼 */}
            <Button
              appearance="primary"
              size="medium"
              onClick={() => onGenerateAudio(scenes)}
              disabled={!srtConnected || isGeneratingAudio || !form?.voice}
              style={{
                height: 40,
                minWidth: 200,
                fontSize: "14px",
                fontWeight: 600,
              }}
            >
              {isGeneratingAudio ? "🎵 음성 생성 중..." : "🎵 음성 생성"}
            </Button>

            {voiceError && (
              <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: 8 }}>
                ⚠️ {voiceError}
              </Text>
            )}
          </Card>
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

        <style>
          {`
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
          `}
        </style>
      </div>
    );
  }
);

Step1FileUpload.displayName = "Step1FileUpload";

export default Step1FileUpload;
