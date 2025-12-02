import React, { memo, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, Text, tokens, Button } from "@fluentui/react-components";
import { PlayRegular } from "@fluentui/react-icons";
import { MODE_CONFIGS } from "../../../constants/modeConstants";

const ModeSelector = memo(({
  selectedMode,
  onModeChange,
  form,
  isGenerating,
  compact = false,
  globalSettings,
  setGlobalSettings,
  api,
  onGenerate = null,
  isCancelling = false,
  onCancel = null,
}) => {
  // 안전한 폼 데이터 처리
  const safeForm = useMemo(
    () => ({
      topic: form?.topic || "",
      referenceScript: form?.referenceScript || "",
      promptName: form?.promptName || "",
    }),
    [form?.topic, form?.referenceScript, form?.promptName]
  );

  // 유효성 검사 메모화
  const validationState = useMemo(() => {
    const hasValidTopic = safeForm.topic.trim();
    const hasValidReference = safeForm.referenceScript.trim() && safeForm.referenceScript.trim().length >= 50;
    const isReferenceOnlyMode = hasValidReference && !hasValidTopic;

    return {
      hasValidTopic,
      hasValidReference,
      isReferenceOnlyMode,
    };
  }, [safeForm.topic, safeForm.referenceScript]);

  const getValidationStatus = useCallback(
    (mode) => {
      if (isGenerating) return "generating";

      // 공통 검증
      if (!validationState.hasValidTopic && !validationState.hasValidReference) return "invalid";
      if (!validationState.isReferenceOnlyMode && !safeForm.promptName) return "invalid";

      return "valid";
    },
    [isGenerating, validationState, safeForm.promptName]
  );

  // 클릭 핸들러 최적화
  const handleModeChange = useCallback(
    (modeKey) => {
      const mode = MODE_CONFIGS[modeKey];
      if (mode?.disabled) return;
      const status = getValidationStatus(modeKey);
      if (status !== "generating") {
        onModeChange(modeKey);
      }
    },
    [getValidationStatus, onModeChange]
  );

  // 스타일 메모화
  const styles = useMemo(
    () => ({
      compactCard: {
        background: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: 12,
        padding: tokens.spacingVerticalM,
        marginBottom: tokens.spacingVerticalM,
        height: "fit-content",
        display: "flex",
        flexDirection: "column",
      },
      tabContainer: {
        display: "flex",
        background: tokens.colorNeutralBackground2,
        borderRadius: 8,
        padding: 4,
        gap: 4,
      },
      modeInfo: {
        marginTop: tokens.spacingVerticalS,
        padding: tokens.spacingVerticalS,
        background: tokens.colorNeutralBackground2,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      defaultCard: {
        background: tokens.colorNeutralBackground1,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: 16,
        padding: "12px 16px",
      },
      gridContainer: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
      },
      summaryContainer: {
        marginTop: tokens.spacingVerticalM,
        padding: tokens.spacingVerticalS,
        background: tokens.colorNeutralBackground2,
        borderRadius: 8,
        textAlign: "center",
      },
    }),
    []
  );

  // 전역 설정 로드 로직 (무한 루프 방지)
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // 한 번만 로드하도록 제한
    if (hasLoadedRef.current || !window.api?.invoke || !setGlobalSettings) {
      return;
    }

    let isMounted = true;

    const loadGlobalSettings = async () => {
      try {
        const result = await window.api.invoke("settings:get", "llmModel");
        const llmSetting = result?.data || result;

        if (!isMounted) return;

        if (llmSetting !== null && llmSetting !== undefined) {
          let llmValue;
          if (typeof llmSetting === "object") {
            llmValue = llmSetting.data || llmSetting.value || llmSetting;
          } else {
            llmValue = llmSetting;
          }

          if (typeof llmValue === "string" && llmValue.trim()) {
            setGlobalSettings((prev) => {
              if (prev.llmModel !== llmValue) {
                return { ...prev, llmModel: llmValue };
              }
              return prev;
            });
            hasLoadedRef.current = true;
          }
        }
      } catch (error) {
        if (isMounted) {
          console.warn("전역 설정 로드 실패:", error);
        }
      }
    };

    loadGlobalSettings();

    return () => {
      isMounted = false;
    };
  }, []); // 의존성 배열을 비워서 무한 호출 방지

  // settings 변경 이벤트 리스너 (한 번만 등록)
  useEffect(() => {
    const handleSettingsChange = async () => {
      if (!window.api?.invoke || !setGlobalSettings) return;

      try {
        const result = await window.api.invoke("settings:get", "llmModel");
        const llmSetting = result?.data || result;

        if (llmSetting !== null && llmSetting !== undefined) {
          let llmValue;
          if (typeof llmSetting === "object") {
            llmValue = llmSetting.data || llmSetting.value || llmSetting;
          } else {
            llmValue = llmSetting;
          }

          if (typeof llmValue === "string" && llmValue.trim()) {
            setGlobalSettings((prev) => {
              if (prev.llmModel !== llmValue) {
                return { ...prev, llmModel: llmValue };
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.warn("설정 변경 시 전역 설정 로드 실패:", error);
      }
    };

    window.addEventListener("settingsChanged", handleSettingsChange);
    return () => {
      window.removeEventListener("settingsChanged", handleSettingsChange);
    };
  }, []); // 의존성 배열을 비워서 한 번만 등록

  // 컴팩트 모드 렌더링
  if (compact) {
    return (
      <Card style={styles.compactCard}>
        <div style={{ marginBottom: tokens.spacingVerticalS }}>
          <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
            🎯 생성 모드
          </Text>
        </div>

        {/* 가로형 탭 */}
        <div style={styles.tabContainer}>
          {Object.values(MODE_CONFIGS).map((mode) => {
            const isSelected = selectedMode === mode.key;
            const status = getValidationStatus(mode.key);
            const Icon = mode.icon;
            const isDisabled = mode.disabled;

            return (
              <button
                key={mode.key}
                onClick={() => handleModeChange(mode.key)}
                disabled={isDisabled}
                style={{
                  flex: 1,
                  background: isSelected ? mode.gradient : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "12px 16px",
                  cursor: isDisabled ? "not-allowed" : status === "generating" ? "not-allowed" : "pointer",
                  transition: "all 200ms ease-out",
                  opacity: isDisabled ? 0.4 : status === "generating" && !isSelected ? 0.6 : 1,
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
                  <div
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      borderRadius: "50%",
                      width: 16,
                      height: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                    }}
                  >
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 선택된 모드 정보 */}
        {selectedMode && (
          <div style={styles.modeInfo}>
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
    <Card style={styles.defaultCard}>
      <div style={{ marginBottom: "8px" }}>
        <Text size={400} weight="semibold" style={{ color: tokens.colorNeutralForeground1 }}>
          🎯 생성 모드 선택
        </Text>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 2, display: "block" }}>
          원하는 콘텐츠 생성 방식을 선택하세요
        </Text>
      </div>

      <div style={styles.gridContainer}>
        {Object.values(MODE_CONFIGS).map((mode) => {
          const isSelected = selectedMode === mode.key;
          const status = getValidationStatus(mode.key);
          const Icon = mode.icon;
          const isDisabled = mode.disabled;

          return (
            <Card
              key={mode.key}
              style={{
                background: isSelected ? mode.gradient : tokens.colorNeutralBackground2,
                border: isSelected ? "2px solid transparent" : `2px solid ${tokens.colorNeutralStroke2}`,
                borderRadius: 12,
                padding: "10px 12px",
                cursor: isDisabled ? "not-allowed" : status === "generating" ? "not-allowed" : "pointer",
                transform: isSelected ? "translateY(-2px)" : "none",
                boxShadow: isSelected ? "0 8px 24px rgba(0,0,0,0.15)" : "0 2px 8px rgba(0,0,0,0.08)",
                transition: "all 200ms ease-out",
                opacity: isDisabled ? 0.4 : status === "generating" && !isSelected ? 0.6 : 1,
                pointerEvents: isDisabled ? "none" : "auto",
              }}
              onClick={() => handleModeChange(mode.key)}
            >
              <div style={{ color: isSelected ? "white" : tokens.colorNeutralForeground1, textAlign: "center" }}>
                <div style={{ marginBottom: tokens.spacingVerticalS, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
                  <Icon style={{ fontSize: 24 }} />
                  {isSelected && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        borderRadius: "50%",
                        width: 20,
                        height: 20,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✓
                    </div>
                  )}
                </div>

                <Text
                  size={300}
                  weight="semibold"
                  style={{
                    color: "inherit",
                    display: "block",
                    marginBottom: 2,
                  }}
                >
                  {mode.title}
                </Text>

                <Text
                  size={100}
                  style={{
                    color: isSelected ? "rgba(255,255,255,0.9)" : tokens.colorNeutralForeground3,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  {mode.subtitle}
                </Text>

                <Text
                  size={100}
                  style={{
                    color: isSelected ? "rgba(255,255,255,0.8)" : tokens.colorNeutralForeground2,
                    lineHeight: 1.4,
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  {mode.description}
                </Text>

                {/* 단계 표시 */}
                <div style={{ marginBottom: "4px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 4,
                      flexWrap: "wrap",
                    }}
                  >
                    {mode.steps.map((step, index) => (
                      <React.Fragment key={step}>
                        <Text
                          size={100}
                          style={{
                            color: isSelected ? "rgba(255,255,255,0.7)" : tokens.colorNeutralForeground3,
                            fontSize: "11px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {step}
                        </Text>
                        {index < mode.steps.length - 1 && (
                          <Text
                            style={{
                              color: isSelected ? "rgba(255,255,255,0.5)" : tokens.colorNeutralForeground3,
                              fontSize: "10px",
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
                    fontSize: "11px",
                  }}
                >
                  ⏱️ 예상 시간: {mode.estimatedTime}
                </Text>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 생성 버튼 */}
      {selectedMode && onGenerate && (
        <div style={{ marginTop: tokens.spacingVerticalM }}>
          <Button
            appearance={isCancelling ? "secondary" : isGenerating ? "secondary" : "primary"}
            icon={isCancelling ? null : isGenerating ? null : <PlayRegular />}
            onClick={() => {
              if (isGenerating) {
                onCancel?.();
              } else {
                onGenerate();
              }
            }}
            disabled={isCancelling || (!isGenerating && !form?.topic?.trim() && !form?.referenceScript?.trim())}
            style={{
              width: "100%",
              padding: "12px 20px",
              fontSize: "14px",
              fontWeight: "bold",
              background: isCancelling
                ? "transparent"
                : isGenerating
                  ? `linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)`
                  : `linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)`,
              border: "none",
              color: isCancelling ? tokens.colorNeutralForeground2 : "white",
              boxShadow: isGenerating ? "0 4px 12px rgba(0,0,0,0.1)" : "0 2px 8px rgba(0,0,0,0.15)",
              transition: "all 200ms ease-out",
            }}
          >
            {isCancelling ? "⏳ 취소 중..." : isGenerating ? "⏹ 생성 중지" : selectedMode === "shorts_mode" ? "⚡ 쇼츠 생성 시작" : "📝 대본 생성 시작"}
          </Button>
        </div>
      )}

    </Card>
  );
});

// 컴포넌트 이름 설정 (개발자 도구에서 디버깅 편의)
ModeSelector.displayName = "ModeSelector";

export default ModeSelector;
