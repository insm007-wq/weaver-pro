// electron/utils/window.js
const { BrowserWindow, Menu } = require("electron");
const path = require("path");

const isDev = !!process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV !== "production";
const shouldAutoOpenDevtools = isDev || process.env.OPEN_DEVTOOLS === "1";

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: "#f5f7fa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true, // ✅ DevTools 사용 가능하게 보장
      preload: path.join(__dirname, "..", "preload.js"),
    },
  });

  // 메뉴 없애도 단축키로 DevTools 열 수 있게, 아래에서 직접 처리
  Menu.setApplicationMenu(null);

  const url = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  win.loadURL(url);

  // ✅ F12 / Ctrl+Shift+I 강제 토글 (메뉴 없어도 동작)
  win.webContents.on("before-input-event", (event, input) => {
    const key = String(input.key || "").toLowerCase();
    if ((input.control || input.meta) && input.shift && key === "i") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
    if (key === "f12") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // ✅ 개발 중엔 자동으로 DevTools 열기(분리 모드). 필요 없으면 환경변수로 끄기.
  if (shouldAutoOpenDevtools) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  // (선택) 개발 중 오른쪽 클릭 → 요소 검사
  if (isDev) {
    win.webContents.on("context-menu", (_e, params) => {
      win.webContents.inspectElement(params.x, params.y);
    });
  }

  // 디버그용 로그
  win.webContents.on("did-finish-load", () => {
    console.log("[main] window loaded:", url);
  });
  win.webContents.on("crashed", () => {
    console.error("[main] renderer crashed");
  });

  return win;
}

module.exports = { createMainWindow };
