// electron/ipc/canva-downloads.js
const { session, app } = require("electron");
const fs = require("fs");
const path = require("path");

const PARTITION = "persist:canva";

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function safeName(name) {
  return String(name || "asset")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}
// 프로젝트 루트: files.js와 규칙 맞춤
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

/**
 * persist:canva 세션에서 발생하는 모든 다운로드를 가로채
 * projects/current/assets/(images|videos)로 저장하고
 * 진행/완료 이벤트를 임베더(메인 렌더러)로 전송한다.
 */
function registerCanvaDownloads() {
  const ses = session.fromPartition(PARTITION);

  // 중복 등록 방지
  ses.removeAllListeners("will-download");

  ses.on("will-download", (event, item, guestWC) => {
    // webview의 host(임베더)로 이벤트 보내야 우리의 preload 리스너가 받는다
    const embedderWC = guestWC.hostWebContents || guestWC;

    const original = item.getFilename();
    const filename = safeName(original);
    const mime = item.getMimeType() || "";
    const isVideo =
      /video/i.test(mime) || /\.(mp4|mov|m4v|webm)$/i.test(filename);

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
        embedderWC.send("canva:progress", {
          state,
          received: item.getReceivedBytes(),
          total: item.getTotalBytes(),
          path: savePath,
        });
      } catch (err) {
        console.warn("[canva:progress] send fail:", err?.message || err);
      }
    });

    item.once("done", async (_e, state) => {
      try {
        if (state === "completed") {
          embedderWC.send("canva:downloaded", {
            ok: true,
            path: savePath,
            mime,
            type: isVideo ? "video" : "image",
          });
        } else {
          embedderWC.send("canva:downloaded", {
            ok: false,
            error: state,
          });
        }
      } catch (err) {
        console.warn("[canva:downloaded] send fail:", err?.message || err);
      }
    });
  });
}

module.exports = { registerCanvaDownloads, PARTITION };
