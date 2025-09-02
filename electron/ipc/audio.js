// electron/ipc/audio.js
const { ipcMain } = require("electron");
const path = require("path");
const fsp = require("fs/promises");

// ESM 패키지(music-metadata)를 CJS에서 안전하게 로드하기 위한 helper
let mmPromise = null;
async function getMusicMetadata() {
  if (!mmPromise) {
    // 동적 import → ESM/Exports 이슈 해결
    mmPromise = import("music-metadata").catch((e) => {
      mmPromise = null; // 다음 시도 가능하게
      throw e;
    });
  }
  return mmPromise;
}

/**
 * MP3 길이(초) 반환
 * invoke: "audio/getDuration", { path }
 * return: number (seconds, float)
 */
ipcMain.handle("audio/getDuration", async (_e, { path: filePath }) => {
  if (!filePath) throw new Error("path_required");
  const mm = await getMusicMetadata(); // ← 동적 import
  const { format } = await mm.parseFile(filePath);
  return Number(format?.duration || 0);
});

/* =======================================================================
 * timemap 저장 유틸
 * ======================================================================= */
async function saveTimemap(outPath, timemap) {
  if (!outPath) throw new Error("outPath_required");
  if (!timemap || typeof timemap !== "object")
    throw new Error("timemap_required");

  // 최종 MP3와 같은 폴더에 저장
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  const tmPath = outPath.replace(/\.mp3$/i, ".timemap.json");
  await fsp.writeFile(tmPath, JSON.stringify(timemap, null, 2), "utf8");
  return tmPath;
}

/**
 * 씬 병합은 렌더러에서 처리 (stub)
 * 단, 렌더러가 병합을 끝낸 뒤 timemap을 같이 넘기면 여기서 .timemap.json으로 저장
 * invoke: "audio/concatScenes", { outPath, timemap }
 */
ipcMain.handle("audio/concatScenes", async (_e, payload = {}) => {
  try {
    let timemapPath = null;
    if (payload.outPath && payload.timemap) {
      timemapPath = await saveTimemap(payload.outPath, payload.timemap);
    }
    return { ok: true, note: "merge handled in renderer", timemapPath };
  } catch (e) {
    console.error("[audio/concatScenes] fail:", e);
    return { ok: false, error: String(e?.message || e) };
  }
});

/**
 * 명시적으로 timemap만 저장하고 싶을 때
 * invoke: "audio/saveTimemap", { outPath, timemap }
 */
ipcMain.handle("audio/saveTimemap", async (_e, { outPath, timemap } = {}) => {
  try {
    const timemapPath = await saveTimemap(outPath, timemap);
    return { ok: true, timemapPath };
  } catch (e) {
    console.error("[audio/saveTimemap] fail:", e);
    return { ok: false, error: String(e?.message || e) };
  }
});

module.exports = {}; // 명시적 export (안내용)
