import React from "react";
import {
  Card,
  Text,
  tokens,
} from "@fluentui/react-components";
import { MODE_CONFIGS } from "../../../constants/modeConstants";

function ModeSelector({ selectedMode, onModeChange, form, isGenerating, compact = false }) {

  // 유효성 검사
  const hasValidTopic = form.topic?.trim();
  const hasValidReference = form.referenceScript?.trim() && form.referenceScript.trim().length >= 50;
  const isReferenceOnlyMode = hasValidReference && !hasValidTopic;

  const getValidationStatus = (mode) => {
    if (isGenerating) return "generating";

    // 공통 검증
    if (!hasValidTopic && !hasValidReference) return "invalid";
    if (!isReferenceOnlyMode && !form.promptName) return "invalid";

    return "valid";
  };

  // 컴팩트 모드 렌더링
  if (compact) {
    return (
      <Card style={{
        background: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: 12,
        padding: tokens.spacingVerticalM,
        marginBottom: tokens.spacingVerticalM,
        height: "fit-content",
        display: "flex",
        flexDirection: "column"
      }}>
        <div style={{ marginBottom: tokens.spacingVerticalS }}>
          <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
            🎯 생성 모드
          </Text>
        </div>

        {/* 가로형 탭 */}
        <div style={{
          display: "flex",
          background: tokens.colorNeutralBackground2,
          borderRadius: 8,
          padding: 4,
          gap: 4,
        }}>
          {Object.values(MODE_CONFIGS).map((mode) => {
            const isSelected = selectedMode === mode.key;
            const status = getValidationStatus(mode.key);
            const Icon = mode.icon;

            return (
              <button
                key={mode.key}
                onClick={() => {
                  if (status !== "generating") {
                    onModeChange(mode.key);
                  }
                }}
                style={{
                  flex: 1,
                  background: isSelected ? mode.gradient : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "12px 16px",
                  cursor: status === "generating" ? "not-allowed" : "pointer",
                  transition: "all 200ms ease-out",
                  opacity: status === "generating" && !isSelected ? 0.6 : 1,
                  color: isSelected ? "white" : tokens.colorNeutralForeground1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontFamily: "inherit",
                  fontSize: "14px",
                  fontWeight: isSelected ? 600 : 500,
                  boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.1)" : "none",
                }}
              >
                <Icon style={{ fontSize: 18 }} />
                {mode.title}
                {isSelected && (
                  <div style={{
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px"
                  }}>
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 선택된 모드 정보 */}
        {selectedMode && (
          <div style={{
            marginTop: tokens.spacingVerticalS,
            padding: tokens.spacingVerticalS,
            background: tokens.colorNeutralBackground2,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
              {MODE_CONFIGS[selectedMode]?.description}
            </Text>
          </div>
        )}
      </Card>
    );
  }

  // 기본 모드 렌더링 (기존 코드 유지)
  return (
    <Card style={{
      background: tokens.colorNeutralBackground1,
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      borderRadius: 16,
      padding: tokens.spacingVerticalL,
      marginBottom: tokens.spacingVerticalL,
    }}>
      <div style={{ marginBottom: tokens.spacingVerticalM }}>
        <Text size={500} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
          🎯 생성 모드 선택
        </Text>
        <Text size={300} style={{
          color: tokens.colorNeutralForeground3,
          marginTop: 4,
          display: "block"
        }}>
          원하는 콘텐츠 생성 방식을 선택하세요
        </Text>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: tokens.spacingHorizontalL,
      }}>
        {Object.values(MODE_CONFIGS).map((mode) => {
          const isSelected = selectedMode === mode.key;
          const status = getValidationStatus(mode.key);
          const Icon = mode.icon;

          return (
            <Card
              key={mode.key}
              style={{
                background: isSelected ? mode.gradient : tokens.colorNeutralBackground2,
                border: isSelected
                  ? "2px solid transparent"
                  : `2px solid ${tokens.colorNeutralStroke2}`,
                borderRadius: 12,
                padding: tokens.spacingVerticalM,
                cursor: status === "generating" ? "not-allowed" : "pointer",
                transform: isSelected ? "translateY(-2px)" : "none",
                boxShadow: isSelected
                  ? "0 8px 24px rgba(0,0,0,0.15)"
                  : "0 2px 8px rgba(0,0,0,0.08)",
                transition: "all 200ms ease-out",
                opacity: status === "generating" && !isSelected ? 0.6 : 1,
              }}
              onClick={() => {
                if (status !== "generating") {
                  onModeChange(mode.key);
                }
              }}
            >
              <div style={{
                color: isSelected ? "white" : tokens.colorNeutralForeground1,
                textAlign: "center"
              }}>
                <div style={{
                  marginBottom: tokens.spacingVerticalS,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8
                }}>
                  <Icon style={{ fontSize: 24 }} />
                  {isSelected && (
                    <div style={{
                      background: "rgba(255,255,255,0.2)",
                      borderRadius: "50%",
                      width: 20,
                      height: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      ✓
                    </div>
                  )}
                </div>

                <Text
                  size={400}
                  weight="semibold"
                  style={{
                    color: "inherit",
                    display: "block",
                    marginBottom: 4
                  }}
                >
                  {mode.title}
                </Text>

                <Text
                  size={200}
                  style={{
                    color: isSelected ? "rgba(255,255,255,0.9)" : tokens.colorNeutralForeground3,
                    display: "block",
                    marginBottom: tokens.spacingVerticalS
                  }}
                >
                  {mode.subtitle}
                </Text>

                <Text
                  size={200}
                  style={{
                    color: isSelected ? "rgba(255,255,255,0.8)" : tokens.colorNeutralForeground2,
                    lineHeight: 1.4,
                    display: "block",
                    marginBottom: tokens.spacingVerticalS
                  }}
                >
                  {mode.description}
                </Text>

                {/* 단계 표시 */}
                <div style={{ marginBottom: tokens.spacingVerticalS }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: 4,
                    flexWrap: "wrap"
                  }}>
                    {mode.steps.map((step, index) => (
                      <React.Fragment key={step}>
                        <Text
                          size={100}
                          style={{
                            color: isSelected ? "rgba(255,255,255,0.7)" : tokens.colorNeutralForeground3,
                            fontSize: "11px",
                            whiteSpace: "nowrap"
                          }}
                        >
                          {step}
                        </Text>
                        {index < mode.steps.length - 1 && (
                          <Text
                            style={{
                              color: isSelected ? "rgba(255,255,255,0.5)" : tokens.colorNeutralForeground3,
                              fontSize: "10px"
                            }}
                          >
                            →
                          </Text>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <Text
                  size={200}
                  style={{
                    color: isSelected ? "rgba(255,255,255,0.7)" : tokens.colorNeutralForeground3,
                    fontSize: "11px"
                  }}
                >
                  ⏱️ 예상 시간: {mode.estimatedTime}
                </Text>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 선택된 모드 요약 */}
      {selectedMode && (
        <div style={{
          marginTop: tokens.spacingVerticalM,
          padding: tokens.spacingVerticalS,
          background: tokens.colorNeutralBackground2,
          borderRadius: 8,
          textAlign: "center"
        }}>
          <Text size={300} style={{ color: tokens.colorNeutralForeground2 }}>
            선택됨: <strong>{MODE_CONFIGS[selectedMode]?.title}</strong>
          </Text>
        </div>
      )}
    </Card>
  );
}

export default ModeSelector;