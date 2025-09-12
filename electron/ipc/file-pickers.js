// electron/ipc/file-pickers.js
const { ipcMain, dialog, BrowserWindow } = require("electron");

function registerFilePickers() {
  const getMainWin = () => BrowserWindow.getAllWindows()[0];

  ipcMain.handle("files/select", async (_evt, { type }) => {
    const filters =
      type === "srt"
        ? [{ name: "Subtitles", extensions: ["srt", "vtt"] }]
        : [{ name: "Audio", extensions: ["mp3"] }]; // 요구: MP3만

    const win = getMainWin();
    const result = await dialog.showOpenDialog(win, {
      title: type === "srt" ? "SRT 파일 선택" : "오디오(MP3) 파일 선택",
      properties: ["openFile"],
      filters,
    });

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  // 폴더 선택 다이얼로그
  ipcMain.handle("dialog:selectFolder", async () => {
    const win = getMainWin();
    const result = await dialog.showOpenDialog(win, {
      title: "영상 저장 폴더 선택",
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true };
    }
    return { canceled: false, filePaths: result.filePaths };
  });
}

module.exports = { registerFilePickers };
