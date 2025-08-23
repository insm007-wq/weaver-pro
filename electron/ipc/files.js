// electron/ipc/files.js
const { ipcMain, dialog, app } = require("electron");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const sharp = require("sharp");

const REDIRECT = new Set([301, 302, 303, 307, 308]);

// 현재 세션에서 선택/생성된 프로젝트 루트 (날짜 폴더)
let CURRENT_ROOT = null;

/* ---------------- utils ---------------- */

function ymd(today = new Date()) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // 2025-08-23
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitize(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\/*/, "")
    .replace(/\.\.(\/|\\)/g, "");
}

function toBuffer(bufLike) {
  if (Buffer.isBuffer(bufLike)) return bufLike;
  if (bufLike && bufLike.type === "Buffer" && Array.isArray(bufLike.data)) {
    return Buffer.from(bufLike.data);
  }
  if (bufLike instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(bufLike));
  }
  if (bufLike && ArrayBuffer.isView(bufLike)) {
    return Buffer.from(bufLike.buffer, bufLike.byteOffset || 0, bufLike.byteLength);
  }
  throw new Error("unsupported_buffer_type");
}

function parseDataUrl(dataUrl) {
  const m = /^data:(.*?);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error("invalid_data_url");
  return Buffer.from(m[2], "base64");
}

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
    req.setTimeout(30000, () => req.destroy(new Error("request_timeout")));
  });
}

/** 대용량(영상 등)은 스트리밍으로 바로 저장 */
function streamDownloadToFile(url, outPath, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("too_many_redirects"));
    const proto = url.startsWith("https:") ? https : http;
    const req = proto.get(url, (res) => {
      if (REDIRECT.has(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return streamDownloadToFile(next, outPath, depth + 1).then(resolve, reject);
      }
      if (![200, 206].includes(res.statusCode)) {
        res.resume();
        return reject(new Error("http_status_" + res.statusCode));
      }
      const ws = fs.createWriteStream(outPath);
      res.pipe(ws);
      ws.on("finish", () => resolve(outPath));
      ws.on("error", reject);
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(60000, () => req.destroy(new Error("request_timeout")));
  });
}

/** 파일명 중복 방지 */
function ensureUniquePath(dir, fileName) {
  const parsed = path.parse(fileName);
  let n = 0;
  let out = path.join(dir, sanitize(fileName));
  while (fs.existsSync(out)) {
    n += 1;
    const nextName = `${parsed.name}(${n})${parsed.ext}`;
    out = path.join(dir, sanitize(nextName));
  }
  return out;
}

/* -------------- 날짜 프로젝트 루트 -------------- */

/** OS별 기본 베이스 폴더 (ContentWeaver) */
function getBaseRoot() {
  const envBase = process.env.CW_BASE_DIR && String(process.env.CW_BASE_DIR).trim();
  if (process.platform === "win32") {
    return envBase || "C:\\ContentWeaver";
  }
  return envBase || path.join(app.getPath("documents"), "ContentWeaver");
}

/** 베이스 아래에 YYYY-MM-DD 또는 YYYY-MM-DD_n 폴더 이름 제안 */
function suggestDatedFolderName(baseDir) {
  const baseName = ymd(); // 오늘 날짜
  let name = baseName;
  let n = 0;
  while (fs.existsSync(path.join(baseDir, name))) {
    n += 1;
    name = `${baseName}_${n}`; // _1, _2, _3 …
  }
  return name;
}

/** 날짜 프로젝트 루트 생성(하위 5개 디렉토리 포함) */
function createDatedProjectRoot(baseDir) {
  ensureDirSync(baseDir);
  const folderName = suggestDatedFolderName(baseDir);
  const root = path.join(baseDir, folderName);
  ensureDirSync(root);

  for (const sub of ["audio", "electron_data", "exports", "subtitle", "videos"]) {
    ensureDirSync(path.join(root, sub));
  }

  CURRENT_ROOT = root;
  return root;
}

/** 현재 프로젝트 루트 반환(없으면 기본 베이스 아래 오늘 날짜 폴더 자동 생성) */
function getProjectRoot() {
  if (CURRENT_ROOT && fs.existsSync(CURRENT_ROOT)) return CURRENT_ROOT;
  const base = getBaseRoot();
  return (CURRENT_ROOT = createDatedProjectRoot(base));
}

/* -------------- IPC: 폴더 선택 + 자동 생성 -------------- */

/**
 * 사용자가 베이스 폴더를 고르면 그 아래에
 *  YYYY-MM-DD(또는 _1, _2…) 폴더를 자동 생성하고
 *  audio/electron_data/exports/subtitle/videos를 만든다.
 *
 * 반환: { ok, root, subdirs: { audio, electron_data, exports, subtitle, videos } }
 */
ipcMain.handle("files/selectDatedProjectRoot", async () => {
  try {
    const baseSuggest = getBaseRoot();

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "저장 위치(베이스 폴더) 선택",
      defaultPath: baseSuggest,
      properties: ["openDirectory", "createDirectory"],
      buttonLabel: "이 위치에 생성",
    });
    if (canceled || !filePaths?.length) return { ok: false, message: "canceled" };

    const baseDir = filePaths[0];
    const root = createDatedProjectRoot(baseDir);

    const sub = {
      audio: path.join(root, "audio"),
      electron_data: path.join(root, "electron_data"),
      exports: path.join(root, "exports"),
      subtitle: path.join(root, "subtitle"),
      videos: path.join(root, "videos"),
    };
    return { ok: true, root, subdirs: sub };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/** 현재 프로젝트 루트 질의 */
ipcMain.handle("files/getProjectRoot", async () => {
  try {
    const root = getProjectRoot();
    const sub = {
      audio: path.join(root, "audio"),
      electron_data: path.join(root, "electron_data"),
      exports: path.join(root, "exports"),
      subtitle: path.join(root, "subtitle"),
      videos: path.join(root, "videos"),
    };
    return { ok: true, root, subdirs: sub };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/* -------------- 기존 핸들러들(루트만 변경) -------------- */

/**
 * 이미지/데이터 URL을 OS 저장 대화상자로 저장 (항상 JPG)
 * ⚠️ 이미지 전용
 */
ipcMain.handle("file:save-url", async (_e, payload = {}) => {
  try {
    const { url, suggestedName } = payload;
    if (!url || typeof url !== "string") {
      return { ok: false, message: "url_required" };
    }
    const baseName = (suggestedName || "thumbnail").replace(/\.[^/.]+$/, "");

    // 기본 경로: 현재 프로젝트 루트의 exports 폴더
    const root = getProjectRoot();
    const exportsDir = path.join(root, "exports");
    ensureDirSync(exportsDir);
    const defaultPath = path.join(exportsDir, `${baseName}.jpg`);

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: "JPEG", extensions: ["jpg", "jpeg"] }],
    });
    if (canceled || !filePath) return { ok: false, message: "canceled" };

    const buf = url.startsWith("data:") ? parseDataUrl(url) : await downloadBuffer(url);

    // JPG 재인코딩(알파 → 흰 배경)
    let img = sharp(buf, { failOnError: false });
    let meta;
    try {
      meta = await img.metadata();
    } catch {
      return { ok: false, message: "not_image_data" };
    }
    if (meta?.hasAlpha) img = img.flatten({ background: { r: 255, g: 255, b: 255 } });
    const out = await img.jpeg({ quality: 93, progressive: true, chromaSubsampling: "4:2:0" }).toBuffer();

    fs.writeFileSync(filePath, out);
    return { ok: true, path: filePath, savedAs: "jpg" };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/**
 * 프로젝트 폴더에 버퍼 저장
 * payload: { category: "audio"|"electron_data"|"exports"|"subtitle"|"videos"|string, fileName, buffer }
 */
ipcMain.handle("files/saveToProject", async (_evt, payload = {}) => {
  try {
    const { category = "misc", fileName, buffer } = payload;
    if (!fileName) throw new Error("fileName_required");
    if (!buffer) throw new Error("buffer_required");

    const root = getProjectRoot();
    const dir = path.join(root, sanitize(category));
    ensureDirSync(dir);

    const targetPath = ensureUniquePath(dir, fileName);
    const out = toBuffer(buffer);
    await fs.promises.writeFile(targetPath, out);

    return { ok: true, path: targetPath };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/**
 * 다른 이름으로 저장(대화상자) – SRT/MP3 등
 */
ipcMain.handle("file:save-buffer", async (_evt, payload = {}) => {
  try {
    const { buffer, suggestedName = "file.bin", mime } = payload;
    if (!buffer) throw new Error("buffer_required");

    // 현재 프로젝트의 적절한 기본 폴더 제안
    const root = getProjectRoot();
    const lower = suggestedName.toLowerCase();
    let baseDir = root;
    if (lower.endsWith(".srt")) baseDir = path.join(root, "subtitle");
    else if (lower.endsWith(".mp3")) baseDir = path.join(root, "audio");
    else baseDir = path.join(root, "exports");
    ensureDirSync(baseDir);

    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: path.join(baseDir, suggestedName),
      filters: [
        lower.endsWith(".srt")
          ? { name: "SubRip Subtitle", extensions: ["srt"] }
          : lower.endsWith(".mp3")
          ? { name: "MP3 Audio", extensions: ["mp3"] }
          : { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || !filePath) return { ok: false, message: "canceled" };

    const out = toBuffer(buffer);
    await fs.promises.writeFile(filePath, out);
    return { ok: true, path: filePath, mime: mime || "application/octet-stream" };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/**
 * 텍스트 파일 읽기 (SRT/텍스트)
 */
ipcMain.handle("files/readText", async (_evt, payload = {}) => {
  const { path: filePath, encoding = "utf8" } = payload || {};
  if (!filePath) throw new Error("path_required");
  const buf = await fs.promises.readFile(filePath);
  return buf.toString(encoding).replace(/^\uFEFF/, "");
});

/**
 * URL을 현재 프로젝트 폴더에 자동 저장 (대화창 없음, 빠른 스트리밍)
 * payload: { url, category?: "videos"|..., fileName }
 */
ipcMain.handle("files/saveUrlToProject", async (_evt, payload = {}) => {
  try {
    const { url, category = "videos", fileName } = payload || {};
    if (!url) throw new Error("url_required");
    if (!fileName) throw new Error("fileName_required");

    const root = getProjectRoot();
    const dir = path.join(root, sanitize(category));
    ensureDirSync(dir);

    const target = ensureUniquePath(dir, fileName);
    await streamDownloadToFile(url, target);
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/* 선택적으로 외부에서 CURRENT_ROOT에 접근할 수 있게 export */
module.exports = {
  getProjectRoot,
};
