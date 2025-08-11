// main.js
const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");
const Store = require("electron-store");
const keytar = require("keytar");

const store = new Store({ name: "settings" });
const SERVICE = "ContentWeaverPro"; // keytar 서비스명

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");
}

/* --------- API 연결 테스트 (그대로 유지) --------- */
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

/* --------- 설정/시크릿 저장소 IPC --------- */
// 일반 설정 저장 (electron-store)
ipcMain.handle("settings:get", async (_e, key) => {
  return store.get(key);
});
ipcMain.handle("settings:set", async (_e, { key, value }) => {
  store.set(key, value);
  return { ok: true };
});

// 민감 정보 저장 (keytar)
ipcMain.handle("secrets:get", async (_e, key) => {
  return keytar.getPassword(SERVICE, key); // 없다면 null
});
ipcMain.handle("secrets:set", async (_e, { key, value }) => {
  await keytar.setPassword(SERVICE, key, value || "");
  return { ok: true };
});

app.whenReady().then(createWindow);
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
