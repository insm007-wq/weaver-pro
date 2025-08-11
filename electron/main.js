// main.js
const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require("path");
const axios = require("axios");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"), // 렌더러 <-> main 브리지
    },
  });

  // 메뉴바 제거
  Menu.setApplicationMenu(null);

  // 웹 앱 로드 (Vite dev 서버)
  win.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");

  // 필요 시 디버깅
  // win.webContents.openDevTools({ mode: "detach" });
}

/* ---------------- IPC: API 연결 테스트 ---------------- */

// ✅ Replicate 연결 테스트
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

// ✅ Anthropic 연결 테스트
ipcMain.handle("anthropic:test", async (_e, apiKey) => {
  try {
    const r = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-haiku-20240307", // 가볍게 핑 테스트
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

// ✅ MiniMax 연결 테스트
// payload: { key: string, groupId: string }
ipcMain.handle("minimax:test", async (_e, payload) => {
  const { key, groupId } = payload || {};
  try {
    const r = await axios.post(
      "https://api.minimax.chat/v1/text/chatcompletion",
      {
        model: "abab5.5-chat", // 가벼운 모델로 ping
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
    // 응답 예: { model, choices: [ { message: { content } } ] }
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

/* ---------------- 앱 라이프사이클 ---------------- */

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
