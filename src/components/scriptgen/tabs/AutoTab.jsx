import { Card, FormGrid, TextField, SelectField } from "../parts/SmallUI";
import { DUR_OPTIONS, MAX_SCENE_OPTIONS, LLM_OPTIONS } from "../constants";
import TtsPanel from "../parts/TtsPanel";

export default function AutoTab({ form, onChange, voices }) {
  return (
    <Card>
      <FormGrid>
        <TextField label="주제" value={form.topic} onChange={(v) => onChange("topic", v)} placeholder="예) 2025 AI 트렌드 요약" />
        <TextField label="스타일" value={form.style} onChange={(v) => onChange("style", v)} placeholder="예) 전문가, 쉽고 차분하게" />
        <SelectField
          label="길이(분)"
          value={form.durationMin}
          options={DUR_OPTIONS.map((v) => ({ label: `${v}`, value: v }))}
          onChange={(v) => onChange("durationMin", Number(v))}
        />
        <SelectField
          label="최대 장면 수"
          value={form.maxScenes}
          options={MAX_SCENE_OPTIONS.map((v) => ({ label: `${v}`, value: v }))}
          onChange={(v) => onChange("maxScenes", Number(v))}
        />
        <SelectField label="LLM (대본)" value={form.llmMain} options={LLM_OPTIONS} onChange={(v) => onChange("llmMain", v)} />
      </FormGrid>
      <TtsPanel form={form} onChange={onChange} voices={voices} />
    </Card>
  );
}
