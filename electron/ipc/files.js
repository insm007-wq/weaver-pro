// electron/ipc/files.js
// ============================================================================
// 파일/폴더 유틸 IPC 모듈
// - 파일/폴더 존재 확인 (files:exists)
// - 버퍼/URL 저장, 텍스트/바이너리 읽기
// - 미디어 파일 선택 다이얼로그
// - 디렉토리 관리 유틸리티
// ============================================================================

const { ipcMain, dialog, app, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const REDIRECT = new Set([301, 302, 303, 307, 308]);

/* =============================== utils =============================== */

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

/** ✅ 미디어 파일 선택 다이얼로그 */
ipcMain.handle("files/selectMediaFile", async (event, options = {}) => {
  try {
    const { fileType = "all" } = options;

    let filters = [];
    switch (fileType) {
      case "video":
        filters = [
          { name: "비디오 파일", extensions: ["mp4", "avi", "mov", "mkv", "webm", "m4v"] },
          { name: "모든 파일", extensions: ["*"] }
        ];
        break;
      case "image":
        filters = [
          { name: "이미지 파일", extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"] },
          { name: "모든 파일", extensions: ["*"] }
        ];
        break;
      default:
        filters = [
          { name: "미디어 파일", extensions: ["mp4", "avi", "mov", "mkv", "webm", "m4v", "jpg", "jpeg", "png", "gif", "bmp", "webp"] },
          { name: "비디오 파일", extensions: ["mp4", "avi", "mov", "mkv", "webm", "m4v"] },
          { name: "이미지 파일", extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"] },
          { name: "모든 파일", extensions: ["*"] }
        ];
    }

    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "미디어 파일 선택",
      filters,
      properties: ["openFile"],
      buttonLabel: "선택"
    });

    if (canceled || !filePaths?.length) {
      return { ok: false, message: "canceled" };
    }

    const selectedFile = filePaths[0];
    const fileName = path.basename(selectedFile);
    const fileExt = path.extname(selectedFile).toLowerCase();

    // 파일 타입 확인
    const videoExts = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"];
    const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

    let detectedType = "unknown";
    if (videoExts.includes(fileExt)) {
      detectedType = "video";
    } else if (imageExts.includes(fileExt)) {
      detectedType = "image";
    }

    return {
      ok: true,
      filePath: selectedFile,
      fileName,
      fileType: detectedType,
      extension: fileExt
    };
  } catch (error) {
    console.error("[files/selectMediaFile] 오류:", error);
    return { ok: false, message: error.message };
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
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".png"
        ? "image/png"
        : ext === ".gif"
        ? "image/gif"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".bmp"
        ? "image/bmp"
        : ext === ".svg"
        ? "image/svg+xml"
        : "application/octet-stream";

    return { ok: true, data: buf.toString("base64"), mime };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});

/* ========= 추가 유틸 IPC ========= */

/** 디렉터리 재귀 생성 */
ipcMain.handle("fs:mkDirRecursive", async (_e, { dirPath }) => {
  try {
    ensureDirSync(String(dirPath || ""));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: String(e?.message || e) };
  }
});

/** ✅ URL을 지정된 경로에 다운로드 */
ipcMain.handle("files:writeUrl", async (_evt, { url, filePath }) => {
  try {
    console.log("🌐 files:writeUrl 호출됨:", { url, filePath });

    if (!url || typeof url !== "string") {
      return { success: false, message: "url_required" };
    }
    if (!filePath || typeof filePath !== "string") {
      return { success: false, message: "filePath_required" };
    }

    // 디렉토리 생성
    const dir = path.dirname(filePath);
    console.log("📁 디렉토리 확인/생성:", dir);
    ensureDirSync(dir);

    // 파일 다운로드 및 저장
    console.log("🌐 URL 다운로드 시작:", url);
    await streamDownloadToFile(url, filePath);
    console.log("✅ files:writeUrl 완료:", filePath);

    // 파일이 실제로 생성되었는지 확인
    const exists = fs.existsSync(filePath);

    if (!exists) {
      return { success: false, message: "file_not_created" };
    }

    return {
      success: true,
      data: {
        ok: true,
        path: filePath
      }
    };
  } catch (error) {
    console.error("❌ files:writeUrl 실패:", error);
    return {
      success: false,
      message: error.message,
      data: {
        ok: false,
        message: error.message
      }
    };
  }
});

/** ✅ 버퍼를 지정된 경로에 저장 */
ipcMain.handle("files:writeBuffer", async (_evt, { buffer, filePath }) => {
  try {
    console.log("💾 files:writeBuffer 호출됨:", { filePath, bufferLength: buffer?.length });

    if (!buffer) {
      return { success: false, message: "buffer_required" };
    }
    if (!filePath || typeof filePath !== "string") {
      return { success: false, message: "filePath_required" };
    }

    // 디렉토리 생성
    const dir = path.dirname(filePath);
    console.log("📁 디렉토리 확인/생성:", dir);
    ensureDirSync(dir);

    // 버퍼를 파일로 저장
    const bufferData = toBuffer(buffer);
    await fs.promises.writeFile(filePath, bufferData);
    console.log("✅ files:writeBuffer 완료:", filePath);

    // 파일이 실제로 생성되었는지 확인
    const exists = fs.existsSync(filePath);

    if (!exists) {
      return { success: false, message: "file_not_created" };
    }

    return {
      success: true,
      data: {
        ok: true,
        path: filePath
      }
    };
  } catch (error) {
    console.error("❌ files:writeBuffer 실패:", error);
    return {
      success: false,
      message: error.message,
      data: {
        ok: false,
        message: error.message
      }
    };
  }
});

/** 텍스트 파일 저장 */
ipcMain.handle("files:writeText", async (_evt, { filePath, content }) => {
  try {
    console.log("💾 files:writeText 호출됨:", {
      filePath,
      contentLength: content?.length,
      contentPreview: content?.substring(0, 100)
    });

    // 디렉토리 생성
    const dir = path.dirname(filePath);
    console.log("📁 디렉토리 확인/생성:", dir);

    ensureDirSync(dir);
    console.log("✅ 디렉토리 생성 완료:", dir);

    // 파일 쓰기 전 경로 검증
    console.log("📝 파일 쓰기 시작:", filePath);
    console.log("📄 내용 길이:", content?.length);

    // 파일 쓰기
    await fs.promises.writeFile(filePath, content, 'utf8');
    console.log("✅ files:writeText 완료:", filePath);

    // 파일이 실제로 생성되었는지 확인
    const exists = fs.existsSync(filePath);

    return { success: true, filePath };
  } catch (error) {
    console.error("❌ files:writeText 실패:", error);
    console.error("❌ 에러 상세:", {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return { success: false, message: error.message };
  }
});

/** 디렉토리 목록 조회 */
ipcMain.handle("files:listDirectory", async (_evt, dirPath) => {
  try {
    console.log("📂 files:listDirectory 호출됨:", dirPath);

    if (!dirPath || typeof dirPath !== "string") {
      return { success: false, message: "dirPath_required" };
    }

    // 디렉토리 존재 확인
    if (!fs.existsSync(dirPath)) {
      return { success: false, message: "directory_not_found" };
    }

    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      return { success: false, message: "path_is_not_directory" };
    }

    // 디렉토리 내용 읽기
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      try {
        const fullPath = path.join(dirPath, entry.name);
        const entryStats = await fs.promises.stat(fullPath);

        files.push({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
          size: entry.isFile() ? entryStats.size : 0,
          modified: entryStats.mtime,
          path: fullPath
        });
      } catch (err) {
        console.warn("파일 상태 읽기 실패:", entry.name, err.message);
        // 개별 파일 오류는 무시하고 계속 진행
      }
    }

    console.log(`✅ files:listDirectory 완료: ${files.length}개 항목 발견`);
    return { success: true, files };
  } catch (error) {
    console.error("❌ files:listDirectory 실패:", error);
    return { success: false, message: error.message };
  }
});

/** ✅ 파일 탐색기에서 파일 보기 */
ipcMain.handle("shell:showInFolder", async (_evt, { filePath }) => {
  try {
    console.log("📂 shell:showInFolder 호출됨:", filePath);

    if (!filePath || typeof filePath !== "string") {
      return { success: false, message: "filePath_required" };
    }

    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return { success: false, message: "file_not_found" };
    }

    // 파일을 선택한 상태로 탐색기 열기
    shell.showItemInFolder(filePath);
    console.log("✅ shell:showInFolder 완료:", filePath);

    return { success: true };
  } catch (error) {
    console.error("❌ shell:showInFolder 실패:", error);
    return { success: false, message: error.message };
  }
});

