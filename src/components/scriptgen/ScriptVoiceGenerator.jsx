// src/ScriptVoiceGenerator.jsx
import { useMemo, useRef, useState, useLayoutEffect, useEffect } from "react";
import { Card, TabButton, Th, Td } from "./parts/SmallUI";
import { ProgressBar, IndeterminateBar } from "./parts/ProgressBar";
import AutoTab from "./tabs/AutoTab";
import RefTab from "./tabs/RefTab";
// import ImportTab from "./tabs/ImportTab"; // 🔒 가져오기 기능 전체 비활성
import {
  VOICES_BY_ENGINE,
  DEFAULT_GENERATE_PROMPT,
  DEFAULT_REFERENCE_PROMPT,
} from "./constants";
import { secToTime } from "./utils/time";
import { base64ToArrayBuffer } from "./utils/buffer";
import ScriptPromptTab from "./tabs/ScriptPromptTab";
import ReferencePromptTab from "./tabs/ReferencePromptTab";

/* ========================= 공백 포함 글자수(정규화) 유틸 =========================
   - 모델이 보고한 charCount가 부정확해도 항상 동일 기준으로 재계산하여 표시  */
function safeCharCount(s) {
  let t = String(s ?? "");
  try {
    t = t.normalize("NFC");
  } catch {}
  // 제로폭 등 제거
  t = t.replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
  // 코드포인트 기준 길이
  return Array.from(t).length;
}

/** ========================= 글자수 규칙 =========================
 * - 자동 탭(auto): 기존 정책 유지(분당 300~400자)
 * - 프롬프트 탭은 "프롬프트 중심"
 *   - prompt-gen: 프롬프트 원문 그대로 전송
 *   - prompt-ref: {referenceText}, {duration}, {topic}, {maxScenes}만 치환
 */
const CHAR_BUDGETS = {
  auto: { perMinMin: 300, perMinMax: 400 },
  perSceneFallback: { min: 500, max: 900 }, // ref 계산용
};

function computeCharBudget({ tab, durationMin, maxScenes }) {
  const duration = Number(durationMin) || 0;
  const scenes = Math.max(1, Number(maxScenes) || 1);
  const totalSeconds = duration * 60;

  // 자동 탭: 분당 속도 정책 적용
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

  // ref: 대략 per-scene 기준
  const { min, max } = CHAR_BUDGETS.perSceneFallback;
  const minCharacters = scenes * min;
  const maxCharacters = scenes * max;
  const avgCharactersPerScene = Math.max(
    1,
    Math.round((minCharacters + maxCharacters) / 2 / scenes)
  );
  return { totalSeconds, minCharacters, maxCharacters, avgCharactersPerScene };
}

/** 프롬프트 원문 그대로 (prompt-gen) */
function compilePromptRaw(tpl) {
  return String(tpl ?? "");
}

/** 레퍼런스 프롬프트 치환 — 4개 키만 치환({referenceText}, {duration}, {topic}, {maxScenes}) */
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

/* ========================= 분량/씬수 추출 유틸 =========================
   - prompt-gen 뿐 아니라 prompt-ref 템플릿(refPrompt)에서도
     상단의 "N분", "최대 장면 수: M" 패턴을 읽어 duration/maxScenes 보정 */
