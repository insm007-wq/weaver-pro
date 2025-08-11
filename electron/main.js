// main.js
const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
const keytar = require("keytar");
const Store = require("electron-store");
const Replicate = require("replicate");

const store = new Store({ name: "settings" });
const SERVICE = "ContentWeaverPro"; // keytar 서비스명

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: "#f5f7fa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  Menu.setApplicationMenu(null);
  win.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");
  // win.webContents.openDevTools({ mode: "detach" });
}

/* ===================== API 연결 테스트 IPC ===================== */

// ✅ Replicate
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
      message: err?.response?.data || err?.message || "Unknown error",
    };
  }
});

// ✅ Anthropic
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
      message: err?.response?.data || err?.message || "Unknown error",
    };
  }
});

// ✅ MiniMax
ipcMain.handle("minimax:test", async (_e, { key, groupId }) => {
  try {
    const r = await axios.post(
      "https://api.minimax.chat/v1/text/chatcompletion",
      {
        model: "abab5.5-chat",
        messages: [{ role: "user", content: "ping" }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-Group-Id": groupId,
        },
        timeout: 15000,
      }
    );
    const choice = r.data?.choices?.[0];
    return { ok: true, model: r.data?.model, reply: choice?.message?.content };
  } catch (err) {
    return {
      ok: false,
      status: err?.response?.status,
      message: err?.response?.data || err?.message || "Unknown error",
    };
  }
});

/* ===================== Replicate 썸네일 생성 IPC ===================== */
async function resolveLatestVersionId(slug, auth) {
  const [owner, name] = (slug || "").split("/");
  if (!owner || !name) throw new Error(`Invalid model slug: ${slug}`);
  const headers = { Authorization: `Token ${auth}` };

  try {
    const r = await axios.get(
      `https://api.replicate.com/v1/models/${owner}/${name}/versions?limit=1`,
      { headers, timeout: 15000 }
    );
    const id = r?.data?.results?.[0]?.id;
    if (id) return id;
  } catch (_) {}

  try {
    const r = await axios.get(
      `https://api.replicate.com/v1/models/${owner}/${name}`,
      { headers, timeout: 15000 }
    );
    const id = r?.data?.latest_version?.id;
    if (id) return id;
  } catch (_) {}

  return null;
}

ipcMain.handle("replicate:generate", async (_e, payload = {}) => {
  const { prompt, referenceImage, count = 1, modelHint, token } = payload;

  try {
    const saved = await keytar.getPassword(SERVICE, "replicateKey");
    const auth = token || saved || process.env.REPLICATE_API_TOKEN;
    if (!auth) {
      return { ok: false, message: "Replicate API Token이 없습니다." };
    }

    let slug;
    if (modelHint) {
      if (modelHint === "flux-dev") slug = "black-forest-labs/flux-dev";
      else if (modelHint === "sdxl") slug = "stability-ai/sdxl";
      else slug = "black-forest-labs/flux-schnell";
    } else {
      slug = referenceImage
        ? "stability-ai/sdxl"
        : "black-forest-labs/flux-schnell";
    }

    const versionId = await resolveLatestVersionId(slug, auth);
    if (!versionId) {
      return { ok: false, message: `모델 버전 조회 실패: ${slug}` };
    }

    const input = {
      prompt,
      num_outputs: count,
      aspect_ratio: "16:9",
    };
    if (referenceImage) {
      input.image = referenceImage;
    }

    const replicate = new Replicate({ auth });
    let prediction = await replicate.predictions.create({
      version: versionId,
      input,
    });

    while (["starting", "processing", "queued"].includes(prediction.status)) {
      await new Promise((r) => setTimeout(r, 1200));
      prediction = await replicate.predictions.get(prediction.id);
    }

    if (prediction.status !== "succeeded") {
      return {
        ok: false,
        message: prediction?.error || `status: ${prediction.status}`,
      };
    }

    const images = Array.isArray(prediction.output)
      ? prediction.output
      : prediction.output
      ? [prediction.output]
      : [];

    return { ok: true, images, prompt: input.prompt };
  } catch (err) {
    return {
      ok: false,
      message: err?.response?.data || err?.message || "Replicate error",
    };
  }
});

/* ===================== 설정/시크릿 저장 IPC ===================== */
// electron-store
ipcMain.handle("settings:get", async (_e, key) => {
  return store.get(key);
});
ipcMain.handle("settings:set", async (_e, { key, value }) => {
  store.set(key, value);
  return { ok: true };
});

// keytar
ipcMain.handle("secrets:get", async (_e, key) => {
  return keytar.getPassword(SERVICE, key);
});
ipcMain.handle("secrets:set", async (_e, { key, value }) => {
  await keytar.setPassword(SERVICE, key, value || "");
  return { ok: true };
});

/* ===================== 헬스 체크 IPC ===================== */
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
async function pingMiniMax(key, groupId) {
  if (!key || !groupId)
    return { state: "missing", detail: !key ? "no key" : "no groupId" };
  try {
    await axios.post(
      "https://api.minimax.chat/v1/text/chatcompletion",
      { model: "abab5.5-chat", messages: [{ role: "user", content: "ping" }] },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          "X-Group-Id": groupId,
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
  const [anthropicKey, replicateKey, miniMaxKey, miniMaxGroupId] =
    await Promise.all([
      keytar.getPassword(SERVICE, "anthropicKey"),
      keytar.getPassword(SERVICE, "replicateKey"),
      keytar.getPassword(SERVICE, "miniMaxKey"),
      Promise.resolve(store.get("miniMaxGroupId")),
    ]);

  const [anthropic, replicate, minimax] = await Promise.all([
    pingAnthropic(anthropicKey),
    pingReplicate(replicateKey),
    pingMiniMax(miniMaxKey, miniMaxGroupId),
  ]);

  return { ok: true, timestamp: Date.now(), anthropic, replicate, minimax };
});

/* ===================== 앱 라이프사이클 ===================== */
app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
