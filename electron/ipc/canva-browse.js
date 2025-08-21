// electron/ipc/canva-browse.js
/**
 * Canva 검색/다운로드 전용 팝업(선택 기능)
 * - BrowserWindow를 persist:canva 파티션으로 열어 미니 webview와 로그인/쿠키 공유
 * - 이 창에서 발생하는 다운로드를 프로젝트 폴더 projects/current/assets/(images|videos)로 저장
 * - 진행/완료 이벤트를 메인 렌더러로 전달(canva:progress, canva:downloaded)
 *
 * ⚠️ 주의:
 * - 세션 단위 will-download는 리스너가 중복 부착되기 쉬움 → 창이 닫힐 때 반드시 removeListener
 * - 미니 webview와 동일 파티션을 사용해야 전역 훅(있다면)과도 동작 일치
 */

const { ipcMain, BrowserWindow, session, app } = require("electron");
const path = require("path");
const fs = require("fs");

const PARTITION = "persist:canva"; // ✅ 미니 webview와 동일 세션

function toCanvaSearchUrl({ query, media = "videos", locale = "ko_kr" }) {
  // Canva 검색 URL
  // media: "videos" | "images" → Canva 쪽에서 photos/videos 개념이라 최대한 맞춰 전달
  const base = `https://www.canva.com/${locale}/search`;
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  // 일부 레이아웃은 media가 무시될 수 있으므로, 필요 시 type=videos/photos를 추가로 시도해도 됨
  p.set("media", media === "images" ? "photos" : "videos");
  return `${base}?${p.toString()}`;
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function safeName(s) {
  return String(s || "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

/** files.js와 규칙 통일: 프로젝트 루트 */
function getProjectRoot() {
  const envBase =
    process.env.CW_BASE_DIR && String(process.env.CW_BASE_DIR).trim();
  if (process.platform === "win32") {
    const base = envBase || "C:\\ContentWeaver";
    const root = path.join(base, "projects", "current");
    ensureDirSync(root);
    return root;
  }
  const base = envBase || path.join(app.getPath("documents"), "ContentWeaver");
  const root = path.join(base, "projects", "current");
  ensureDirSync(root);
  return root;
}

/** 메인 렌더러 webContents 찾기(이 팝업 말고 첫 번째 창) */
function getMainWebContents(excludeWC) {
  const all = BrowserWindow.getAllWindows();
  const cand = all.find((w) => !excludeWC || w.webContents.id !== excludeWC.id);
  return cand ? cand.webContents : excludeWC || null;
}

function registerCanvaBrowse() {
  ipcMain.handle(
    "canva/openBrowser",
    async (_evt, { query, media = "videos" } = {}) => {
      // ✅ persist:canva 파티션 사용 → 미니 webview와 로그인/쿠키 공유
      const win = new BrowserWindow({
        width: 1200,
        height: 820,
        title: "Canva 검색/다운로드",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          partition: PARTITION,
        },
      });

      // 이 창의 세션(= persist:canva)
      const ses = win.webContents.session;

      // 세션 will-download 리스너 (창 닫힐 때 제거)
      const onWillDownload = (event, item, guestWC) => {
        // 진행/완료 이벤트는 메인 렌더러로 보내기
        const mainWC = getMainWebContents(win.webContents) || guestWC;

        const original = item.getFilename();
        const filename = safeName(original);
        const mime = item.getMimeType() || "";
        const isVideo =
          /video/i.test(mime) || /\.(mp4|mov|m4v|webm)$/i.test(filename);

        // 저장 경로: projects/current/assets/(videos|images)
        const root = getProjectRoot();
        const dir = path.join(root, "assets", isVideo ? "videos" : "images");
        ensureDirSync(dir);

        // 이름 충돌 시 _1, _2... 붙이기
        const ext = path.extname(filename);
        const base = filename.slice(0, -ext.length) || filename;
        let finalName = filename;
        let savePath = path.join(dir, finalName);
        let i = 1;
        while (fs.existsSync(savePath)) {
          finalName = `${base}_${i}${ext}`;
          savePath = path.join(dir, finalName);
          i += 1;
        }

        item.setSavePath(savePath);

        item.on("updated", (_e, state) => {
          try {
            mainWC &&
              mainWC.send("canva:progress", {
                state,
                received: item.getReceivedBytes(),
                total: item.getTotalBytes(),
                path: savePath,
              });
          } catch (err) {
            console.warn(
              "[canva-browse] progress send fail:",
              err?.message || err
            );
          }
        });

        item.once("done", async (_e, state) => {
          try {
            if (state === "completed") {
              mainWC &&
                mainWC.send("canva:downloaded", {
                  ok: true,
                  path: savePath,
                  mime,
                  type: isVideo ? "video" : "image",
                });
            } else {
              mainWC &&
                mainWC.send("canva:downloaded", {
                  ok: false,
                  error: state,
                });
            }
          } catch (err) {
            console.warn(
              "[canva-browse] downloaded send fail:",
              err?.message || err
            );
          }
        });
      };

      ses.on("will-download", onWillDownload);

      win.on("closed", () => {
        // ✅ 이 팝업이 닫히면 리스너 제거해서 중복 방지
        try {
          ses.removeListener("will-download", onWillDownload);
        } catch {}
      });

      // 검색 URL로 오픈(로그인은 여기서 사용자가 진행)
      const url = toCanvaSearchUrl({ query, media });
      await win.loadURL(url);

      return { ok: true, url };
    }
  );
}

module.exports = { registerCanvaBrowse };
