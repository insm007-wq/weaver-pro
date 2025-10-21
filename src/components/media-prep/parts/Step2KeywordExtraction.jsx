import React, { memo, useMemo } from "react";
import { tokens, Text, Card, Button, Spinner, Body2, Badge, Caption1 } from "@fluentui/react-components";
import { ArrowLeft24Regular, LightbulbFilament24Regular } from "@fluentui/react-icons";
import { PrimaryButton } from "../../common";

/**
 * 키워드 배지 리스트 컴포넌트
 * - 최대 50개 키워드 표시
 * - 더보기 버튼으로 추가 키워드 표시
 */
const KeywordBadgeList = memo(({ assets = [] }) => {
  const [showAll, setShowAll] = React.useState(false);
  const MAX_DISPLAY = 50;

  const badgeStyle = useMemo(
    () => ({
      cursor: "default",
      fontSize: "12px",
      lineHeight: 1,
      width: "100%",
      textAlign: "center",
      justifyContent: "center",
      minHeight: "26px",
      display: "flex",
      alignItems: "center",
      wordBreak: "keep-all",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
    }),
    []
  );

  const displayItems = useMemo(() => {
    if (!assets?.length) return [];

    const displayCount = showAll ? assets.length : MAX_DISPLAY;
    const items = assets.slice(0, displayCount).map((asset, index) => (
      <Badge
        key={asset.id || `keyword-${index}`}
        appearance="tint"
        color="brand"
        size="small"
        style={badgeStyle}
      >
        {asset.keyword || `키워드 ${index + 1}`}
      </Badge>
    ));

    // 더보기 버튼
    if (assets.length > MAX_DISPLAY && !showAll) {
      items.push(
        <Badge
          key="more-btn"
          appearance="outline"
          color="neutral"
          size="small"
          style={{ ...badgeStyle, fontWeight: 500, cursor: "pointer" }}
          onClick={() => setShowAll(true)}
        >
          +{assets.length - MAX_DISPLAY}개 더
        </Badge>
      );
    }

    return items;
  }, [assets, badgeStyle, showAll]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
        justifyContent: "center",
        alignItems: "start",
        maxWidth: "100%",
        margin: "0 auto",
        padding: `0 ${tokens.spacingHorizontalS}`,
      }}
    >
      {displayItems}
    </div>
  );
});

KeywordBadgeList.displayName = "KeywordBadgeList";

/**
 * 2단계: 키워드 추출
 */
