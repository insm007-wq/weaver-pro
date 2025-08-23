// electron/ipc/canva.js
const { BrowserWindow, ipcMain, app } = require("electron");
const http = require("http");
const crypto = require("crypto");
const fetch = (...a) => import("node-fetch").then(({ default: f }) => f(...a));
const { URL } = require("url");

/* ----------------------------- PKCE 유틸 ----------------------------- */
function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function buildAuthUrl({ clientId, redirectUri, scope, challenge }) {
  const u = new URL("https://www.canva.com/api/oauth/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("scope", scope);
  return u.toString();
}

async function exchangeToken({ code, verifier, clientId, redirectUri }) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    client_id: clientId,
  });
  if (process.env.CANVA_CLIENT_SECRET) {
    params.set("client_secret", process.env.CANVA_CLIENT_SECRET); // 개발 중 임시
  }
  const res = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error(`Token exchange failed ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

/* ------------------------ 루프백 서버 (127.0.0.1) ------------------------ */
function startLoopbackServer(expectedPath = "/oauth/redirect", port = 51789) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const u = new URL(req.url, `http://127.0.0.1:${port}`);
        if (u.pathname === expectedPath) {
          const code = u.searchParams.get("code");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<html><body style="font-family:sans-serif"><h3>로그인이 완료되었습니다.</h3><p>이 창은 자동으로 닫혀요.</p></body></html>`);
          server.close(() => resolve(code || null));
          return;
        }
        res.writeHead(404);
        res.end("Not found");
      } catch (e) {
        try {
          res.writeHead(500);
          res.end("Error");
        } catch {}
        server.close(() => reject(e));
      }
    });
    server.on("error", (e) => reject(e));
    server.listen(port, "127.0.0.1", () => {});
  });
}

/* ----------------------------- 로그인 플로우 ----------------------------- */
async function startCanvaAuth() {
  const clientId = process.env.CANVA_CLIENT_ID;
  const redirectUri = process.env.CANVA_REDIRECT_URI; // http://127.0.0.1:51789/oauth/redirect 권장
  const scope = "design:content:read asset:write profile:read";
  if (!clientId || !redirectUri) throw new Error("ENV 미설정: CANVA_CLIENT_ID / CANVA_REDIRECT_URI");

  await app.whenReady();
  const { verifier, challenge } = pkce();
  const authUrl = buildAuthUrl({ clientId, redirectUri, scope, challenge });

  const win = new BrowserWindow({
    width: 980,
    height: 760,
    title: "Canva에 연결",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    show: true,
  });

  console.log("[canva] authorize:", authUrl);
  console.log("[canva] redirectUri:", redirectUri);

  const redir = new URL(redirectUri);
  const isLoopback = redir.protocol.startsWith("http");

  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(() => {
      try {
        win.close();
      } catch {}
      reject(new Error("Canva 로그인 타임아웃(120s)"));
    }, 120000);
    try {
      const codePromise = isLoopback ? startLoopbackServer(redir.pathname || "/oauth/redirect", Number(redir.port || 51789)) : new Promise((_r) => {}); // 딥링크 모드는 main에서 직접 처리

      await win.loadURL(authUrl);
      const code = await codePromise;
      if (!code) {
        clearTimeout(timeout);
        try {
          win.close();
        } catch {}
        return reject(new Error("리디렉트 code 없음"));
      }
      console.log("[canva] got code:", code.slice(0, 8) + "…");

      const token = await exchangeToken({ code, verifier, clientId, redirectUri });
      clearTimeout(timeout);
      try {
        win.close();
      } catch {}
      resolve(token);
    } catch (e) {
      clearTimeout(timeout);
      try {
        win.close();
      } catch {}
      reject(e);
    }
  });
}

/* ----------------------------- IPC 등록 ----------------------------- */
function registerCanvaIPC() {
  ipcMain.handle("canva.login", async () => startCanvaAuth());
  ipcMain.handle("canva/login", async () => startCanvaAuth()); // 호환
  console.log("ipc/canva registered (redirect:", process.env.CANVA_REDIRECT_URI, ", scopes: profile:read design:content:read )");
}

module.exports = { registerCanvaIPC };
