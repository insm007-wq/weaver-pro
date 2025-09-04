// electron/ipc/canva.js
// ============================================================================
// Canva 자동화 IPC (Phase 1: 로그인/검색창 순차 오픈 + 다운로드 가로채기)
// - login(): Canva 브라우저 창 오픈 (사용자 로그인)
// - getSession(): 간단한 세션 체크(창/쿠키 유무 기반 베이직 헬스체크)
// - logout(): 파티션 쿠키 정리
// - autoRun(payload): 키워드별 검색 페이지를 순차로 열기 (다운로드는 사용자가 클릭)
// - stop(): autoRun 루프 중지
// - will-download 훅: 저장 경로/파일명 통일, 완료 이벤트 브로드캐스트
// - 이벤트: "canva:progress", "canva:downloaded"
// ============================================================================

const { app, BrowserWindow, ipcMain, session, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const store = require("../services/store"); // electron-store 래퍼 (프로젝트에 이미 존재)
let win = null;
let running = false;
let stopRequested = false;
let downloadHookAttached = false;

const PARTITION = "persist:canva";
const START_URL = "https://www.canva.com/"; // 로그인 진입
const SEARCH_BASE = "https://www.canva.com/templates/search/"; // 키워드 검색 진입

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ensureDir(p) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (_) {}
  return p;
}

// 기본 저장 루트(설정 → 저장 루트 우선, 없으면 C:\ContentWeaver\YYYY-MM-DD 또는 ~/ContentWeaver/…)
function getDefaultRoot() {
  const configured = store.get("paths.saveRoot") || store.get("paths.projectRoot") || store.get("paths.root") || null;

  if (configured) return ensureDir(configured);

  const base =
    process.platform === "win32" ? path.join("C:\\", "ContentWeaver", todayStr()) : path.join(os.homedir(), "ContentWeaver", todayStr());
  return ensureDir(base);
}

// 브로드캐스트 유틸
function emitAll(event, payload) {
  try {
    BrowserWindow.getAllWindows().forEach((w) => w.webContents.send(event, payload));
  } catch (e) {
    console.warn("[canva] emitAll fail:", e?.message || e);
  }
}

