// electron/main.js
const { app } = require("electron");
const path = require("path");
const { createMainWindow } = require("./utils/window");
const { registerCanvaBrowse } = require("./ipc/canva-browse");
const { registerCanvaDownloads } = require("./ipc/canva-downloads"); // ✅
const { registerCanvaAuth } = require("./ipc/canva-auth"); // ✅

// ✅ 캐시/서비스워커가 쓸 수 있는 안전한 폴더로 변경 (권한 오류 방지)
const baseUserData = path.join(
  process.env.CW_BASE_DIR || "C:\\ContentWeaver",
  "electron_data"
);
app.setPath("userData", baseUserData);
// (선택) GPU 캐시 에러 로그 줄이고 싶으면 아래도 가능
// app.disableHardwareAcceleration();

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
  registerCanvaDownloads(); // ✅ webview(persist:canva) 다운로드 가로채기
  registerCanvaAuth(); // ✅ 로그인 체크/초기화 IPC
  registerCanvaBrowse(); // (팝업 브라우저 쓰면 유지)
  createMainWindow();
});

app.on("activate", () => {
  const { BrowserWindow } = require("electron");
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
