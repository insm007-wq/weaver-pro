// electron/ipc/files.js
const { ipcMain, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const sharp = require("sharp");

const REDIRECT = new Set([301, 302, 303, 307, 308]);

function downloadBuffer(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("too_many_redirects"));
    const mod = url.startsWith("https:") ? https : http;
    const req = mod.get(url, (res) => {
      if (REDIRECT.has(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return downloadBuffer(next, depth + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error("http_status_" + res.statusCode));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}
function parseDataUrl(dataUrl) {
  const m = /^data:(.*?);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error("invalid_data_url");
  return Buffer.from(m[2], "base64");
}

ipcMain.handle("file:save-url", async (_e, payload = {}) => {
  try {
    const { url, suggestedName } = payload;
    if (!url || typeof url !== "string") {
      return { ok: false, message: "url_required" };
    }

    // 기본 파일명은 .jpg로 고정
    const base = (suggestedName || "thumbnail").replace(/\.[^/.]+$/, "");
    const home = process.env.HOME || process.env.USERPROFILE || "";
    const defaultPath = path.join(home, `${base}.jpg`);

    // 저장 다이얼로그 (확장자 선택 없이 위치만 고르게)
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: "JPEG", extensions: ["jpg", "jpeg"] }],
    });
    if (canceled || !filePath) return { ok: false, message: "canceled" };

    // 원본 바이트 로드
    const buf = url.startsWith("data:")
      ? parseDataUrl(url)
      : await downloadBuffer(url);

    // 디코드 → 항상 JPG로 재인코딩 (알파는 흰 배경)
    let meta;
    let img = sharp(buf, { failOnError: false });
    try {
      meta = await img.metadata();
    } catch {
      return { ok: false, message: "not_image_data" };
    }
    if (meta?.hasAlpha) {
      img = img.flatten({ background: { r: 255, g: 255, b: 255 } });
    }
    const out = await img
      .jpeg({ quality: 93, progressive: true, chromaSubsampling: "4:2:0" })
      .toBuffer();

    fs.writeFileSync(filePath, out);
    return { ok: true, path: filePath, savedAs: "jpg" };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});
