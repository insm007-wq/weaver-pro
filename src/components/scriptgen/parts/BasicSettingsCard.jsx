import React, { useMemo, useState } from "react";
import { Card, Text, Field, Input, Dropdown, Option, Spinner, Switch, Textarea, tokens } from "@fluentui/react-components";
import { SettingsRegular } from "@fluentui/react-icons";
import { STYLE_OPTIONS, DURATION_OPTIONS } from "../../../constants/scriptSettings";
import { validateAndSanitizeText } from "../../../utils/sanitizer";

/** 영상 길이별 최적 장면 수 자동 계산 (원본 유지) */
const getRecommendedScenes = (durationMin) => {
  if (!durationMin) return 8;
  if (durationMin <= 3) return 8;
  if (durationMin <= 5) return 10;
  if (durationMin <= 8) return 12;
  if (durationMin <= 10) return 15;
  if (durationMin <= 15) return 20;
  if (durationMin <= 20) return 25;
  if (durationMin <= 30) return 35;
  if (durationMin <= 45) return 50;
  return 60;
};

/** 장면 수 옵션 동적 생성 (원본 유지) */
const getDynamicSceneOptions = (durationMin) => {
  const recommended = getRecommendedScenes(durationMin);
  const min = Math.max(4, Math.floor(recommended * 0.6));
  const max = Math.min(100, Math.ceil(recommended * 1.4));

  const options = [];
  const step = Math.max(1, Math.floor((max - min) / 10));

  for (let i = min; i <= max; i += step) {
    const isRecommended = i === recommended;
    const label = isRecommended ? `${i}개 (권장)` : i < recommended ? `${i}개 (간결)` : `${i}개 (상세)`;
    options.push({ key: i, text: label, isRecommended });
  }

  if (!options.some((opt) => opt.key === recommended)) {
    options.push({ key: recommended, text: `${recommended}개 (권장)`, isRecommended: true });
    options.sort((a, b) => a.key - b.key);
  }

  return options;
};

/**
 * 기본 설정 카드 (UI만 개선)
 */
