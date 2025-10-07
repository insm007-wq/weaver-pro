// electron/utils/window.js
const { BrowserWindow, Menu, app } = require("electron");
const path = require("path");

/* =============================================================================
 * 런타임 플래그
 *  - dev 모드에선 기본으로 DevTools 자동 오픈(분리형 창)
 *  - 필요 시 OPEN_DEVTOOLS=0 로 끌 수 있음
 * ============================================================================= */
const isDev = !app.isPackaged;
const autoOpenDevtools =
  (process.env.OPEN_DEVTOOLS ?? (isDev ? "1" : "0")) !== "0";

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 1280,
    minHeight: 720,
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

  // 개발/프로덕션 URL 로드
  if (isDev) {
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
  } else {
    // 프로덕션: 빌드된 파일 로드
    const indexPath = path.join(__dirname, "..", "..", "dist", "index.html");

    win.loadFile(indexPath).catch((err) => {
      console.error("[window] Failed to load file:", err);
      // 경로가 틀릴 수 있으니 다른 경로도 시도
      const altPath = path.join(app.getAppPath(), "dist", "index.html");
      win.loadFile(altPath).catch((err2) => {
        console.error("[window] All paths failed:", err2);
      });
    });
  }

  /* =============================================================================
   * DevTools 관련
   * 1) F12 / Ctrl+Shift+I 로 DevTools 토글 (분리형) - 항상 사용 가능
   * 2) (dev 모드에서만) 앱 로드시 자동으로 DevTools 분리형 창 오픈
   * ============================================================================= */
  // (1) 단축키 토글 - 개발/프로덕션 모두 사용 가능
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

  // (2) 자동 오픈: 개발 모드에서만
  if (isDev) {
    // DOM 준비되면 열기
    win.webContents.once("dom-ready", () => {
      console.log("[window] DOM ready, opening DevTools...");
      win.webContents.openDevTools({ mode: "detach", activate: true });
    });
  }

  // 창이 표시되면 보여주기
  win.once("ready-to-show", () => {
    console.log("[window] Window ready to show");
    win.show();
  });

  // 프로덕션에서 3초 후에도 안 보이면 강제로 표시 (devtools 없이)
  if (!isDev) {
    setTimeout(() => {
      if (!win.isVisible()) {
        console.log("[window] Force showing window after timeout");
        win.show();
      }
    }, 3000);
  }

  // (옵션) 개발 중 우클릭 → 요소 검사
  if (isDev) {
    win.webContents.on("context-menu", (_e, params) => {
      win.webContents.inspectElement(params.x, params.y);
    });
  }

  // 디버그 로그
  win.webContents.on("did-finish-load", () => {
    console.log("[main] window loaded");
  });
  win.webContents.on("crashed", () => {
    console.error("[main] renderer crashed");
  });

  return win;
}

module.exports = { createMainWindow };
