// electron/utils/window.js
const { BrowserWindow, Menu } = require("electron");
const path = require("path");

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    backgroundColor: "#f5f7fa",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "..", "preload.js"),
    },
  });
  Menu.setApplicationMenu(null);
  win.loadURL(process.env.VITE_DEV_SERVER_URL || "http://localhost:5173");
  // win.webContents.openDevTools({ mode: "detach" });
  return win;
}

module.exports = { createMainWindow };
