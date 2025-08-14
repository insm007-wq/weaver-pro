// electron/ipc/tests.js
const { ipcMain } = require("electron");
const axios = require("axios");

/** 간단한 sleep (재시도 백오프에 사용) */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 에러 객체를 안전하게 정규화 */
function normalizeError(err) {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data ?? null;
  const message =
    data?.error?.message || data?.message || err?.message || "Unknown error";
  return { status, message: data || message };
}

/**
 * ✅ OpenAI 연결 테스트 (안전 버전)
 * - GPT-5 계열: max_completion_tokens 사용 (max_tokens 금지)
 * - temperature 파라미터 전송하지 않음 (기본값 1만 허용하는 모델 존재)
 * - 키 미입력 가드 + 429/5xx 재시도(최대 2회) + 타임아웃
 */
ipcMain.handle("openai:test", async (_e, apiKey) => {
  if (
    !apiKey ||
    typeof apiKey !== "string" ||
    !apiKey.trim().startsWith("sk-")
  ) {
    return {
      ok: false,
      status: 400,
      message: "유효한 OpenAI API 키(sk-...)를 입력하세요.",
    };
  }

  const url = "https://api.openai.com/v1/chat/completions";
  const payload = {
    model: "gpt-5-mini",
    messages: [{ role: "user", content: "ping" }],
    max_completion_tokens: 5, // ✅ GPT-5 계열 파라미터
    // temperature 전송 안 함: 일부 모델은 기본값(1)만 허용
  };
  const config = {
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    timeout: 15000,
    // 4xx/5xx를 throw 하게 둠
  };

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const r = await axios.post(url, payload, config);
      // 일부 응답은 r.data.model 대신 r.data.choices[0].model 등에 담길 수 있음 → 방어적으로 처리
      const modelName =
        r?.data?.model || r?.data?.choices?.[0]?.model || "gpt-5-mini";
      return { ok: true, model: modelName };
    } catch (err) {
      const { status, message } = normalizeError(err);

      // 재시도 조건: 429(레이트/쿼터) 또는 5xx(일시 오류)
      const canRetry = status === 429 || (status >= 500 && status < 600);
      if (attempt < maxRetries && canRetry) {
        // 지수 백오프 (0.5s, 1s)
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      return { ok: false, status, message };
    }
  }
});

/**
 * (기존) Replicate 연결 테스트
 * - 토큰/권한 확인용
 */
ipcMain.handle("replicate:test", async (_e, token) => {
  try {
    if (!token || typeof token !== "string" || !token.trim()) {
      return {
        ok: false,
        status: 400,
        message: "Replicate 토큰을 입력하세요.",
      };
    }
    const r = await axios.get("https://api.replicate.com/v1/models", {
      headers: { Authorization: `Token ${token.trim()}` },
      timeout: 15000,
    });
    return { ok: true, count: r.data?.results?.length ?? 0 };
  } catch (err) {
    return normalizeError(err) && { ok: false, ...normalizeError(err) };
  }
});

/**
 * (기존) Anthropic 연결 테스트
 * - 간단 ping
 */
ipcMain.handle("anthropic:test", async (_e, apiKey) => {
  try {
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return {
        ok: false,
        status: 400,
        message: "Anthropic API 키를 입력하세요.",
      };
    }
    const r = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      },
      {
        headers: {
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        timeout: 15000,
      }
    );
    return { ok: true, model: r.data?.model || "unknown" };
  } catch (err) {
    return normalizeError(err) && { ok: false, ...normalizeError(err) };
  }
});

/**
 * (기존) MiniMax 연결 테스트
 * - Group ID + Key 필요
 */
ipcMain.handle("minimax:test", async (_e, { key, groupId }) => {
  try {
    if (!key || !groupId) {
      return {
        ok: false,
        status: 400,
        message: "MiniMax Key와 Group ID를 입력하세요.",
      };
    }
    const r = await axios.post(
      "https://api.minimax.chat/v1/text/chatcompletion",
      { model: "abab5.5-chat", messages: [{ role: "user", content: "ping" }] },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-Group-Id": groupId,
        },
        timeout: 15000,
      }
    );
    return { ok: true, model: r.data?.model };
  } catch (err) {
    return normalizeError(err) && { ok: false, ...normalizeError(err) };
  }
});

/** ✅ Google TTS 연결 테스트
 * - API Key로 voices 목록 조회 호출
 * - 성공하면 { ok: true, voices: N } 반환
 */
ipcMain.handle("testGoogleTTS", async (_e, apiKey) => {
  try {
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return {
        ok: false,
        status: 400,
        message: "Google TTS API 키를 입력하세요.",
      };
    }
    const url = `https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(
      apiKey.trim()
    )}`;
    const r = await axios.get(url, { timeout: 15000 });
    const voices = Array.isArray(r?.data?.voices) ? r.data.voices.length : 0;
    return { ok: true, voices };
  } catch (err) {
    const status = err?.response?.status ?? null;
    const data = err?.response?.data ?? null;
    const message =
      data?.error?.message || data?.message || err?.message || "Unknown error";
    return { ok: false, status, message: data || message };
  }
});
