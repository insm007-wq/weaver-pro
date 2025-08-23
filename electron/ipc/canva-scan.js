// electron/ipc/canva-scan.js
const { BrowserWindow, ipcMain } = require("electron");

/* -----------------------------------------------------------------------------
 * 페이지 로드 대기 (브라우저 버전 상관없이 안전)
 * ---------------------------------------------------------------------------*/
function waitForPageStable(wc, { timeout = 45000, test = () => true } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        wc.removeListener("did-navigate", onNav);
        wc.removeListener("did-navigate-in-page", onNav);
        wc.removeListener("did-finish-load", onFinish);
        wc.removeListener("did-frame-finish-load", onFinish);
        wc.removeListener("destroyed", onDestroyed);
      } catch {}
    };
    const onDestroyed = () => {
      cleanup();
      reject(new Error("window destroyed before load finished"));
    };
    const onNav = () => {};
    const onFinish = () => {
      try {
        const url = wc.getURL();
        if (test(url)) {
          cleanup();
          resolve(url);
        }
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    wc.on("did-navigate", onNav);
    wc.on("did-navigate-in-page", onNav);
    wc.on("did-finish-load", onFinish);
    wc.on("did-frame-finish-load", onFinish);
    wc.on("destroyed", onDestroyed);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("timeout waiting for page load"));
    }, timeout);
  });
}

/* -----------------------------------------------------------------------------
 * 진행 이벤트 브로드캐스트 (렌더러의 window.api.onCanvaProgress에서 받음)
 * ---------------------------------------------------------------------------*/
function sendProgress(patch) {
  const w = BrowserWindow.getAllWindows()[0];
  if (!w) return;
  try {
    w.webContents.send("canva:progress", patch);
  } catch {}
}

/* -----------------------------------------------------------------------------
 * 검색 전용 창 생성 (다운로드/빌드ID/UA 등 복잡한 훅 전부 제거)
 * ---------------------------------------------------------------------------*/
function createScanWindow({ show = true } = {}) {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    show,
    title: "Canva 검색",
    autoHideMenuBar: true,
    webPreferences: {
      // 같은 세션 재사용이 필요하면 다음 라인 주석 해제
      // partition: "persist:canva-scan",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  return win;
}

/* -----------------------------------------------------------------------------
 * 검색 페이지 열기 (검색만, 다운로드/파싱 없음)
 * ---------------------------------------------------------------------------*/
async function openSearchPage(win, { keyword, onlyVideo = true, locale = "ko_kr" }) {
  const media = onlyVideo ? "videos" : "photos";
  const url = `https://www.canva.com/${locale}/search?q=${encodeURIComponent(keyword || "")}&media=${media}`;
  await win.webContents.loadURL(url);
  await waitForPageStable(win.webContents, { test: (u) => /\/search/.test(u) });
  return url;
}

/* -----------------------------------------------------------------------------
 * 메인 핸들러 (검색만 수행)
 *  - 키워드마다 검색 페이지를 순서대로 열어줌
 *  - 빌드ID/로그인/다운로드/후처리 전부 제거
 * ---------------------------------------------------------------------------*/
async function scanSearchOnly(_evt, payload = {}) {
  const { keywords = [], onlyVideo = true, locale = "ko_kr" } = payload;
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("키워드가 없습니다.");
  }

  sendProgress({
    stage: "start",
    totalKeywords: keywords.length,
    totalPlanned: 0,
    totalDownloaded: 0,
  });

  const win = createScanWindow({ show: true });

  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    sendProgress({
      stage: "search",
      keyword: kw,
      kIndex: i,
      totalKeywords: keywords.length,
      totalDownloaded: 0,
      totalPlanned: 0,
    });

    try {
      const opened = await openSearchPage(win, { keyword: kw, onlyVideo, locale });
      // 필요하면 여기서 잠깐 대기 후 다음 키워드로 넘어가게 할 수 있음
      // await new Promise((r) => setTimeout(r, 800));
      sendProgress({ stage: "enqueue", keyword: kw, found: 0 });
    } catch (e) {
      sendProgress({ stage: "error", message: e?.message || String(e) });
      // 검색 실패해도 계속 다음 키워드로
    }
  }

  sendProgress({ stage: "done" });
  return { ok: true };
}

/* -----------------------------------------------------------------------------
 * IPC 등록 (기존 채널 유지)
 * ---------------------------------------------------------------------------*/
function registerCanvaScan() {
  const handler = (evt, payload) => scanSearchOnly(evt, payload);
  ipcMain.handle("canva.scanAndDownload", handler);
  ipcMain.handle("canva/scanAndDownload", handler);
  console.log("ipc/canva-scan registered (search-only)");
}

module.exports = { registerCanvaScan };
