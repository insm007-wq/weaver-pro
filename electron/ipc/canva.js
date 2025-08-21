// electron/ipc/canva.js
const { ipcMain, BrowserWindow, shell } = require("electron");
const axios = require("axios");
const { URL } = require("url");

// (옵션) 네 프로젝트에 이미 있는 secret/settings 서비스가 있다면 사용
let getSetting, getSecret, setSecret;
try {
  // 존재한다면 사용 (없으면 payload/환경변수에서 받음)
  ({ getSetting } = require("../services/settings"));
} catch {}
try {
  ({ getSecret, setSecret } = require("../services/secrets"));
} catch {}

/**
 * 안전한 가져오기: 우선순위 payload > settings/env > 기본값(undefined)
 */
async function resolveOAuthConfig(payload = {}) {
  const env = process.env || {};
  const cfg = {
    clientId:
      payload.clientId ||
      (getSetting ? await getSetting("canva.clientId") : undefined) ||
      env.CANVA_CLIENT_ID,
    clientSecret:
      payload.clientSecret ||
      (getSecret ? await getSecret("canva.clientSecret") : undefined) ||
      env.CANVA_CLIENT_SECRET,
    redirectUri:
      payload.redirectUri ||
      (getSetting ? await getSetting("canva.redirectUri") : undefined) ||
      env.CANVA_REDIRECT_URI,
    scope:
      payload.scope ||
      (getSetting ? await getSetting("canva.scope") : undefined) ||
      "design:read design:write",
    // 지역 이슈가 있다면 authorize/token 엔드포인트를 조정
    authorizeEndpoint:
      payload.authorizeEndpoint || "https://www.canva.com/oauth/authorize",
    tokenEndpoint: payload.tokenEndpoint || "https://www.canva.com/oauth/token",
  };

  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
    throw new Error(
      "[canva] OAuth config missing. clientId/clientSecret/redirectUri 필요"
    );
  }
  return cfg;
}

function buildAuthorizeUrl({
  authorizeEndpoint,
  clientId,
  redirectUri,
  scope,
}) {
  const u = new URL(authorizeEndpoint);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("scope", scope);
  // 보안: CSRF 방지용 state (간단 랜덤)
  const state = Math.random().toString(36).slice(2);
  u.searchParams.set("state", state);
  return { url: u.toString(), state };
}

async function exchangeToken({
  tokenEndpoint,
  code,
  clientId,
  clientSecret,
  redirectUri,
}) {
  // 표준 OAuth2: x-www-form-urlencoded 로 전송
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);

  const res = await axios.post(tokenEndpoint, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 20000,
  });
  return res.data; // { access_token, expires_in, refresh_token, scope, token_type, ... }
}

function registerCanvaOAuth() {
  ipcMain.handle("oauth/canvaLogin", async (_evt, payload) => {
    const cfg = await resolveOAuthConfig(payload).catch((e) => {
      return { error: e.message };
    });
    if (cfg.error) return { ok: false, error: cfg.error };

    return new Promise((resolve) => {
      const { url: authUrl, state } = buildAuthorizeUrl(cfg);

      const authWin = new BrowserWindow({
        width: 900,
        height: 700,
        title: "Canva 로그인",
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      const finish = (result) => {
        try {
          resolve(result);
        } finally {
          if (!authWin.isDestroyed()) authWin.close();
        }
      };

      const onNav = async (navigatedUrl) => {
        // redirect_uri 에 도달하면 code 파싱
        if (!navigatedUrl.startsWith(cfg.redirectUri)) return;

        try {
          const u = new URL(navigatedUrl);
          const code = u.searchParams.get("code");
          const gotState = u.searchParams.get("state");
          const err = u.searchParams.get("error");

          if (err) {
            return finish({ ok: false, error: err });
          }
          if (!code) {
            return finish({ ok: false, error: "Authorization code missing" });
          }
          if (gotState && gotState !== state) {
            return finish({ ok: false, error: "Invalid state" });
          }

          // 토큰 교환
          const token = await exchangeToken({
            tokenEndpoint: cfg.tokenEndpoint,
            code,
            clientId: cfg.clientId,
            clientSecret: cfg.clientSecret,
            redirectUri: cfg.redirectUri,
          });

          // 토큰 저장(선택)
          if (setSecret) {
            await setSecret("canva.accessToken", token.access_token);
            if (token.refresh_token) {
              await setSecret("canva.refreshToken", token.refresh_token);
            }
          }

          return finish({ ok: true, token });
        } catch (e) {
          return finish({ ok: false, error: e.message || String(e) });
        }
      };

      authWin.webContents.on("will-redirect", (_e, url) => onNav(url));
      authWin.webContents.on("did-navigate", (_e, url) => onNav(url));
      authWin.on("closed", () => finish({ ok: false, canceled: true }));

      // 외부 링크는 시스템 브라우저로 열기
      authWin.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
      });

      // 로그인 시작
      authWin.loadURL(authUrl).catch((e) => {
        finish({ ok: false, error: e.message || String(e) });
      });
    });
  });
}

module.exports = { registerCanvaOAuth };
