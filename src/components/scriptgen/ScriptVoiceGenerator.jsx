// src/ScriptVoiceGenerator.jsx
import { useMemo, useRef, useState, useLayoutEffect, useEffect } from "react";
import { Card, TabButton, Th, Td } from "./parts/SmallUI";
import { ProgressBar, IndeterminateBar } from "./parts/ProgressBar";
import AutoTab from "./tabs/AutoTab";
import RefTab from "./tabs/RefTab";
import { VOICES_BY_ENGINE, DEFAULT_GENERATE_PROMPT, DEFAULT_REFERENCE_PROMPT } from "./constants";

import ScriptPromptTab from "./tabs/ScriptPromptTab";
import ReferencePromptTab from "./tabs/ReferencePromptTab";

// ▶ 새로 분리된 유틸들
import { safeCharCount } from "../../utils/safeChars";
import { computeCharBudget } from "../../utils/charBudget";
import { compilePromptRaw, compileRefPrompt } from "../../utils/prompts";
import { extractDurationMinFromText, extractMaxScenesFromText } from "../../utils/extract";
import { secToTime } from "../../utils/time";
import { base64ToArrayBuffer } from "../../utils/buffer";
import { estimateEtaSec } from "../../utils/eta";
import { ipcCall as call } from "../../utils/ipc";

/** ========================= 기본 TTS 옵션 ========================= */
const DEFAULT_TTS_ENGINE = "google";
const DEFAULT_VOICE = (VOICES_BY_ENGINE[DEFAULT_TTS_ENGINE] || [])[0] || ""; // ko-KR-Wavenet-* 중 첫 번째

/** 폼 초기값 팩토리 (탭별 독립 상태) */
const makeDefaultForm = () => ({
  topic: "",
  style: "",
  durationMin: 5,
  maxScenes: 10,
  llmMain: "openai-gpt5mini",
  ttsEngine: DEFAULT_TTS_ENGINE,
  voiceName: DEFAULT_VOICE,
  speakingRate: 0.84,
  pitch: 0.2,
});

