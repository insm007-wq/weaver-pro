// src/ScriptVoiceGenerator.jsx
import { useMemo, useRef, useState, useLayoutEffect, useEffect } from "react";
import { Card, TabButton, Th, Td } from "./parts/SmallUI";
import { ProgressBar, IndeterminateBar } from "./parts/ProgressBar";
import AutoTab from "./tabs/AutoTab";
import RefTab from "./tabs/RefTab";
import ImportTab from "./tabs/ImportTab";
import {
  VOICES_BY_ENGINE,
  DEFAULT_GENERATE_PROMPT,
  DEFAULT_REFERENCE_PROMPT,
} from "./constants";
import { secToTime } from "./utils/time";
import { base64ToArrayBuffer } from "./utils/buffer";
import ScriptPromptTab from "./tabs/ScriptPromptTab";
import ReferencePromptTab from "./tabs/ReferencePromptTab";

// 템플릿 변수 치환 (필요 변수만 정확히 치환)
function compileTemplate(tpl, vars) {
  let s = String(tpl ?? "");
  const dict = {
    duration: vars.duration,
    topic: vars.topic,
    style: vars.style,
    maxScenes: vars.maxScenes,
    minCharacters: vars.minCharacters,
    maxCharacters: vars.maxCharacters,
    avgCharactersPerScene: vars.avgCharactersPerScene,
    totalSeconds: vars.totalSeconds,
    referenceText: vars.referenceText ?? "", // ref 탭용
  };
  Object.entries(dict).forEach(([k, v]) => {
    s = s.replaceAll(`{${k}}`, String(v ?? ""));
  });
  return s;
}

export default function ScriptVoiceGenerator() {
  // 탭: auto | ref | import | prompt-gen | prompt-ref
  const [activeTab, setActiveTab] = useState("auto");

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

  // 프롬프트 (대본/레퍼런스 탭)
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
      } catch {}
    })();
  }, []);

  const savePrompt = async (type) => {
    if (type === "generate") {
      await window.api.setSetting({
        key: "prompt.generateTemplate",
        value: genPrompt,
      });
    } else if (type === "reference") {
      await window.api.setSetting({
        key: "prompt.referenceTemplate",
        value: refPrompt,
      });
    }
    setPromptSavedAt(new Date());
  };

  const resetPrompt = (type) => {
    if (type === "generate") setGenPrompt(DEFAULT_GENERATE_PROMPT);
    if (type === "reference") setRefPrompt(DEFAULT_REFERENCE_PROMPT);
  };

  // 상태
  const [status, setStatus] = useState("idle");
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [elapsedSec, setElapsedSec] = useState(0);
  const scriptTimerRef = useRef(null);

  const [doc, setDoc] = useState(null);
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

  // 선택 보이스
  const voices = useMemo(
    () => VOICES_BY_ENGINE[form.ttsEngine] || [],
    [form.ttsEngine]
  );
  const onChange = (key, v) => setForm((s) => ({ ...s, [key]: v }));

  // IPC
  const call = (channel, payload) => window.api.invoke(channel, payload);

  // 실행 인디케이터
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

  // 실행
  const runGenerate = async (mode) => {
    // prompt-gen → auto, prompt-ref → ref로 정규화
    const normalized =
      mode === "prompt-gen" ? "auto" : mode === "prompt-ref" ? "ref" : mode;

    setStatus("running");
    setError("");
    setPhase("SCRIPT");
    setProgress({ current: 0, total: 0 });
    startScriptIndicator();

    try {
      // 변수 계산(프론트 계산치)
      const duration = Number(form.durationMin);
      const maxScenes = Number(form.maxScenes);
      const topic = String(form.topic || "");
      const style = String(form.style || "");
      const minCharacters = maxScenes * 500;
      const maxCharacters = maxScenes * 900;
      const avgCharactersPerScene = Math.round(
        (minCharacters + maxCharacters) / 2 / Math.max(1, maxScenes)
      );
      const totalSeconds = duration * 60;

      // 탭별 사용자 프롬프트 컴파일
      const compiledPrompt =
        mode === "prompt-gen"
          ? compileTemplate(genPrompt, {
              duration,
              topic,
              style,
              maxScenes,
              minCharacters,
              maxCharacters,
              avgCharactersPerScene,
              totalSeconds,
            })
          : mode === "prompt-ref"
          ? compileTemplate(refPrompt, {
              duration,
              topic,
              style,
              maxScenes,
              minCharacters,
              maxCharacters,
              avgCharactersPerScene,
              totalSeconds,
              referenceText: refText,
            })
          : undefined;

      // 디버그: 실제 전송되는 값 확인
      console.groupCollapsed("%c[RUN][generate] payload", "color:#2563eb");
      console.log({
        type: normalized,
        llm: form.llmMain,
        duration,
        maxScenes,
        topic,
        style,
        compiledPrompt: compiledPrompt
          ? compiledPrompt.slice(0, 220)
          : undefined,
        customPrompt: !!compiledPrompt,
      });
      console.groupEnd();

      // 공통 옵션
      const base = {
        llm: form.llmMain,
        duration,
        maxScenes,
        compiledPrompt,
        customPrompt: !!compiledPrompt, // ✅ 백엔드에게 '커스텀 프롬프트 모드' 알림
      };

      let generatedDoc = null;

      if (normalized === "auto") {
        generatedDoc = await call("llm/generateScript", {
          ...base,
          type: "auto",
          topic,
          style,
        });
      } else if (normalized === "ref") {
        generatedDoc = await call("llm/generateScript", {
          ...base,
          type: "reference",
          topic,
          style,
          referenceText: refText,
        });
      } else if (normalized === "import") {
        generatedDoc = doc;
      }

      stopScriptIndicator();
      if (!generatedDoc?.scenes?.length)
        throw new Error("대본 생성 결과가 비어있습니다.");
      setDoc(generatedDoc);

      // SRT 생성/저장
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

      // TTS
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

  // 가져오기
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
    } catch {
      setError("MP3 저장 실패");
    }
  };

  // 실행 가능 조건
  const canRun =
    (activeTab === "auto" && form.topic.trim()) ||
    (activeTab === "ref" && refText.trim()) ||
    (activeTab === "import" && doc) ||
    (activeTab === "prompt-gen" && genPrompt.trim()) ||
    (activeTab === "prompt-ref" && refPrompt.trim() && refText.trim());

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
          active={activeTab === "import"}
          onClick={() => setActiveTab("import")}
          label="가져오기 (SRT/MP3)"
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
          form={form}
          onChange={onChange}
          voices={voices}
          onRun={() => runGenerate("auto")}
        />
      )}

      {activeTab === "ref" && (
        <RefTab
          form={form}
          onChange={onChange}
          voices={voices}
          refText={refText}
          setRefText={setRefText}
          onRun={() => runGenerate("ref")}
        />
      )}

      {activeTab === "import" && (
        <ImportTab
          form={form}
          onChange={onChange}
          voices={voices}
          importSrtRef={importSrtRef}
          importMp3Ref={importMp3Ref}
          onImportSrt={handleImportSrt}
          onUseMp3={handleUseUploadedMp3}
          onRun={() => runGenerate("import")}
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
            form={form}
            onChange={onChange}
            voices={voices}
            // 실행 버튼은 상단 공용 버튼만 사용
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
            form={form}
            onChange={onChange}
            voices={voices}
            refText={refText}
            setRefText={setRefText}
            // 실행 버튼은 상단 공용 버튼만 사용
          />
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
                  <Td className="text-center">{sc.scene_number ?? i + 1}</Td>
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
