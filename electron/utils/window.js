// electron/utils/window.js
const { BrowserWindow, Menu } = require("electron");
const path = require("path");

/* =============================================================================
 * 런타임 플래그
 *  - dev 모드에선 기본으로 DevTools 자동 오픈(분리형 창)
 *  - 필요 시 OPEN_DEVTOOLS=0 로 끌 수 있음
 * ============================================================================= */
const isDev =
  !!process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV !== "production";
const autoOpenDevtools =
  (process.env.OPEN_DEVTOOLS ?? (isDev ? "1" : "0")) !== "0";

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: "#f5f7fa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true, // ✅ DevTools 사용 허용
      preload: path.join(__dirname, "..", "preload.js"),
      webviewTag: true,
    },
  });

  // 메뉴 제거(단축키로 DevTools 열 수 있음)
  Menu.setApplicationMenu(null);

  const url = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";
  win.loadURL(url);

  /* =============================================================================
   * DevTools 관련
   * 1) F12 / Ctrl+Shift+I 로 DevTools 토글 (분리형)
   * 2) (dev 기본) 앱 로드시 자동으로 DevTools 분리형 창 오픈
   * ============================================================================= */
  // (1) 단축키 토글
  win.webContents.on("before-input-event", (event, input) => {
    const key = String(input.key || "").toLowerCase();
    if ((input.control || input.meta) && input.shift && key === "i") {
      win.webContents.openDevTools({ mode: "detach", activate: true });
      event.preventDefault();
    }
    if (key === "f12") {
      win.webContents.openDevTools({ mode: "detach", activate: true });
      event.preventDefault();
    }
  });

  // (2) 자동 오픈: 렌더러가 DOM 준비되면 한 번만 분리형 DevTools 오픈
  if (autoOpenDevtools) {
    win.webContents.once("dom-ready", () => {
      if (!win.webContents.isDevToolsOpened()) {
        win.webContents.openDevTools({ mode: "detach", activate: true });
      }
    });
  }

  // (옵션) 개발 중 우클릭 → 요소 검사
  if (isDev) {
    win.webContents.on("context-menu", (_e, params) => {
      win.webContents.inspectElement(params.x, params.y);
    });
  }

  // 디버그 로그
  win.webContents.on("did-finish-load", () => {
    console.log("[main] window loaded:", url);
  });
  win.webContents.on("crashed", () => {
    console.error("[main] renderer crashed");
  });

  return win;
}

module.exports = { createMainWindow };
