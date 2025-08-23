import React, { useEffect, useMemo, useState } from "react";

export default function ApiTab() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");

  const [pexelsKey, setPexelsKey] = useState("");
  const [pixabayKey, setPixabayKey] = useState("");

  const [minimaxGroupId, setMinimaxGroupId] = useState("");
  const [minimaxKey, setMinimaxKey] = useState("");

  const [googleTtsKey, setGoogleTtsKey] = useState("");

  const [status, setStatus] = useState({
    openai: null,
    anthropic: null,
    replicate: null,
    pexels: null,
    pixabay: null,
    minimax: null,
    googleTts: null,
  });
  const [loading, setLoading] = useState({
    openai: false,
    anthropic: false,
    replicate: false,
    pexels: false,
    pixabay: false,
    minimax: false,
    googleTts: false,
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const [ok, ak, rk, gidSecret, gidOldSetting, mk, gk, pxk, pbk] = await Promise.all([
        window.api.getSecret("openaiKey"),
        window.api.getSecret("anthropicKey"),
        window.api.getSecret("replicateKey"),
        window.api.getSecret("minimaxGroupId"),
        window.api.getSetting("miniMaxGroupId"),
        window.api.getSecret("minimaxKey"),
        window.api.getSecret("googleTtsApiKey"),
        window.api.getSecret("pexelsApiKey"),
        window.api.getSecret("pixabayApiKey"),
      ]);

      if (!gidSecret && gidOldSetting) {
        try {
          await window.api.setSecret({ key: "minimaxGroupId", value: String(gidOldSetting || "").trim() });
        } catch {}
      }

      setOpenaiKey(ok || "");
      setAnthropicKey(ak || "");
      setReplicateKey(rk || "");
      setMinimaxGroupId((gidSecret || gidOldSetting || "").trim());
      setMinimaxKey(mk || "");
      setGoogleTtsKey(gk || "");
      setPexelsKey(pxk || "");
      setPixabayKey(pbk || "");
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const setBusy = (k, v) => setLoading((s) => ({ ...s, [k]: v }));
  const setStat = (k, ok, msg) => setStatus((s) => ({ ...s, [k]: { ok, msg, ts: Date.now() } }));
  const setSaved = (k) => setStatus((s) => ({ ...s, [k]: { ok: null, msg: "키 저장됨", ts: Date.now() } }));

  /* ---------------- 저장: 저장 시 상태 = Saved ---------------- */
  const saveOpenAI = async () => {
    await window.api.setSecret({ key: "openaiKey", value: (openaiKey || "").trim() });
    setSaved("openai");
    setToast({ type: "success", text: "OpenAI 키 저장 완료" });
  };
  const saveAnthropic = async () => {
    await window.api.setSecret({ key: "anthropicKey", value: (anthropicKey || "").trim() });
    setSaved("anthropic");
    setToast({ type: "success", text: "Anthropic 키 저장 완료" });
  };
  const saveReplicate = async () => {
    await window.api.setSecret({ key: "replicateKey", value: (replicateKey || "").trim() });
    setSaved("replicate");
    setToast({ type: "success", text: "Replicate 토큰 저장 완료" });
  };
  const savePexels = async () => {
    await window.api.setSecret({ key: "pexelsApiKey", value: (pexelsKey || "").trim() });
    setSaved("pexels");
    setToast({ type: "success", text: "Pexels 키 저장 완료" });
  };
  const savePixabay = async () => {
    await window.api.setSecret({ key: "pixabayApiKey", value: (pixabayKey || "").trim() });
    setSaved("pixabay");
    setToast({ type: "success", text: "Pixabay 키 저장 완료" });
  };
  const saveMiniMax = async () => {
    await Promise.all([
      window.api.setSecret({ key: "minimaxGroupId", value: (minimaxGroupId || "").trim() }),
      window.api.setSecret({ key: "minimaxKey", value: (minimaxKey || "").trim() }),
    ]);
    setSaved("minimax");
    setToast({ type: "success", text: "MiniMax 설정 저장 완료" });
  };
  const saveGoogleTts = async () => {
    await window.api.setSecret({ key: "googleTtsApiKey", value: (googleTtsKey || "").trim() });
    setSaved("googleTts");
    setToast({ type: "success", text: "Google TTS 키 저장 완료" });
  };

  /* ---------------- 테스트: 성공 시 Connected ---------------- */
  const handleTestOpenAI = async () => {
    if (!openaiKey?.trim()) {
      setToast({ type: "error", text: "OpenAI 키를 입력하세요." });
      setStat("openai", false, "키 미입력");
      return;
    }
    setBusy("openai", true);
    setStat("openai", false, "");
    try {
      const res = await window.api.testOpenAI?.(openaiKey.trim());
      res?.ok
        ? setStat("openai", true, `연결 성공 (model: ${res?.model ?? "gpt-5-mini"})`)
        : setStat("openai", false, `실패: ${res?.status ?? ""} ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "OpenAI 연결 성공" : "OpenAI 실패" });
    } catch (e) {
      setStat("openai", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "OpenAI 오류" });
    } finally {
      setBusy("openai", false);
    }
  };

  const handleTestAnthropic = async () => {
    setBusy("anthropic", true);
    setStat("anthropic", false, "");
    try {
      const res = await window.api.testAnthropic?.(anthropicKey.trim());
      res?.ok ? setStat("anthropic", true, "연결 성공") : setStat("anthropic", false, `실패: ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "Anthropic 연결 성공" : "Anthropic 실패" });
    } catch (e) {
      setStat("anthropic", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Anthropic 오류" });
    } finally {
      setBusy("anthropic", false);
    }
  };

  const handleTestReplicate = async () => {
    setBusy("replicate", true);
    setStat("replicate", false, "");
    try {
      const res = await window.api.testReplicate?.(replicateKey.trim());
      res?.ok
        ? setStat("replicate", true, `연결 성공 (models: ${res.count})`)
        : setStat("replicate", false, `실패: ${res?.status ?? ""} ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "Replicate 연결 성공" : "Replicate 실패" });
    } catch (e) {
      setStat("replicate", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Replicate 오류" });
    } finally {
      setBusy("replicate", false);
    }
  };

  const handleTestPexels = async () => {
    if (!pexelsKey?.trim()) {
      setToast({ type: "error", text: "Pexels 키를 입력하세요." });
      setStat("pexels", false, "키 미입력");
      return;
    }
    setBusy("pexels", true);
    setStat("pexels", false, "");
    try {
      const res = await window.api.testPexels?.(pexelsKey.trim());
      res?.ok
        ? setStat("pexels", true, `연결 성공 (${res?.endpoint ?? "photos"})${res?.remaining != null ? `, 남은 호출수 ${res.remaining}` : ""}`)
        : setStat("pexels", false, `실패: ${res?.status ?? ""} ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "Pexels 연결 성공" : "Pexels 실패" });
    } catch (e) {
      setStat("pexels", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Pexels 오류" });
    } finally {
      setBusy("pexels", false);
    }
  };

  const handleTestPixabay = async () => {
    if (!pixabayKey?.trim()) {
      setToast({ type: "error", text: "Pixabay 키를 입력하세요." });
      setStat("pixabay", false, "키 미입력");
      return;
    }
    setBusy("pixabay", true);
    setStat("pixabay", false, "");
    try {
      const res = await window.api.testPixabay?.(pixabayKey.trim());
      res?.ok
        ? setStat("pixabay", true, `연결 성공 (${res?.endpoint ?? "photos"})${res?.hits != null ? `, 샘플 히트 ${res.hits}` : ""}`)
        : setStat("pixabay", false, `실패: ${res?.status ?? ""} ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "Pixabay 연결 성공" : "Pixabay 실패" });
    } catch (e) {
      setStat("pixabay", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Pixabay 오류" });
    } finally {
      setBusy("pixabay", false);
    }
  };

  const handleTestMiniMax = async () => {
    setBusy("minimax", true);
    setStat("minimax", false, "");
    try {
      const res = await window.api.testMiniMax?.({ key: (minimaxKey || "").trim(), groupId: (minimaxGroupId || "").trim() });
      res?.ok ? setStat("minimax", true, "연결 성공") : setStat("minimax", false, `실패: ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "MiniMax 연결 성공" : "MiniMax 실패" });
    } catch (e) {
      setStat("minimax", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "MiniMax 오류" });
    } finally {
      setBusy("minimax", false);
    }
  };

  const handleTestGoogleTts = async () => {
    setBusy("googleTts", true);
    setStat("googleTts", false, "");
    try {
      const res = await window.api.testGoogleTTS?.(googleTtsKey.trim());
      res?.ok ? setStat("googleTts", true, `연결 성공 (voices: ${res.voices})`) : setStat("googleTts", false, `실패: ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "Google TTS 연결 성공" : "Google TTS 실패" });
    } catch (e) {
      setStat("googleTts", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Google TTS 오류" });
    } finally {
      setBusy("googleTts", false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-4 z-50">
        {toast && (
          <div className={`pointer-events-auto px-4 py-2 rounded-lg shadow-lg text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
            {toast.text}
          </div>
        )}
      </div>

      {/* OpenAI */}
      <Section title="🧠 OpenAI API Key" status={status.openai} loading={loading.openai} onTest={handleTestOpenAI} onSave={saveOpenAI}>
        <input
          type="password"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          placeholder="OpenAI API Key (sk-...)"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>

      {/* Anthropic */}
      <Section title="🤖 Anthropic API Key" status={status.anthropic} loading={loading.anthropic} onTest={handleTestAnthropic} onSave={saveAnthropic}>
        <input
          type="password"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder="Anthropic API Key"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>

      {/* Replicate */}
      <Section title="🔁 Replicate API Token" status={status.replicate} loading={loading.replicate} onTest={handleTestReplicate} onSave={saveReplicate}>
        <input
          type="password"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={replicateKey}
          onChange={(e) => setReplicateKey(e.target.value)}
          placeholder="API Token"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>

      {/* Pexels */}
      <Section title="🖼️ Pexels API Key" status={status.pexels} loading={loading.pexels} onTest={handleTestPexels} onSave={savePexels}>
        <input
          type="password"
          value={pexelsKey}
          onChange={(e) => setPexelsKey(e.target.value)}
          placeholder="Pexels API Key"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>

      {/* Pixabay */}
      <Section title="📦 Pixabay API Key" status={status.pixabay} loading={loading.pixabay} onTest={handleTestPixabay} onSave={savePixabay}>
        <input
          type="password"
          value={pixabayKey}
          onChange={(e) => setPixabayKey(e.target.value)}
          placeholder="Pixabay API Key"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>

      {/* MiniMax */}
      <Section title="🧩 MiniMax API" status={status.minimax} loading={loading.minimax} onTest={handleTestMiniMax} onSave={saveMiniMax}>
        <div className="flex gap-2 w-full">
          <input
            type="text"
            value={minimaxGroupId}
            onChange={(e) => setMinimaxGroupId(e.target.value)}
            placeholder="Group ID (예: 1940...)"
            className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoComplete="off"
            spellCheck={false}
          />
          <input
            type="password"
            value={minimaxKey}
            onChange={(e) => setMinimaxKey(e.target.value)}
            placeholder="MiniMax Secret Key"
            className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </Section>

      {/* Google TTS */}
      <Section title="🗣️ Google Cloud Text-to-Speech" status={status.googleTts} loading={loading.googleTts} onTest={handleTestGoogleTts} onSave={saveGoogleTts}>
        <input
          type="password"
          value={googleTtsKey}
          onChange={(e) => setGoogleTtsKey(e.target.value)}
          placeholder="Google Cloud API Key (Text-to-Speech)"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>
    </div>
  );
}

