// electron/main.js
const { app } = require("electron");
const { createMainWindow } = require("./utils/window");

// IPC 등록
require("./ipc/tests");
require("./ipc/replicate");
require("./ipc/settings");
require("./ipc/health");

app.whenReady().then(createMainWindow);
app.on("activate", () => {
  const { BrowserWindow } = require("electron");
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
