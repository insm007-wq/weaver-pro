import { memo, useMemo, useState, useCallback, useEffect } from "react";
import { Card, Text, Field, Input, Dropdown, Option, Spinner, Switch, Textarea, tokens, Button } from "@fluentui/react-components";
import { SettingsRegular, PlayRegular } from "@fluentui/react-icons";
import { STYLE_OPTIONS, DURATION_OPTIONS, SHORTS_STYLE_OPTIONS, SHORTS_DURATION_OPTIONS } from "../../../constants/scriptSettings";
import { validateAndSanitizeText } from "../../../utils/sanitizer";
import { useScriptGenerator } from "../../../hooks/useScriptGenerator";

/**
 * 기본 설정 카드 (UI만 개선)
 */
const BasicSettingsCard = memo(({
  form,
  onChange,
  promptNames,
  promptLoading,
  setForm,
  disabled = false,
  selectedMode = "script_mode",
  isGenerating = false,
  onGenerate = null,
  fullVideoState = {},
  voices = [],
  api = null,
  runGenerate = null,
  setError = null,
  setIsLoading = null,
  setDoc = null,
  setFullVideoState = null,
  chunkProgress = null,
}) => {
  const [validationErrors, setValidationErrors] = useState({});

  // 대본 생성 훅
  const { runScriptMode, cancelGeneration, isCancelling } = useScriptGenerator();

  // 안전한 폼 데이터 처리
  const safeForm = useMemo(
    () => ({
      topic: form?.topic || "",
      style: form?.style || "",
      durationMin: form?.durationMin || 0,
      promptName: form?.promptName || "",
      showReferenceScript: form?.showReferenceScript || false,
      referenceScript: form?.referenceScript || "",
    }),
    [form?.topic, form?.style, form?.durationMin, form?.promptName, form?.showReferenceScript, form?.referenceScript]
  );

  // 유효성 검사 메모화
  const validationState = useMemo(() => {
    const hasValidTopic = safeForm.topic.trim();
    const hasValidReference = safeForm.referenceScript.trim() && safeForm.referenceScript.trim().length >= 50;
    const isReferenceOnlyMode = hasValidReference && !hasValidTopic;

    const errors = [];
    if (!hasValidTopic && !hasValidReference) {
      errors.push("• 영상 주제 입력 또는 레퍼런스 대본 입력 (50자 이상)");
    }
    if (!isReferenceOnlyMode && !safeForm.promptName) {
      errors.push("• 대본 생성 프롬프트 선택");
    }

    return {
      hasValidTopic,
      hasValidReference,
      isReferenceOnlyMode,
      errors,
    };
  }, [safeForm.topic, safeForm.referenceScript, safeForm.promptName]);

  const isDisabled = useMemo(
    () => isGenerating || validationState.errors.length > 0 || disabled,
    [isGenerating, validationState.errors.length, disabled]
  );

  // 생성 시작 핸들러
  const handleStartGeneration = useCallback(async () => {
    if (isDisabled) return;

    await runScriptMode(form, {
      form,
      voices,
      api,
      runGenerate,
      setError,
      setIsLoading,
      setDoc,
      setFullVideoState,
    });
  }, [isDisabled, runScriptMode, form, voices, api, runGenerate, setError, setIsLoading, setDoc, setFullVideoState]);

  // 안전한 입력 처리 함수 메모화
  const handleSafeChange = useCallback(
    (field, value, options = {}) => {
      const result = validateAndSanitizeText(value, {
        maxLength: field === "topic" ? 80 : field === "referenceScript" ? 15000 : 100,
        allowEmpty: true,
        fieldName: field,
        ...options,
      });

      // 검증 오류 상태 업데이트
      setValidationErrors((prev) => ({
        ...prev,
        [field]: result.errors,
      }));

      // 정제된 값으로 onChange 호출
      onChange(field, result.sanitized);
    },
    [onChange, setValidationErrors]
  );

  // 스타일 메모화
  const styles = useMemo(
    () => ({
      cardContainer: {
        padding: "12px 16px",
        borderRadius: "16px",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        height: "fit-content",
        display: "flex",
        flexDirection: "column",
      },
      headerContainer: {
        marginBottom: tokens.spacingVerticalS,
      },
      headerContent: {
        display: "flex",
        alignItems: "center",
        gap: 8,
      },
      gridContainer: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "12px",
        alignItems: "start",
      },
      fullWidthColumn: {
        gridColumn: "1 / -1",
      },
      referenceContainer: {
        gridColumn: "1 / -1",
        marginTop: tokens.spacingVerticalS,
      },
      switchContainer: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      },
      textareaContainer: {
        minHeight: 120,
        borderColor: tokens.colorNeutralStroke2,
        borderRadius: 12,
      },
      statusBar: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: tokens.spacingVerticalXS,
        paddingTop: 8,
        borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
      },
      fixedHeightCaption: {
        minHeight: 22,
        marginTop: 4,
      },
    }),
    []
  );

  // 프롬프트 자동 선택 로직 추가
  useEffect(() => {
    if (promptNames.length > 0 && !safeForm.promptName) {
      setForm((prev) => ({ ...prev, promptName: promptNames[0] }));
    }
  }, [promptNames, safeForm.promptName, setForm]);

  return (
    <Card style={styles.cardContainer}>
      <div style={styles.headerContainer}>
        <div style={styles.headerContent}>
          <SettingsRegular />
          <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
            기본 설정
          </Text>
        </div>
        {/* 보조 설명 (톤 낮춘 캡션) */}
        <Text
          size={200}
          style={{
            color: tokens.colorNeutralForeground3,
            marginTop: 4,
            display: "block",
          }}
        >
          대본 생성에 필요한 핵심 값을 한 곳에서 설정합니다.
        </Text>
      </div>

      {/* 2열 그리드 유지 + 행간/열간 미세 조정 */}
      <div style={styles.gridContainer}>
        {/* 영상 주제: 전체 너비 */}
        <div style={styles.fullWidthColumn}>
          <Field
            label={
              <Text size={300} weight="semibold">
                영상 주제
              </Text>
            }
          >
            <Input
              value={safeForm.topic}
              onChange={(e) => handleSafeChange("topic", e.target.value)}
              placeholder={
                safeForm.showReferenceScript
                  ? "주제를 입력하면 레퍼런스 스타일로 새 대본 생성 / 비워두면 레퍼런스 자체를 개선"
                  : "예: 인공지능의 미래와 우리 삶의 변화"
              }
              size="medium"
              style={{ height: 36 }}
              maxLength={80}
              aria-invalid={validationErrors.topic?.length > 0}
              disabled={disabled}
            />
            {validationErrors.topic?.length > 0 && (
              <Text size={200} style={{ color: tokens.colorPaletteRedForeground2, marginTop: 4 }}>
                {validationErrors.topic[0]}
              </Text>
            )}
          </Field>
        </div>

        {/* 스타일 선택 */}
        {(() => {
          const isShortMode = selectedMode === "shorts_mode";
          const styleOptions = isShortMode ? SHORTS_STYLE_OPTIONS : STYLE_OPTIONS;
          return (
            <Field
              label={
                <Text size={300} weight="semibold">
                  {isShortMode ? "쇼츠 스타일" : "스타일"}
                </Text>
              }
            >
              <Dropdown
                value={styleOptions.find((s) => s.key === safeForm.style)?.text || "스타일 선택"}
                selectedOptions={[safeForm.style]}
                onOptionSelect={(_, d) => onChange("style", d.optionValue)}
                size="medium"
                style={{ minHeight: 36 }}
                disabled={disabled}
              >
                {styleOptions.map((style) => (
                  <Option key={style.key} value={style.key} text={style.desc ? `${style.text} - ${style.desc}` : style.text}>
                    {style.text}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          );
        })()}

        {/* 예상 길이 */}
        {(() => {
          const isShortMode = selectedMode === "shorts_mode";
          const durationOptions = isShortMode ? SHORTS_DURATION_OPTIONS : DURATION_OPTIONS;
          const parseValue = isShortMode ? parseFloat : parseInt;
          return (
            <Field
              label={
                <Text size={300} weight="semibold">
                  {isShortMode ? "쇼츠 길이" : "예상 길이"}
                </Text>
              }
            >
              <Dropdown
                value={durationOptions.find((d) => d.key === safeForm.durationMin)?.text || "길이 선택"}
                selectedOptions={[safeForm.durationMin?.toString()]}
                onOptionSelect={(_, d) => onChange("durationMin", parseValue(d.optionValue))}
                size="medium"
                style={{ minHeight: 36 }}
                disabled={disabled}
              >
                {durationOptions.map((duration) => (
                  <Option key={duration.key} value={duration.key.toString()}>
                    {duration.text}
                  </Option>
                ))}
              </Dropdown>
              {isShortMode && (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
                  💡 쇼츠는 첫 3초가 가장 중요합니다
                </Text>
              )}
            </Field>
          );
        })()}

        {/* 프롬프트 선택 */}
        <Field
          label={
            <Text size={300} weight="semibold">
              대본 생성 프롬프트
            </Text>
          }
        >
          <Dropdown
            value={safeForm.promptName || (promptLoading ? "불러오는 중..." : "프롬프트 선택")}
            selectedOptions={safeForm.promptName ? [safeForm.promptName] : []}
            onOptionSelect={(_, d) => onChange("promptName", d.optionValue)}
            size="medium" // 🔧 large → medium
            disabled={disabled || !!promptLoading || promptNames.length === 0}
            style={{ minHeight: 36 }}
          >
            {promptNames.map((name) => (
              <Option key={name} value={name}>
                {name}
              </Option>
            ))}
          </Dropdown>

          {/* 상태 캡션: 높이 고정 */}
          <div style={styles.fixedHeightCaption}>
            {promptLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Spinner size="tiny" />
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  불러오는 중...
                </Text>
              </div>
            ) : promptNames.length === 0 ? (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                설정에서 프롬프트를 저장하세요
              </Text>
            ) : null}
          </div>
        </Field>

        {/* 레퍼런스 대본 (선택) - 전체 너비 */}
        <div style={styles.referenceContainer}>
          <div style={styles.switchContainer}>
            <Switch checked={safeForm.showReferenceScript} onChange={(_, data) => onChange("showReferenceScript", data.checked)} disabled={disabled} />
            <Text
              size={300}
              weight="semibold"
              style={{
                cursor: "default",
                userSelect: "none",
                pointerEvents: "none",
              }}
            >
              레퍼런스 대본 (선택사항)
            </Text>
          </div>

          {safeForm.showReferenceScript && (
            <Field>
              <Text
                size={200}
                style={{
                  color: tokens.colorNeutralForeground3,
                  marginBottom: tokens.spacingVerticalXS,
                  display: "block",
                }}
              >
                {safeForm.topic.trim()
                  ? "🎭 레퍼런스의 톤앤매너를 분석해 새로운 주제에 적용한 대본을 생성합니다."
                  : "📈 레퍼런스를 분석해 구조/스타일을 개선한 버전을 생성합니다."}
              </Text>

              <Textarea
                value={safeForm.referenceScript}
                onChange={(e) => handleSafeChange("referenceScript", e.target.value)}
                placeholder="예시: '안녕하세요! 오늘은 맛있는 요리를 만들어볼게요. 먼저 재료를 준비해주세요...'"
                rows={6}
                resize="none"
                disabled={disabled}
                maxLength={15000}
                style={{
                  ...styles.textareaContainer,
                  borderColor: validationErrors.referenceScript?.length > 0 ? tokens.colorPaletteRedBorder2 : styles.textareaContainer.borderColor,
                }}
                aria-invalid={validationErrors.referenceScript?.length > 0}
              />
              {validationErrors.referenceScript?.length > 0 && (
                <Text size={200} style={{ color: tokens.colorPaletteRedForeground2, marginTop: 4 }}>
                  {validationErrors.referenceScript[0]}
                </Text>
              )}

              {/* 글자 수/상태 바: 상단 경계선 약화 */}
              <div style={styles.statusBar}>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  {safeForm.referenceScript.trim()
                    ? `📊 ${safeForm.referenceScript.trim().length.toLocaleString()}자 입력됨`
                    : safeForm.topic.trim()
                    ? "📝 레퍼런스 대본을 입력하면 해당 스타일로 새로운 주제의 대본을 생성합니다"
                    : "📝 레퍼런스만 입력하면 개선본 생성, 주제도 함께 입력하면 새로운 주제로 스타일 적용"}
                </Text>

                {safeForm.referenceScript.trim() && (
                  <Text
                    size={200}
                    style={{
                      color: safeForm.referenceScript.trim().length > 500 ? tokens.colorPaletteGreenForeground2 : tokens.colorNeutralForeground3,
                      fontWeight: safeForm.referenceScript.trim().length > 500 ? 600 : 400,
                    }}
                  >
                    {safeForm.referenceScript.trim().length > 500
                      ? safeForm.topic.trim()
                        ? "✅ 스타일 가이드 준비완료"
                        : "✅ 개선 준비완료"
                      : "권장: 500자 이상"}
                  </Text>
                )}
              </div>
            </Field>
          )}
        </div>
      </div>

      {/* 생성 버튼 영역 */}
      <div style={{ marginTop: tokens.spacingVerticalM, paddingTop: tokens.spacingVerticalS, borderTop: `1px solid ${tokens.colorNeutralStroke2}` }}>
        <Button
          appearance={isCancelling ? "secondary" : isGenerating && fullVideoState.currentStep !== "completed" ? "secondary" : "primary"}
          icon={isCancelling ? <Spinner size="tiny" /> : isGenerating && fullVideoState.currentStep !== "completed" ? null : <PlayRegular />}
          onClick={() => {
            // 생성 중이면 중지, 아니면 생성 시작
            if (isGenerating && fullVideoState.currentStep !== "completed") {
              cancelGeneration({
                setFullVideoState,
                setIsLoading,
                setDoc,
              });
            } else {
              // 생성 시작
              handleStartGeneration();
            }
          }}
          disabled={isCancelling || (!isGenerating && isDisabled)}
          style={{
            width: "100%",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          {isCancelling ? (
            "⏳ 취소 중..."
          ) : isGenerating && fullVideoState.currentStep !== "completed" ? (
            "⏹ 생성 중지"
          ) : (
            <span>
              {fullVideoState.currentStep === "completed"
                ? "🔄 새 대본 생성"
                : selectedMode === "shorts_mode"
                ? "⚡ 쇼츠 생성 시작"
                : "📝 대본 생성 시작"}
            </span>
          )}
        </Button>

        {/* 생성 중 진행 상황 텍스트 */}
        {isGenerating && fullVideoState.currentStep !== "completed" && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, textAlign: "center", marginTop: tokens.spacingVerticalS, display: "block" }}>
            {chunkProgress
              ? `청크 ${chunkProgress.current}/${chunkProgress.total} 생성 중... (${chunkProgress.progress}%)`
              : fullVideoState.currentStep
              ? `🎬 ${
                  {
                    script: "대본 생성",
                    audio: "음성 합성",
                    subtitle: "자막 생성",
                    idle: "대기",
                  }[fullVideoState.currentStep] || fullVideoState.currentStep
                } 진행 중...`
              : "생성 중..."}
          </Text>
        )}

        {/* 에러/완료 메시지 */}
        {fullVideoState.error ? (
          <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: tokens.spacingVerticalS, display: "block" }}>
            ❌ 오류: {fullVideoState.error}
          </Text>
        ) : fullVideoState.currentStep === "completed" ? (
          <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1, marginTop: tokens.spacingVerticalS, display: "block" }}>
            ✅ 대본 생성이 완료되었습니다!
          </Text>
        ) : isDisabled && validationState.errors.length > 0 ? (
          <Text size={200} style={{ marginTop: tokens.spacingVerticalS, display: "block" }}>
            <span style={{ color: tokens.colorPaletteRedForeground1, fontWeight: 600 }}>💡 필수 입력:</span>
            <span style={{ color: tokens.colorNeutralForeground3 }}> {validationState.errors.join(", ")}</span>
          </Text>
        ) : null}
      </div>
    </Card>
  );
});

// 컴포넌트 이름 설정 (개발자 도구에서 디버깅 편의)
BasicSettingsCard.displayName = "BasicSettingsCard";

export default BasicSettingsCard;
