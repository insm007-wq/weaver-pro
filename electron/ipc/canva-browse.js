// electron/ipc/canva-browse.js
const { ipcMain, BrowserWindow, session, app } = require("electron");
const path = require("path");
const fs = require("fs");

function toCanvaSearchUrl({ query, media = "videos", locale = "ko_kr" }) {
  const base = `https://www.canva.com/${locale}/search`;
  const p = new URLSearchParams();
  if (query) p.set("q", query);
  p.set("media", media === "images" ? "photos" : "videos");
  return `${base}?${p.toString()}`;
}

function safeName(s) {
  return String(s)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function registerCanvaBrowse() {
  ipcMain.handle(
    "canva/openBrowser",
    async (_evt, { query, media, saveDir } = {}) => {
      const win = new BrowserWindow({
        width: 1200,
        height: 820,
        title: "Canva 검색/다운로드",
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      // 저장 폴더
      const baseSave =
        saveDir || path.join(app.getPath("downloads"), "WeaverAssets");
      if (!fs.existsSync(baseSave)) fs.mkdirSync(baseSave, { recursive: true });

      // 다운로드 가로채기
      win.webContents.session.on(
        "will-download",
        (_event, item, webContents) => {
          const orig = item.getFilename();
          const ext = path.extname(orig) || ".bin";
          const kw = safeName(query || "asset");
          const stamp = new Date().toISOString().replace(/[:.]/g, "-");
          const finalName = `${kw}_${stamp}${ext}`;
          const targetPath = path.join(baseSave, finalName);
          item.setSavePath(targetPath);

          item.once("done", (_e, state) => {
            webContents.send("canva:downloaded", {
              ok: state === "completed",
              state,
              name: finalName,
              path: targetPath,
              keyword: kw,
              media: media || "videos",
            });
          });
        }
      );

      // 검색 URL로 오픈(로그인은 여기서 사용자가 진행)
      const url = toCanvaSearchUrl({ query, media });
      await win.loadURL(url);
      return { ok: true, url, saveDir: baseSave };
    }
  );
}

module.exports = { registerCanvaBrowse };
