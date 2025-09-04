import React, { useEffect, useMemo, useState } from "react";

export default function ApiTab() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");

  const [pexelsKey, setPexelsKey] = useState("");
  const [pixabayKey, setPixabayKey] = useState("");


  const [googleTtsKey, setGoogleTtsKey] = useState("");
  const [imagen3ServiceAccount, setImagen3ServiceAccount] = useState("");

  const [status, setStatus] = useState({
    openai: null,
    anthropic: null,
    replicate: null,
    pexels: null,
    pixabay: null,
    googleTts: null,
    imagen3: null,
  });
  const [loading, setLoading] = useState({
    openai: false,
    anthropic: false,
    replicate: false,
    pexels: false,
    pixabay: false,
    googleTts: false,
    imagen3: false,
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const [ok, ak, rk, gk, pxk, pbk, i3] = await Promise.all([
        window.api.getSecret("openaiKey"),
        window.api.getSecret("anthropicKey"),
        window.api.getSecret("replicateKey"),
        window.api.getSecret("googleTtsApiKey"),
        window.api.getSecret("pexelsApiKey"),
        window.api.getSecret("pixabayApiKey"),
        window.api.getSecret("imagen3ServiceAccount"),
      ]);

      setOpenaiKey(ok || "");
      setAnthropicKey(ak || "");
      setReplicateKey(rk || "");
      setGoogleTtsKey(gk || "");
      setPexelsKey(pxk || "");
      setPixabayKey(pbk || "");
      setImagen3ServiceAccount(i3 || "");
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
  const saveGoogleTts = async () => {
    await window.api.setSecret({ key: "googleTtsApiKey", value: (googleTtsKey || "").trim() });
    setSaved("googleTts");
    setToast({ type: "success", text: "Google TTS 키 저장 완료" });
  };
  const saveImagen3 = async () => {
    await window.api.setSecret({ key: "imagen3ServiceAccount", value: (imagen3ServiceAccount || "").trim() });
    setSaved("imagen3");
    setToast({ type: "success", text: "Imagen3 서비스 계정 저장 완료" });
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

  const handleTestImagen3 = async () => {
    if (!imagen3ServiceAccount?.trim()) {
      setToast({ type: "error", text: "Imagen3 서비스 계정 JSON을 입력하세요." });
      setStat("imagen3", false, "서비스 계정 미입력");
      return;
    }
    setBusy("imagen3", true);
    setStat("imagen3", false, "");
    try {
      const res = await window.api.testImagen3?.(imagen3ServiceAccount.trim());
      res?.ok ? setStat("imagen3", true, "연결 성공") : setStat("imagen3", false, `실패: ${stringifyErr(res?.message)}`);
      setToast({ type: res?.ok ? "success" : "error", text: res?.ok ? "Imagen3 연결 성공" : "Imagen3 실패" });
    } catch (e) {
      setStat("imagen3", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Imagen3 오류" });
    } finally {
      setBusy("imagen3", false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast */}
      <div aria-live="polite" className="pointer-events-none fixed right-6 top-6 z-50">
        {toast && (
          <div className={`pointer-events-auto px-4 py-3 rounded-lg shadow-large text-white font-medium animate-slide-up ${
            toast.type === "success" ? "bg-success-600" : "bg-error-600"
          }`}>
            <div className="flex items-center gap-2">
              {toast.type === "success" ? "✅" : "❌"}
              {toast.text}
            </div>
          </div>
        )}
      </div>

      {/* OpenAI */}
      <Section title="🧠 OpenAI API Key" status={status.openai} loading={loading.openai} onTest={handleTestOpenAI} onSave={saveOpenAI}>
        <input
          type="password"
          className="input-field"
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
          className="input-field"
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
          className="input-field"
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
          className="input-field"
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
          className="input-field"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>


      {/* Google TTS */}
      <Section title="🗣️ Google Cloud Text-to-Speech" status={status.googleTts} loading={loading.googleTts} onTest={handleTestGoogleTts} onSave={saveGoogleTts}>
        <input
          type="password"
          value={googleTtsKey}
          onChange={(e) => setGoogleTtsKey(e.target.value)}
          placeholder="Google Cloud API Key (Text-to-Speech)"
          className="input-field"
          autoComplete="off"
          spellCheck={false}
        />
      </Section>

      {/* Google Imagen3 */}
      <Section title="🎨 Google Imagen3" status={status.imagen3} loading={loading.imagen3} onTest={handleTestImagen3} onSave={saveImagen3}>
        <div className="w-full">
          <textarea
            value={imagen3ServiceAccount}
            onChange={(e) => setImagen3ServiceAccount(e.target.value)}
            placeholder="Google Cloud 서비스 계정 JSON (전체 내용)"
            className="input-field w-full h-32 font-mono text-sm resize-y"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => setImagen3ServiceAccount(e.target.result);
                    reader.readAsText(file);
                  }
                };
                input.click();
              }}
              className="btn-ghost text-sm"
            >
              📁 JSON 파일 선택
            </button>
            <span className="text-xs text-neutral-500">
              다운로드한 서비스 계정 JSON 파일의 내용을 붙여넣거나 파일을 선택하세요
            </span>
          </div>
        </div>
      </Section>
    </div>
  );
}

/* ---------- 재사용 컴포넌트 ---------- */

function Section({ title, status, loading, onTest, onSave, children }) {
  const borderClass = useMemo(() => {
    if (!status) return "border-neutral-200"; // Not tested
    if (status.ok === true) return "border-success-300 shadow-medium"; // Connected
    if (status.ok === false) return "border-error-300"; // Failed
    return "border-neutral-200"; // Saved (ok === null)
  }, [status]);

  return (
    <div className={`card ${borderClass}`}>
      <div className="card-header">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-base text-neutral-900">
            {title}
          </label>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="card-body">
        <div className="flex items-center gap-3 w-full mb-4">{children}</div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onSave} className="btn-secondary">
              💾 저장
            </button>
            <button
              onClick={onTest}
              disabled={loading}
              className="btn-primary"
            >
              {loading && <div className="loading-spinner mr-2" />}
              {loading ? "테스트 중..." : "🧪 테스트"}
            </button>
          </div>
          
          {status?.ts && (
            <span className="text-xs text-neutral-400">
              마지막 확인: {new Date(status.ts).toLocaleTimeString()}
            </span>
          )}
        </div>

        {status?.msg && (
          <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${
            status.ok === false 
              ? "bg-error-50 text-error-700" 
              : status.ok === true 
                ? "bg-success-50 text-success-700" 
                : "bg-neutral-50 text-neutral-700"
          }`}>
            {status.msg}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status) return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
      ⏳ 미테스트
    </span>
  );
  if (status.ok === true) return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700 border border-success-200">
      ✅ 연결됨
    </span>
  );
  if (status.ok === false) return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-error-100 text-error-700 border border-error-200">
      ❌ 실패
    </span>
  );
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700 border border-primary-200">
      💾 저장됨
    </span>
  );
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
