// electron/main.js
require("dotenv").config();

const path = require("path");
const { app, BrowserWindow } = require("electron");

/* =============================================================================
 * 기본 환경
 * ============================================================================= */
const isDev = !app.isPackaged;
if (isDev) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

/* =============================================================================
 * 세이프 리콰이어러 (safeRequire / tryRegister)
 * ============================================================================= */
function safeRequire(label, loader) {
  try {
    const mod = loader();
    console.log(`[load] ${label}: OK`);
    return mod;
  } catch (err) {
    console.warn(`[load] ${label}: FAIL ->`, err?.message || err);
    return null;
  }
}

/** tryRegister(label, mod, fnName = "register") */
async function tryRegister(label, mod, fnName = "register") {
  try {
    const fn = mod && mod[fnName];
    if (typeof fn === "function") {
      const r = fn();
      if (r && typeof r.then === "function") await r;
      console.log(`[ipc] ${label}.${fnName}: OK`);
    } else {
      console.log(`[ipc] ${label}: (auto-registered or no-op)`);
    }
  } catch (err) {
    console.warn(`[ipc] ${label}: FAILED ->`, err?.message || err);
  }
}

/* =============================================================================
 * 메인 윈도우 (utils/window 없을 때 폴백 제공)
 * ============================================================================= */
function createWindowFallback() {
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";

  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // 렌더러 콘솔 로그 브릿지
  win.webContents.on("console-message", (_e, level, msg) => console.log("[renderer]", level, msg));

  if (isDev) {
    win.loadURL(VITE_DEV_SERVER_URL).catch((e) => console.error("loadURL:", e));
    // win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html")).catch((e) => console.error("loadFile:", e));
  }

  win.once("ready-to-show", () => win.show());
  return win;
}

/* utils/window가 있으면 사용, 없으면 폴백 */
const winUtil = safeRequire("utils/window", () => require("./utils/window"));
const createMainWindow = (winUtil && winUtil.createMainWindow) || createWindowFallback;

/* =============================================================================
 * 싱글 인스턴스
 * ============================================================================= */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    if (process.platform === "win32") {
      app.setAppUserModelId(process.env.APP_ID || "weaver-pro");
    }

    /* -----------------------------------------------------------------------
     * ✅ IPC 등록 (항상 창 생성 전에!)
     * -------------------------------------------------------------------- */
    // 파일 선택/저장 등
    const pickers = safeRequire("ipc/file-pickers", () => require("./ipc/file-pickers"));
    await tryRegister("file-pickers", pickers, "registerFilePickers");

    // 프로젝트 파일/스트리밍 저장
    const files = safeRequire("ipc/files", () => require("./ipc/files"));
    // files 모듈은 require 시 내부에서 ipcMain.handle 등록 → tryRegister 불필요
    // 필요 시 아래 줄 사용:
    // await tryRegister("files", files, "registerFilesIPC");

    // 스톡 검색(Pexels/Pixabay)
    const stock = safeRequire("ipc/stock", () => require("./ipc/stock"));
    await tryRegister("stock", stock, "registerStockIPC");

    // AI 키워드/용어 번역 (ai:extractKeywords / ai:translateTerms 모두 이 모듈)
    const aiKeywords = safeRequire("ipc/ai-keywords", () => require("./ipc/ai-keywords"));
    await tryRegister("ai-keywords", aiKeywords, "registerAIKeywords");

    // 헬스/설정/기타
    safeRequire("ipc/tests", () => require("./ipc/tests"));
    safeRequire("ipc/replicate", () => require("./ipc/replicate"));
    safeRequire("ipc/settings", () => require("./ipc/settings"));
    safeRequire("ipc/health", () => require("./ipc/health"));
    safeRequire("ipc/image-analyzer", () => require("./ipc/image-analyzer"));
    safeRequire("ipc/llm/index", () => require("./ipc/llm/index"));
    safeRequire("ipc/script", () => require("./ipc/script"));
    safeRequire("ipc/tts", () => require("./ipc/tts"));
    safeRequire("ipc/audio", () => require("./ipc/audio"));

    // ✅ 초안 내보내기(프리뷰) IPC 등록
    // - 채널: preview:compose / preview:cancel / (send) preview:progress
    const preview = safeRequire("ipc/preview", () => require("./ipc/preview"));
    await tryRegister("preview", preview, "register");

    // ✅ Canva IPC 등록
    const canvaIpc = safeRequire("ipc/canva", () => require("./ipc/canva"));
    await tryRegister("canva", canvaIpc, "register");

    /* -----------------------------------------------------------------------
     * 메인 윈도우
     * -------------------------------------------------------------------- */
    createMainWindow();

    /* -----------------------------------------------------------------------
     * (개발 전용) 네비게이션 실패 로그
     * -------------------------------------------------------------------- */
    if (isDev) {
      app.on("web-contents-created", (_e, contents) => {
        contents.on("did-fail-load", (_ev, code, desc, validatedURL, isMainFrame) => {
          if (isMainFrame) {
            console.log(`[debug] did-fail-load(${code}:${desc}) ${validatedURL}`);
          }
        });
      });
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
