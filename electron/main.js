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
  // 포트 범위를 더 넓게 설정하여 유연성 확보
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ||
    process.env.VITE_PORT ? `http://localhost:${process.env.VITE_PORT}` :
    "http://localhost:5173";

  const win = new BrowserWindow({
    width: 1280,
    height: 1000,
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
    win.webContents.openDevTools({ mode: "detach" });
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
console.log("[main] Single instance lock status:", gotLock);

if (!gotLock) {
  console.log("[main] Another instance is already running, quitting...");
  app.quit();
} else {
  console.log("[main] Got lock, this is the primary instance");
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      console.log("[main] App is ready, starting initialization...");

      if (process.platform === "win32") {
        app.setAppUserModelId(process.env.APP_ID || "weaver-pro");
      }

    /* -----------------------------------------------------------------------
     * ✅ IPC 등록 (항상 창 생성 전에!)
     * -------------------------------------------------------------------- */
    console.log("[main] Starting IPC module loading...");
    
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

    // 영상 다운로드
    const videoDownload = safeRequire("ipc/video-download", () => require("./ipc/video-download"));
    await tryRegister("video-download", videoDownload, "registerVideoDownloadIPC");

    // AI 키워드/용어 번역 (ai:extractKeywords / ai:translateTerms 모두 이 모듈)
    const aiKeywords = safeRequire("ipc/ai-keywords", () => require("./ipc/ai-keywords"));
    await tryRegister("ai-keywords", aiKeywords, "registerAIKeywords");

    // 헬스/설정/기타
    safeRequire("ipc/tests", () => require("./ipc/tests"));
    safeRequire("ipc/replicate", () => require("./ipc/replicate"));
    const settingsModule = safeRequire("ipc/settings", () => require("./ipc/settings"));
    safeRequire("ipc/health", () => require("./ipc/health"));
    safeRequire("ipc/image-analyzer", () => require("./ipc/image-analyzer"));
    safeRequire("ipc/llm/index", () => require("./ipc/llm/index"));
    safeRequire("ipc/script", () => require("./ipc/script"));
    safeRequire("ipc/tts", () => require("./ipc/tts"));
    safeRequire("ipc/audio", () => require("./ipc/audio"));

    // FFmpeg 영상 합성
    const ffmpeg = safeRequire("ipc/ffmpeg", () => require("./ipc/ffmpeg"));
    await tryRegister("ffmpeg", ffmpeg, "register");

    console.log("[main] All basic IPC modules loaded, starting startup-cleanup...");

    // 시작 시 정리 모듈
    console.log("[main] Loading startup-cleanup module...");
    const startupCleanup = safeRequire("ipc/startup-cleanup", () => require("./ipc/startup-cleanup"));
    console.log("[main] Startup-cleanup module loaded:", !!startupCleanup);

    await tryRegister("startup-cleanup", startupCleanup, "register");

    // 자동 시작 정리 실행 (즉시 실행)
    if (startupCleanup?.initOnReady) {
      console.log("[main] Running startup cleanup immediately...");
      startupCleanup.initOnReady();
    } else {
      console.log("[main] ERROR: initOnReady not found in startup-cleanup module");
    }

    // ✅ 미디어 다운로드(프리뷰) IPC 등록
    // - 채널: preview:compose / preview:cancel / (send) preview:progress
    const preview = safeRequire("ipc/preview", () => require("./ipc/preview"));
    await tryRegister("preview", preview, "register");

    
    // ✅ 프로젝트 관리 서비스 (출력 폴더 및 파일 경로 관리)
    const projectManager = safeRequire("ipc/projectManager", () => require("./ipc/projectManager"));
    await tryRegister("project-manager", projectManager, "register");
    
    // ✅ Shell 기능 (폴더 열기 등)
    const { shell } = require("electron");
    const { ipcMain } = require("electron");
    ipcMain.handle("shell:openPath", async (event, path) => {
      try {
        await shell.openPath(path);
        return { success: true };
      } catch (error) {
        return { success: false, message: error.message };
      }
    });

    // ✅ Store 관리 (약관 동의 등)
    const store = safeRequire("services/store", () => require("./services/store"));
    if (store) {
      console.log("📝 [main] Store module loaded, store path:", store.path);

      ipcMain.handle("store:getTermsAccepted", async () => {
        try {
          console.log("🔍 [main] getTermsAccepted called");
          const result = store.getTermsAccepted();
          console.log("🔍 [main] getTermsAccepted result:", result);
          return result;
        } catch (error) {
          console.error("❌ [main] getTermsAccepted error:", error);
          return false;
        }
      });

      ipcMain.handle("store:setTermsAccepted", async (event, accepted) => {
        try {
          console.log("💾 [main] setTermsAccepted called with:", accepted);
          store.setTermsAccepted(accepted);
          const verify = store.getTermsAccepted();
          console.log("💾 [main] setTermsAccepted completed, verification read:", verify);
          return { success: true };
        } catch (error) {
          console.error("❌ [main] setTermsAccepted error:", error);
          return { success: false, message: error.message };
        }
      });
    } else {
      console.error("❌ [main] Store module failed to load!");
    }

    /* -----------------------------------------------------------------------
     * 기본 설정 초기화 (IPC 등록 완료 후)
     * -------------------------------------------------------------------- */
    console.log("[main] Initializing default settings...");
    if (settingsModule && settingsModule.initializeDefaultSettings) {
      settingsModule.initializeDefaultSettings();
    } else {
      console.warn("[main] settingsModule or initializeDefaultSettings not available");
    }

    /* -----------------------------------------------------------------------
     * API 키 기본값 초기화 (첫 실행 시 자동 설정)
     * -------------------------------------------------------------------- */
    console.log("[main] Initializing default API keys...");
    const secrets = safeRequire("services/secrets", () => require("./services/secrets"));
    if (secrets && secrets.initializeDefaultKeys) {
      await secrets.initializeDefaultKeys();
      console.log("[main] Default API keys initialization completed");
    } else {
      console.warn("[main] secrets.initializeDefaultKeys not available");
    }

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
    } catch (error) {
      console.error("[main] CRITICAL ERROR during initialization:", error);
      console.error("[main] Stack trace:", error.stack);
      // 에러가 발생해도 창을 띄우도록 시도
      try {
        createMainWindow();
      } catch (winError) {
        console.error("[main] Failed to create window:", winError);
      }
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
