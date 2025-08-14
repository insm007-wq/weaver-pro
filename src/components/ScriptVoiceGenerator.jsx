// src/components/ScriptVoiceGenerator.jsx
import { useMemo, useRef, useState, useLayoutEffect, useEffect } from "react";

const DUR_OPTIONS = [1, 3, 5, 7, 10, 15];
const MAX_SCENE_OPTIONS = [6, 8, 10, 12, 15, 20];

// ✅ LLM 옵션: OpenAI GPT-5 mini 기본값
const LLM_OPTIONS = [
  { label: "Anthropic Claude 3.5/3.7", value: "anthropic" },
  { label: "Minimax abab", value: "minimax" },
  { label: "OpenAI GPT-5 mini", value: "openai-gpt5mini" },
];

const TTS_ENGINES = [
  { label: "Google Cloud TTS", value: "google" },
  { label: "Azure Speech", value: "azure" },
  { label: "Amazon Polly", value: "polly" },
  { label: "OpenAI TTS", value: "openai" },
];

const VOICES_BY_ENGINE = {
  google: [
    "ko-KR-Wavenet-A",
    "ko-KR-Wavenet-B",
    "ko-KR-Standard-A",
    "ko-KR-Standard-B",
  ],
  azure: ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"],
  polly: ["Seoyeon"],
  openai: ["alloy", "nova", "verse"],
};

/** 프롬프트 기본값(고객사 요구안 반영) */
const DEFAULT_GENERATE_PROMPT = `다음 조건에 맞는 {duration}분 길이의 영상 대본을 작성해주세요:

주제: {topic}
스타일: {style}
언어: 한국어
최대 장면 수: {maxScenes}개

요구사항:
- 장면 수는 가능한 한 최대 장면 수에 가깝게 분할
- 자연스러운 구어체
- JSON 외 텍스트 금지`;

const DEFAULT_REFERENCE_PROMPT = `## 레퍼런스 대본 분석 및 적용

다음 레퍼런스 대본을 분석하고 그 장점을 활용해주세요:

=== 레퍼런스 대본 ===
{referenceScript}
=== 레퍼런스 대본 끝 ===

요구사항:
- 레퍼런스의 구조/톤/템포를 참고하되, 표절 없이 새로 작성
- 한국어 구어체
- JSON 외 텍스트 금지`;

