// electron/ipc/audio.js
const { ipcMain } = require("electron");
ipcMain.handle("audio/concatScenes", async () => {
  // 렌더러에서 이미 MP3를 병합하여 narration.mp3 저장하도록 변경
  return { ok: true, note: "merge handled in renderer" };
});
