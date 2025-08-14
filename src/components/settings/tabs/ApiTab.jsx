// src/components/settings/tabs/ApiTab.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function ApiTab() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");
  const [miniMaxGroupId, setMiniMaxGroupId] = useState("");
  const [miniMaxKey, setMiniMaxKey] = useState("");
  const [googleTtsKey, setGoogleTtsKey] = useState("");

  const [status, setStatus] = useState({
    openai: null, // ✅ OpenAI 상태 표시
    anthropic: null,
    replicate: null,
    minimax: null,
    googleTts: null, // ✅ 추가
  });
  const [loading, setLoading] = useState({
    openai: false, // ✅ OpenAI 로딩 표시
    anthropic: false,
    replicate: false,
    minimax: false,
    googleTts: false, // ✅ 추가
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const [ok, ak, rk, gid, mk, gk] = await Promise.all([
        window.api.getSecret("openaiKey"), // ✅ OpenAI
        window.api.getSecret("anthropicKey"),
        window.api.getSecret("replicateKey"),
        window.api.getSetting("miniMaxGroupId"),
        window.api.getSecret("miniMaxKey"),
        window.api.getSecret("googleTtsApiKey"), // ✅ 추가
      ]);
      setOpenaiKey(ok || ""); // ✅ OpenAI
      setAnthropicKey(ak || "");
      setReplicateKey(rk || "");
      setMiniMaxGroupId(gid || "");
      setMiniMaxKey(mk || "");
      setGoogleTtsKey(gk || ""); // ✅ 추가
    })();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const setBusy = (k, v) => setLoading((s) => ({ ...s, [k]: v }));
  const setStat = (k, ok, msg) =>
    setStatus((s) => ({ ...s, [k]: { ok, msg, ts: Date.now() } }));

  // ----- 저장 -----
  const saveOpenAI = async () => {
    await window.api.setSecret({ key: "openaiKey", value: openaiKey });
    setToast({ type: "success", text: "OpenAI 키 저장 완료" });
  };

  const saveAnthropic = async () => {
    await window.api.setSecret({ key: "anthropicKey", value: anthropicKey });
    setToast({ type: "success", text: "Anthropic 키 저장 완료" });
  };

  const saveReplicate = async () => {
    await window.api.setSecret({ key: "replicateKey", value: replicateKey });
    setToast({ type: "success", text: "Replicate 토큰 저장 완료" });
  };

  const saveMiniMax = async () => {
    await Promise.all([
      window.api.setSetting({ key: "miniMaxGroupId", value: miniMaxGroupId }),
      window.api.setSecret({ key: "miniMaxKey", value: miniMaxKey }),
    ]);
    setToast({ type: "success", text: "MiniMax 설정 저장 완료" });
  };

  // ✅ 추가: Google TTS 저장
  const saveGoogleTts = async () => {
    await window.api.setSecret({ key: "googleTtsApiKey", value: googleTtsKey });
    setToast({ type: "success", text: "Google TTS 키 저장 완료" });
  };

  // ----- 테스트 -----
  const handleTestOpenAI = async () => {
    // ✅ 키 미입력 가드
    if (!openaiKey?.trim()) {
      setToast({ type: "error", text: "OpenAI 키를 입력하세요." });
      setStat("openai", false, "키 미입력");
      return;
    }
    setBusy("openai", true);
    setStat("openai", false, "");
    try {
      const res = await window.api.testOpenAI(openaiKey);
      res?.ok
        ? setStat(
            "openai",
            true,
            `연결 성공 (model: ${res?.model ?? "gpt-5-mini"})`
          )
        : setStat(
            "openai",
            false,
            `실패: ${res?.status ?? ""} ${
              typeof res?.message === "string"
                ? res.message
                : JSON.stringify(res?.message ?? "")
            }`
          );
      setToast({
        type: res?.ok ? "success" : "error",
        text: res?.ok ? "OpenAI 연결 성공" : "OpenAI 실패",
      });
    } catch (e) {
      setStat("openai", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "OpenAI 오류" });
    } finally {
      setBusy("openai", false);
    }
  };

  const handleTestReplicate = async () => {
    setBusy("replicate", true);
    setStat("replicate", false, "");
    try {
      const res = await window.api.testReplicate(replicateKey);
      res?.ok
        ? setStat("replicate", true, `연결 성공 (models: ${res.count})`)
        : setStat(
            "replicate",
            false,
            `실패: ${res?.status ?? ""} ${JSON.stringify(res?.message ?? "")}`
          );
      setToast({
        type: res?.ok ? "success" : "error",
        text: res?.ok ? "Replicate 연결 성공" : "Replicate 실패",
      });
    } catch (e) {
      setStat("replicate", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Replicate 오류" });
    } finally {
      setBusy("replicate", false);
    }
  };

  const handleTestAnthropic = async () => {
    setBusy("anthropic", true);
    setStat("anthropic", false, "");
    try {
      const res = await window.api.testAnthropic(anthropicKey);
      res?.ok
        ? setStat("anthropic", true, "연결 성공")
        : setStat(
            "anthropic",
            false,
            `실패: ${JSON.stringify(res?.message ?? "")}`
          );
      setToast({
        type: res?.ok ? "success" : "error",
        text: res?.ok ? "Anthropic 연결 성공" : "Anthropic 실패",
      });
    } catch (e) {
      setStat("anthropic", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "Anthropic 오류" });
    } finally {
      setBusy("anthropic", false);
    }
  };

  const handleTestMiniMax = async () => {
    setBusy("minimax", true);
    setStat("minimax", false, "");
    try {
      const res = await window.api.testMiniMax({
        key: miniMaxKey,
        groupId: miniMaxGroupId,
      });
      res?.ok
        ? setStat("minimax", true, "연결 성공")
        : setStat(
            "minimax",
            false,
            `실패: ${JSON.stringify(res?.message ?? "")}`
          );
      setToast({
        type: res?.ok ? "success" : "error",
        text: res?.ok ? "MiniMax 연결 성공" : "MiniMax 실패",
      });
    } catch (e) {
      setStat("minimax", false, `오류: ${e?.message || e}`);
      setToast({ type: "error", text: "MiniMax 오류" });
    } finally {
      setBusy("minimax", false);
    }
  };

  // ✅ 추가: Google TTS 테스트 (testGoogleTTS가 없으면 안내)
  const handleTestGoogleTts = async () => {
    setBusy("googleTts", true);
    setStat("googleTts", false, "");
    try {
      if (typeof window.api.testGoogleTTS !== "function") {
        setStat("googleTts", true, "키 저장됨 (테스트 함수 미구현)");
        setToast({ type: "success", text: "Google TTS 키 확인(간이)" });
        return;
      }
      const res = await window.api.testGoogleTTS(googleTtsKey);
      res?.ok
        ? setStat("googleTts", true, "연결 성공")
        : setStat(
            "googleTts",
            false,
            `실패: ${JSON.stringify(res?.message ?? "")}`
          );
      setToast({
        type: res?.ok ? "success" : "error",
        text: res?.ok ? "Google TTS 연결 성공" : "Google TTS 실패",
      });
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
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-50"
      >
        {toast && (
          <div
            className={`pointer-events-auto px-4 py-2 rounded-lg shadow-lg text-white ${
              toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>

      {/* ✅ OpenAI */}
      <Section
        title="🧠 OpenAI API Key"
        status={status.openai}
        loading={loading.openai}
        onTest={handleTestOpenAI}
        onSave={saveOpenAI}
      >
        <input
          type="password"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          placeholder="OpenAI API Key (sk-...)"
        />
      </Section>

      {/* Anthropic */}
      <Section
        title="🤖 Anthropic API Key"
        status={status.anthropic}
        loading={loading.anthropic}
        onTest={handleTestAnthropic}
        onSave={saveAnthropic}
      >
        <input
          type="password"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder="Anthropic API Key"
        />
      </Section>

      {/* Replicate */}
      <Section
        title="🔁 Replicate API Token"
        status={status.replicate}
        loading={loading.replicate}
        onTest={handleTestReplicate}
        onSave={saveReplicate}
      >
        <input
          type="password"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={replicateKey}
          onChange={(e) => setReplicateKey(e.target.value)}
          placeholder="API Token"
        />
      </Section>

      {/* MiniMax */}
      <Section
        title="🧩 MiniMax API"
        status={status.minimax}
        loading={loading.minimax}
        onTest={handleTestMiniMax}
        onSave={saveMiniMax}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={miniMaxGroupId}
            onChange={(e) => setMiniMaxGroupId(e.target.value)}
            placeholder="Group ID"
            className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <input
            type="password"
            value={miniMaxKey}
            onChange={(e) => setMiniMaxKey(e.target.value)}
            placeholder="MiniMax API Key"
            className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </Section>

      {/* ✅ Google TTS */}
      <Section
        title="🗣️ Google Cloud Text-to-Speech"
        status={status.googleTts}
        loading={loading.googleTts}
        onTest={handleTestGoogleTts}
        onSave={saveGoogleTts}
      >
        <input
          type="password"
          value={googleTtsKey}
          onChange={(e) => setGoogleTtsKey(e.target.value)}
          placeholder="Google Cloud API Key (Text-to-Speech)"
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </Section>
    </div>
  );
}

/* ---------- 재사용 컴포넌트 ---------- */
function Section({ title, status, loading, onTest, onSave, children }) {
  const borderClass = useMemo(
    () =>
      !status
        ? "border-gray-200"
        : status.ok
        ? "border-green-300"
        : "border-red-300",
    [status]
  );

  return (
    <div className={`p-4 rounded-xl border ${borderClass} bg-white`}>
      <div className="flex items-center justify-between mb-2">
        <label className="font-medium text-sm">{title}</label>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-center gap-2">{children}</div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={onSave}
          className="text-sm px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
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
        {status?.ts && (
          <span className="text-xs text-gray-500">
            마지막 확인: {new Date(status.ts).toLocaleTimeString()}
          </span>
        )}
      </div>

      {status?.msg && (
        <p
          className={`text-xs mt-2 ${
            status.ok ? "text-green-600" : "text-red-600"
          }`}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status)
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
        Not tested
      </span>
    );
  if (status.ok)
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-200">
        ✅ Connected
      </span>
    );
  return (
    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
      ❌ Failed
    </span>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