export default function ScriptVoiceGenerator() {
  // 🔹 탭 추가: prompt
  const [activeTab, setActiveTab] = useState("auto"); // auto|ref|import|prompt
  const [form, setForm] = useState({
    topic: "",
    style: "",
    durationMin: 5,
    maxScenes: 10,
    llmMain: "openai-gpt5mini",
    ttsEngine: "google",
    voiceName: "ko-KR-Wavenet-A",
    speakingRate: 1.0,
    pitch: 0,
  });

  const [refText, setRefText] = useState("");
  const importSrtRef = useRef(null);
  const importMp3Ref = useRef(null);

  // ✅ 커스텀 프롬프트 상태 + 로드/저장
  const [genPrompt, setGenPrompt] = useState(DEFAULT_GENERATE_PROMPT);
  const [refPrompt, setRefPrompt] = useState(DEFAULT_REFERENCE_PROMPT);
  const [promptSavedAt, setPromptSavedAt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [gp, rp] = await Promise.all([
          window.api.getSetting("prompt.generateTemplate"),
          window.api.getSetting("prompt.referenceTemplate"),
        ]);
        if (gp) setGenPrompt(gp);
        if (rp) setRefPrompt(rp);
      } catch (e) {
        // 무시(최초 실행 시 settings 없을 수 있음)
      }
    })();
  }, []);

  const savePrompts = async () => {
    await Promise.all([
      window.api.setSetting({
        key: "prompt.generateTemplate",
        value: genPrompt,
      }),
      window.api.setSetting({
        key: "prompt.referenceTemplate",
        value: refPrompt,
      }),
    ]);
    setPromptSavedAt(new Date());
  };
  const resetPrompts = () => {
    setGenPrompt(DEFAULT_GENERATE_PROMPT);
    setRefPrompt(DEFAULT_REFERENCE_PROMPT);
  };

  const [status, setStatus] = useState("idle"); // idle|running|done|error
  const [phase, setPhase] = useState(""); // SCRIPT|SRT|TTS|MERGE|완료
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");

  // ⏱️ SCRIPT 단계 경과초
  const [elapsedSec, setElapsedSec] = useState(0);
  const scriptTimerRef = useRef(null);

  // ✅ 폭 고정
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);
  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  const voices = useMemo(
    () => VOICES_BY_ENGINE[form.ttsEngine] || [],
    [form.ttsEngine]
  );
  const onChange = (key, v) => setForm((s) => ({ ...s, [key]: v }));

  const call = async (channel, payload) => {
    try {
      return await window?.api?.invoke(channel, payload);
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  // ▶️ SCRIPT 인디케이터
  const startScriptIndicator = () => {
    setElapsedSec(0);
    if (scriptTimerRef.current) clearInterval(scriptTimerRef.current);
    scriptTimerRef.current = setInterval(
      () => setElapsedSec((s) => s + 1),
      1000
    );
  };
  const stopScriptIndicator = () => {
    if (scriptTimerRef.current) {
      clearInterval(scriptTimerRef.current);
      scriptTimerRef.current = null;
    }
  };
  useEffect(() => () => stopScriptIndicator(), []);

  const runGenerate = async (mode) => {
    setStatus("running");
    setError("");
    setPhase("SCRIPT");
    setProgress({ current: 0, total: 0 });
    startScriptIndicator();

    try {
      // 프롬프트 오버라이드 전달(백엔드가 지원하면 사용, 아니면 무시)
      const payloadCommon = {
        topic: form.topic,
        style: form.style,
        duration: form.durationMin,
        maxScenes: form.maxScenes,
        llm: form.llmMain,
        promptTemplate: genPrompt,
        promptRefTemplate: refPrompt,
      };

      let generatedDoc = null;

      if (mode === "auto") {
        generatedDoc = await call("llm/generateScript", {
          ...payloadCommon,
          type: "auto",
        });
      } else if (mode === "ref") {
        generatedDoc = await call("llm/generateScript", {
          ...payloadCommon,
          type: "reference",
          referenceText: refText,
        });
      } else {
        generatedDoc = doc;
      }

      stopScriptIndicator();
      if (!generatedDoc || !generatedDoc.scenes?.length) {
        throw new Error("대본 생성 결과가 비어있습니다.");
      }
      setDoc(generatedDoc);

      // --- SRT 생성 & 저장 ---
      setPhase("SRT");
      const srtRes = await call("script/toSrt", { doc: generatedDoc });
      if (srtRes?.srt) {
        const srtBuf = new TextEncoder().encode(srtRes.srt).buffer;
        await call("files/saveToProject", {
          category: "subtitle",
          fileName: "subtitle.srt",
          buffer: srtBuf,
        });
      }

      // --- TTS 생성 ---
      setPhase("TTS");
      setProgress({ current: 0, total: generatedDoc.scenes.length });
      const ttsRes = await call("tts/synthesizeByScenes", {
        doc: generatedDoc,
        tts: {
          engine: form.ttsEngine,
          voiceName: form.voiceName,
          speakingRate: Number(form.speakingRate),
          pitch: Number(form.pitch),
        },
      });

      // 씬별 MP3 저장 및 병합(간단 연결)
      let merged = [];
      if (ttsRes?.parts?.length) {
        for (let i = 0; i < ttsRes.parts.length; i++) {
          const p = ttsRes.parts[i];
          const arr = base64ToArrayBuffer(p.base64);
          merged.push(new Uint8Array(arr));
          await call("files/saveToProject", {
            category: "audio/parts",
            fileName: p.fileName,
            buffer: arr,
          });
          setProgress({ current: i + 1, total: ttsRes.parts.length });
        }

        const totalLen = merged.reduce((s, u) => s + u.byteLength, 0);
        const out = new Uint8Array(totalLen);
        let off = 0;
        merged.forEach((u) => {
          out.set(u, off);
          off += u.byteLength;
        });
        await call("files/saveToProject", {
          category: "audio",
          fileName: "narration.mp3",
          buffer: out.buffer,
        });
      }

      setPhase("MERGE");
      setProgress({ current: 1, total: 1 });
      await call("audio/concatScenes", {});

      setStatus("done");
      setPhase("완료");
    } catch (e) {
      stopScriptIndicator();
      setStatus("error");
      setError(e?.message || "오류가 발생했습니다.");
    }
  };

  const handleImportSrt = async () => {
    const file = importSrtRef.current?.files?.[0];
    if (!file) return;
    const text = await file.text();
    setStatus("running");
    setPhase("IMPORT");
    setError("");
    try {
      const parsed = await call("script/importSrt", { srtText: text });
      setDoc(parsed);
      setStatus("idle");
      setPhase("대본 불러오기 완료");
    } catch (e) {
      setStatus("error");
      setError(e?.message || "SRT 파싱 실패");
    }
  };

  const handleUseUploadedMp3 = async () => {
    const file = importMp3Ref.current?.files?.[0];
    if (!file) return;
    try {
      await call("files/saveToProject", {
        category: "audio",
        fileName: "narration.mp3",
        buffer: await file.arrayBuffer(),
      });
      setPhase("업로드한 오디오 저장 완료");
    } catch (e) {
      setError("MP3 저장 실패");
    }
  };

  const canRun =
    (activeTab === "auto" && form.topic.trim().length > 0) ||
    (activeTab === "ref" && refText.trim().length > 0) ||
    (activeTab === "import" && doc);

  return (
    <div
      ref={containerRef}
      className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-md"
      style={
        fixedWidthPx
          ? {
              width: `${fixedWidthPx}px`,
              minWidth: `${fixedWidthPx}px`,
              maxWidth: `${fixedWidthPx}px`,
              flex: `0 0 ${fixedWidthPx}px`,
              boxSizing: "border-box",
              scrollbarGutter: "stable both-edges",
            }
          : { scrollbarGutter: "stable both-edges" }
      }
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">대본 &amp; 음성 생성</h1>
          <span className="text-xs text-slate-500">
            SRT 자막 + MP3 내레이션을 한 번에
          </span>
        </div>
        <div className="flex items-center gap-3">
          {status !== "idle" && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {phase}
              {phase === "SCRIPT" && ` · ${elapsedSec}s`}
              {progress.total > 0 && ` · ${progress.current}/${progress.total}`}
            </span>
          )}
          <button
            onClick={() => runGenerate(activeTab)}
            disabled={!canRun || status === "running"}
            className={`px-4 py-2 rounded-lg text-sm text-white transition
              ${
                status === "running"
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
          >
            실행
          </button>
        </div>
      </div>

      {/* 진행 바 */}
      {status !== "idle" && (
        <div className="mb-4">
          {phase === "SCRIPT" ? (
            <IndeterminateBar />
          ) : (
            <ProgressBar current={progress.current} total={progress.total} />
          )}
        </div>
      )}

      {/* 탭 바 */}
      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <TabButton
          active={activeTab === "auto"}
          onClick={() => setActiveTab("auto")}
          label="자동 생성"
        />
        <TabButton
          active={activeTab === "ref"}
          onClick={() => setActiveTab("ref")}
          label="레퍼런스 기반"
        />
        <TabButton
          active={activeTab === "import"}
          onClick={() => setActiveTab("import")}
          label="가져오기 (SRT/MP3)"
        />
        {/* 🔹 새 탭: 프롬프트 */}
        <TabButton
          active={activeTab === "prompt"}
          onClick={() => setActiveTab("prompt")}
          label="프롬프트"
        />
      </div>

      {/* 본문 */}
      <div>
        {activeTab === "auto" && (
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
                options={MAX_SCENE_OPTIONS.map((v) => ({
                  label: `${v}`,
                  value: v,
                }))}
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
          </Card>
        )}

        {activeTab === "ref" && (
          <Card>
            <FormGrid>
              <TextField
                label="주제"
                value={form.topic}
                onChange={(v) => onChange("topic", v)}
                placeholder="예) 세종시 주거 정보 가이드"
              />
              <TextField
                label="스타일"
                value={form.style}
                onChange={(v) => onChange("style", v)}
                placeholder="예) 다큐멘터리, 차분한 톤"
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
                options={MAX_SCENE_OPTIONS.map((v) => ({
                  label: `${v}`,
                  value: v,
                }))}
                onChange={(v) => onChange("maxScenes", Number(v))}
              />
              <SelectField
                label="LLM (대본)"
                value={form.llmMain}
                options={LLM_OPTIONS}
                onChange={(v) => onChange("llmMain", v)}
              />
            </FormGrid>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                레퍼런스 대본
              </label>
              <textarea
                className="w-full h-40 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="레퍼런스 대본을 붙여넣으면, 스타일·구조를 분석해 새로운 대본을 생성합니다."
                value={refText}
                onChange={(e) => setRefText(e.target.value)}
              />
            </div>

            <TtsPanel form={form} onChange={onChange} voices={voices} />
          </Card>
        )}

        {activeTab === "import" && (
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  자막 파일(SRT)
                </label>
                <div className="flex gap-2">
                  <input
                    ref={importSrtRef}
                    type="file"
                    accept=".srt"
                    className="text-sm"
                  />
                  <button
                    onClick={handleImportSrt}
                    className="px-3 py-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200"
                  >
                    불러오기
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  음성 파일(MP3) — 선택
                </label>
                <div className="flex gap-2">
                  <input
                    ref={importMp3Ref}
                    type="file"
                    accept=".mp3"
                    className="text-sm"
                  />
                  <button
                    onClick={handleUseUploadedMp3}
                    className="px-3 py-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200"
                  >
                    프로젝트에 저장
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  MP3를 업로드하지 않으면, 아래 TTS 옵션으로 자동 생성합니다.
                </p>
              </div>
            </div>
            <div className="mt-4">
              <TtsPanel form={form} onChange={onChange} voices={voices} />
            </div>
          </Card>
        )}

        {/* 🔹 새 탭: 프롬프트 편집 */}
        {activeTab === "prompt" && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">프롬프트 관리</div>
              <div className="text-xs text-slate-500">
                {promptSavedAt
                  ? `저장됨: ${promptSavedAt.toLocaleTimeString()}`
                  : ""}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  대본 생성 프롬프트
                </label>
                <textarea
                  className="w-full h-64 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={genPrompt}
                  onChange={(e) => setGenPrompt(e.target.value)}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  사용 가능한 변수:{" "}
                  {"{topic}, {style}, {duration}, {maxScenes}"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  레퍼런스 분석 프롬프트
                </label>
                <textarea
                  className="w-full h-64 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={refPrompt}
                  onChange={(e) => setRefPrompt(e.target.value)}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  사용 가능 변수: {"{referenceScript}, {topic}"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={savePrompts}
                className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-500"
              >
                저장
              </button>
              <button
                onClick={resetPrompts}
                className="px-3 py-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200"
              >
                기본값으로 초기화
              </button>
            </div>
          </Card>
        )}

        {/* 결과/리스트 */}
        <Card className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">씬 미리보기</div>
            <div className="text-xs text-slate-500">
              {doc?.scenes?.length ? `${doc.scenes.length}개 씬` : "대본 없음"}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <Th>#</Th>
                  <Th>시작–끝</Th>
                  <Th>글자수</Th>
                  <Th className="text-left">텍스트</Th>
                </tr>
              </thead>
              <tbody>
                {(doc?.scenes || []).map((sc, i) => (
                  <tr key={sc.id || i} className="border-t border-slate-100">
                    <Td className="text-center">{i + 1}</Td>
                    <Td className="text-center">
                      {secToTime(sc.start)}–{secToTime(sc.end)}
                    </Td>
                    <Td className="text-center">
                      {sc.charCount ?? sc.text?.length}
                    </Td>
                    <Td className="text-slate-700">{sc.text}</Td>
                  </tr>
                ))}
                {!doc?.scenes?.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-center py-10 text-slate-400"
                    >
                      대본을 생성하거나 SRT를 불러오면 씬 목록이 표시됩니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {error && (
            <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Small UI bits ---------- */
function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-t-lg transition ${
        active
          ? "bg-white border border-b-0 border-slate-200 text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function FormGrid({ children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Th({ children, className = "" }) {
  return (
    <th className={`px-3 py-2 text-xs font-medium ${className}`}>{children}</th>
  );
}
function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

/** 진행바(정량) */
function ProgressBar({ current, total }) {
  const pct =
    total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
      <div
        className="h-2 bg-blue-500 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** 진행바(비정량, SCRIPT용) */
function IndeterminateBar() {
  return (
    <div className="w-full h-2 rounded bg-slate-100 overflow-hidden">
      <div className="h-2 bg-blue-500 animate-pulse" style={{ width: "40%" }} />
    </div>
  );
}

function TtsPanel({ form, onChange, voices }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SelectField
        label="TTS 엔진"
        value={form.ttsEngine}
        options={TTS_ENGINES}
        onChange={(v) => {
          onChange("ttsEngine", v);
          const vs = VOICES_BY_ENGINE[v] || [];
          if (vs.length) onChange("voiceName", vs[0]);
        }}
      />
      <SelectField
        label="보이스"
        value={form.voiceName}
        options={voices.map((v) => ({ label: v, value: v }))}
        onChange={(v) => onChange("voiceName", v)}
      />
      <TextField
        label="속도(speakingRate)"
        value={form.speakingRate}
        onChange={(v) => onChange("speakingRate", v)}
        placeholder="1.0"
      />
      <TextField
        label="피치(pitch)"
        value={form.pitch}
        onChange={(v) => onChange("pitch", v)}
        placeholder="0"
      />
    </div>
  );
}

// util
function secToTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh !== "00" ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
