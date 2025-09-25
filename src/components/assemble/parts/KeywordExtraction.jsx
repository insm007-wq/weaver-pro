import React from "react";
import { tokens, Text, Body1, Body2, Caption1, Card, Badge, Spinner } from "@fluentui/react-components";
import { LightbulbFilament24Regular } from "@fluentui/react-icons";
import { PrimaryButton } from "../../common";

// ChipsWrap 컴포넌트를 KeywordExtraction 내부로 이동
const ChipsWrap = ({ items }) => (
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
);

const KeywordExtraction = ({ srtConnected, isExtracting, handleExtractKeywords, assets, scenes, currentLlmModel, getLlmDisplayName }) => {
  return (
    <Card
      style={{
        padding: "12px 16px",
        borderRadius: "16px",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        height: "fit-content",
        display: "flex",
        flexDirection: "column",
      }}
    >
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
                {getLlmDisplayName(currentLlmModel).replace("🤖 ", "")}
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
          onClick={handleExtractKeywords}
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
        <div
          style={{
            minHeight: 200,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            borderRadius: tokens.borderRadiusLarge,
            padding: tokens.spacingVerticalL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.colorNeutralBackground2,
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
          }}
        >
          {assets.length > 0 ? (
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                    gap: tokens.spacingHorizontalS,
                    marginTop: tokens.spacingVerticalXS,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalXS}`,
                    }}
                  >
                    <Text size={400} weight="semibold" style={{ color: tokens.colorBrandForeground1 }}>
                      {assets.length}개
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
                      {scenes.length}개
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
                      {(assets.length / Math.max(scenes.length, 1)).toFixed(1)}개
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
                <ChipsWrap
                  items={assets
                    .slice(0, 50)
                    .map((asset, index) => (
                      <Badge
                        key={index}
                        appearance="tint"
                        color="brand"
                        size="small"
                        style={{
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
                        }}
                      >
                        {asset.keyword || `키워드 ${index + 1}`}
                      </Badge>
                    ))
                    .concat(
                      assets.length > 50
                        ? [
                            <Badge
                              key="more"
                              appearance="outline"
                              color="neutral"
                              size="small"
                              style={{
                                cursor: "default",
                                fontSize: "12px",
                                lineHeight: 1,
                                width: "100%",
                                textAlign: "center",
                                justifyContent: "center",
                                minHeight: "26px",
                                display: "flex",
                                alignItems: "center",
                                fontWeight: 500,
                                padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
                              }}
                            >
                              +{assets.length - 50}개 더
                            </Badge>,
                          ]
                        : []
                    )}
                />
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
};

export default KeywordExtraction;
