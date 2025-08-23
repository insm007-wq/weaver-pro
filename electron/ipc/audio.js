// electron/ipc/audio.js
const { ipcMain } = require("electron");
const mm = require("music-metadata");

/**
 * MP3 길이(초) 반환
 * invoke: "audio/getDuration", { path }
 * return: number (seconds, float)
 */
ipcMain.handle("audio/getDuration", async (_e, { path: filePath }) => {
  if (!filePath) throw new Error("path_required");
  const { format } = await mm.parseFile(filePath);
  return Number(format?.duration || 0);
});

/**
 * 씬 병합은 렌더러에서 처리 (stub)
 */
ipcMain.handle("audio/concatScenes", async () => {
  return { ok: true, note: "merge handled in renderer" };
});
