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
    width: 1440,
    height: 1000,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: "#f5f7fa",
    icon: path.join(__dirname, "..", "assets", "icon.png"), // 크로스 플랫폼용 아이콘
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

  // Vite 서버 URL 확인 (포트가 변경될 수 있음)
  const url = process.env.VITE_DEV_SERVER_URL ||
    process.env.VITE_PORT ? `http://localhost:${process.env.VITE_PORT}` :
    "http://localhost:5173";

  console.log("[window] Loading URL:", url);

  // 포트 폴백 시도 함수
  const tryPorts = async (ports) => {
    for (const port of ports) {
      try {
        const testUrl = `http://localhost:${port}`;
        console.log(`[window] Trying port ${port}...`);
        await win.loadURL(testUrl);
        console.log(`[window] Successfully connected to port ${port}`);
        return;
      } catch (err) {
        console.warn(`[window] Failed to connect to port ${port}:`, err.message);
      }
    }
    console.error("[window] All ports failed, no Vite server found");
  };

  // URL 로드 시도
  win.loadURL(url).catch(async (err) => {
    console.error("[window] Failed to load URL:", err);
    // 여러 포트로 폴백 시도
    const fallbackPorts = [5173, 5174, 5175, 3000, 4000];
    await tryPorts(fallbackPorts);
  });

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

  // (2) 자동 오픈: 무조건 개발자 도구 열기
  // DOM 준비되면 열기
  win.webContents.once("dom-ready", () => {
    console.log("[window] DOM ready, opening DevTools...");
    win.webContents.openDevTools({ mode: "detach", activate: true });
  });
  
  // 창이 표시되면 한 번 더 시도
  win.once("ready-to-show", () => {
    console.log("[window] Window ready to show, opening DevTools...");
    if (!win.webContents.isDevToolsOpened()) {
      win.webContents.openDevTools({ mode: "detach", activate: true });
    }
    win.show();
  });

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