const Step2KeywordExtraction = memo(
  ({
    // Keyword extraction props
    srtConnected,
    isExtracting,
    isGeneratingAudio = false,
    handleExtractKeywords,
    assets,
    scenes,
    currentLlmModel,
    getLlmDisplayName,
    // Step navigation
    onPrev,
    canProceed,
  }) => {
    // 안전한 배열 처리
    const safeAssets = useMemo(() => (Array.isArray(assets) ? assets : []), [assets]);
    const safeScenes = useMemo(() => (Array.isArray(scenes) ? scenes : []), [scenes]);

    // LLM 모델 디스플레이 이름 메모화
    const displayModelName = useMemo(() => {
      if (!currentLlmModel || !getLlmDisplayName) return "";
      try {
        return getLlmDisplayName(currentLlmModel).replace("🤖 ", "");
      } catch (error) {
        console.warn("LLM 모델 디스플레이 오류:", error);
        return currentLlmModel;
      }
    }, [currentLlmModel, getLlmDisplayName]);

    // 통계 정보 계산 메모화
    const statistics = useMemo(
      () => ({
        keywordCount: safeAssets.length,
        sceneCount: safeScenes.length,
        averagePerScene: safeScenes.length > 0 ? (safeAssets.length / safeScenes.length).toFixed(1) : "0.0",
      }),
      [safeAssets.length, safeScenes.length]
    );

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
              <div style={{ fontSize: "18px", lineHeight: 1 }}>🤖</div>
              <Text size={300} weight="semibold">
                AI로 키워드를 추출하세요
              </Text>
            </div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              자막 내용을 분석하여 영상 소스 검색에 필요한 키워드를 자동으로 추출합니다
            </Text>
          </div>
        </Card>

        {/* 키워드 추출 섹션 */}
        <Card
          style={{
            padding: "12px 16px",
            borderRadius: "16px",
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            display: "flex",
            flexDirection: "column",
            height: "420px",
          }}
        >
          <div style={{ marginBottom: tokens.spacingVerticalS }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LightbulbFilament24Regular />
              <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
                AI 키워드 추출
              </Text>
            </div>
            <Text
              size={200}
              style={{
                color: tokens.colorNeutralForeground3,
                marginTop: 4,
                display: "block",
              }}
            >
              SRT 내용을 분석하여 자동으로 영상 소스 검색 키워드를 추출합니다.
            </Text>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
            <PrimaryButton
              size="medium"
              style={{ height: 40, minWidth: 280, maxWidth: 480, alignSelf: "center" }}
              disabled={!srtConnected || isExtracting || isGeneratingAudio}
              onClick={() => handleExtractKeywords(safeScenes)}
            >
              {isGeneratingAudio
                ? "🎵 음성 생성 중..."
                : isExtracting
                  ? "키워드 추출 중..."
                  : "🤖 키워드 추출 시작"}
            </PrimaryButton>

            {/* 결과 영역 */}
            <div
              style={{
                minHeight: 280,
                maxHeight: 280,
                border: `1px solid ${tokens.colorNeutralStroke2}`,
                borderRadius: tokens.borderRadiusMedium,
                padding: tokens.spacingVerticalM,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tokens.colorNeutralBackground2,
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              {isGeneratingAudio ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: tokens.spacingVerticalM,
                    alignItems: "center",
                  }}
                >
                  <Spinner size="medium" />
                  <Body2 style={{ color: tokens.colorBrandForeground1 }}>🎵 수동 모드 음원을 생성하고 있습니다...</Body2>
                </div>
              ) : safeAssets.length > 0 ? (
                <div style={{ textAlign: "center", width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      marginBottom: tokens.spacingVerticalXS,
                      padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
                      backgroundColor: tokens.colorNeutralBackground1,
                      borderRadius: tokens.borderRadiusSmall,
                      border: `1px solid ${tokens.colorNeutralStroke3}`,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: tokens.spacingHorizontalS,
                      }}
                    >
                      <Body2
                        style={{
                          color: tokens.colorBrandForeground1,
                          fontWeight: 600,
                          fontSize: "14px",
                        }}
                      >
                        ✅ 키워드 추출 완료
                      </Body2>
                      <Badge
                        appearance="tint"
                        color="green"
                        size="small"
                        style={{
                          fontSize: "10px",
                          fontWeight: 500,
                        }}
                      >
                        💾 저장됨
                      </Badge>
                    </div>

                    {/* 통계 정보 */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                        gap: tokens.spacingHorizontalXXS,
                        marginTop: tokens.spacingVerticalXXS,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXXS}`,
                        }}
                      >
                        <Text size={300} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
                          {statistics.keywordCount}개
                        </Text>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3, fontSize: "10px" }}>
                          키워드 수
                        </Caption1>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXXS}`,
                        }}
                      >
                        <Text size={300} weight="semibold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                          {statistics.sceneCount}개
                        </Text>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3, fontSize: "10px" }}>
                          처리된 씬
                        </Caption1>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXXS}`,
                        }}
                      >
                        <Text size={300} weight="semibold" style={{ color: tokens.colorPalettePurpleForeground1 }}>
                          {statistics.averagePerScene}개
                        </Text>
                        <Caption1 style={{ color: tokens.colorNeutralForeground3, fontSize: "10px" }}>
                          씬당 평균
                        </Caption1>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      overflowX: "hidden",
                      border: `1px solid ${tokens.colorNeutralStroke3}`,
                      borderRadius: tokens.borderRadiusSmall,
                      padding: tokens.spacingVerticalS,
                      backgroundColor: tokens.colorNeutralBackground1,
                    }}
                  >
                    <KeywordBadgeList assets={safeAssets} />
                  </div>
                </div>
              ) : isExtracting ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: tokens.spacingVerticalM,
                    alignItems: "center",
                  }}
                >
                  <Spinner size="medium" />
                  <Body2 style={{ color: tokens.colorBrandForeground1 }}>키워드를 정밀하게 분석 중입니다...</Body2>
                </div>
              ) : (
                <div style={{ textAlign: "center", maxWidth: 520, width: "100%", margin: "0 auto" }}>
                  <Body2
                    style={{
                      color: tokens.colorNeutralForeground3,
                      marginBottom: tokens.spacingVerticalM,
                      display: "block",
                      textAlign: "center",
                    }}
                  >
                    {srtConnected
                      ? "🤖 키워드 추출 시작 버튼을 눌러 자동 분석을 시작하세요"
                      : "SRT 파일을 먼저 업로드해야 키워드 추출이 가능합니다"}
                  </Body2>
                  <Caption1
                    style={{
                      color: tokens.colorNeutralForeground3,
                      display: "block",
                      marginTop: tokens.spacingVerticalS,
                      textAlign: "center",
                    }}
                  >
                    AI가 자막을 분석하여 필요한 영상 소스를 자동으로 검색하고 추천합니다.
                  </Caption1>
                </div>
              )}
            </div>
          </div>
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

Step2KeywordExtraction.displayName = "Step2KeywordExtraction";

export default Step2KeywordExtraction;
