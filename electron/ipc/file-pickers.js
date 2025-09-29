// electron/ipc/file-pickers.js
const { ipcMain, dialog, BrowserWindow } = require("electron");

function registerFilePickers() {
  const getMainWin = () => BrowserWindow.getAllWindows()[0];

  ipcMain.handle("files/select", async (_evt, { type }) => {
    let filters;
    let title;

    switch (type) {
      case "srt":
        filters = [{ name: "Subtitles", extensions: ["srt", "vtt"] }];
        title = "SRT 파일 선택";
        break;
      case "mp3":
        filters = [{ name: "Audio", extensions: ["mp3"] }];
        title = "오디오(MP3) 파일 선택";
        break;
      case "video":
        filters = [
          { name: "비디오 파일", extensions: ["mp4", "avi", "mov", "mkv", "webm", "m4v"] },
          { name: "모든 파일", extensions: ["*"] }
        ];
        title = "비디오 파일 선택";
        break;
      case "image":
        filters = [
          { name: "이미지 파일", extensions: ["jpg", "jpeg", "png", "gif", "bmp", "webp"] },
          { name: "모든 파일", extensions: ["*"] }
        ];
        title = "이미지 파일 선택";
        break;
      default:
        filters = [{ name: "모든 파일", extensions: ["*"] }];
        title = "파일 선택";
    }

    const win = getMainWin();
    const result = await dialog.showOpenDialog(win, {
      title,
      properties: ["openFile"],
      filters,
    });

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true };
    }
    return { canceled: false, filePath: result.filePaths[0] };
  });

  // 폴더 선택 다이얼로그
  ipcMain.handle("dialog:selectFolder", async (event, options = {}) => {
    const win = getMainWin();
    const dialogOptions = {
      title: "프로젝트 루트 폴더 선택",
      properties: ["openDirectory", "createDirectory"],
    };

    // 현재 경로가 있으면 기본 경로로 설정
    if (options.defaultPath) {
      dialogOptions.defaultPath = options.defaultPath;
    }

    const result = await dialog.showOpenDialog(win, dialogOptions);

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true };
    }
    return { canceled: false, filePaths: result.filePaths };
  });
}

module.exports = { registerFilePickers };
