// electron/ipc/tests.js
const { ipcMain } = require("electron");
const axios = require("axios");

/** 간단한 sleep (재시도 백오프) */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 에러 정규화 */
function normalizeError(err) {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data ?? null;
  const message = data?.error?.message || data?.message || err?.message || "Unknown error";
  return { status, message: data || message };
}

/** 포맷 */
const ok = (extra = {}) => ({ ok: true, ...extra });
const fail = (status, message) => ({ ok: false, status, message });

/** ✅ OpenAI */
ipcMain.handle("openai:test", async (_e, apiKey) => {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim().startsWith("sk-")) {
    return fail(400, "유효한 OpenAI API 키(sk-...)를 입력하세요.");
  }
  const url = "https://api.openai.com/v1/chat/completions";
  const payload = {
    model: "gpt-5-mini",
    messages: [{ role: "user", content: "ping" }],
    max_completion_tokens: 5, // GPT-5 계열
  };
  const cfg = {
    headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
    timeout: 15000,
  };
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const r = await axios.post(url, payload, cfg);
      const model = r?.data?.model || r?.data?.choices?.[0]?.model || "gpt-5-mini";
      return ok({ model });
    } catch (err) {
      const { status, message } = normalizeError(err);
      const retry = status === 429 || (status >= 500 && status < 600);
      if (attempt < 2 && retry) {
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      return fail(status, message);
    }
  }
});

/** ✅ Replicate */
ipcMain.handle("replicate:test", async (_e, token) => {
  try {
    if (!token || !token.trim()) return fail(400, "Replicate 토큰을 입력하세요.");
    const r = await axios.get("https://api.replicate.com/v1/models", {
      headers: { Authorization: `Token ${token.trim()}` },
      timeout: 15000,
    });
    return ok({ count: r.data?.results?.length ?? 0 });
  } catch (err) {
    const { status, message } = normalizeError(err);
    return fail(status, message);
  }
});

/** ✅ Anthropic */
ipcMain.handle("anthropic:test", async (_e, apiKey) => {
  try {
    if (!apiKey || !apiKey.trim()) return fail(400, "Anthropic API 키를 입력하세요.");
    const r = await axios.post(
      "https://api.anthropic.com/v1/messages",
      { model: "claude-3-haiku-20240307", max_tokens: 5, messages: [{ role: "user", content: "ping" }] },
      { headers: { "x-api-key": apiKey.trim(), "anthropic-version": "2023-06-01", "content-type": "application/json" }, timeout: 15000 }
    );
    return ok({ model: r.data?.model || "unknown" });
  } catch (err) {
    const { status, message } = normalizeError(err);
    return fail(status, message);
  }
});


/** ✅ Google TTS */
ipcMain.handle("testGoogleTTS", async (_e, apiKey) => {
  try {
    if (!apiKey || !apiKey.trim()) return fail(400, "Google TTS API 키를 입력하세요.");
    const url = `https://texttospeech.googleapis.com/v1/voices?key=${encodeURIComponent(apiKey.trim())}`;
    const r = await axios.get(url, { timeout: 15000 });
    const voices = Array.isArray(r?.data?.voices) ? r.data.voices.length : 0;
    return ok({ voices });
  } catch (err) {
    const { status, message } = normalizeError(err);
    return fail(status, message);
  }
});


/** ✅ Pexels */
ipcMain.handle("pexels:test", async (_e, arg) => {
  const key = (typeof arg === "string" ? arg : arg?.key || "").trim();
  if (!key) return fail(400, "Pexels API 키를 입력하세요.");

  const cfg = { headers: { Authorization: key }, timeout: 15000, validateStatus: () => true };
  const endpoints = ["https://api.pexels.com/videos/search?query=ping&per_page=1", "https://api.pexels.com/v1/search?query=ping&per_page=1"];

  const tryOnce = async (url) => {
    try {
      const r = await axios.get(url, cfg);
      if (r.status === 200) {
        const remaining = r.headers?.["x-ratelimit-remaining"] ?? r.headers?.["ratelimit-remaining"] ?? null;
        const total = r.data?.total_results ?? r.data?.total ?? null;
        return ok({ status: 200, total, remaining, endpoint: url.includes("/videos/") ? "videos" : "photos" });
      }
      return fail(r.status, r.data || r.statusText);
    } catch (err) {
      const { status, message } = normalizeError(err);
      return fail(status, message);
    }
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of endpoints) {
      const res = await tryOnce(url);
      if (res.ok) return res;
      if (!(res.status === 429 || (res.status >= 500 && res.status < 600))) return res;
    }
    await sleep(500 * Math.pow(2, attempt));
  }
  return fail(0, "Pexels 테스트 실패(재시도 초과)");
});

/** ✅ Pixabay */
ipcMain.handle("pixabay:test", async (_e, arg) => {
  const key = (typeof arg === "string" ? arg : arg?.key || "").trim();
  if (!key) return fail(400, "Pixabay API 키를 입력하세요.");

  const tryOnce = async (url, params) => {
    try {
      const r = await axios.get(url, { params, timeout: 15000, validateStatus: () => true });
      if (r.status === 200) {
        const hits = Array.isArray(r.data?.hits) ? r.data.hits.length : 0;
        return ok({ status: 200, hits, endpoint: url.includes("/videos") ? "videos" : "photos" });
      }
      return fail(r.status, r.data || r.statusText);
    } catch (err) {
      const { status, message } = normalizeError(err);
      return fail(status, message);
    }
  };

  const endpoints = [
    { url: "https://pixabay.com/api/", params: { key, q: "ping", image_type: "photo", per_page: 3 } },
    { url: "https://pixabay.com/api/videos/", params: { key, q: "ping", per_page: 3 } },
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const ep of endpoints) {
      const res = await tryOnce(ep.url, ep.params);
      if (res.ok) return res;
      if (!(res.status === 429 || (res.status >= 500 && res.status < 600))) return res;
    }
    await sleep(500 * Math.pow(2, attempt));
  }
  return fail(0, "Pixabay 테스트 실패(재시도 초과)");
});

/** ✅ Google Gemini */
ipcMain.handle("gemini:test", async (_e, apiKey) => {
  try {
    if (!apiKey || !apiKey.trim()) return fail(400, "Gemini API 키를 입력하세요.");
    
    // 먼저 models 목록을 가져와서 API 키가 유효한지 확인
    const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey.trim())}`;
    
    const modelsResponse = await axios.get(modelsUrl, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000
    });
    
    // 사용 가능한 모델이 있으면 성공
    const models = modelsResponse.data?.models || [];
    const geminiModels = models.filter(m => m.name && m.name.includes('gemini'));
    
    if (geminiModels.length > 0) {
      return ok({ 
        model: "gemini-2.5-flash", 
        availableModels: geminiModels.length,
        message: `${geminiModels.length}개의 Gemini 모델 사용 가능`
      });
    }
    
    return fail(404, "사용 가능한 Gemini 모델을 찾을 수 없습니다.");
    
  } catch (err) {
    const { status, message } = normalizeError(err);
    console.error("[Gemini Test Error]", err.response?.data || err.message);
    return fail(status, message);
  }
});
