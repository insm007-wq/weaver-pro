// src/utils/ipcSafe.js
// window.api 호출을 한 군데로 모으고, 플랫폼/이름 차이를 흡수
function getFn(path) {
  const segs = String(path).split(".");
  let obj = typeof window !== "undefined" ? window : undefined;
  obj = obj?.api;
  for (const s of segs) obj = obj?.[s];
  return typeof obj === "function" ? obj : null;
}
async function tryCall(fnPath, ...args) {
  const fn = getFn(fnPath);
  if (!fn) return undefined;
  try {
    return await fn(...args);
  } catch {
    return undefined;
  }
}

/* -------- Settings / Secrets -------- */
export async function getSetting(key) {
  const v = await tryCall("getSetting", key);
  return v ?? null;
}
export async function setSetting({ key, value }) {
  const r = (await tryCall("setSetting", { key, value })) ?? (await tryCall("settingsSet", { key, value }));
  return r ?? null;
}
export async function getSecret(key) {
  const a = await tryCall("getSecret", key);
  if (a != null) return a;
  const b = await getSetting(`secrets.${key}`);
  return b ?? null;
}
export async function setSecret({ key, value }) {
  const r = (await tryCall("setSecret", { key, value })) ?? (await tryCall("secretsSet", { key, value }));
  return r ?? null;
}

/* -------- 파일 읽기 / 오디오 길이 -------- */
export async function readTextAny(path) {
  const a = await tryCall("readText", path);
  if (a) return a;
  const b = await tryCall("readTextFile", path);
  if (b) return b;
  return null;
}
export async function getMp3DurationSafe(path) {
  const a = await tryCall("getMp3Duration", path);
  if (a != null) return Number(a) || 0;
  const b = await tryCall("audioGetDuration", path);
  if (b != null) return Number(b) || 0;
  return 0;
}

/* -------- 스톡 검색/저장 -------- */
export async function stockSearch(options) {
  const r =
    (await tryCall("stockSearch", options)) ??
    (await tryCall("searchStockVideos", options)) ??
    (await tryCall("stocks.search", options)) ??
    null;

  if (r && typeof r === "object") {
    const ok = !!(r.ok ?? (Array.isArray(r.items) && r.items.length >= 0));
    const items = Array.isArray(r.items) ? r.items : [];
    return { ok, items, ...r };
  }
  return { ok: false, items: [] };
}

export async function saveUrlToProject({ url, category, fileName }) {
  const r =
    (await tryCall("saveUrlToProject", { url, category, fileName })) ??
    (await tryCall("files.saveUrlToProject", { url, category, fileName })) ??
    (await tryCall("saveFromUrl", { url, category, fileName })) ??
    (await tryCall("files.saveFromUrl", { url, category, fileName })) ??
    null;

  if (r && typeof r === "object") {
    const ok = !!(r.ok ?? r.success ?? r.path);
    const path = r.path ?? r.filePath ?? r.fullPath ?? null;
    return { ok, path, ...r };
  }
  return { ok: false, path: null };
}

/* -------- AI 키워드 추출 -------- */
export async function aiExtractKeywords({ apiKey, text, topK = 60, language = "ko" }) {
  const r =
    (await tryCall("aiExtractKeywords", { apiKey, text, topK, language })) ??
    (await tryCall("ai.extractKeywords", { apiKey, text, topK, language })) ??
    null;

  if (r && typeof r === "object") {
    const ok = !!(r.ok ?? Array.isArray(r.keywords));
    const keywords = Array.isArray(r.keywords) ? r.keywords : [];
    return { ok, keywords, ...r };
  }
  return { ok: false, keywords: [] };
}

/* -------- (선택) 프로젝트 폴더 보장 -------- */
export async function ensureProjectDir(category) {
  const r = (await tryCall("ensureProjectDir", category)) ?? (await tryCall("files.ensureCategory", category)) ?? null;
  return r ?? null;
}