/* ---------- 재사용 컴포넌트 ---------- */

function Section({ title, status, loading, onTest, onSave, children }) {
  const borderClass = useMemo(() => {
    if (!status) return "border-gray-200"; // Not tested
    if (status.ok === true) return "border-green-300"; // Connected
    if (status.ok === false) return "border-red-300"; // Failed
    return "border-gray-200"; // Saved (ok === null)
  }, [status]);

  return (
    <div className={`p-4 rounded-xl border ${borderClass} bg-white`}>
      <div className="flex items-center justify-between mb-2">
        <label className="font-medium text-sm">{title}</label>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-center gap-2 w-full">{children}</div>

      <div className="mt-3 flex items-center gap-3">
        <button onClick={onSave} className="text-sm px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
          저장
        </button>
        <button
          onClick={onTest}
          disabled={loading}
          className="text-sm px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-60 flex items-center gap-2"
        >
          {loading && <Spinner />}
          {loading ? "테스트 중..." : "테스트"}
        </button>
        {status?.ts && <span className="text-xs text-gray-500">마지막 확인: {new Date(status.ts).toLocaleTimeString()}</span>}
      </div>

      {status?.msg && (
        <p className={`text-xs mt-2 ${status.ok === false ? "text-red-600" : status.ok === true ? "text-green-600" : "text-gray-600"}`}>{status.msg}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">Not tested</span>;
  if (status.ok === true) return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">✅ Connected</span>;
  if (status.ok === false) return <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">❌ Failed</span>;
  return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">Saved</span>;
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function stringifyErr(m) {
  return typeof m === "string" ? m : JSON.stringify(m ?? "");
}