export default function ScriptVoiceGenerator() {
  /* ========================= 상태: 탭/폼/문서 ========================= */
  const [activeTab, setActiveTab] = useState("auto");
  const [forms, setForms] = useState({
    auto: makeDefaultForm(),
    ref: makeDefaultForm(),
    "prompt-gen": makeDefaultForm(),
    "prompt-ref": makeDefaultForm(),
  });
  const form = forms[activeTab];
  const onChangeFor = (tab) => (key, v) => setForms((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: v } }));

  // 탭에서 필요로 하는 보이스 목록
  const voices = useMemo(() => VOICES_BY_ENGINE[form.ttsEngine] || [], [form.ttsEngine]);

  // 입력/문서
  const [refText, setRefText] = useState("");
  const [promptRefText, setPromptRefText] = useState("");
  const [docs, setDocs] = useState({
    auto: null,
    ref: null,
    "prompt-gen": null,
    "prompt-ref": null,
  });
  const currentDoc = docs[activeTab] || null;

  /* ========================= 템플릿 로드/저장 ========================= */
  const [genPrompt, setGenPrompt] = useState(DEFAULT_GENERATE_PROMPT);
  const [refPrompt, setRefPrompt] = useState(DEFAULT_REFERENCE_PROMPT);
  const [promptSavedAt, setPromptSavedAt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [gp, rp] = await Promise.all([
          window.api?.getSetting?.("prompt.generateTemplate"),
          window.api?.getSetting?.("prompt.referenceTemplate"),
        ]);
        if (gp) setGenPrompt(gp);
        if (rp) setRefPrompt(rp);
      } catch {}
    })();
  }, []);

  const savePrompt = async (type) => {
    try {
      if (type === "generate") {
        await window.api?.setSetting?.({
          key: "prompt.generateTemplate",
          value: genPrompt,
        });
      } else if (type === "reference") {
        await window.api?.setSetting?.({
          key: "prompt.referenceTemplate",
          value: refPrompt,
        });
      }
      setPromptSavedAt(new Date());
    } catch {}
  };
  const resetPrompt = (type) => {
    if (type === "generate") setGenPrompt(DEFAULT_GENERATE_PROMPT);
    if (type === "reference") setRefPrompt(DEFAULT_REFERENCE_PROMPT);
  };

  /* ========================= 진행/ETA/오류 ========================= */
  const [status, setStatus] = useState("idle"); // idle|running|done|error
  const [phase, setPhase] = useState(""); // SCRIPT|TTS|SRT|MERGE|완료
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [phaseElapsedSec, setPhaseElapsedSec] = useState(0);
  const phaseTimerRef = useRef(null);
  const [plan, setPlan] = useState({ durationMin: 0, maxScenes: 0 });
  const [error, setError] = useState("");

  // (UI 너비 고정용) 첫 렌더의 실제 width를 기억
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);
  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  /** 단계 시작 시 타이머 초기화 */
  const beginPhase = (name) => {
    setPhase(name);
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    const start = Date.now();
    setPhaseElapsedSec(0);
    phaseTimerRef.current = setInterval(() => {
      setPhaseElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  };
  useEffect(() => () => phaseTimerRef.current && clearInterval(phaseTimerRef.current), []);

  /* ========================= 실행 ========================= */
  const runGenerate = async (tab) => {
    const f = forms[tab];
    const normalized = tab === "prompt-gen" ? "auto" : tab === "prompt-ref" ? "ref" : tab;

    setStatus("running");
    setError("");
    setProgress({ current: 0, total: 0 });
    beginPhase("SCRIPT");

    try {
      // 1) 입력 파라미터 정제
      let duration = Number(f.durationMin);
      let maxScenes = Number(f.maxScenes);
      const topic = String(f.topic || "");
      const style = String(f.style || "");

      if (tab === "prompt-gen") {
        const d = extractDurationMinFromText(genPrompt);
        if (Number.isFinite(d)) duration = d;
        const s = extractMaxScenesFromText(genPrompt);
        if (Number.isFinite(s)) maxScenes = s;
      }
      if (tab === "prompt-ref") {
        const d = extractDurationMinFromText(refPrompt);
        if (Number.isFinite(d)) duration = d;
        const s = extractMaxScenesFromText(refPrompt);
        if (Number.isFinite(s)) maxScenes = s;
      }

      setPlan({ durationMin: duration, maxScenes });

      const { totalSeconds, minCharacters, maxCharacters, avgCharactersPerScene, cpmMin, cpmMax } = computeCharBudget({
        tab: normalized,
        durationMin: duration,
        maxScenes,
      });

      const compiledPrompt =
        tab === "prompt-gen"
          ? compilePromptRaw(genPrompt)
          : tab === "prompt-ref"
          ? compileRefPrompt(refPrompt, {
              referenceText: promptRefText,
              duration,
              topic,
              maxScenes,
            })
          : undefined;

      const common = { llm: f.llmMain, duration, maxScenes, topic, style };
      const isPromptTab = tab === "prompt-gen" || tab === "prompt-ref";
      const base = isPromptTab
        ? {
            ...common,
            ...(compiledPrompt ? { compiledPrompt } : {}),
            customPrompt: true,
          }
        : {
            ...common,
            minCharacters,
            maxCharacters,
            avgCharactersPerScene,
            totalSeconds,
            cpmMin,
            cpmMax,
          };

      const invokePayload =
        normalized === "auto"
          ? { ...base, type: "auto" }
          : {
              ...base,
              type: "reference",
              referenceText: tab === "prompt-ref" ? promptRefText : refText,
            };

      // 2) SCRIPT 생성
      const generatedDoc = await call("llm/generateScript", invokePayload);
      if (!generatedDoc?.scenes?.length) throw new Error("대본 생성 결과가 비어있습니다.");
      setDocs((prev) => ({ ...prev, [tab]: generatedDoc }));

      // 3) TTS (씬별)
      beginPhase("TTS");
      setProgress({ current: 0, total: generatedDoc.scenes.length });
      const ttsRes = await call("tts/synthesizeByScenes", {
        doc: generatedDoc,
        tts: {
          engine: f.ttsEngine,
          voiceName: f.voiceName || DEFAULT_VOICE,
          speakingRate: Number(f.speakingRate),
          pitch: Number(f.pitch),
        },
      });

      // 조각 저장 후 메모리에서 이어붙이기(현재 기능 유지)
      const merged = [];
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
        for (const u of merged) {
          out.set(u, off);
          off += u.byteLength;
        }
        await call("files/saveToProject", {
          category: "audio",
          fileName: "narration.mp3",
          buffer: out.buffer,
        });
      }

      // 4) SRT (TTS 마크 사용)
      beginPhase("SRT");
      setProgress({ current: 0, total: 0 });
      const srtRes = await call("script/toSrt", {
        doc: generatedDoc,
        ttsMarks: ttsRes?.marks || null, // 타임포인트 전달(없으면 백엔드 폴백)
      });
      if (srtRes?.srt) {
        const srtBuf = new TextEncoder().encode(srtRes.srt).buffer;
        await call("files/saveToProject", {
          category: "subtitle",
          fileName: "subtitle.srt",
          buffer: srtBuf,
        });
      }

      // 5) MERGE (렌더러 처리 스텁 유지)
      beginPhase("MERGE");
      setProgress({ current: 0, total: 0 });
      await call("audio/concatScenes", {});

      // 완료
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      setPhase("완료");
      setProgress({ current: 1, total: 1 });
      setStatus("done");
    } catch (e) {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      setStatus("error");
      const msg = e?.response?.data?.error?.message || e?.message || "오류가 발생했습니다.";
      setError(msg);
    }
  };

  /* ========================= 실행 가능 여부 ========================= */
  const canRun =
    (activeTab === "auto" && (forms.auto.topic || "").trim().length > 0) ||
    (activeTab === "ref" && (refText || "").trim().length > 0) ||
    (activeTab === "prompt-gen" && (genPrompt || "").trim().length > 0) ||
    (activeTab === "prompt-ref" && (refPrompt || "").trim().length > 0 && (promptRefText || "").trim().length > 0);

  // ETA
  const etaSec = estimateEtaSec({
    phase,
    progress,
    elapsed: phaseElapsedSec,
    plan,
  });

  /* ========================= 렌더 ========================= */
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
          <h1 className="text-xl font-semibold text-neutral-900">대본 &amp; 음성 생성</h1>
          <span className="text-xs text-neutral-600">SRT 자막 + MP3 내레이션을 한 번에</span>
        </div>
        <button
          type="button"
          onClick={() => runGenerate(activeTab)}
          disabled={!canRun || status === "running"}
          className={`px-4 py-2 rounded-lg text-sm text-white transition ${
            status === "running" ? "bg-slate-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500"
          }`}
        >
          실행
        </button>
      </div>

      {/* 진행 바 */}
      {status !== "idle" && (
        <div className="mb-4">
          {progress.total > 0 ? (
            <ProgressBar
              current={progress.current}
              total={progress.total}
              etaSec={etaSec}
              phase={phase}
              elapsedSec={phaseElapsedSec}
              status={status}
            />
          ) : (
            <IndeterminateBar etaSec={etaSec} phase={phase} elapsedSec={phaseElapsedSec} status={status} />
          )}
        </div>
      )}

      {/* 탭 바 */}
      <div className="mb-4 flex gap-2 border-b border-slate-200">
        <TabButton active={activeTab === "auto"} onClick={() => setActiveTab("auto")} label="자동 생성" />
        <TabButton active={activeTab === "ref"} onClick={() => setActiveTab("ref")} label="레퍼런스 기반" />
        <TabButton active={activeTab === "prompt-gen"} onClick={() => setActiveTab("prompt-gen")} label="대본 프롬프트" />
        <TabButton active={activeTab === "prompt-ref"} onClick={() => setActiveTab("prompt-ref")} label="레퍼런스 프롬프트" />
      </div>

      {/* 본문 */}
      {activeTab === "auto" && (
        <AutoTab
          form={forms.auto}
          onChange={onChangeFor("auto")}
          voices={VOICES_BY_ENGINE[forms.auto.ttsEngine] || []}
          onRun={() => runGenerate("auto")}
        />
      )}
      {activeTab === "ref" && (
        <RefTab
          form={forms.ref}
          onChange={(key, v) => {
            if (key === "ttsEngine") {
              const vs = VOICES_BY_ENGINE[v] || [];
              setForms((prev) => ({
                ...prev,
                ref: {
                  ...prev.ref,
                  ttsEngine: v,
                  voiceName: vs.length ? vs[0] : prev.ref.voiceName,
                },
              }));
            } else {
              onChangeFor("ref")(key, v);
            }
          }}
          voices={VOICES_BY_ENGINE[forms.ref.ttsEngine] || []}
          refText={refText}
          setRefText={setRefText}
        />
      )}
      {activeTab === "prompt-gen" && (
        <Card>
          <ScriptPromptTab
            template={genPrompt}
            setTemplate={setGenPrompt}
            savedAt={promptSavedAt}
            onSave={() => savePrompt("generate")}
            onReset={() => resetPrompt("generate")}
            form={forms["prompt-gen"]}
            onChange={onChangeFor("prompt-gen")}
            voices={VOICES_BY_ENGINE[forms["prompt-gen"].ttsEngine] || []}
          />
        </Card>
      )}
      {activeTab === "prompt-ref" && (
        <Card>
          <ReferencePromptTab
            template={refPrompt}
            setTemplate={setRefPrompt}
            savedAt={promptSavedAt}
            onSave={() => savePrompt("reference")}
            onReset={() => resetPrompt("reference")}
            form={forms["prompt-ref"]}
            onChange={onChangeFor("prompt-ref")}
            voices={VOICES_BY_ENGINE[forms["prompt-ref"].ttsEngine] || []}
            refText={promptRefText}
            setRefText={setPromptRefText}
            onRun={() => runGenerate("prompt-ref")}
          />
        </Card>
      )}

      {/* 결과 테이블 */}
      <Card className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold text-neutral-900">씬 미리보기</div>
          <div className="text-xs text-neutral-600">{currentDoc?.scenes?.length ? `${currentDoc.scenes.length}개 씬` : "대본 없음"}</div>
        </div>

        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <Th>#</Th>
                <Th>시작–끝</Th>
                <Th>글자수</Th>
                <Th className="text-left">텍스트</Th>
              </tr>
            </thead>
            <tbody>
              {(currentDoc?.scenes || []).map((sc, i) => (
                <tr key={sc.id || i} className="border-t border-slate-100">
                  <Td className="text-center">{sc.scene_number ?? i + 1}</Td>
                  <Td className="text-center">
                    {secToTime(sc.start)}–{secToTime(sc.end)}
                  </Td>
                  <Td className="text-center">{safeCharCount(sc.text)}</Td>
                  <Td className="text-neutral-800">{sc.text}</Td>
                </tr>
              ))}
              {!currentDoc?.scenes?.length && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-neutral-500">
                    대본을 생성하거나 SRT를 불러오면 씬 목록이 표시됩니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {error && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      </Card>
    </div>
  );
}
