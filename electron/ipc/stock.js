// electron/ipc/stock.js
const { ipcMain } = require("electron");
const axios = require("axios");

const DBG = process.env.DEBUG_STOCK === "1";
const log = (...a) => DBG && console.log("[stock]", ...a);
const errlog = (...a) => console.warn("[stock:ERR]", ...a);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 프로바이더별 레이트리밋 상태 ─────────────────────────────────────────── */
const providerState = {
  pexels: { backoff: 0, nextAt: 0 },
  pixabay: { backoff: 0, nextAt: 0 },
};
const BASE_BACKOFF = 1200; // 시작 1.2s
const MAX_BACKOFF = 60000; // 최대 60s

async function withRateLimit(provider, doRequest) {
  const st = providerState[provider];
  const now = Date.now();
  if (now < st.nextAt) await sleep(st.nextAt - now);

  try {
    const res = await doRequest();
    // 성공하면 백오프 해제
    st.backoff = 0;
    st.nextAt = Date.now();
    return res;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 429) {
      // Retry-After(초) 존중 + 지수백오프(+지터)
      const ra = parseInt(e?.response?.headers?.["retry-after"] || "", 10);
      let wait = Number.isFinite(ra) ? ra * 1000 : st.backoff ? Math.min(MAX_BACKOFF, st.backoff * 2) : BASE_BACKOFF;
      wait = Math.min(MAX_BACKOFF, Math.round(wait * (1 + Math.random() * 0.25)));
      st.backoff = wait;
      st.nextAt = Date.now() + wait;
      errlog(`${provider} 429 rate-limited. backoff(ms)= ${wait}`);
      // 429는 '빈 결과'로 처리하여 상위 로직이 다른 키워드/다른 공급사로 진행하도록
      return { _rateLimited: true, data: null };
    }
    // 그 외는 상위에서 잡도록 로그만
    errlog(provider, e?.message || e);
    throw e;
  }
}

/* ── 공통 유틸 ──────────────────────────────────────────────────────────── */
function closestRes(files, target) {
  if (!Array.isArray(files) || !files.length) return null;
  const { w: tw = 0, h: th = 0 } = target || {};
  return (
    files
      .filter((f) => f && f.url && f.width && f.height)
      .map((f) => ({ ...f, _score: Math.abs(f.width - tw) + Math.abs(f.height - th) }))
      .sort((a, b) => a._score - b._score)[0] || null
  );
}
function withinBytes(size, minB, maxB) {
  if (!size || size <= 0) return false;
  if (minB && size < minB) return false;
  if (maxB && size > maxB) return false;
  return true;
}
function normTerms(q, arr) {
  const out = [];
  if (typeof q === "string" && q.trim()) out.push(q.trim());
  if (Array.isArray(arr))
    for (const t of arr) {
      const s = String(t || "").trim();
      if (s && !out.includes(s)) out.push(s);
    }
  return out;
}

/* ── Providers ─────────────────────────────────────────────────────────── */
async function searchPexels({ apiKey, query, perPage, targetRes, minBytes, maxBytes }) {
  if (!apiKey) return [];
  const url = "https://api.pexels.com/videos/search";
  const params = { query, per_page: Math.min(perPage || 6, 80), locale: "ko-KR" };

  const r = await withRateLimit("pexels", () => axios.get(url, { headers: { Authorization: apiKey }, params, timeout: 15000 }));
  if (r?._rateLimited || !r?.data) return [];

  const out = [];
  for (const v of r.data?.videos || []) {
    const files = (v.video_files || [])
      .filter((f) => /^video\/mp4$/i.test(f.file_type || "video/mp4"))
      .map((f) => ({ url: f.link, width: f.width || 0, height: f.height || 0, size: f.file_size || 0, quality: f.quality || "" }));
    const sized = files.filter((f) => withinBytes(f.size, minBytes, maxBytes));
    const best = closestRes(sized.length ? sized : files, targetRes);
    if (best?.url) {
      const id = v.id;
      out.push({
        provider: "pexels",
        url: best.url,
        filename: `pexels-${id}-${best.width}x${best.height}.mp4`,
        width: best.width,
        height: best.height,
        size: best.size || 0,
        quality: best.quality || "",
        tags: [],
      });
    }
  }
  return out;
}

