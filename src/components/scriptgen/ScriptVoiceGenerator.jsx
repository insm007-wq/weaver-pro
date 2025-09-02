// src/ScriptVoiceGenerator.jsx
import { useMemo, useRef, useState, useLayoutEffect, useEffect } from "react";
import { Card, TabButton, Th, Td } from "./parts/SmallUI";
import { ProgressBar, IndeterminateBar } from "./parts/ProgressBar";
import AutoTab from "./tabs/AutoTab";
import RefTab from "./tabs/RefTab";
import {
  VOICES_BY_ENGINE,
  DEFAULT_GENERATE_PROMPT,
  DEFAULT_REFERENCE_PROMPT,
} from "./constants";
import { secToTime } from "./utils/time";
import { base64ToArrayBuffer } from "./utils/buffer";
import ScriptPromptTab from "./tabs/ScriptPromptTab";
import ReferencePromptTab from "./tabs/ReferencePromptTab";

/* ========================= 공백 포함 글자수(정규화) ========================= */
function safeCharCount(s) {
  let t = String(s ?? "");
  try {
    t = t.normalize("NFC");
  } catch {}
  t = t.replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
  return Array.from(t).length;
}

/** ========================= 글자수 규칙 ========================= */
const CHAR_BUDGETS = {
  auto: { perMinMin: 300, perMinMax: 400 },
  perSceneFallback: { min: 500, max: 900 },
};

function computeCharBudget({ tab, durationMin, maxScenes }) {
  const duration = Number(durationMin) || 0;
  const scenes = Math.max(1, Number(maxScenes) || 1);
  const totalSeconds = duration * 60;

  if (tab === "auto") {
    const { perMinMin, perMinMax } = CHAR_BUDGETS.auto;
    const minCharacters = Math.max(0, Math.round(duration * perMinMin));
    const maxCharacters = Math.max(
      minCharacters,
      Math.round(duration * perMinMax)
    );
    const avgCharactersPerScene = Math.max(
      1,
      Math.round((minCharacters + maxCharacters) / 2 / scenes)
    );
    return {
      totalSeconds,
      minCharacters,
      maxCharacters,
      avgCharactersPerScene,
      cpmMin: perMinMin,
      cpmMax: perMinMax,
    };
  }

  const { min, max } = CHAR_BUDGETS.perSceneFallback;
  const minCharacters = scenes * min;
  const maxCharacters = scenes * max;
  const avgCharactersPerScene = Math.max(
    1,
    Math.round((minCharacters + maxCharacters) / 2 / scenes)
  );
  return { totalSeconds, minCharacters, maxCharacters, avgCharactersPerScene };
}

/** 프롬프트 유틸 */
function compilePromptRaw(tpl) {
  return String(tpl ?? "");
}
function compileRefPrompt(tpl, { referenceText, duration, topic, maxScenes }) {
  let s = String(tpl ?? "");
  const dict = {
    referenceText: referenceText ?? "",
    duration: duration ?? "",
    topic: topic ?? "",
    maxScenes: maxScenes ?? "",
  };
  for (const [k, v] of Object.entries(dict))
    s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/* ========================= 분량/씬수 추출 ========================= */
function extractDurationMinFromText(s) {
  const t = String(s || "");
  const m1 = t.match(/(\d+(?:\.\d+)?)\s*분/);
  const m2 = t.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/i);
  const v = m1 ? parseFloat(m1[1]) : m2 ? parseFloat(m2[1]) : NaN;
  if (!Number.isFinite(v)) return null;
  return Math.max(1, Math.round(v));
}
function extractMaxScenesFromText(s) {
  const t = String(s || "");
  const m =
    t.match(/최대\s*장면\s*수\s*[:=]?\s*(\d+)/) ||
    t.match(/최대\s*장면수\s*[:=]?\s*(\d+)/) ||
    t.match(/max\s*scenes?\s*[:=]?\s*(\d+)/i);
  const v = m ? parseInt(m[1], 10) : NaN;
  if (!Number.isFinite(v)) return null;
  return Math.max(1, v);
}

/* ========================= 탭별 폼 ========================= */
const makeDefaultForm = () => ({
  topic: "",
  style: "",
  durationMin: 5,
  maxScenes: 10,
  llmMain: "openai-gpt5mini",
  ttsEngine: "google",
  speakingRate: 0.84,
  pitch: 0.2,
});