function createOrFocusWindow() {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Canva",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "../preload.js"),
      partition: PARTITION,
    },
  });

  // 다운로드 가로채기 (세션 단위 1회만 설치)
  const ses = win.webContents.session;
  if (!downloadHookAttached) {
    ses.on("will-download", (e, item) => {
      try {
        const url = item.getURL();
        const mime = item.getMimeType();
        const origName = item.getFilename() || "download.mp4";

        // 런타임 옵션을 window 전역 대신 세션 temp에 담아둠
        const runtime = ses.__CW_RUNTIME__ || {};
        const keyword = runtime.__LAST_KEYWORD__ || "keyword";
        const seq = (runtime.__SEQ_MAP__ = runtime.__SEQ_MAP__ || {});
        const n = (seq[keyword] = (seq[keyword] || 0) + 1);

        const w = runtime.targetRes?.w || 1920;
        const h = runtime.targetRes?.h || 1080;
        const pattern = runtime.fileNamePattern || "{keyword}_{seq}_{w}x{h}";
        const ext = path.extname(origName) || (mime && mime.includes("video") ? ".mp4" : ".mp4");

        const safeKeyword = String(keyword)
          .replace(/[\\/:*?"<>|]/g, "_")
          .slice(0, 60);
        const fileName =
          pattern
            .replace("{keyword}", safeKeyword)
            .replace("{seq}", String(n).padStart(2, "0"))
            .replace("{w}", String(w))
            .replace("{h}", String(h)) + ext;

        const baseDir = ensureDir(path.join(getDefaultRoot(), "videos"));
        const savePath = path.join(baseDir, fileName);
        item.setSavePath(savePath);

        item.on("updated", (_e, state) => {
          emitAll("canva:progress", {
            keyword,
            phase: "download",
            message: state,
          });
        });

        item.once("done", (_e, state) => {
          if (state === "completed") {
            emitAll("canva:progress", {
              keyword,
              phase: "save",
              message: "completed",
              savedDelta: 1,
            });
            emitAll("canva:downloaded", {
              path: savePath,
              keyword,
              width: w,
              height: h,
              durationSec: 0,
              thumbUrl: "",
              provider: "canva",
              assetId: path.basename(savePath, ext),
            });
            emitAll("canva:progress", {
              keyword,
              phase: "done",
            });
          } else {
            emitAll("canva:progress", {
              keyword,
              phase: "save",
              message: state,
              skipDelta: 1,
              reason: "saveError",
            });
          }
        });
      } catch (err) {
        console.warn("[canva] will-download error:", err?.message || err);
      }
    });
    downloadHookAttached = true;
  }

  win.on("closed", () => {
    win = null;
  });

  win.loadURL(START_URL);
  return win;
}

// 간단 세션 헬스체크: Canva 도메인 쿠키 유무 확인(대체용)
async function hasCanvaCookie() {
  try {
    const ses = session.fromPartition(PARTITION);
    const cookies = await ses.cookies.get({ domain: ".canva.com" });
    // 쿠키가 1개라도 있으면 로그인된 것으로 간주(보수적 단순판단)
    return Array.isArray(cookies) && cookies.length > 0;
  } catch {
    return false;
  }
}

/* =============================== IPC 등록 =============================== */
function register() {
  // 로그인: 창 오픈 후 URL 로드. (실제 로그인은 사용자가 수행)
  ipcMain.handle("canva:login", async () => {
    const w = createOrFocusWindow();
    try {
      await w.loadURL(START_URL);
    } catch (_) {}
    // 2초 뒤 쿠키 한번 체크(너무 빡세게 확인하지 않음)
    setTimeout(async () => {
      const ok = await hasCanvaCookie();
      emitAll("canva:progress", {
        keyword: null,
        phase: "login",
        message: ok ? "logged-in" : "not-logged-in",
      });
    }, 2000);

    // 사용자 정보까지는 불가 → 기본 응답
    return { ok: true, user: null };
  });

  // 세션 조회
  ipcMain.handle("canva:getSession", async () => {
    const ok = await hasCanvaCookie();
    return { ok, session: ok ? { user: null } : null };
  });

  // 로그아웃: 파티션 쿠키 모두 제거
  ipcMain.handle("canva:logout", async () => {
    try {
      const ses = session.fromPartition(PARTITION);
      const cookies = await ses.cookies.get({});
      await Promise.all(
        cookies.map((c) => ses.cookies.remove((c.secure ? "https://" : "http://") + c.domain.replace(/^\./, "") + (c.path || "/"), c.name))
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e?.message || String(e) };
    }
  });

  // 자동화 시작(Phase 1: 검색 페이지 순차 열기 + 다운로드 가로채기)
  ipcMain.handle("canva:autoRun", async (_evt, payload = {}) => {
    if (running) return { ok: false, message: "이미 실행 중입니다." };
    const keywords = Array.isArray(payload.keywords) ? payload.keywords : [];
    if (!keywords.length) return { ok: false, message: "키워드가 없습니다." };

    const perKeyword = Math.max(1, Math.min(6, payload.perKeyword || 1));

    const w = createOrFocusWindow();
    const ses = w.webContents.session;
    // 런타임 파라미터 공유(다운로드 파일명 생성에 사용)
    ses.__CW_RUNTIME__ = {
      targetRes: payload.targetRes || { w: 1920, h: 1080 },
      fileNamePattern: payload.fileNamePattern || "{keyword}_{seq}_{w}x{h}",
      __SEQ_MAP__: {},
    };

    running = true;
    stopRequested = false;

    try {
      for (const k of keywords) {
        if (stopRequested) break;

        // 진행 메시지
        emitAll("canva:progress", { keyword: k, phase: "search", message: "open" });

        // 마지막 키워드 기록(다운로드 네이밍 용)
        ses.__CW_RUNTIME__.__LAST_KEYWORD__ = k;

        // 검색 페이지 열기
        const url = SEARCH_BASE + encodeURIComponent(k);
        await w.loadURL(url);

        // (선택) 약간 대기 → 사용자가 내려받기 클릭 (Phase 1: 수동 클릭)
        await new Promise((r) => setTimeout(r, 1500));

        // perKeyword > 1인 경우, 사용자가 여러 개 클릭하도록 대기시간을 조금 더 줌
        if (perKeyword > 1) {
          await new Promise((r) => setTimeout(r, 1200 * Math.min(perKeyword, 3)));
        }

        emitAll("canva:progress", { keyword: k, phase: "pick", message: "waiting-user" });
        // 실제 자동 클릭은 Phase 2에서 DOM 스크립트 셀렉터 확정 후 주입 예정
      }

      emitAll("canva:progress", { keyword: null, phase: "done", message: "queue-finished" });
      return { ok: true };
    } catch (e) {
      console.warn("[canva:autoRun] error:", e?.message || e);
      return { ok: false, message: e?.message || String(e) };
    } finally {
      running = false;
    }
  });

  // 중지
  ipcMain.handle("canva:stop", async () => {
    stopRequested = true;
    return { ok: true };
  });

  console.log("[ipc] canva: registered");
}

module.exports = { register };
