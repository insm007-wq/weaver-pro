import React, { memo, useMemo, useState } from "react";
import { tokens, Text, Card, Button, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Caption1 } from "@fluentui/react-components";
import {
  ArrowLeft24Regular,
  Checkmark24Filled,
  DocumentBulletList24Regular,
  LightbulbFilament24Regular,
  ArrowDownload24Regular,
} from "@fluentui/react-icons";

/**
 * 3단계: 완료 및 요약
 */
const Step3Complete = ({
  // Summary data
  srtConnected,
  srtFilePath,
  scenesCount,
  totalDuration,
  keywordsCount,
  getFileInfo,
  // Step navigation
  onPrev,
  onReset,
}) => {
  // 다이얼로그 상태
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // 파일 정보 계산
  const srtFileInfo = useMemo(() => {
    if (!srtFilePath) return { fileName: "없음", displayPath: "" };
    return getFileInfo(srtFilePath);
  }, [srtFilePath, getFileInfo]);

  // 초기화 핸들러
  const handleReset = () => {
    setResetDialogOpen(false);
    onReset();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        animation: "fadeIn 400ms ease-out",
        minHeight: "500px",
        justifyContent: "space-between",
      }}
    >
      {/* 완료 축하 카드 */}
      <Card
        style={{
          padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
          borderRadius: "8px",
          border: `1px solid ${tokens.colorPaletteGreenBorder1}`,
          backgroundColor: tokens.colorPaletteGreenBackground1,
          minHeight: "40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS, justifyContent: "space-between", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS }}>
            <div style={{ fontSize: "18px", lineHeight: 1 }}>🎉</div>
            <Text size={300} weight="semibold">
              미디어 준비가 완료되었습니다!
            </Text>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            이제 미디어 편집 또는 비디오 조립 단계로 넘어갈 수 있습니다
          </Text>
        </div>
      </Card>

      {/* 요약 정보 카드 */}
      <Card
        style={{
          padding: "12px 16px",
          borderRadius: "12px",
          border: `1px solid ${tokens.colorNeutralStroke2}`,
        }}
      >
        <Text size={400} weight="semibold" style={{ display: "block", marginBottom: tokens.spacingVerticalM }}>
          📊 작업 요약
        </Text>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: tokens.spacingVerticalM,
          }}
        >
          {/* SRT 파일 정보 */}
          <div
            style={{
              padding: tokens.spacingVerticalM,
              backgroundColor: tokens.colorNeutralBackground2,
              borderRadius: "12px",
              border: `1px solid ${tokens.colorNeutralStroke2}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: tokens.spacingVerticalS }}>
              <DocumentBulletList24Regular style={{ color: tokens.colorBrandForeground1 }} />
              <Text size={400} weight="semibold">
                자막 파일
              </Text>
            </div>
            <div style={{ marginLeft: "32px" }}>
              <Text size={300} style={{ display: "block", color: tokens.colorNeutralForeground2 }}>
                {srtFileInfo.fileName}
              </Text>
              {srtFileInfo.displayPath && (
                <Text size={200} style={{ display: "block", color: tokens.colorNeutralForeground3, marginTop: 2 }}>
                  📁 {srtFileInfo.displayPath}
                </Text>
              )}
              <Text
                size={300}
                weight="semibold"
                style={{
                  display: "block",
                  color: tokens.colorBrandForeground1,
                  marginTop: tokens.spacingVerticalXS,
                }}
              >
                {scenesCount}개 씬 · {totalDuration.toFixed(1)}초
              </Text>
            </div>
          </div>

          {/* 키워드 정보 */}
          <div
            style={{
              padding: tokens.spacingVerticalM,
              backgroundColor: tokens.colorNeutralBackground2,
              borderRadius: "12px",
              border: `1px solid ${tokens.colorNeutralStroke2}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: tokens.spacingVerticalS }}>
              <LightbulbFilament24Regular style={{ color: tokens.colorBrandForeground1 }} />
              <Text size={400} weight="semibold">
                추출된 키워드
              </Text>
            </div>
            <div style={{ marginLeft: "32px" }}>
              <Text
                size={400}
                weight="bold"
                style={{
                  display: "block",
                  color: tokens.colorPaletteGreenForeground1,
                  fontSize: "24px",
                }}
              >
                {keywordsCount}개
              </Text>
              <Text size={300} style={{ display: "block", color: tokens.colorNeutralForeground3, marginTop: 2 }}>
                영상 소스 검색 준비 완료
              </Text>
            </div>
          </div>
        </div>
      </Card>

      {/* 다음 단계 안내 */}
      <Card
        style={{
          padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
          borderRadius: "12px",
          border: `1px solid ${tokens.colorBrandStroke1}`,
          backgroundColor: tokens.colorBrandBackground2,
        }}
      >
        <Text size={300} weight="semibold" style={{ display: "block", marginBottom: tokens.spacingVerticalXS }}>
          🚀 다음 단계
        </Text>
        <div style={{ marginLeft: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM }}>
          <Text size={200} style={{ display: "block", color: tokens.colorNeutralForeground2, marginBottom: 2 }}>
            1. <strong>미디어 다운로드</strong> 탭에서 키워드로 이미지/비디오를 검색하고 다운로드하세요
          </Text>
          <Text size={200} style={{ display: "block", color: tokens.colorNeutralForeground2, marginBottom: 2 }}>
            2. <strong>영상 완성</strong> 탭에서 자막과 미디어를 조합하여 최종 영상을 생성하세요
          </Text>
          <Text size={200} style={{ display: "block", color: tokens.colorNeutralForeground2 }}>
            3. <strong>영상 완성</strong> 탭에서 완성된 영상을 확인하고 내보내세요
          </Text>
        </div>
        <Button
          appearance="primary"
          size="medium"
          icon={<ArrowDownload24Regular />}
          iconPosition="after"
          onClick={() => {
            // 미디어 다운로드 페이지로 이동
            const event = new CustomEvent("navigate-to-download");
            window.dispatchEvent(event);
          }}
          style={{
            width: "100%",
            height: "42px",
            fontSize: "14px",
            fontWeight: 600,
            boxShadow: `0 2px 8px ${tokens.colorBrandBackground}60`,
          }}
        >
          📥 미디어 다운로드로 이동
        </Button>
      </Card>

      {/* 네비게이션 버튼 */}
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
        <Button
          appearance="subtle"
          size="medium"
          icon={<ArrowLeft24Regular />}
          onClick={onPrev}
          style={{
            minWidth: "120px",
            height: "40px",
          }}
        >
          이전 단계
        </Button>

        <Button
          appearance="primary"
          size="medium"
          icon={<Checkmark24Filled />}
          iconPosition="after"
          onClick={() => setResetDialogOpen(true)}
          style={{
            minWidth: "180px",
            height: "40px",
            fontSize: "14px",
            fontWeight: 600,
            backgroundColor: tokens.colorPaletteRedBackground3,
            borderColor: tokens.colorPaletteRedBorder2,
            color: tokens.colorNeutralForegroundOnBrand,
            boxShadow: `0 2px 8px ${tokens.colorPaletteRedBackground3}60`,
          }}
        >
          새로 시작하기
        </Button>
      </div>

      {/* 초기화 확인 다이얼로그 */}
      <Dialog open={resetDialogOpen} onOpenChange={(e, data) => setResetDialogOpen(data.open)}>
        <DialogSurface style={{ maxWidth: "480px" }}>
          <DialogBody>
            <DialogTitle style={{ fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold }}>⚠️ 초기화 확인</DialogTitle>
            <DialogContent style={{ paddingTop: tokens.spacingVerticalM, paddingBottom: tokens.spacingVerticalL }}>
              <Text style={{ display: "block", marginBottom: tokens.spacingVerticalS }}>정말로 새로 시작하시겠습니까?</Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3, display: "block" }}>
                현재 업로드된 파일과 추출된 키워드가 모두 초기화됩니다.
                <br />이 작업은 되돌릴 수 없습니다.
              </Caption1>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setResetDialogOpen(false)}
                style={{
                  minWidth: "100px",
                }}
              >
                취소
              </Button>
              <Button
                appearance="primary"
                onClick={handleReset}
                style={{
                  minWidth: "100px",
                  backgroundColor: tokens.colorPaletteRedBackground3,
                  borderColor: tokens.colorPaletteRedBorder2,
                }}
              >
                초기화
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

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

            @keyframes bounceIn {
              0% {
                opacity: 0;
                transform: scale(0.3);
              }
              50% {
                transform: scale(1.05);
              }
              70% {
                transform: scale(0.9);
              }
              100% {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}
      </style>
    </div>
  );
};

Step3Complete.displayName = "Step3Complete";

export default Step3Complete;
