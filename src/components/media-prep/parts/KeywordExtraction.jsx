import { useMemo, memo } from "react";
import { tokens, Text, Body1, Body2, Caption1, Card, Badge, Spinner } from "@fluentui/react-components";
import { LightbulbFilament24Regular } from "@fluentui/react-icons";
import { PrimaryButton } from "../../common";

// ChipsWrap 컴포넌트 - 성능 최적화를 위해 메모화
const ChipsWrap = memo(({ items }) => (
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
    {items}
  </div>
));

// 키워드 배지 리스트 컴포넌트 - 성능 최적화
const KeywordBadgeList = memo(({ assets, maxDisplay = 50 }) => {
  const badgeStyle = useMemo(() => ({
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
  }), []);

  const moreStyle = useMemo(() => ({
    ...badgeStyle,
    fontWeight: 500,
  }), [badgeStyle]);

  const displayItems = useMemo(() => {
    const items = assets
      .slice(0, maxDisplay)
      .map((asset, index) => (
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

    if (assets.length > maxDisplay) {
      items.push(
        <Badge
          key="more"
          appearance="outline"
          color="neutral"
          size="small"
          style={moreStyle}
        >
          +{assets.length - maxDisplay}개 더
        </Badge>
      );
    }

    return items;
  }, [assets, maxDisplay, badgeStyle, moreStyle]);

  return <ChipsWrap items={displayItems} />;
});

const KeywordExtraction = memo(({ srtConnected, isExtracting, handleExtractKeywords, assets, scenes, currentLlmModel, getLlmDisplayName }) => {
  // 안전한 배열 처리
  const safeAssets = useMemo(() => Array.isArray(assets) ? assets : [], [assets]);
  const safeScenes = useMemo(() => Array.isArray(scenes) ? scenes : [], [scenes]);

  // LLM 모델 디스플레이 이름 메모화
  const displayModelName = useMemo(() => {
    if (!currentLlmModel || !getLlmDisplayName) return '';
    try {
      return getLlmDisplayName(currentLlmModel).replace('🤖 ', '');
    } catch (error) {
      console.warn('LLM 모델 디스플레이 오류:', error);
      return currentLlmModel;
    }
  }, [currentLlmModel, getLlmDisplayName]);

  // 통계 정보 계산 메모화
  const statistics = useMemo(() => ({
    keywordCount: safeAssets.length,
    sceneCount: safeScenes.length,
    averagePerScene: safeScenes.length > 0 ? (safeAssets.length / safeScenes.length).toFixed(1) : '0.0'
  }), [safeAssets.length, safeScenes.length]);

  // 커스텀 스타일 메모화
  const styles = useMemo(() => ({
    cardContainer: {
      padding: "12px 16px",
      borderRadius: "16px",
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      height: "fit-content",
      display: "flex",
      flexDirection: "column",
    },
    resultArea: {
      minHeight: 200,
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: tokens.borderRadiusLarge,
      padding: tokens.spacingVerticalL,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tokens.colorNeutralBackground2,
      boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
    },
    statisticsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
      gap: tokens.spacingHorizontalS,
      marginTop: tokens.spacingVerticalXS,
    },
    keywordsContainer: {
      maxHeight: "300px",
      overflowY: "auto",
      overflowX: "hidden",
      border: `1px solid ${tokens.colorNeutralStroke3}`,
      borderRadius: tokens.borderRadiusSmall,
      padding: tokens.spacingVerticalS,
      backgroundColor: tokens.colorNeutralBackground1,
    }
  }), []);

  return (
    <Card style={styles.cardContainer}>
      <div style={{ marginBottom: tokens.spacingVerticalS }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <LightbulbFilament24Regular />
            <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
              AI 키워드 추출
            </Text>
          </div>
          {currentLlmModel && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                backgroundColor: tokens.colorBrandBackground2,
                border: `1px solid ${tokens.colorBrandStroke1}`,
                borderRadius: tokens.borderRadiusMedium,
                fontSize: "12px",
                fontWeight: 600,
                color: tokens.colorBrandForeground1,
              }}
            >
              <div style={{ fontSize: "14px" }}>🤖</div>
              <Text size={200} weight="semibold" style={{ color: "inherit" }}>
                {displayModelName}
              </Text>
            </div>
          )}
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacingVerticalL,
        }}
      >
        <PrimaryButton
          size="large"
          style={{ height: 48, maxWidth: 480, alignSelf: "center" }}
          disabled={!srtConnected || isExtracting}
          onClick={() => handleExtractKeywords(safeScenes)}
        >
          {isExtracting ? (
            <>
              <Spinner size="tiny" style={{ marginRight: tokens.spacingHorizontalS }} />
              키워드 추출 중...
            </>
          ) : (
            "🤖 키워드 추출 시작"
          )}
        </PrimaryButton>

        {/* 결과 영역 */}
        <div style={styles.resultArea}>
          {safeAssets.length > 0 ? (
            <div style={{ textAlign: "center", width: "100%" }}>
              <div
                style={{
                  marginBottom: tokens.spacingVerticalM,
                  padding: tokens.spacingVerticalS,
                  backgroundColor: tokens.colorNeutralBackground1,
                  borderRadius: tokens.borderRadiusSmall,
                  border: `1px solid ${tokens.colorNeutralStroke3}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: tokens.spacingHorizontalS }}>
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

                {/* 통계 정보 행 */}
                <div style={styles.statisticsGrid}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
                    }}
                  >
                    <Text size={400} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
                      {statistics.keywordCount}개
                    </Text>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, fontSize: "11px" }}>키워드 수</Caption1>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
                    }}
                  >
                    <Text size={400} weight="semibold" style={{ color: tokens.colorPaletteGreenForeground1 }}>
                      {statistics.sceneCount}개
                    </Text>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, fontSize: "11px" }}>처리된 씬</Caption1>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
                    }}
                  >
                    <Text size={400} weight="semibold" style={{ color: tokens.colorPalettePurpleForeground1 }}>
                      {statistics.averagePerScene}개
                    </Text>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, fontSize: "11px" }}>씬당 평균</Caption1>
                  </div>
                </div>
              </div>

              <div
                style={{
                  maxHeight: "300px",
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
              <Body1 style={{ color: tokens.colorBrandForeground1 }}>키워드를 정밀하게 분석 중입니다...</Body1>
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
                  ? "키워드 추출 버튼을 눌러 영상 소스 검색을 시작하세요"
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
                추출된 키워드를 기반으로 영상 제작에 필요한 소스를 자동으로 검색 및 추천합니다.
              </Caption1>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

// 컴포넌트 이름 설정 (개발자 도구에서 디버깅 편의)
KeywordExtraction.displayName = "KeywordExtraction";
ChipsWrap.displayName = "ChipsWrap";
KeywordBadgeList.displayName = "KeywordBadgeList";

export default KeywordExtraction;