export default function ScriptVoiceGenerator() {
  const [activeTab, setActiveTab] = useState("auto");
  const [forms, setForms] = useState({
    auto: makeDefaultForm(),
    ref: makeDefaultForm(),
    "prompt-gen": makeDefaultForm(),
    "prompt-ref": makeDefaultForm(),
  });
  const form = forms[activeTab];
  const onChangeFor = (tab) => (key, v) =>
    setForms((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: v } }));

  const voices = useMemo(
    () => VOICES_BY_ENGINE[form.ttsEngine] || [],
    [form.ttsEngine]
  );

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

  // 템플릿
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

  // 진행/ETA
  const [status, setStatus] = useState("idle");
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [phaseElapsedSec, setPhaseElapsedSec] = useState(0);
  const phaseTimerRef = useRef(null);
  const [plan, setPlan] = useState({ durationMin: 0, maxScenes: 0 });

  const beginPhase = (name) => {
    setPhase(name);
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    const start = Date.now();
    setPhaseElapsedSec(0);
    phaseTimerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setPhaseElapsedSec(s);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, []);

  const [error, setError] = useState("");

  // 폭 고정
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);
  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  // IPC
  const call = (channel, payload) => window.api.invoke(channel, payload);

  // 실행
  const runGenerate = async (tab) => {
    const f = forms[tab];
    const normalized =
      tab === "prompt-gen" ? "auto" : tab === "prompt-ref" ? "ref" : tab;

    setStatus("running");
    setError("");
    setProgress({ current: 0, total: 0 });
    beginPhase("SCRIPT");

    try {
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

      const {
        totalSeconds,
        minCharacters,
        maxCharacters,
        avgCharactersPerScene,
        cpmMin,
        cpmMax,
      } = computeCharBudget({
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

      // SCRIPT
      const generatedDoc = await call("llm/generateScript", invokePayload);
      if (!generatedDoc?.scenes?.length)
        throw new Error("대본 생성 결과가 비어있습니다.");
      setDocs((prev) => ({ ...prev, [tab]: generatedDoc }));

      // SRT
      beginPhase("SRT");
      setProgress({ current: 0, total: 0 });
      const srtRes = await call("script/toSrt", { doc: generatedDoc });
      if (srtRes?.srt) {
        const srtBuf = new TextEncoder().encode(srtRes.srt).buffer;
        await call("files/saveToProject", {
          category: "subtitle",
          fileName: "subtitle.srt",
          buffer: srtBuf,
        });
      }

      // TTS
      beginPhase("TTS");
      setProgress({ current: 0, total: generatedDoc.scenes.length });
      const ttsRes = await call("tts/synthesizeByScenes", {
        doc: generatedDoc,
        tts: {
          engine: f.ttsEngine,
          voiceName: f.voiceName,
          speakingRate: Number(f.speakingRate),
          pitch: Number(f.pitch),
        },
      });

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

      // MERGE
      beginPhase("MERGE");
      setProgress({ current: 0, total: 0 });
      await call("audio/concatScenes", {});

      // 완료
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      setPhase("완료");
      setProgress({ current: 1, total: 1 }); // 100%
      setStatus("done");
    } catch (e) {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
      setStatus("error");
      const msg =
        e?.response?.data?.error?.message ||
        e?.message ||
        "오류가 발생했습니다.";
      setError(msg);
    }
  };

  // 실행 가능
  const canRun =
    (activeTab === "auto" && (forms.auto.topic || "").trim().length > 0) ||
    (activeTab === "ref" && (refText || "").trim().length > 0) ||
    (activeTab === "prompt-gen" && (genPrompt || "").trim().length > 0) ||
    (activeTab === "prompt-ref" &&
      (refPrompt || "").trim().length > 0 &&
      (promptRefText || "").trim().length > 0);

  // ETA
  const etaSec = estimateEtaSec({
    phase,
    progress,
    elapsed: phaseElapsedSec,
    plan,
  });

  // 렌더
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
        <button
          type="button"
          onClick={() => runGenerate(activeTab)}
          disabled={!canRun || status === "running"}
          className={`px-4 py-2 rounded-lg text-sm text-white transition ${
            status === "running"
              ? "bg-slate-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500"
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
            <IndeterminateBar
              etaSec={etaSec}
              phase={phase}
              elapsedSec={phaseElapsedSec}
              status={status}
            />
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
          active={activeTab === "prompt-gen"}
          onClick={() => setActiveTab("prompt-gen")}
          label="대본 프롬프트"
        />
        <TabButton
          active={activeTab === "prompt-ref"}
          onClick={() => setActiveTab("prompt-ref")}
          label="레퍼런스 프롬프트"
        />
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

      {/* 결과 */}
      <Card className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">씬 미리보기</div>
          <div className="text-xs text-slate-500">
            {currentDoc?.scenes?.length
              ? `${currentDoc.scenes.length}개 씬`
              : "대본 없음"}
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
              {(currentDoc?.scenes || []).map((sc, i) => (
                <tr key={sc.id || i} className="border-t border-slate-100">
                  <Td className="text-center">{sc.scene_number ?? i + 1}</Td>
                  <Td className="text-center">
                    {secToTime(sc.start)}–{secToTime(sc.end)}
                  </Td>
                  <Td className="text-center">{safeCharCount(sc.text)}</Td>
                  <Td className="text-slate-700">{sc.text}</Td>
                </tr>
              ))}
              {!currentDoc?.scenes?.length && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400">
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
  );
}

/* ========================= ETA 계산기 =========================
   - 결정형(progress.total>0): 실측 속도. 남은 수가 0이면 숫자 숨김.
   - 비결정형: 휴리스틱. 0 이하이면 null(문구로 대체).
*/
function estimateEtaSec({ phase, progress, elapsed, plan }) {
  const { current, total } = progress || {};

  // 결정형
  if (total > 0 && current > 0) {
    const per = elapsed / current; // sec per unit
    const eta = Math.round(per * (total - current));
    return eta > 0 ? eta : null; // 0초는 표기하지 않음
  }

  // 비결정형
  if (phase === "SCRIPT") {
    const expect = Math.round(
      (plan?.durationMin || 0) * 5 + (plan?.maxScenes || 0) * 1
    );
    const eta = expect - elapsed;
    return eta > 0 ? eta : null;
  }
  if (phase === "SRT") {
    const expect = Math.min(15, Math.round(1 + (plan?.maxScenes || 0) * 0.2));
    const eta = expect - elapsed;
    return eta > 0 ? eta : null;
  }
  if (phase === "MERGE") {
    const expect = 3;
    const eta = expect - elapsed;
    return eta > 0 ? eta : null;
  }
  if (phase === "완료") return 0;

  return null;
}
