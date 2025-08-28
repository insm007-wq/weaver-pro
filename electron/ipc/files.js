// electron/ipc/files.js
// ============================================================================
// 파일/폴더 유틸 IPC 모듈 (전체본)
// - 날짜 기반 프로젝트 루트 생성 및 하위 디렉토리 생성
// - 파일/폴더 존재 확인 (files:exists)
// - 윈도우 스타일 중복 이름 제안 (ensureUniquePath)
// - 버퍼/URL 저장, 텍스트/바이너리 읽기 등
// ============================================================================

const { ipcMain, dialog, app } = require("electron");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const sharp = require("sharp");

const REDIRECT = new Set([301, 302, 303, 307, 308]);

// 현재 세션에서 선택/생성된 프로젝트 루트 (YYYY-MM-DD or YYYY-MM-DD (1) ...)
let CURRENT_ROOT = null;

/* =============================== utils =============================== */

/** yyyy-mm-dd (오늘) */
function ymd(today = new Date()) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`; // 예: 2025-08-23
}

/** 디렉터리 보장 */
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** 경로 문자열 정리 (상위 디렉터리 이탈/중복 슬래시 등 제거) */
function sanitize(p) {
  return String(p || "")
    .replace(/\\/g, "/")
    .replace(/^\/*/, "")
    .replace(/\.\.(\/|\\)/g, "")
    .replace(/\/{2,}/g, "/");
}

/** 다양한 버퍼 형태 → Node Buffer */
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

/** data:URL → Buffer */
function parseDataUrl(dataUrl) {
  const m = /^data:(.*?);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error("invalid_data_url");
  return Buffer.from(m[2], "base64");
}

/** 소형 파일 다운로드 → Buffer */
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

/** 대용량(영상 등) 다운로드 → 파일로 저장(스트리밍) */
function streamDownloadToFile(url, outPath, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error("too_many_redirects"));
    const proto = url.startsWith("https:") ? https : http;
    const req = proto.get(url, (res) => {
      if (REDIRECT.has(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        return streamDownloadToFile(next, outPath, depth + 1).then(
          resolve,
          reject
        );
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

/** 윈도우 스타일 파일명 중복 방지: name.ext → name (1).ext ... */
function ensureUniquePath(dir, fileName) {
  const parsed = path.parse(fileName || "file");
  const safeBase = path.basename(sanitize(parsed.base)); // 하위 폴더 침범 방지
  const baseName = safeBase || "file";
  const nameOnly = path.parse(baseName).name;
  const ext = path.parse(baseName).ext || "";

  let n = 0;
  let out = path.join(dir, baseName);
  while (fs.existsSync(out)) {
    n += 1;
    out = path.join(dir, `${nameOnly} (${n})${ext}`); // 공백 + 괄호
  }
  return out;
}

/* =========== 날짜 프로젝트 루트 생성/질의 (YYYY-MM-DD (n)) =========== */

/** OS별 기본 베이스 폴더 */
function getBaseRoot() {
  const envBase =
    process.env.CW_BASE_DIR && String(process.env.CW_BASE_DIR).trim();
  if (process.platform === "win32") {
    return envBase || "C:\\ContentWeaver";
  }
  return envBase || path.join(app.getPath("documents"), "ContentWeaver");
}

/** 베이스 아래에 YYYY-MM-DD 또는 YYYY-MM-DD (1) … 이름 제안 */
function suggestDatedFolderName(baseDir) {
  const baseName = ymd();
  let name = baseName;
  let n = 0;
  while (fs.existsSync(path.join(baseDir, name))) {
    n += 1;
    name = `${baseName} (${n})`;
  }
  return name;
}

/** 날짜 프로젝트 루트 생성(하위 5개 디렉토리 포함) */
function createDatedProjectRoot(baseDir) {
  ensureDirSync(baseDir);
  const folderName = suggestDatedFolderName(baseDir);
  const root = path.join(baseDir, folderName);
  ensureDirSync(root);

  for (const sub of [
    "audio",
    "electron_data",
    "exports",
    "subtitle",
    "videos",
  ]) {
    ensureDirSync(path.join(root, sub));
  }

  CURRENT_ROOT = root;
  return root;
}

/** 현재 프로젝트 루트 반환(없으면 기본 베이스 아래에 자동 생성) */
function getProjectRoot() {
  if (CURRENT_ROOT && fs.existsSync(CURRENT_ROOT)) return CURRENT_ROOT;
  const base = getBaseRoot();
  return (CURRENT_ROOT = createDatedProjectRoot(base));
}

/* =============================== IPCs =============================== */

/** ✅ 파일/폴더 존재 확인: window.api.checkPathExists(path) */
ipcMain.handle("files:exists", async (_e, filePath) => {
  try {
    if (!filePath) return { exists: false };
    const st = fs.statSync(String(filePath));
    return { exists: true, isFile: st.isFile(), isDir: st.isDirectory() };
  } catch {
    return { exists: false };
  }
});

/**
 * ✅ 베이스 폴더 선택 → 날짜 폴더 자동 생성 + 하위 디렉토리 생성
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
    if (canceled || !filePaths?.length)
      return { ok: false, message: "canceled" };

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

/** ✅ 현재 프로젝트 루트 질의 */
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

/* ========================== 저장/읽기 핸들러 ========================== */

/** 이미지/데이터 URL을 OS 저장 대화상자로 저장 (항상 JPG) — 이미지 전용 */
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

    const buf = url.startsWith("data:")
      ? parseDataUrl(url)
      : await downloadBuffer(url);

    // JPG 재인코딩(알파 → 흰 배경)
    let img = sharp(buf, { failOnError: false });
    let meta;
    try {
      meta = await img.metadata();
    } catch {
      return { ok: false, message: "not_image_data" };
    }
    if (meta?.hasAlpha)
      img = img.flatten({ background: { r: 255, g: 255, b: 255 } });
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

/** 다른 이름으로 저장(대화상자) – SRT/MP3 등 */
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
    return {
      ok: true,
      path: filePath,
      mime: mime || "application/octet-stream",
    };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/** 텍스트 파일 읽기 (SRT/텍스트) */
ipcMain.handle("files/readText", async (_evt, payload = {}) => {
  try {
    const { path: filePath, encoding = "utf8" } = payload || {};
    if (!filePath) throw new Error("path_required");
    const buf = await fs.promises.readFile(filePath);
    return buf.toString(encoding).replace(/^\uFEFF/, "");
  } catch (err) {
    throw err; // renderer에서 catch하도록
  }
});

/** 바이너리 읽기: 로컬 파일 → base64로 반환 */
ipcMain.handle("files/readBinary", async (_evt, payload = {}) => {
  try {
    const { path: filePath } = payload || {};
    if (!filePath) throw new Error("path_required");
    const buf = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime =
      ext === ".mp4"
        ? "video/mp4"
        : ext === ".webm"
        ? "video/webm"
        : ext === ".mov"
        ? "video/quicktime"
        : ext === ".m4v"
        ? "video/mp4"
        : ext === ".mkv"
        ? "video/x-matroska"
        : ext === ".avi"
        ? "video/x-msvideo"
        : "application/octet-stream";

    return { ok: true, data: buf.toString("base64"), mime };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/* ============================== exports ============================== */
module.exports = {
  getProjectRoot,
};