function BasicSettingsCard({ form, onChange, promptNames, promptLoading }) {
  const [validationErrors, setValidationErrors] = useState({});

  const sceneOptions = useMemo(() =>
    getDynamicSceneOptions(form.durationMin),
    [form.durationMin]
  );

  // 안전한 입력 처리 함수
  const handleSafeChange = (field, value, options = {}) => {
    const result = validateAndSanitizeText(value, {
      maxLength: field === 'topic' ? 200 : field === 'referenceScript' ? 100000 : 100,
      allowEmpty: true,
      fieldName: field,
      ...options
    });

    // 검증 오류 상태 업데이트
    setValidationErrors(prev => ({
      ...prev,
      [field]: result.errors
    }));

    // 정제된 값으로 onChange 호출
    onChange(field, result.sanitized);

    if (!result.isValid) {
      console.warn(`입력 검증 실패 [${field}]:`, result.errors);
    }
  };

  return (
    <Card
      style={{
        padding: "12px 16px",
        borderRadius: "16px",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        height: "fit-content",
        display: "flex",
        flexDirection: "column"
      }}
    >
      
      <div
        style={{
          marginBottom: tokens.spacingVerticalS,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <SettingsRegular />
          <Text
            size={400}
            weight="semibold"
            style={{ letterSpacing: 0.2 }}
          >
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          alignItems: "start",
        }}
      >
        {/* 영상 주제: 전체 너비 */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Field
            label={
              <Text size={300} weight="semibold">
                영상 주제
              </Text>
            }
          >
            <Input
              value={form.topic || ""}
              onChange={(e) => handleSafeChange("topic", e.target.value)}
              placeholder={
                form.showReferenceScript
                  ? "주제를 입력하면 레퍼런스 스타일로 새 대본 생성 / 비워두면 레퍼런스 자체를 개선"
                  : "예: 인공지능의 미래와 우리 삶의 변화"
              }
              size="medium"
              style={{ height: 36 }}
              aria-invalid={validationErrors.topic?.length > 0}
            />
            {validationErrors.topic?.length > 0 && (
              <Text size={200} style={{ color: tokens.colorPaletteRedForeground2, marginTop: 4 }}>
                {validationErrors.topic[0]}
              </Text>
            )}
          </Field>
        </div>

        {/* 스타일 선택 */}
        <Field
          label={
            <Text size={300} weight="semibold">
              스타일
            </Text>
          }
        >
          <Dropdown
            value={STYLE_OPTIONS.find((s) => s.key === form.style)?.text || "스타일 선택"}
            selectedOptions={[form.style]}
            onOptionSelect={(_, d) => onChange("style", d.optionValue)}
            size="medium" // 🔧 large → medium
            style={{ minHeight: 36 }} // 🔧 시각 높이 맞춤
          >
            {STYLE_OPTIONS.map((style) => (
              <Option key={style.key} value={style.key}>
                {style.text}
              </Option>
            ))}
          </Dropdown>
        </Field>

        {/* 예상 길이 */}
        <Field
          label={
            <Text size={300} weight="semibold">
              예상 길이
            </Text>
          }
        >
          <Dropdown
            value={DURATION_OPTIONS.find((d) => d.key === form.durationMin)?.text || "길이 선택"}
            selectedOptions={[form.durationMin?.toString()]}
            onOptionSelect={(_, d) => onChange("durationMin", parseInt(d.optionValue))}
            size="medium" // 🔧 large → medium
            style={{ minHeight: 36 }}
          >
            {DURATION_OPTIONS.map((duration) => (
              <Option key={duration.key} value={duration.key.toString()}>
                {duration.text}
              </Option>
            ))}
          </Dropdown>
        </Field>

        {/* 최대 장면 수 (자동 계산) */}
        <Field label={
            <Text size={300} weight="semibold">
              최대 장면 수
            </Text>
          }
        >
          <Dropdown
            value={sceneOptions.find((s) => s.key === form.maxScenes)?.text || "장면 수 선택"}
            selectedOptions={[form.maxScenes?.toString()]}
            onOptionSelect={(_, d) => onChange("maxScenes", parseInt(d.optionValue))}
            size="medium" // 🔧 large → medium
            disabled={!form.durationMin}
            placeholder={form.durationMin ? "장면 수 선택" : "먼저 영상 길이를 선택하세요"}
            style={{ minHeight: 36 }}
          >
            {sceneOptions.map((scene) => (
              <Option
                key={scene.key}
                value={scene.key.toString()}
                style={{
                  // 권장 옵션은 은은한 배경/서브톤
                  color: scene.isRecommended ? tokens.colorPaletteGreenForeground2 : "inherit",
                  fontWeight: scene.isRecommended ? 600 : 400,
                  background: scene.isRecommended ? tokens.colorPaletteGreenBackground1 : "transparent",
                }}
              >
                {scene.text}
              </Option>
            ))}
          </Dropdown>

          {/* 권장 안내 캡션: 높이 고정해 레이아웃 안정 */}
          <div style={{ minHeight: 22, marginTop: 4 }}>
            {form.durationMin && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3, display: "block" }}>
                권장: {getRecommendedScenes(form.durationMin)}개
              </Text>
            )}
          </div>
        </Field>

        {/* 프롬프트 선택 */}
        <Field
          label={
            <Text size={300} weight="semibold">
              대본 생성 프롬프트
            </Text>
          }
        >
          <Dropdown
            value={form.promptName || (promptLoading ? "불러오는 중..." : "프롬프트 선택")}
            selectedOptions={form.promptName ? [form.promptName] : []}
            onOptionSelect={(_, d) => onChange("promptName", d.optionValue)}
            size="medium" // 🔧 large → medium
            disabled={!!promptLoading || promptNames.length === 0}
            style={{ minHeight: 36 }}
          >
            {promptNames.map((name) => (
              <Option key={name} value={name}>
                {name}
              </Option>
            ))}
          </Dropdown>

          {/* 상태 캡션: 높이 고정 */}
          <div style={{ minHeight: 22, marginTop: 4 }}>
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
        <div style={{ gridColumn: "1 / -1", marginTop: tokens.spacingVerticalM }}>
          <Field
            label={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Switch
                  checked={form.showReferenceScript || false}
                  onChange={(_, data) => onChange("showReferenceScript", data.checked)}
                  label={
                    <Text size={300} weight="semibold">
                      레퍼런스 대본 (선택사항)
                    </Text>
                  }
                />
              </div>
            }
          >
            {form.showReferenceScript && (
              <>
                <Text
                  size={200}
                  style={{
                    color: tokens.colorNeutralForeground3,
                    marginBottom: tokens.spacingVerticalXS,
                    display: "block",
                  }}
                >
                  {form.topic && form.topic.trim()
                    ? "🎭 레퍼런스의 톤앤매너를 분석해 새로운 주제에 적용한 대본을 생성합니다."
                    : "📈 레퍼런스를 분석해 구조/스타일을 개선한 버전을 생성합니다."}
                </Text>

                <Textarea
                  value={form.referenceScript || ""}
                  onChange={(e) => handleSafeChange("referenceScript", e.target.value)}
                  placeholder="예시: '안녕하세요! 오늘은 맛있는 요리를 만들어볼게요. 먼저 재료를 준비해주세요...'"
                  rows={6}
                  resize="vertical"
                  style={{
                    minHeight: 120,
                    borderColor: validationErrors.referenceScript?.length > 0
                      ? tokens.colorPaletteRedBorder2
                      : tokens.colorNeutralStroke2,
                    borderRadius: 12,
                  }}
                  aria-invalid={validationErrors.referenceScript?.length > 0}
                />
                {validationErrors.referenceScript?.length > 0 && (
                  <Text size={200} style={{ color: tokens.colorPaletteRedForeground2, marginTop: 4 }}>
                    {validationErrors.referenceScript[0]}
                  </Text>
                )}

                {/* 글자 수/상태 바: 상단 경계선 약화 */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: tokens.spacingVerticalXS,
                    paddingTop: 8,
                    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
                  }}
                >
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    {form.referenceScript && form.referenceScript.trim()
                      ? `📊 ${form.referenceScript.trim().length.toLocaleString()}자 입력됨`
                      : form.topic && form.topic.trim()
                      ? "📝 레퍼런스 대본을 입력하면 해당 스타일로 새로운 주제의 대본을 생성합니다"
                      : "📝 레퍼런스만 입력하면 개선본 생성, 주제도 함께 입력하면 새로운 주제로 스타일 적용"}
                  </Text>

                  {form.referenceScript && form.referenceScript.trim() && (
                    <Text
                      size={200}
                      style={{
                        color:
                          form.referenceScript.trim().length > 500 ? tokens.colorPaletteGreenForeground2 : tokens.colorNeutralForeground3,
                        fontWeight: form.referenceScript.trim().length > 500 ? 600 : 400,
                      }}
                    >
                      {form.referenceScript.trim().length > 500
                        ? form.topic && form.topic.trim()
                          ? "✅ 스타일 가이드 준비완료"
                          : "✅ 개선 준비완료"
                        : "권장: 500자 이상"}
                    </Text>
                  )}
                </div>
              </>
            )}
          </Field>
        </div>
      </div>
    </Card>
  );
}

export default BasicSettingsCard;
