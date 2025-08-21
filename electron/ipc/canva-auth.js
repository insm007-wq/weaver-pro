// electron/ipc/canva-auth.js
const { ipcMain, session, app } = require("electron");
const { PARTITION } = require("./canva-downloads"); // persist:canva 상수 재사용

// Canva 로그인 여부 추정: .canva.com 도메인에 의미있는 쿠키가 있는지 확인
async function isLoggedIn() {
  const ses = session.fromPartition(PARTITION);
  try {
    const cookies = await ses.cookies.get({ domain: ".canva.com" });
    // 이름은 종종 바뀌므로 보수적 휴리스틱: 주요 쿠키가 하나라도 있으면 로그인으로 간주
    const hit = cookies.some((c) =>
      /canva|sid|session|auth|csrf/i.test(`${c.name}`)
    );
    return hit;
  } catch {
    return false;
  }
}

function registerCanvaAuth() {
  ipcMain.handle("canva:check-auth", async () => {
    return { ok: true, loggedIn: await isLoggedIn() };
  });

  // 로그인/캐시 등 전체 초기화
  ipcMain.handle("canva:clear-auth", async () => {
    const ses = session.fromPartition(PARTITION);
    try {
      await ses.clearStorageData({
        origin: null,
        storages: [
          "cookies",
          "localstorage",
          "serviceworkers",
          "indexdb",
          "filesystem",
          "cache",
        ],
        quotas: ["temporary", "persistent", "syncable"],
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e?.message || e) };
    }
  });

  // (선택) 서비스워커/캐시만 지우기
  ipcMain.handle("canva:clear-cache", async () => {
    const ses = session.fromPartition(PARTITION);
    try {
      await ses.clearStorageData({ storages: ["cache", "serviceworkers"] });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e?.message || e) };
    }
  });
}

module.exports = { registerCanvaAuth };
