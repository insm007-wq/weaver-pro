// src/components/tabs/RefTab.jsx
import { useMemo } from "react";
import { Card, FormGrid, TextField, SelectField } from "../parts/SmallUI";
import { DUR_OPTIONS, MAX_SCENE_OPTIONS, LLM_OPTIONS } from "../constants";
import TtsPanel from "../parts/TtsPanel";

export default function RefTab({
  form,
  onChange,
  voices,
  refText,
  setRefText,
  disabled = false,
}) {
  const refCounts = useMemo(() => {
    const t = refText || "";
    return { chars: t.length, lines: t ? t.split(/\r?\n/).length : 0 };
  }, [refText]);

  return (
    <Card>
      <FormGrid>
        <TextField
          label="주제"
          value={form.topic}
          onChange={(v) => onChange("topic", v)}
          placeholder="예) 세종시 주거 정보 가이드"
          disabled={disabled}
        />
        <TextField
          label="스타일"
          value={form.style}
          onChange={(v) => onChange("style", v)}
          placeholder="예) 다큐멘터리, 차분한 톤"
          disabled={disabled}
        />
        <SelectField
          label="길이(분)"
          value={form.durationMin}
          options={DUR_OPTIONS.map((v) => ({ label: `${v}`, value: v }))}
          onChange={(v) => onChange("durationMin", Number(v))}
          disabled={disabled}
        />
        <SelectField
          label="최대 장면 수"
          value={form.maxScenes}
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

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-slate-600">
            레퍼런스 대본
          </label>
          <span className="text-[11px] text-slate-500">
            {refCounts.lines}줄 · {refCounts.chars}자
          </span>
        </div>
        <textarea
          className={`w-full h-40 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-200 ${
            disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white'
          }`}
          placeholder="레퍼런스 대본을 붙여넣으면, 스타일·구조를 분석해 새로운 대본을 생성합니다."
          value={refText}
          onChange={(e) => setRefText(e.target.value)}
          disabled={disabled}
        />
      </div>

      <TtsPanel form={form} onChange={onChange} voices={voices} disabled={disabled} />
    </Card>
  );
}