/** ✅ URL에서 파일 다운로드 및 저장 (사용자 선택) */
ipcMain.handle("file:save-url", async (_evt, { url, suggestedName }) => {
  try {
    console.log("💾 file:save-url 호출됨:", { url, suggestedName });

    if (!url || typeof url !== "string") {
      return { ok: false, message: "url_required" };
    }

    // 파일 저장 대화상자 표시
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "파일 저장",
      defaultPath: suggestedName || "download.jpg",
      filters: [
        { name: "이미지 파일", extensions: ["jpg", "jpeg", "png", "gif", "webp"] },
        { name: "모든 파일", extensions: ["*"] }
      ],
      buttonLabel: "저장"
    });

    if (canceled || !filePath) {
      console.log("❌ 사용자가 저장을 취소함");
      return { ok: false, message: "canceled" };
    }

    // URL에서 파일 다운로드
    console.log("🌐 URL 다운로드 시작:", url);
    await streamDownloadToFile(url, filePath);
    console.log("✅ file:save-url 완료:", filePath);

    return { ok: true, path: filePath };
  } catch (error) {
    console.error("❌ file:save-url 실패:", error);
    return { ok: false, message: error.message };
  }
});

/** ✅ 파일을 프로젝트 폴더에 저장 (드래그 앤 드롭용) */
ipcMain.handle("files/saveToProject", async (_evt, { category, fileName, buffer }) => {
  try {
    console.log("💾 files/saveToProject 호출됨:", { category, fileName, bufferSize: buffer?.byteLength });

    if (!category || !fileName || !buffer) {
      return { ok: false, message: "category, fileName, buffer 필수" };
    }

    const store = require('../services/store');
    const { getProjectManager } = require('../services/projectManager');

    // 현재 프로젝트 가져오기
    const currentProjectId = store.getCurrentProjectId();

    if (!currentProjectId) {
      return { ok: false, message: "프로젝트가 선택되지 않았습니다." };
    }

    const projectManager = getProjectManager();
    let currentProject = store.getCurrentProject();

    if (!currentProject) {
      currentProject = await projectManager.findProjectById(currentProjectId);
      if (!currentProject) {
        return { ok: false, message: `프로젝트를 찾을 수 없습니다: ${currentProjectId}` };
      }
      projectManager.setCurrentProject(currentProject);
    }

    // 카테고리별 폴더 경로 (videos 또는 images)
    let targetDir;
    if (category === "videos") {
      targetDir = currentProject.paths.video;
    } else if (category === "images") {
      targetDir = currentProject.paths.images;
    } else {
      return { ok: false, message: `지원하지 않는 카테고리: ${category}` };
    }

    // 디렉토리 생성
    ensureDirSync(targetDir);

    // 파일 저장
    const filePath = path.join(targetDir, fileName);
    const bufferData = toBuffer(buffer);
    await fs.promises.writeFile(filePath, bufferData);

    console.log("✅ files/saveToProject 완료:", filePath);
    return { ok: true, path: filePath };
  } catch (error) {
    console.error("❌ files/saveToProject 실패:", error);
    return { ok: false, message: error.message };
  }
});

