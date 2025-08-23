// electron/main.js
require("dotenv").config();

const path = require("path");
const { app, BrowserWindow, session } = require("electron");

/* =============================================================================
 * 기본 환경
 * ============================================================================= */
const isDev = !app.isPackaged;
if (isDev) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";

// Canva 차단 회피용 최신 UA (필요시 버전만 올려 쓰세요)
const SPOOFED_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// ENV 요약(민감정보 마스킹)
console.log("[ENV] CANVA_CLIENT_ID:", (process.env.CANVA_CLIENT_ID || "").slice(0, 8) + "…");
console.log("[ENV] CANVA_REDIRECT_URI:", process.env.CANVA_REDIRECT_URI || "");
console.log("[ENV] APP_URL_SCHEME:", process.env.APP_URL_SCHEME || "(disabled)");
console.log("[ENV] ENABLE_CANVA_BROWSE:", process.env.ENABLE_CANVA_BROWSE || "0");
console.log("[ENV] ENABLE_DEEPLINK:", process.env.ENABLE_DEEPLINK || "0");

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

/** tryRegister(label, mod, fnName) */
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

  // 렌더러 콘솔 브릿지(최소)
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
     * ✅ Canva 차단 회피: 전역 UA/헤더 강제
     *  - app.userAgentFallback: 모든 윈도우 기본 UA
     *  - onBeforeSendHeaders: *.canva.com 요청 헤더 보정
     * -------------------------------------------------------------------- */
    try {
      app.userAgentFallback = SPOOFED_UA;
    } catch {}

    const installCanvaUAHeaders = (ses) => {
      if (!ses || ses.__canvaUAInstalled) return;
      ses.__canvaUAInstalled = true;

      ses.webRequest.onBeforeSendHeaders((details, callback) => {
        const url = details.url || "";
        if (url.includes(".canva.com")) {
          const h = details.requestHeaders || {};
          h["User-Agent"] = SPOOFED_UA;
          h["Accept-Language"] = "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7";
          // Client Hints (요즘 UA 판별에 자주 사용)
          h["sec-ch-ua"] = '"Chromium";v="124", "Google Chrome";v="124", "Not A(Brand)";v="99"';
          h["sec-ch-ua-platform"] = '"Windows"';
          h["sec-ch-ua-mobile"] = "?0";
          return callback({ requestHeaders: h });
        }
        return callback({ requestHeaders: details.requestHeaders });
      });
    };

    // 기본 세션 + 이후 생성 세션에도 적용
    installCanvaUAHeaders(session.defaultSession);
    app.on("session-created", (ses) => installCanvaUAHeaders(ses));

    /* -----------------------------------------------------------------------
     * ❶ IPC 등록 (항상 창 생성 전에!)
     * -------------------------------------------------------------------- */
    // Canva 스캐너(자동 검색→CDN 다운로드)
    const scan = safeRequire("ipc/canva-scan", () => require("./ipc/canva-scan"));
    await tryRegister("canva-scan", scan, "registerCanvaScan");

    // Canva OAuth (팝업 + PKCE)
    const canvaIpc = safeRequire("ipc/canva", () => require("./ipc/canva"));
    await tryRegister("canva", canvaIpc, "registerCanvaIPC");

    // 파일 선택
    const pickers = safeRequire("ipc/file-pickers", () => require("./ipc/file-pickers"));
    await tryRegister("file-pickers", pickers, "registerFilePickers");

    // (선택) 브라우저 수동 다운로드 — 무거우면 꺼두기: ENABLE_CANVA_BROWSE=1
    if (process.env.ENABLE_CANVA_BROWSE === "1") {
      const browse = safeRequire("ipc/canva-browse", () => require("./ipc/canva-browse"));
      await tryRegister("canva-browse", browse, "registerCanvaBrowse");
    }

    // 기타 IPC (require 시 자체 등록)
    safeRequire("ipc/tests", () => require("./ipc/tests"));
    safeRequire("ipc/replicate", () => require("./ipc/replicate"));
    safeRequire("ipc/settings", () => require("./ipc/settings"));
    safeRequire("ipc/health", () => require("./ipc/health"));
    safeRequire("ipc/image-analyzer", () => require("./ipc/image-analyzer"));
    safeRequire("ipc/files", () => require("./ipc/files"));
    safeRequire("ipc/llm/index", () => require("./ipc/llm/index"));
    safeRequire("ipc/script", () => require("./ipc/script"));
    safeRequire("ipc/tts", () => require("./ipc/tts"));
    safeRequire("ipc/audio", () => require("./ipc/audio"));

    /* -----------------------------------------------------------------------
     * ❷ (옵션) 딥링크
     * -------------------------------------------------------------------- */
    if (process.env.ENABLE_DEEPLINK === "1") {
      const APP_SCHEME = process.env.APP_URL_SCHEME || "myapp";

      if (process.defaultApp) {
        app.setAsDefaultProtocolClient(APP_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
      } else {
        app.setAsDefaultProtocolClient(APP_SCHEME);
      }

      app.on("open-url", (e, url) => {
        e.preventDefault();
        app.emit("app:deeplink", url);
      });

      app.on("app:deeplink", (url) => {
        try {
          const u = new URL(url);
          const code = u.searchParams.get("code");
          const state = u.searchParams.get("state");
          console.log("[deeplink]", url, "-> code:", code ? code.slice(0, 8) + "…" : "(none)");
          const w = BrowserWindow.getAllWindows()[0];
          w?.webContents?.send?.("oauth/callback", { url, code, state });
        } catch (err) {
          console.warn("[deeplink] parse error:", err);
        }
      });
    }

    /* -----------------------------------------------------------------------
     * ❸ 메인 윈도우
     * -------------------------------------------------------------------- */
    createMainWindow();

    /* -----------------------------------------------------------------------
     * ❹ (개발 전용) 네비게이션/리다이렉트 로그
     * -------------------------------------------------------------------- */
    if (isDev) {
      const REDIRECT_URI = process.env.CANVA_REDIRECT_URI || "";
      app.on("web-contents-created", (_e, contents) => {
        const log = (tag, url) => {
          if (!url) return;
          if (REDIRECT_URI && url.startsWith(REDIRECT_URI)) {
            console.log(`[debug] ${tag} (redirectUri):`, url);
          }
        };
        contents.on("will-redirect", (_ev, url) => log("will-redirect", url));
        contents.on("will-navigate", (_ev, url) => log("will-navigate", url));
        contents.on("did-fail-load", (_ev, code, desc, validatedURL, isMain) => {
          if (isMain) log(`did-fail-load(${code}:${desc})`, validatedURL);
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
