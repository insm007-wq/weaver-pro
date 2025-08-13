// electron/ipc/settings.js
const { ipcMain } = require("electron");
const store = require("../services/store");
const { getSecret, setSecret } = require("../services/secrets");

// ---- helpers ----
function ensureKey(k, msg = "key is required") {
  if (typeof k !== "string" || !k.trim()) {
    throw new Error(msg);
  }
  return k.trim();
}

// ---- 일반 설정 (electron-store) ----
ipcMain.handle("settings:get", async (_e, key) => {
  const k = ensureKey(key, "key is required");
  // undefined를 그대로 보내면 렌더러에서 처리하기 불편하니 null로 통일
  const v = store.get(k);
  return v === undefined ? null : v;
});

ipcMain.handle("settings:set", async (_e, payload) => {
  // payload는 { key, value } 형태여야 함
  const { key, value } = payload || {};
  const k = ensureKey(key, "key is required");
  store.set(k, value);
  return { ok: true };
});

// ---- 비밀 값 (keytar) ----
ipcMain.handle("secrets:get", async (_e, key) => {
  const k = ensureKey(key, "key is required");
  try {
    const v = await getSecret(k);
    return v ?? null;
  } catch (err) {
    // 렌더러가 문자열만 받도록
    return { ok: false, message: String(err?.message || err) };
  }
});

ipcMain.handle("secrets:set", async (_e, payload) => {
  // payload는 { key, value } 형태여야 함
  const { key, value } = payload || {};
  const k = ensureKey(key, "Account is required"); // keytar의 account 의미
  // value가 undefined면 빈 문자열로 저장 (keytar 요구사항에 안전)
  const v = value == null ? "" : String(value);
  try {
    await setSecret(k, v);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});
