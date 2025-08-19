// electron/main.js
const { app } = require("electron");
const { createMainWindow } = require("./utils/window");

// IPC 등록 (모듈 내부에서 ipcMain.handle 등록)
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

app.whenReady().then(createMainWindow);

app.on("activate", () => {
  const { BrowserWindow } = require("electron");
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
