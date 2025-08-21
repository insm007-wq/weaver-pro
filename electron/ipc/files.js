// electron/ipc/files.js
const { ipcMain, dialog, app } = require("electron");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const sharp = require("sharp");

const REDIRECT = new Set([301, 302, 303, 307, 308]);

// ---------------- helpers ----------------
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

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** 안전 경로(역참조 방지) */
function sanitize(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\/*/, "")
    .replace(/\.\.(\/|\\)/g, "");
}

/** ArrayBuffer/TypedArray/Buffer를 Buffer로 통일 */
function toBuffer(bufLike) {
  if (Buffer.isBuffer(bufLike)) return bufLike;
  if (bufLike && bufLike.type === "Buffer" && Array.isArray(bufLike.data)) {
    return Buffer.from(bufLike.data);
  }
  if (bufLike instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(bufLike));
  }
  if (bufLike && ArrayBuffer.isView(bufLike)) {
    return Buffer.from(
      bufLike.buffer,
      bufLike.byteOffset || 0,
      bufLike.byteLength
    );
  }
  throw new Error("unsupported_buffer_type");
}

/** ✅ 프로젝트 루트
 * - Windows: C:\ContentWeaver\projects\current
 * - 그 외 OS: Documents/ContentWeaver/projects/current
 * - 환경변수 CW_BASE_DIR가 있으면 그 아래를 사용
 */
function getProjectRoot() {
  const envBase =
    process.env.CW_BASE_DIR && String(process.env.CW_BASE_DIR).trim();
  if (process.platform === "win32") {
    const base = envBase || "C:\\ContentWeaver";
    const root = path.join(base, "projects", "current");
    ensureDirSync(root);
    return root;
  }
  // macOS/Linux 기본은 사용자 문서 폴더 아래
  const base = envBase || path.join(app.getPath("documents"), "ContentWeaver");
  const root = path.join(base, "projects", "current");
  ensureDirSync(root);
  return root;
}

// --------------- handlers ---------------

/**
 * 이미지/데이터 URL을 OS 저장 대화상자로 저장 (항상 JPG로 내보냄)
 * payload: { url: string, suggestedName?: string }
 */
ipcMain.handle("file:save-url", async (_e, payload = {}) => {
  try {
    const { url, suggestedName } = payload;
    if (!url || typeof url !== "string") {
      return { ok: false, message: "url_required" };
    }

    const baseName = (suggestedName || "thumbnail").replace(/\.[^/.]+$/, "");

    // ✅ 기본 저장 위치를 C:\ContentWeaver\exports 로 제안(윈도우)
    let defaultPath;
    if (process.platform === "win32") {
      const exportsDir = path.join(
        process.env.CW_BASE_DIR || "C:\\ContentWeaver",
        "exports"
      );
      ensureDirSync(exportsDir);
      defaultPath = path.join(exportsDir, `${baseName}.jpg`);
    } else {
      const home = process.env.HOME || process.env.USERPROFILE || "";
      defaultPath = path.join(home, `${baseName}.jpg`);
    }

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: "JPEG", extensions: ["jpg", "jpeg"] }],
    });
    if (canceled || !filePath) return { ok: false, message: "canceled" };

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

/**
 * ✅ 프로젝트 폴더에 버퍼 저장 (자동 생성)
 * payload: { category: string, fileName: string, buffer: ArrayBuffer|Uint8Array|Buffer }
 */
ipcMain.handle("files/saveToProject", async (_evt, payload = {}) => {
  try {
    const { category = "misc", fileName, buffer } = payload;
    if (!fileName) throw new Error("fileName_required");
    if (!buffer) throw new Error("buffer_required");

    const root = getProjectRoot();
    const dir = path.join(root, sanitize(category));
    ensureDirSync(dir); // 폴더 자동 생성

    const targetPath = path.join(dir, sanitize(fileName));
    const out = toBuffer(buffer);
    await fs.promises.writeFile(targetPath, out);

    return { ok: true, path: targetPath };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/**
 * ✅ 임의의 버퍼를 '다른 이름으로 저장' (SRT/MP3 다운로드용)
 * payload: { buffer: ArrayBuffer|Uint8Array|Buffer, suggestedName?: string, mime?: string }
 */
ipcMain.handle("file:save-buffer", async (_evt, payload = {}) => {
  try {
    const { buffer, suggestedName = "file.bin", mime } = payload;
    if (!buffer) throw new Error("buffer_required");

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: suggestedName,
      filters: [
        suggestedName.toLowerCase().endsWith(".srt")
          ? { name: "SubRip Subtitle", extensions: ["srt"] }
          : suggestedName.toLowerCase().endsWith(".mp3")
          ? { name: "MP3 Audio", extensions: ["mp3"] }
          : { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || !filePath) return { ok: false, message: "canceled" };

    const out = toBuffer(buffer);
    await fs.promises.writeFile(filePath, out);
    return {
      ok: true,
      path: filePath,
      mime: mime || "application/octet-stream",
    };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/**
 * ✅ 텍스트 파일 읽기 (SRT/텍스트 키워드 추출용)
 * payload: { path: string, encoding?: string }
 * 반환: string (BOM 제거된 텍스트)
 */
ipcMain.handle("files/readText", async (_evt, payload = {}) => {
  const { path: filePath, encoding = "utf8" } = payload || {};
  if (!filePath) throw new Error("path_required");
  const buf = await fs.promises.readFile(filePath);
  // 기본은 UTF-8 가정, BOM 제거
  let text = buf.toString(encoding).replace(/^\uFEFF/, "");
  return text;
});