async function searchPixabay({ apiKey, query, perPage, targetRes, minBytes, maxBytes }) {
  if (!apiKey) return [];
  const url = "https://pixabay.com/api/videos/";
  const params = { key: apiKey, q: query, per_page: Math.min(perPage || 6, 200), video_type: "film", safesearch: "true" };

  const r = await withRateLimit("pixabay", () => axios.get(url, { params, timeout: 15000 }));
  if (r?._rateLimited || !r?.data) return [];

  const out = [];
  for (const hit of r.data?.hits || []) {
    const variants = [];
    for (const k of ["large", "medium", "small", "tiny"]) {
      const v = hit.videos?.[k];
      if (v?.url) variants.push({ url: v.url, width: v.width || 0, height: v.height || 0, size: v.size || 0, label: k });
    }
    const sized = variants.filter((v) => withinBytes(v.size, minBytes, maxBytes));
    const best = closestRes(sized.length ? sized : variants, targetRes);
    if (best?.url) {
      const id = hit.id;
      const tags = String(hit.tags || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      out.push({
        provider: "pixabay",
        url: best.url,
        filename: `pixabay-${id}-${best.width}x${best.height}.mp4`,
        width: best.width,
        height: best.height,
        size: best.size || 0,
        quality: best.label || "",
        tags,
      });
    }
  }
  return out;
}

/* ── IPC ───────────────────────────────────────────────────────────────── */
function registerStockIPC() {
  ipcMain.removeHandler?.("stock:search");
  ipcMain.handle("stock:search", async (_e, payload = {}) => {
    const {
      query = "",
      queries = [],
      perPage = 6,
      providers = ["pexels", "pixabay"],
      pexelsKey,
      pixabayKey,
      targetRes = { w: 2560, h: 1440 },
      minBytes = 0,
      maxBytes = 0,
      type = "videos",
      strictKeyword = false,
    } = payload || {};

    const qTerms = normTerms(query, queries);
    if (!qTerms.length) return { ok: false, message: "query_required", items: [] };
    if (type !== "videos") return { ok: false, message: "only_videos_supported", items: [] };

    try {
      let results = [];
      for (const q of qTerms) {
        if (providers.includes("pexels") && pexelsKey) {
          try {
            const items = await searchPexels({ apiKey: pexelsKey, query: q, perPage, targetRes, minBytes, maxBytes });
            results = results.concat(items.map((it) => ({ ...it, _q: q })));
          } catch (_) {}
        }
        if (providers.includes("pixabay") && pixabayKey) {
          try {
            const items = await searchPixabay({ apiKey: pixabayKey, query: q, perPage, targetRes, minBytes, maxBytes });
            results = results.concat(items.map((it) => ({ ...it, _q: q })));
          } catch (_) {}
        }
      }

      // 중복 제거
      const seen = new Set();
      const uniq = [];
      for (const r of results) {
        const key = (r?.url || "").split("?")[0];
        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniq.push(r);
      }

      // strict(가능 범위 내) 필터
      let filtered = uniq;
      if (strictKeyword) {
        const needles = qTerms.map((s) => s.toLowerCase());
        filtered = uniq.filter((it) => (it.provider === "pixabay" && it.tags?.length ? needles.some((t) => it.tags.some((tag) => tag.includes(t))) : true));
      }

      // 해상도/용량 근접 정렬
      filtered.sort((a, b) => {
        const aS = Math.abs((a.width || 0) - (targetRes.w || 0)) + Math.abs((a.height || 0) - (targetRes.h || 0));
        const bS = Math.abs((b.width || 0) - (targetRes.w || 0)) + Math.abs((b.height || 0) - (targetRes.h || 0));
        if (aS !== bS) return aS - bS;
        const mid = minBytes && maxBytes ? (minBytes + maxBytes) / 2 : 0;
        const aD = mid ? Math.abs((a.size || 0) - mid) : 0;
        const bD = mid ? Math.abs((b.size || 0) - mid) : 0;
        return aD - bD;
      });

      return { ok: true, items: filtered };
    } catch (e) {
      errlog("search fatal", e?.message || e);
      return { ok: false, message: String(e?.message || e), items: [] };
    }
  });

  console.log("[ipc] stock.registerStockIPC: OK");
}
module.exports = { registerStockIPC };
