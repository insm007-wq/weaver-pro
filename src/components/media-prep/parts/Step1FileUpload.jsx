import React, { memo, useMemo } from "react";
import { tokens, Text, Card, Button } from "@fluentui/react-components";
import { ArrowRight24Regular, LinkSquare24Regular, DismissCircle24Regular } from "@fluentui/react-icons";
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
  }) => {
    // 다음 단계 진행 가능 여부 (SRT 파일이 업로드되어야 함)
    const isReadyToNext = useMemo(() => {
      return srtConnected && scenes.length > 0;
    }, [srtConnected, scenes.length]);

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
          handleReset={handleReset}
        />

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
                minWidth: "180px",
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
