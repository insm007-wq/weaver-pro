// src/components/scriptgen/tabs/AutoTab.jsx
import { useMemo, useState } from "react";
import { Card, FormGrid, TextField, SelectField } from "../parts/SmallUI";
import { DUR_OPTIONS, MAX_SCENE_OPTIONS, LLM_OPTIONS } from "../constants";
import TtsPanel from "../parts/TtsPanel";

/** 간단 유틸: 안전한 숫자 변환 */
function toInt(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** LLM에 넘길 사용자 프롬프트 구성 */
function buildAutoPrompt({ topic, style, durationMin, maxScenes }) {
  return [
    // 역할 고정
    "당신은 한국어로 또박또박 구성하는 '전문 대본 작가'입니다.",
    // 출력 형식 강제
    "반드시 아래 JSON만 출력하세요. 설명/마크다운/코드펜스 금지.",
    '최상위 형태: {"title":"...","scenes":[{"text":"...","duration":숫자}, ...]}',
    // 사용자 지정 파라미터
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"} `,
    `목표 길이(분): ${durationMin}`,
    `최대 장면 수(상한): ${maxScenes}`,
    // 추가 가이드(장면 길이 균형, 문체 등)
    "각 장면은 자연스러운 구어체로 2~4문장 분량, 장면간 중복을 피하고 연결감을 주세요.",
  ].join("\n");
}

/** Auto 탭: 이 컴포넌트 안에서 '실행'까지 처리 */
export default function AutoTab({ form, onChange, voices }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 폼값 정규화(메모)
  const norm = useMemo(
    () => ({
      topic: form.topic?.trim() || "",
      style: form.style?.trim() || "",
      durationMin: toInt(form.durationMin, 5),
      maxScenes: toInt(form.maxScenes, 10),
      llm: form.llmMain || "openai-gpt5mini",
    }),
    [form.topic, form.style, form.durationMin, form.maxScenes, form.llmMain]
  );

  /** 실행 버튼 핸들러
   * - 이 탭 내부에서 IPC 호출까지 수행
   * - 성공: window 이벤트로 부모/다른 영역에 결과 알림 (script:generated)
   * - 실패: 에러 토스트/메시지 + window 이벤트(script:error)
   */
  const handleRun = async () => {
    setErr("");
    setBusy(true);

    try {
      const payload = {
        llm: norm.llm, // "openai-gpt5mini" | "anthropic" | "minimax"
        type: "auto",
        topic: norm.topic,
        style: norm.style,
        duration: norm.durationMin,
        maxScenes: norm.maxScenes,
        // LLM 공통 프롬프트(백엔드에서 사용)
        compiledPrompt: buildAutoPrompt(norm),
      };

      // 백엔드 IPC 호출 (electron/ipc/llm/index.js 에서 라우팅)
      const out = await window.api.invoke("llm/generateScript", payload);

      // 성공 이벤트 브로드캐스트(부모가 듣고 미리보기/표 채우도록)
      window.dispatchEvent(
        new CustomEvent("script:generated", { detail: { source: "auto", out } })
      );
    } catch (e) {
      const msg = e?.message || "대본 생성 중 오류가 발생했습니다.";
      setErr(msg);
      // 실패 이벤트 브로드캐스트
      window.dispatchEvent(
        new CustomEvent("script:error", {
          detail: { source: "auto", error: msg },
        })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <FormGrid>
        <TextField
          label="주제"
          value={form.topic}
          onChange={(v) => onChange("topic", v)}
          placeholder="예) 2025 AI 트렌드 요약"
        />
        <TextField
          label="스타일"
          value={form.style}
          onChange={(v) => onChange("style", v)}
          placeholder="예) 전문가, 쉽고 차분하게"
        />

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

        <SelectField
          label="LLM (대본)"
          value={form.llmMain}
          options={LLM_OPTIONS}
          onChange={(v) => onChange("llmMain", v)}
        />
      </FormGrid>

      <TtsPanel form={form} onChange={onChange} voices={voices} />

      {/* 실행/에러 영역 */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? "생성 중..." : "실행"}
        </button>

        {!!err && (
          <span className="text-sm text-red-600 truncate" title={err}>
            {err}
          </span>
        )}
      </div>
    </Card>
  );
}