/** ✅ 디렉토리 내 모든 파일 삭제 (폴더는 유지) */
ipcMain.handle("files:clearDirectory", async (_evt, { dirPath }) => {
  try {
    console.log("🗑️ files:clearDirectory 호출됨:", dirPath);

    if (!dirPath || typeof dirPath !== "string") {
      return { success: false, message: "dirPath_required" };
    }

    // 디렉토리 존재 확인
    if (!fs.existsSync(dirPath)) {
      console.log("⚠️ 디렉토리 없음, 새로 생성:", dirPath);
      ensureDirSync(dirPath);
      return { success: true, deletedCount: 0 };
    }

    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      return { success: false, message: "path_is_not_directory" };
    }

    // 디렉토리 내 모든 파일/폴더 삭제
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    let deletedCount = 0;

    for (const entry of entries) {
      try {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile()) {
          await fs.promises.unlink(fullPath);
          deletedCount++;
          console.log("🗑️ 파일 삭제:", entry.name);
        } else if (entry.isDirectory()) {
          await fs.promises.rm(fullPath, { recursive: true, force: true });
          deletedCount++;
          console.log("🗑️ 폴더 삭제:", entry.name);
        }
      } catch (err) {
        console.warn("⚠️ 삭제 실패:", entry.name, err.message);
      }
    }

    console.log(`✅ files:clearDirectory 완료: ${deletedCount}개 항목 삭제`);
    return { success: true, deletedCount };
  } catch (error) {
    console.error("❌ files:clearDirectory 실패:", error);
    return { success: false, message: error.message };
  }
});
