import React, { useEffect, useMemo, useState } from "react";

export default function ApiTab() {
  const [anthropicKey, setAnthropicKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");
  const [miniMaxGroupId, setMiniMaxGroupId] = useState("");
  const [miniMaxKey, setMiniMaxKey] = useState("");

  const [status, setStatus] = useState({
    anthropic: null,
    replicate: null,
    minimax: null,
  });
  const [loading, setLoading] = useState({
    anthropic: false,
    replicate: false,
    minimax: false,
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // 앱 시작 시 저장된 값 불러오기
    (async () => {
      const [ak, rk, gid, mk] = await Promise.all([
        window.api.getSecret("anthropicKey"),
        window.api.getSecret("replicateKey"),
        window.api.getSetting("miniMaxGroupId"),
        window.api.getSecret("miniMaxKey"),
      ]);
      setAnthropicKey(ak || "");
      setReplicateKey(rk || "");
      setMiniMaxGroupId(gid || "");
      setMiniMaxKey(mk || "");
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

  /* ----- 저장 핸들러 ----- */
  const saveAnthropic = async () => {
    await window.api.setSecret("anthropicKey", anthropicKey);
    setToast({ type: "success", text: "Anthropic 키 저장 완료" });
  };
  const saveReplicate = async () => {
    await window.api.setSecret("replicateKey", replicateKey);
    setToast({ type: "success", text: "Replicate 토큰 저장 완료" });
  };
  const saveMiniMax = async () => {
    await Promise.all([
      window.api.setSetting("miniMaxGroupId", miniMaxGroupId),
      window.api.setSecret("miniMaxKey", miniMaxKey),
    ]);
    setToast({ type: "success", text: "MiniMax 설정 저장 완료" });
  };

  /* ----- 테스트 핸들러 (기존과 동일) ----- */
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
