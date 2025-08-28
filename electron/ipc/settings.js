// electron/ipc/settings.js
const { ipcMain, BrowserWindow } = require("electron");
const store = require("../services/store");
const { getSecret, setSecret } = require("../services/secrets");

/* ========================================================================== */
/* helpers                                                                    */
/* ========================================================================== */
function ensureKey(k, msg = "key is required") {
  if (typeof k !== "string" || !k.trim()) {
    throw new Error(msg);
  }
  return k.trim();
}

function isEqual(a, b) {
  // 값 비교(객체/배열 포함) – 브로드캐스트 노이즈 줄이기
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return a === b;
  }
}

function broadcastChanged(payload) {
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const w of wins) {
      w.webContents.send("settings:changed", payload);
    }
  } catch (e) {
    console.warn("[settings] broadcast fail:", e);
  }
}

/* ========================================================================== */
/* 일반 설정 (electron-store)                                                 */
/* ========================================================================== */
ipcMain.handle("settings:get", async (_e, key) => {
  const k = ensureKey(key, "key is required");
  // undefined 그대로 넘기면 렌더러에서 다루기 불편 → null로 통일
  const v = store.get(k);
  return v === undefined ? null : v;
});

ipcMain.handle("settings:set", async (_e, payload) => {
  // payload는 { key, value } 형태
  const { key, value } = payload || {};
  const k = ensureKey(key, "key is required");

  const prev = store.get(k);
  store.set(k, value);

  // 값이 변경되었으면 모든 렌더러에 브로드캐스트
  if (!isEqual(prev, value)) {
    broadcastChanged({ key: k, value });
  }
  return { ok: true };
});

/* (옵션) 여러 키를 한 번에 저장하고 개별 변경 브로드캐스트 */
ipcMain.handle("settings:setMany", async (_e, items) => {
  // items: Array<{ key, value }>
  if (!Array.isArray(items))
    return { ok: false, message: "items must be array" };

  for (const it of items) {
    const k = ensureKey(it?.key, "key is required");
    const prev = store.get(k);
    store.set(k, it.value);
    if (!isEqual(prev, it.value)) {
      broadcastChanged({ key: k, value: it.value });
    }
  }
  return { ok: true };
});

/* ========================================================================== */
/* 비밀 값 (keytar)                                                           */
/* ========================================================================== */
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
  // value가 undefined면 빈 문자열로 저장 (keytar 안전)
  const v = value == null ? "" : String(value);
  try {
    await setSecret(k, v);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: String(err?.message || err) };
  }
});
