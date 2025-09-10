// src/components/scriptgen/tabs/AutoTab.jsx
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
} from "@fluentui/react-components";
import { StandardCard } from "../../common";
import { DUR_OPTIONS, MAX_SCENE_OPTIONS, LLM_OPTIONS } from "../constants";
import TtsPanel from "../parts/TtsPanel";

/** 간단 유틸: 안전한 숫자 변환 (폼 보정에 사용) */
function toInt(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

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
});

/**
 * Auto 탭: 폼 편집 전용
 * - 실행 버튼/IPC 호출 제거 (상단 공용 실행 버튼 사용)
 * - 부모에서 runGenerate("auto") 를 호출해 실행
 */
export default function AutoTab({
  form,
  onChange,
  voices,
  disabled = false /* 로딩 상태에서 비활성화 */,
}) {
  const styles = useStyles();

  // 표시용 정규화 (옵션 값 보정)
  const norm = useMemo(
    () => ({
      topic: String(form.topic ?? ""),
      style: String(form.style ?? ""),
      durationMin: toInt(form.durationMin, 5),
      maxScenes: toInt(form.maxScenes, 10),
      llm: form.llmMain || "openai-gpt5mini",
    }),
    [form.topic, form.style, form.durationMin, form.maxScenes, form.llmMain]
  );

  return (
    <StandardCard>
      <div className={styles.container}>
        {/* 기본 설정 섹션 */}
        <div>
          <Text className={styles.sectionTitle} weight="semibold" size={500}>
            ⚙️ 기본 설정
          </Text>
          <Text className={styles.description} size={300}>
            주제와 스타일을 입력하면 AI가 자동으로 대본을 생성합니다
          </Text>
          <div className={styles.formGrid}>
            <Field label="주제">
              <Input
                value={form.topic || ""}
                onChange={(_, data) => onChange("topic", data.value)}
                placeholder="예) 2025 AI 트렌드 요약"
                disabled={disabled}
              />
            </Field>
            <Field label="스타일">
              <Input
                value={form.style || ""}
                onChange={(_, data) => onChange("style", data.value)}
                placeholder="예) 전문가, 쉽고 차분하게"
                disabled={disabled}
              />
            </Field>
            <Field label="길이(분)">
              <Dropdown
                value={`${norm.durationMin}분`}
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
                value={`${norm.maxScenes}개`}
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

        {/* TTS 설정 섹션 */}
        <TtsPanel form={form} onChange={onChange} voices={voices} disabled={disabled} />
      </div>
    </StandardCard>
  );
}