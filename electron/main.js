// electron/main.js
const { app } = require("electron");
const { createMainWindow } = require("./utils/window");
const { registerCanvaBrowse } = require("./ipc/canva-browse");

// 기존 IPC들
require("./ipc/tests");
require("./ipc/replicate");
require("./ipc/settings");
require("./ipc/health");
require("./ipc/image-analyzer");
require("./ipc/files");
require("./ipc/llm/index");
require("./ipc/script");
require("./ipc/tts");
require("./ipc/audio");

const { registerFilePickers } = require("./ipc/file-pickers");

app.whenReady().then(() => {
  registerFilePickers && registerFilePickers();
  registerCanvaBrowse(); // 👈 추가
  createMainWindow();
});

app.on("activate", () => {
  const { BrowserWindow } = require("electron");
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
