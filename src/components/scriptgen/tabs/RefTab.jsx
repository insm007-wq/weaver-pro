// src/components/tabs/RefTab.jsx
import React, { useMemo } from "react";
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Divider,
  Field,
  Input,
  Dropdown,
  Option,
  Textarea,
  Badge,
  Card,
} from "@fluentui/react-components";
import { DUR_OPTIONS, MAX_SCENE_OPTIONS, LLM_OPTIONS } from "../constants";
import TtsPanel from "../parts/TtsPanel";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.margin('0', '0', tokens.spacingVerticalM, '0'),
  },
  description: {
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalL,
  },
  refSection: {
    ...shorthands.margin(tokens.spacingVerticalL, '0'),
  },
  refHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    ...shorthands.margin('0', '0', tokens.spacingVerticalS, '0'),
  },
  refStats: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },
  textarea: {
    minHeight: "160px",
    fontFamily: tokens.fontFamilyBase,
  },
});

export default function RefTab({
  form,
  onChange,
  voices,
  refText,
  setRefText,
  disabled = false,
}) {
  const styles = useStyles();
  
  const refCounts = useMemo(() => {
    const t = refText || "";
    return { chars: t.length, lines: t ? t.split(/\r?\n/).length : 0 };
  }, [refText]);

  return (
    <Card>
      <div className={styles.container}>
        {/* 기본 설정 섹션 */}
        <div>
          <Text className={styles.sectionTitle} weight="semibold" size={500}>
            ⚙️ 기본 설정
          </Text>
          <Text className={styles.description} size={300}>
            레퍼런스 대본을 기반으로 스타일과 구조를 분석하여 새로운 대본을 생성합니다
          </Text>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: tokens.spacingVerticalL,
            marginTop: tokens.spacingVerticalL,
          }}>
            <Field label="주제">
              <Input
                value={form.topic || ""}
                onChange={(_, data) => onChange("topic", data.value)}
                placeholder="예) 세종시 주거 정보 가이드"
                disabled={disabled}
              />
            </Field>
            <Field label="스타일">
              <Input
                value={form.style || ""}
                onChange={(_, data) => onChange("style", data.value)}
                placeholder="예) 다큐멘터리, 차분한 톤"
                disabled={disabled}
              />
            </Field>
            <Field label="길이(분)">
              <Dropdown
                value={`${form.durationMin}분`}
                onOptionSelect={(_, data) => onChange("durationMin", Number(data.optionValue))}
                disabled={disabled}
              >
                {DUR_OPTIONS.map((v) => (
                  <Option key={v} value={v}>
                    {v}분
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="최대 장면 수">
              <Dropdown
                value={`${form.maxScenes}개`}
                onOptionSelect={(_, data) => onChange("maxScenes", Number(data.optionValue))}
                disabled={disabled}
              >
                {MAX_SCENE_OPTIONS.map((v) => (
                  <Option key={v} value={v}>
                    {v}개
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <Field label="LLM 모델">
              <Dropdown
                value={LLM_OPTIONS.find(opt => opt.value === form.llmMain)?.label || ""}
                onOptionSelect={(_, data) => onChange("llmMain", data.optionValue)}
                disabled={disabled}
              >
                {LLM_OPTIONS.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>
        </div>

        <Divider />

        {/* 레퍼런스 대본 섹션 */}
        <div className={styles.refSection}>
          <div className={styles.refHeader}>
            <Text weight="semibold" size={500}>
              📝 레퍼런스 대본
            </Text>
            <div className={styles.refStats}>
              <Badge appearance="tint" size="small">
                {refCounts.lines}줄
              </Badge>
              <Badge appearance="tint" size="small">
                {refCounts.chars}자
              </Badge>
            </div>
          </div>
          <Text className={styles.description} size={300}>
            참고할 대본을 입력하면 스타일과 구조를 분석하여 새로운 대본을 생성합니다
          </Text>
          <Field>
            <Textarea
              className={styles.textarea}
              placeholder="레퍼런스 대본을 붙여넣으세요. AI가 스타일, 구조, 톤을 분석하여 유사한 형태의 새로운 대본을 생성합니다."
              value={refText || ""}
              onChange={(_, data) => setRefText(data.value)}
              disabled={disabled}
              resize="vertical"
            />
          </Field>
        </div>

        <Divider />

        {/* TTS 설정 섹션 */}
        <TtsPanel form={form} onChange={onChange} voices={voices} disabled={disabled} />
      </div>
    </Card>
  );
}