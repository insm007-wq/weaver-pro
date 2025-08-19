import React, { useEffect, useMemo, useState } from "react";

/**
 * API 탭 (단순화 버전)
 * - 각 서비스 키 입력/저장/테스트
 * - MiniMax: groupId / key 둘 다 한 줄 입력
 * - 저장 시에는 trim 정도만 적용
 */
export default function ApiTab() {
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [replicateKey, setReplicateKey] = useState("");

  // MiniMax (표준 키 이름: minimaxGroupId / minimaxKey)
  const [minimaxGroupId, setMinimaxGroupId] = useState("");
  const [minimaxKey, setMinimaxKey] = useState("");

  // Google TTS
  const [googleTtsKey, setGoogleTtsKey] = useState("");

  const [status, setStatus] = useState({
    openai: null,
    anthropic: null,
    replicate: null,
    minimax: null,
    googleTts: null,
  });
  const [loading, setLoading] = useState({
    openai: false,
    anthropic: false,
    replicate: false,
    minimax: false,
    googleTts: false,
  });
  const [toast, setToast] = useState(null);

  // 초기 로드: 저장된 값 불러오기 (하위호환 포함)
  useEffect(() => {
    (async () => {
      const [ok, ak, rk, gidSecret, gidOldSetting, mk, gk] = await Promise.all([
        window.api.getSecret("openaiKey"),
        window.api.getSecret("anthropicKey"),
        window.api.getSecret("replicateKey"),
        window.api.getSecret("minimaxGroupId"), // 표준 저장 위치
        window.api.getSetting("miniMaxGroupId"), // (구) settings → 하위호환
        window.api.getSecret("minimaxKey"),
        window.api.getSecret("googleTtsApiKey"),
      ]);

      // (구) settings에 있던 miniMaxGroupId를 secrets로 승격 (있으면)
      if (!gidSecret && gidOldSetting) {
        try {
          await window.api.setSecret({
            key: "minimaxGroupId",
            value: String(gidOldSetting || "").trim(),
          });
        } catch {
          /* ignore */
        }
      }

      setOpenaiKey(ok || "");
      setAnthropicKey(ak || "");
      setReplicateKey(rk || "");
      setMinimaxGroupId((gidSecret || gidOldSetting || "").trim());
      setMinimaxKey(mk || "");
      setGoogleTtsKey(gk || "");
    })();
  }, []);

  // 토스트 자동 제거
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const setBusy = (k, v) => setLoading((s) => ({ ...s, [k]: v }));
  const setStat = (k, ok, msg) =>
    setStatus((s) => ({ ...s, [k]: { ok, msg, ts: Date.now() } }));

  /* ---------------- 저장 ---------------- */

  const saveOpenAI = async () => {
    await window.api.setSecret({
      key: "openaiKey",
      value: (openaiKey || "").trim(),
    });
    setToast({ type: "success", text: "OpenAI 키 저장 완료" });
  };

  const saveAnthropic = async () => {
    await window.api.setSecret({
      key: "anthropicKey",
      value: (anthropicKey || "").trim(),
    });
    setToast({ type: "success", text: "Anthropic 키 저장 완료" });
  };

  const saveReplicate = async () => {
    await window.api.setSecret({
      key: "replicateKey",
      value: (replicateKey || "").trim(),
    });
    setToast({ type: "success", text: "Replicate 토큰 저장 완료" });
  };

  const saveMiniMax = async () => {
    await Promise.all([
      window.api.setSecret({
        key: "minimaxGroupId",
        value: (minimaxGroupId || "").trim(),
      }),
      window.api.setSecret({
        key: "minimaxKey",
        value: (minimaxKey || "").trim(),
      }),
    ]);
    setToast({ type: "success", text: "MiniMax 설정 저장 완료" });
  };

  const saveGoogleTts = async () => {
    await window.api.setSecret({
      key: "googleTtsApiKey",
      value: (googleTtsKey || "").trim(),
    });
    setToast({ type: "success", text: "Google TTS 키 저장 완료" });
  };

  /* ---------------- 테스트 ---------------- */

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
        ? setStat(
            "openai",
            true,
            `연결 성공 (model: ${res?.model ?? "gpt-5-mini"})`
          )
        : setStat(
            "openai",
            false,
            `실패: ${res?.status ?? ""} ${stringifyErr(res?.message)}`
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

  const handleTestAnthropic = async () => {
    setBusy("anthropic", true);
    setStat("anthropic", false, "");
    try {
      const res = await window.api.testAnthropic?.(anthropicKey.trim());
      res?.ok
        ? setStat("anthropic", true, "연결 성공")
        : setStat("anthropic", false, `실패: ${stringifyErr(res?.message)}`);
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

  const handleTestReplicate = async () => {
    setBusy("replicate", true);
    setStat("replicate", false, "");
    try {
      const res = await window.api.testReplicate?.(replicateKey.trim());
      res?.ok
        ? setStat("replicate", true, `연결 성공 (models: ${res.count})`)
        : setStat(
            "replicate",
            false,
            `실패: ${res?.status ?? ""} ${stringifyErr(res?.message)}`
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

  const handleTestMiniMax = async () => {
    setBusy("minimax", true);
    setStat("minimax", false, "");
    try {
      let res = null;
      if (typeof window.api.testMiniMax === "function") {
        res = await window.api.testMiniMax({
          key: (minimaxKey || "").trim(),
          groupId: (minimaxGroupId || "").trim(),
        });
      } else if (typeof window.api.invoke === "function") {
        res = await window.api.invoke("minimax:test");
      }
      res?.ok
        ? setStat("minimax", true, "연결 성공")
        : setStat("minimax", false, `실패: ${stringifyErr(res?.message)}`);
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

  const handleTestGoogleTts = async () => {
    setBusy("googleTts", true);
    setStat("googleTts", false, "");
    try {
      if (typeof window.api.testGoogleTTS !== "function") {
        setStat("googleTts", true, "키 저장됨 (테스트 함수 미구현)");
        setToast({ type: "success", text: "Google TTS 키 확인(간이)" });
      } else {
        const res = await window.api.testGoogleTTS(googleTtsKey.trim());
        res?.ok
          ? setStat("googleTts", true, "연결 성공")
          : setStat("googleTts", false, `실패: ${stringifyErr(res?.message)}`);
        setToast({
          type: res?.ok ? "success" : "error",
          text: res?.ok ? "Google TTS 연결 성공" : "Google TTS 실패",
        });
      }
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

      {/* OpenAI */}
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
          autoComplete="off"
          spellCheck={false}
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
          autoComplete="off"
          spellCheck={false}
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
          autoComplete="off"
          spellCheck={false}
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
          autoComplete="off"
          spellCheck={false}
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

      <div className="flex items-center gap-2 w-full">{children}</div>

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

/* ---------- helpers ---------- */
function stringifyErr(m) {
  return typeof m === "string" ? m : JSON.stringify(m ?? "");
}
