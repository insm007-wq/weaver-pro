// electron/ipc/health.js
const { ipcMain } = require("electron");
const axios = require("axios");
const store = require("../services/store");
const { getSecret } = require("../services/secrets");

async function pingReplicate(token) {
  if (!token) return { state: "missing", detail: "no token" };
  try {
    const r = await axios.get("https://api.replicate.com/v1/models", {
      headers: { Authorization: `Token ${token}` },
      timeout: 12000,
    });
    return { state: "ok", detail: `models: ${r.data?.results?.length ?? 0}` };
  } catch (e) {
    return { state: "fail", detail: e?.response?.status || e?.message };
  }
}
async function pingAnthropic(apiKey) {
  if (!apiKey) return { state: "missing", detail: "no key" };
  try {
    await axios.post(
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
        timeout: 12000,
      }
    );
    return { state: "ok", detail: "reachable" };
  } catch (e) {
    return { state: "fail", detail: e?.response?.status || e?.message };
  }
}

ipcMain.handle("health:check", async () => {
  const [anthropicKey, replicateKey] = await Promise.all([
    getSecret("anthropicKey"),
    getSecret("replicateKey"),
  ]);

  const [anthropic, replicate] = await Promise.all([
    pingAnthropic(anthropicKey),
    pingReplicate(replicateKey),
  ]);

  return { ok: true, timestamp: Date.now(), anthropic, replicate };
});
