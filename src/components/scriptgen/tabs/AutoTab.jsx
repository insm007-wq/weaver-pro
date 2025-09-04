// src/components/scriptgen/tabs/AutoTab.jsx
import { useMemo } from "react";
import { Card, FormGrid, TextField, SelectField } from "../parts/SmallUI";
import { DUR_OPTIONS, MAX_SCENE_OPTIONS, LLM_OPTIONS } from "../constants";
import TtsPanel from "../parts/TtsPanel";

/** 간단 유틸: 안전한 숫자 변환 (폼 보정에 사용) */
function toInt(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

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
    <Card>
      <FormGrid>
        <TextField
          label="주제"
          value={form.topic}
          onChange={(v) => onChange("topic", v)}
          placeholder="예) 2025 AI 트렌드 요약"
          disabled={disabled}
        />
        <TextField
          label="스타일"
          value={form.style}
          onChange={(v) => onChange("style", v)}
          placeholder="예) 전문가, 쉽고 차분하게"
          disabled={disabled}
        />

        <SelectField
          label="길이(분)"
          value={norm.durationMin}
          options={DUR_OPTIONS.map((v) => ({ label: `${v}`, value: v }))}
          onChange={(v) => onChange("durationMin", Number(v))}
          disabled={disabled}
        />

        <SelectField
          label="최대 장면 수"
          value={norm.maxScenes}
          options={MAX_SCENE_OPTIONS.map((v) => ({ label: `${v}`, value: v }))}
          onChange={(v) => onChange("maxScenes", Number(v))}
          disabled={disabled}
        />

        <SelectField
          label="LLM (대본)"
          value={form.llmMain}
          options={LLM_OPTIONS}
          onChange={(v) => onChange("llmMain", v)}
          disabled={disabled}
        />
      </FormGrid>

      <TtsPanel form={form} onChange={onChange} voices={voices} disabled={disabled} />
    </Card>
  );
}
