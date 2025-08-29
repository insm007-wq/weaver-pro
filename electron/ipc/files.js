// electron/ipc/files.js
// ============================================================================
// 파일/폴더 유틸 IPC 모듈 (전체)
// - 날짜 기반 프로젝트 루트 생성 및 하위 디렉토리 생성
// - 파일/폴더 존재 확인 (files:exists)
// - 버퍼/URL 저장, 텍스트/바이너리 읽기
// - ★ 스트리밍 다운로드: files/saveUrlToProject
// - (이미지 처리용 sharp 제거)  → file:save-url 은 단순 저장만 수행
// - ★ 테스트 모드: 동일 이름 덮어쓰기(폴더 (1) 생성/파일 (1) 접미사 방지)
//   - OVERWRITE_MODE=true 로 동작 (필요시 false로 바꾸면 기존 방식 복원)
// - ★ 저장 완료 브로드캐스트: "files:downloaded" (renderer 구독 → 자동배치)
// ============================================================================

const { ipcMain, dialog, app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const REDIRECT = new Set([301, 302, 303, 307, 308]);

// ★ 테스트 모드: 덮어쓰기
const OVERWRITE_MODE =
  process.env.CW_OVERWRITE === "1" ||
  process.env.NODE_ENV === "development" ||
  true; // ← 테스트 동안 true 고정 (배포시 false로)

let CURRENT_ROOT = null;

/* =============================== utils =============================== */

/** yyyy-mm-dd (오늘) 문자열 */
function ymd(today = new Date()) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 디렉터리 존재 보장 */
function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** 경로 문자열 정리 (상위 폴더 이탈, 중복 슬래시 제거) */
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

/** 소형 파일 다운로드 → Buffer (리다이렉트 처리) */
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

/** 대용량(영상 등) 다운로드 → 파일로 저장(스트리밍, 리다이렉트 처리) */
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

/**
 * 파일 경로 결정:
 * - OVERWRITE_MODE=true  : 같은 이름이 있어도 그대로 덮어쓰기
 * - OVERWRITE_MODE=false : name.ext, name (1).ext, name (2).ext …
 */
function ensurePath(dir, fileName) {
  const parsed = path.parse(fileName || "file");
  const safeBase = path.basename(sanitize(parsed.base)) || "file";
  const out = path.join(dir, safeBase);
  if (OVERWRITE_MODE) return out;

  const nameOnly = path.parse(safeBase).name;
  const ext = path.parse(safeBase).ext || "";
  let n = 0;
  let candidate = out;
  while (fs.existsSync(candidate)) {
    n += 1;
    candidate = path.join(dir, `${nameOnly} (${n})${ext}`);
  }
  return candidate;
}

/* =========== 날짜 프로젝트 루트 생성/질의 (YYYY-MM-DD) =========== */

/** OS별 기본 베이스 폴더 */
function getBaseRoot() {
  const envBase =
    process.env.CW_BASE_DIR && String(process.env.CW_BASE_DIR).trim();
  if (process.platform === "win32") {
    return envBase || "C:\\ContentWeaver";
  }
  return envBase || path.join(app.getPath("documents"), "ContentWeaver");
}

/** 베이스 아래에 폴더 이름 결정(덮어쓰기 모드면 (1) 제거) */
function decideDatedFolderName(baseDir) {
  const baseName = ymd();
  if (OVERWRITE_MODE) return baseName; // 항상 YYYY-MM-DD 사용 (있으면 재사용)
  // 비-덮어쓰기 모드에서는 (1), (2) 증가
  let name = baseName;
  let n = 0;
  while (fs.existsSync(path.join(baseDir, name))) {
    n += 1;
    name = `${baseName} (${n})`;
  }
  return name;
}

/** 날짜 프로젝트 루트 생성(하위 디렉토리 포함) */
function createDatedProjectRoot(baseDir) {
  ensureDirSync(baseDir);
  const folderName = decideDatedFolderName(baseDir);
  const root = path.join(baseDir, folderName);
  // 덮어쓰기 모드: 이미 있어도 그대로 사용
  ensureDirSync(root);
  for (const sub of ["audio", "electron_data", "exports", "subtitle", "videos"])
    ensureDirSync(path.join(root, sub));
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

/** ✅ 파일/폴더 존재 확인 */
ipcMain.handle("files:exists", async (_e, filePath) => {
  try {
    if (!filePath) return { exists: false };
    const st = fs.statSync(String(filePath));
    return { exists: true, isFile: st.isFile(), isDir: st.isDirectory() };
  } catch {
    return { exists: false };
  }
});

/** ✅ 베이스 폴더 선택 → 날짜 폴더 생성(덮어쓰기 모드면 YYYY-MM-DD 재사용) */
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

/**
 * ✅ 이미지/데이터 URL을 OS 저장 대화상자로 저장
 * - sharp 없이 단순 저장 (확장자는 suggestedName 또는 URL에서 추정)
 */
ipcMain.handle("file:save-url", async (_e, payload = {}) => {
  try {
    const { url, suggestedName = "image.jpg" } = payload || {};
    if (!url || typeof url !== "string") {
      return { ok: false, message: "url_required" };
    }

    // 기본 저장 위치: 프로젝트/exports
    const root = getProjectRoot();
    const exportsDir = path.join(root, "exports");
    ensureDirSync(exportsDir);

    // 확장자/기본 파일명 결정
    const guessExt = () => {
      if (suggestedName && path.extname(suggestedName)) {
        return suggestedName;
      }
      try {
        const u = new URL(url);
        const base = path.basename(u.pathname);
        if (base && path.extname(base)) return base;
      } catch {}
      return "image.jpg";
    };

    const defaultPath = path.join(exportsDir, guessExt());
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
    });
    if (canceled || !filePath) return { ok: false, message: "canceled" };

    const buf = url.startsWith("data:")
      ? parseDataUrl(url)
      : await downloadBuffer(url);
    await fs.promises.writeFile(filePath, buf);
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/**
 * ✅ URL(주로 동영상)을 현재 프로젝트에 바로 저장 (대화상자 없음)
 * payload: { url, category?="videos", fileName? }
 *  - 리다이렉트/대용량 스트리밍 지원
 *  - OVERWRITE_MODE=true 이면 동일 파일명 덮어쓰기
 *  - 저장 완료 시 "files:downloaded" 브로드캐스트
 */
ipcMain.handle("files/saveUrlToProject", async (evt, payload = {}) => {
  try {
    const { url, category = "videos", fileName } = payload || {};
    if (!url || typeof url !== "string") {
      return { ok: false, message: "url_required" };
    }

    const root = getProjectRoot();
    const dir = path.join(root, sanitize(category));
    ensureDirSync(dir);

    let base =
      (fileName && String(fileName).trim()) ||
      (() => {
        try {
          const u = new URL(url);
          const last = path.basename(u.pathname);
          return last || "download.bin";
        } catch {
          return "download.bin";
        }
      })();

    const outPath = ensurePath(dir, base);

    // 덮어쓰기 모드면 기존 파일 제거 후 저장
    if (OVERWRITE_MODE && fs.existsSync(outPath)) {
      await fs.promises.rm(outPath, { force: true });
    }
    await streamDownloadToFile(url, outPath);

    // ✅ 저장 완료 브로드캐스트
    const payloadOut = {
      path: outPath,
      category,
      fileName: path.basename(outPath),
    };
    try {
      evt?.sender?.send("files:downloaded", payloadOut);
    } catch {}
    try {
      BrowserWindow.getAllWindows().forEach((w) =>
        w.webContents.send("files:downloaded", payloadOut)
      );
    } catch {}

    return { ok: true, path: outPath };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/** ✅ 프로젝트 폴더에 버퍼 저장 (저장 이벤트 브로드캐스트 포함) */
ipcMain.handle("files/saveToProject", async (evt, payload = {}) => {
  try {
    const { category = "misc", fileName, buffer } = payload || {};
    if (!fileName) throw new Error("fileName_required");
    if (!buffer) throw new Error("buffer_required");

    const root = getProjectRoot();
    const dir = path.join(root, sanitize(category));
    ensureDirSync(dir);

    const targetPath = ensurePath(dir, fileName);
    if (OVERWRITE_MODE && fs.existsSync(targetPath)) {
      await fs.promises.rm(targetPath, { force: true });
    }
    const out = toBuffer(buffer);
    await fs.promises.writeFile(targetPath, out);

    // ✅ 저장 완료 브로드캐스트
    const payloadOut = {
      path: targetPath,
      category,
      fileName: path.basename(targetPath),
    };
    try {
      evt?.sender?.send("files:downloaded", payloadOut);
    } catch {}
    try {
      BrowserWindow.getAllWindows().forEach((w) =>
        w.webContents.send("files:downloaded", payloadOut)
      );
    } catch {}

    return { ok: true, path: targetPath };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/** ✅ 다른 이름으로 저장(대화상자) – SRT/MP3 등 */
ipcMain.handle("file:save-buffer", async (_evt, payload = {}) => {
  try {
    const { buffer, suggestedName = "file.bin", mime } = payload || {};
    if (!buffer) throw new Error("buffer_required");

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

/** ✅ 텍스트 파일 읽기 (SRT/텍스트) */
ipcMain.handle("files/readText", async (_evt, payload = {}) => {
  try {
    const { path: filePath, encoding = "utf8" } = payload || {};
    if (!filePath) throw new Error("path_required");
    const buf = await fs.promises.readFile(filePath);
    return buf.toString(encoding).replace(/^\uFEFF/, "");
  } catch (err) {
    throw err; // renderer에서 catch
  }
});

/** ✅ 바이너리 읽기: 로컬 파일 → base64로 반환 */
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

/* ========= 추가 유틸 IPC (preload에서 참조 중이면 필요) ========= */

/** 오늘 날짜 문자열 */
ipcMain.handle("files:todayStr", async () => ymd());

/** 디렉터리 재귀 생성 */
ipcMain.handle("fs:mkDirRecursive", async (_e, { dirPath }) => {
  try {
    ensureDirSync(String(dirPath || ""));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

/**
 * 다음 사용 가능한 이름 조회
 * payload: { dir, base, kind?: "file"|"dir" }
 */
ipcMain.handle("files:nextAvailableName", async (_e, { dir, base, kind }) => {
  try {
    const d = String(dir || "");
    const b = String(base || "");
    ensureDirSync(d);
    if (OVERWRITE_MODE) {
      return { ok: true, name: b, fullPath: path.join(d, b) };
    }
    const nameOnly = path.parse(b).name;
    const ext = path.parse(b).ext || "";
    let n = 0;
    let candidate = path.join(d, b);
    while (fs.existsSync(candidate)) {
      n += 1;
      candidate = path.join(d, `${nameOnly} (${n})${ext}`);
    }
    return { ok: true, name: path.basename(candidate), fullPath: candidate };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

/* ============================== exports ============================== */
module.exports = {
  getProjectRoot,
};
