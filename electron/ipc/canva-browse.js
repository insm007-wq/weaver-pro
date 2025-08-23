// electron/ipc/canva-browse.js
const { ipcMain, BrowserWindow, app } = require("electron");
const path = require("path");
const fs = require("fs");

function toCanvaSearchUrl({ query, media = "videos" }) {
  // 1순위: 글로벌 최신 검색
  const p = new URLSearchParams();
  if (query) p.set("query", query);
  // media 필터는 UI에서 기억/적용됨. 굳이 붙이지 않아도 됨.
  return `https://www.canva.com/search/templates?${p.toString()}`;

  // 필요시 보조:
  // return `https://www.canva.com/search?${new URLSearchParams({ q: query || "" }).toString()}`;
}

function safeName(s) {
  return String(s)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

function registerCanvaBrowse() {
  ipcMain.handle("canva.openBrowser", async (_evt, { query, media, saveDir } = {}) => {
    const win = new BrowserWindow({
      width: 1200,
      height: 820,
      title: "Canva 검색/다운로드",
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        partition: "persist:canva",
      },
    });

    const baseSave = saveDir || path.join(app.getPath("downloads"), "WeaverAssets", media === "images" ? "images" : "videos");
    if (!fs.existsSync(baseSave)) fs.mkdirSync(baseSave, { recursive: true });

    const ses = win.webContents.session;
    ses.on("will-download", (_e, item, webContents) => {
      const kw = safeName(query || "asset");
      const ext = path.extname(item.getFilename() || "") || ".bin";
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const final = `${kw}_${stamp}${ext}`;
      const dest = path.join(baseSave, final);
      try {
        item.setSavePath(dest);
      } catch {}
      item.once("done", (_ev, state) => {
        webContents.send("canva:downloaded", {
          ok: state === "completed",
          state,
          path: dest,
          keyword: kw,
          media: media || "videos",
        });
      });
    });

    const url = toCanvaSearchUrl({ query, media });
    await win.loadURL(url);
    return { ok: true, url, saveDir: baseSave };
  });

  // 슬래시 호환 (레거시)
  ipcMain.handle("canva/openBrowser", (...a) => ipcMain._events["canva.openBrowser"]?.(...a));
  console.log("ipc/canva-browse registered (openBrowser)");
}

module.exports = { registerCanvaBrowse };