function extractDurationMinFromText(s) {
  const t = String(s || "");
  const m1 = t.match(/(\d+(?:\.\d+)?)\s*분/); // 예: 7분, 7.5분
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

/* ========================= 탭별 독립 form 기본값/제어 ========================= */
const makeDefaultForm = () => ({
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

export default function ScriptVoiceGenerator() {
  // ---------------- UI 상태 ----------------
  const [activeTab, setActiveTab] = useState("auto");

  // ✅ 탭별 독립 폼 상태
  const [forms, setForms] = useState({
    auto: makeDefaultForm(),
    ref: makeDefaultForm(),
    "prompt-gen": makeDefaultForm(),
    "prompt-ref": makeDefaultForm(),
  });

  // 현재 활성 탭의 form 스냅샷
  const form = forms[activeTab];

  // 탭별 onChange 생성기
  const onChangeFor = (tab) => (key, v) =>
    setForms((prev) => ({ ...prev, [tab]: { ...prev[tab], [key]: v } }));

  // 음성 목록 (활성 탭 기준)
  const voices = useMemo(
    () => VOICES_BY_ENGINE[form.ttsEngine] || [],
    [form.ttsEngine]
  );

  // 탭별 입력/문서 분리
  const [refText, setRefText] = useState(""); // 레퍼런스 기반 탭
  const [promptRefText, setPromptRefText] = useState(""); // 레퍼런스 프롬프트 탭
  const [docs, setDocs] = useState({
    auto: null,
    ref: null,
    "prompt-gen": null,
    "prompt-ref": null,
  });
  const currentDoc = docs[activeTab] || null;

  // ---------------- 프롬프트 템플릿 ----------------
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

  // ---------------- 진행 상태 ----------------
  const [status, setStatus] = useState("idle");
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [elapsedSec, setElapsedSec] = useState(0);
  const scriptTimerRef = useRef(null);

  const [error, setError] = useState("");

  // ---------------- 폭 고정 ----------------
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);
  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  // ---------------- IPC 래퍼 ----------------
  const call = (channel, payload) => window.api.invoke(channel, payload);

  // ---------------- 인디케이터 ----------------
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

  // ======================== 실행 플로우(탭별 독립 실행) ========================
  const runGenerate = async (tab) => {
    // ⚙️ 이 실행에서 사용할 "그 탭의 form" 스냅샷
    const f = forms[tab];

    // 백엔드 라우팅 기준으로 탭 정규화
    //  - prompt-gen → auto 경로 사용
    //  - prompt-ref → ref 경로 사용
    const normalized =
      tab === "prompt-gen" ? "auto" : tab === "prompt-ref" ? "ref" : tab;

    setStatus("running");
    setError("");
    setPhase("SCRIPT");
    setProgress({ current: 0, total: 0 });
    startScriptIndicator();

    try {
      // ★ 기본은 "그 탭의 form" 값
      let duration = Number(f.durationMin);
      let maxScenes = Number(f.maxScenes);
      const topic = String(f.topic || "");
      const style = String(f.style || "");

      // ✅ prompt-gen: 프롬프트 상단에서 분/씬수 읽어 오버라이드
      if (tab === "prompt-gen") {
        const dFromPrompt = extractDurationMinFromText(genPrompt);
        if (Number.isFinite(dFromPrompt)) duration = dFromPrompt;
        const sFromPrompt = extractMaxScenesFromText(genPrompt);
        if (Number.isFinite(sFromPrompt)) maxScenes = sFromPrompt;
      }

      // ✅ prompt-ref: 템플릿 본문에서 분/씬수 읽어 오버라이드
      if (tab === "prompt-ref") {
        const dFromTpl = extractDurationMinFromText(refPrompt);
        if (Number.isFinite(dFromTpl)) duration = dFromTpl;
        const sFromTpl = extractMaxScenesFromText(refPrompt);
        if (Number.isFinite(sFromTpl)) maxScenes = sFromTpl;
      }

      // 자동/ref 계산치 (프롬프트 탭은 정책치 전송 X)
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

      // ----- 프롬프트 구성 -----
      const compiledPrompt =
        tab === "prompt-gen"
          ? compilePromptRaw(genPrompt) // ✅ 원문 그대로 전송
          : tab === "prompt-ref"
          ? compileRefPrompt(refPrompt, {
              referenceText: promptRefText, // ✅ 사용자 입력 레퍼런스
              duration,
              topic,
              maxScenes,
            })
          : undefined;

      // ----- 공통 필드 -----
      const common = {
        llm: f.llmMain,
        duration,
        maxScenes,
        topic,
        style,
      };

      // ----- payload 조립(탭 독립 분기) -----
      const isPromptTab = tab === "prompt-gen" || tab === "prompt-ref";
      const base = isPromptTab
        ? {
            ...common,
            ...(compiledPrompt ? { compiledPrompt } : {}),
            customPrompt: true, // 🔒 프롬프트 탭은 길이 보정 루프 비활성(백엔드에서 조건 처리)
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

      let invokePayload = null;
      if (normalized === "auto") {
        // 자동 생성(또는 prompt-gen)의 백엔드 라우트
        invokePayload = { ...base, type: "auto" };
      } else if (normalized === "ref") {
        // 레퍼런스 기반(또는 prompt-ref)의 백엔드 라우트
        invokePayload = {
          ...base,
          type: "reference",
          referenceText: tab === "prompt-ref" ? promptRefText : refText,
        };
      }

      // ✅ 파라미터 요약 로그(민감 본문 비노출)
      try {
        console.log("[RUN]", {
          tab,
          normalized,
          duration,
          maxScenes,
          topic,
          style,
          llm: f.llmMain,
          tts: {
            engine: f.ttsEngine,
            voice: f.voiceName,
            rate: f.speakingRate,
            pitch: f.pitch,
          },
          hasCompiledPrompt: !!compiledPrompt,
          refTextLen:
            normalized === "ref"
              ? (tab === "prompt-ref" ? promptRefText : refText)?.length || 0
              : 0,
        });
        if (tab === "prompt-gen" && compiledPrompt) {
          console.log("[PROMPT-GEN] len:", compiledPrompt.length);
        }
        if (tab === "prompt-ref" && compiledPrompt) {
          console.log(
            "[PROMPT-REF] len:",
            compiledPrompt.length,
            "refTextLen:",
            (promptRefText || "").length
          );
        }
      } catch {}

      // ----- 호출 -----
      const generatedDoc = await call("llm/generateScript", invokePayload);

      // ----- 결과 처리 -----
      stopScriptIndicator();
      if (!generatedDoc?.scenes?.length)
        throw new Error("대본 생성 결과가 비어있습니다.");

      // 현재 탭의 결과만 저장(탭 독립)
      setDocs((prev) => ({ ...prev, [tab]: generatedDoc }));

      // ---------- SRT ----------
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

      // ---------- TTS ----------
      setPhase("TTS");
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

      // ---------- MERGE ----------
      setPhase("MERGE");
      setProgress({ current: 1, total: 1 });
      await call("audio/concatScenes", {});
      setStatus("done");
      setPhase("완료");
    } catch (e) {
      stopScriptIndicator();
      setStatus("error");
      const msg =
        e?.response?.data?.error?.message ||
        e?.message ||
        "오류가 발생했습니다.";
      setError(msg);
    }
  };

  // ---------------- 실행 가능 조건(탭별 독립, 공백 방지) ----------------
  const canRun =
    (activeTab === "auto" && (forms.auto.topic || "").trim().length > 0) ||
    (activeTab === "ref" && (refText || "").trim().length > 0) ||
    (activeTab === "prompt-gen" && (genPrompt || "").trim().length > 0) ||
    (activeTab === "prompt-ref" &&
      (refPrompt || "").trim().length > 0 &&
      (promptRefText || "").trim().length > 0);

  // ---------------- 렌더 ----------------
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

      {/* 결과/리스트 (현재 탭의 문서만 표시) */}
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
                  <Td className="text-center">
                    {/* 모델 리포트 값 표기 제거 → 우리가 재계산한 값만 표시 */}
                    {safeCharCount(sc.text)}
                  </Td>
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
