// electron/ipc/audio.js
const { ipcMain } = require("electron");

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

/**
 * 씬 병합은 렌더러에서 처리 (stub)
 */
ipcMain.handle("audio/concatScenes", async () => {
  return { ok: true, note: "merge handled in renderer" };
});

module.exports = {}; // 명시적 export (안내용)
