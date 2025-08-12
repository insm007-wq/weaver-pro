// electron/ipc/settings.js
const { ipcMain } = require("electron");
const store = require("../services/store");
const { getSecret, setSecret } = require("../services/secrets");

ipcMain.handle("settings:get", async (_e, key) => store.get(key));
ipcMain.handle("settings:set", async (_e, { key, value }) => {
  store.set(key, value);
  return { ok: true };
});

ipcMain.handle("secrets:get", async (_e, key) => getSecret(key));
ipcMain.handle("secrets:set", async (_e, { key, value }) => {
  await setSecret(key, value);
  return { ok: true };
});
