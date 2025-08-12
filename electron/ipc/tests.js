// electron/ipc/tests.js
const { ipcMain } = require("electron");
const axios = require("axios");

ipcMain.handle("replicate:test", async (_e, token) => {
  try {
    const r = await axios.get("https://api.replicate.com/v1/models", {
      headers: { Authorization: `Token ${token}` },
      timeout: 15000,
    });
    return { ok: true, count: r.data?.results?.length ?? 0 };
  } catch (err) {
    return {
      ok: false,
      status: err?.response?.status,
      message: err?.response?.data || err?.message,
    };
  }
});

ipcMain.handle("anthropic:test", async (_e, apiKey) => {
  try {
    const r = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 5,
        messages: [{ role: "user", content: "ping" }],
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        timeout: 15000,
      }
    );
    return { ok: true, model: r.data?.model || "unknown" };
  } catch (err) {
    return {
      ok: false,
      status: err?.response?.status,
      message: err?.response?.data || err?.message,
    };
  }
});

ipcMain.handle("minimax:test", async (_e, { key, groupId }) => {
  try {
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
    return {
      ok: false,
      status: err?.response?.status,
      message: err?.response?.data || err?.message,
    };
  }
});
