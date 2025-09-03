// electron/ipc/stock.js
// ============================================================================
// 스톡 영상 검색 IPC (안정화 버전)
// - per-provider gate(동시요청 제한), rate-limit 서킷브레이커, 로그 스로틀링
// - 429/네트워크 에러는 즉시 스킵해서 다음 작업으로 진행
// ============================================================================

const { ipcMain } = require("electron");
const axios = require("axios");

const DBG = process.env.DEBUG_STOCK === "1";
const log = (...a) => DBG && console.log("[stock]", ...a);
const errlog = (...a) => console.warn("[stock:ERR]", ...a);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── per-provider gate (동시요청 상한) ───────────────────────────────────── */
const MAX_INFLIGHT = 2; // 프로바이더당 동시 요청 2개로 제한
const GATE_SLEEP = 80; // 게이트 대기 간격
const inflight = { pexels: 0, pixabay: 0 };

async function gate(provider) {
  while ((inflight[provider] || 0) >= MAX_INFLIGHT) await sleep(GATE_SLEEP);
  inflight[provider] = (inflight[provider] || 0) + 1;
  let released = false;
  return () => {
    if (!released) {
      inflight[provider] = Math.max(0, (inflight[provider] || 1) - 1);
      released = true;
    }
  };
}

/* ── 레이트리밋/서킷 상태 ──────────────────────────────────────────────── */
const providerState = {
  pexels: { backoff: 0, nextAt: 0, strikes: 0, disabledUntil: 0, lastLogAt: 0 },
  pixabay: { backoff: 0, nextAt: 0, strikes: 0, disabledUntil: 0, lastLogAt: 0 },
};

const BASE_BACKOFF = 1200; // 1.2s 시작
const MAX_BACKOFF = 60000; // 60s 상한
const LOG_THROTTLE_MS = 3000; // 429 로그 스로틀링
const SKIP_IF_REMAIN_MS = 2500; // 백오프 잔여 > 2.5s 면 즉시 스킵
const CIRCUIT_STRIKES = 3; // 연속 429 n회 → 서킷 오픈
const CIRCUIT_MAX_MS = 5 * 60 * 1000; // 서킷 최대 5분

async function withRateLimit(provider, doRequest) {
  const st = providerState[provider];
  const now = Date.now();

  // 서킷 오픈 중이면 즉시 스킵
  if (now < st.disabledUntil) return { _rateLimited: true, data: null };

  // per-provider 동시요청 제한
  const release = await gate(provider);
  try {
    // 백오프가 예약되어 있으면: 잔여 대기가 짧으면 기다리고, 길면 스킵
    if (now < st.nextAt) {
      const remain = st.nextAt - now;
      if (remain > SKIP_IF_REMAIN_MS) return { _rateLimited: true, data: null };
      await sleep(remain);
    }

    const res = await doRequest();

    // 성공 → 상태 초기화
    st.backoff = 0;
    st.nextAt = 0;
    st.strikes = 0;
    return res;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 429) {
      // backoff 계산
      const ra = parseInt(e?.response?.headers?.["retry-after"] || "", 10);
      let wait = Number.isFinite(ra) ? ra * 1000 : st.backoff ? Math.min(MAX_BACKOFF, Math.round(st.backoff * 1.5)) : BASE_BACKOFF;
      wait = Math.min(MAX_BACKOFF, Math.round(wait * (1 + Math.random() * 0.2)));

      st.backoff = wait;
      st.nextAt = Date.now() + wait;
      st.strikes = (st.strikes || 0) + 1;

      // 서킷 트립: 연속 429 다수 or 백오프 길이 과도
      if (st.strikes >= CIRCUIT_STRIKES || wait > 10000) {
        st.disabledUntil = Date.now() + Math.min(CIRCUIT_MAX_MS, wait * 4);
        st.strikes = 0; // 카운터 리셋
      }

      // 로그 스로틀링
      const now2 = Date.now();
      if (now2 - (st.lastLogAt || 0) > LOG_THROTTLE_MS) {
        errlog(`${provider} 429 rate-limited. backoff(ms)= ${wait}` + (st.disabledUntil > now2 ? " (circuit open)" : ""));
        st.lastLogAt = now2;
      }

      // 호출부는 빈 결과로 판단하도록
      return { _rateLimited: true, data: null };
    }

    // 기타 에러는 호출부 allSettled에서 스킵
    errlog(provider, e?.message || e);
    throw e;
  } finally {
    release();
  }
}

/* ── 공통 유틸 ──────────────────────────────────────────────────────────── */
function closestRes(files, target) {
  if (!Array.isArray(files) || !files.length) return null;
  const { w: tw = 0, h: th = 0 } = target || {};
  return (
    files
      .filter((f) => f && f.url && f.width && f.height)
      .map((f) => ({
        ...f,
        _score: Math.abs((f.width || 0) - tw) + Math.abs((f.height || 0) - th),
      }))
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
  if (Array.isArray(arr)) {
    for (const t of arr) {
      const s = String(t || "").trim();
      if (s && !out.includes(s)) out.push(s);
    }
  }
  return out;
}

/* ── Providers ─────────────────────────────────────────────────────────── */
async function searchPexels({ apiKey, query, perPage, targetRes, minBytes, maxBytes }) {
  if (!apiKey) return [];
  const url = "https://api.pexels.com/videos/search";
  const params = { query, per_page: Math.min(perPage || 6, 80), locale: "ko-KR" };

  const r = await withRateLimit("pexels", () => axios.get(url, { headers: { Authorization: apiKey }, params, timeout: 10000 }));
  if (r?._rateLimited || !r?.data) return [];

  const out = [];
  for (const v of r.data?.videos || []) {
    const files = (v.video_files || [])
      .filter((f) => /^video\/mp4$/i.test(f.file_type || "video/mp4"))
      .map((f) => ({
        url: f.link,
        width: f.width || 0,
        height: f.height || 0,
        size: f.file_size || 0,
        quality: f.quality || "",
      }));
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
  const params = {
    key: apiKey,
    q: query,
    per_page: Math.min(perPage || 6, 200),
    video_type: "film",
    safesearch: "true",
  };

  const r = await withRateLimit("pixabay", () => axios.get(url, { params, timeout: 10000 }));
  if (r?._rateLimited || !r?.data) return [];

  const out = [];
  for (const hit of r.data?.hits || []) {
    const variants = [];
    for (const k of ["large", "medium", "small", "tiny"]) {
      const v = hit.videos?.[k];
      if (v?.url)
        variants.push({
          url: v.url,
          width: v.width || 0,
          height: v.height || 0,
          size: v.size || 0,
          label: k,
        });
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

/* ── IPC 핸들러 ─────────────────────────────────────────────────────────── */
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

    const meta = {
      queries: qTerms.length,
      providerCalls: 0,
      providerErrors: 0,
      emptyResults: 0,
      usedProviders: providers.filter(Boolean),
    };

    try {
      let results = [];

      for (const q of qTerms) {
        const tasks = [];

        if (providers.includes("pexels") && pexelsKey) {
          meta.providerCalls++;
          tasks.push(searchPexels({ apiKey: pexelsKey, query: q, perPage, targetRes, minBytes, maxBytes }));
        }
        if (providers.includes("pixabay") && pixabayKey) {
          meta.providerCalls++;
          tasks.push(searchPixabay({ apiKey: pixabayKey, query: q, perPage, targetRes, minBytes, maxBytes }));
        }

        if (!tasks.length) continue;

        const settled = await Promise.allSettled(tasks);
        for (const s of settled) {
          if (s.status === "fulfilled") {
            const arr = Array.isArray(s.value) ? s.value : [];
            if (!arr.length) meta.emptyResults++;
            for (const it of arr) results.push({ ...it, _q: q });
          } else {
            meta.providerErrors++;
            errlog("provider call failed:", s.reason?.message || s.reason);
          }
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

      // strict 필터 (가능한 범위 내)
      let filtered = uniq;
      if (strictKeyword) {
        const needles = qTerms.map((s) => s.toLowerCase());
        filtered = uniq.filter((it) => {
          if (it.provider === "pixabay" && it.tags?.length) {
            return needles.some((t) => it.tags.some((tag) => tag.includes(t)));
          }
          return true; // pexels는 태그 빈약 → 필터 제외
        });
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

      log("search done:", { terms: qTerms.length, results: filtered.length, meta });
      return { ok: true, items: filtered, meta };
    } catch (e) {
      errlog("search fatal", e?.message || e);
      return { ok: true, items: [], meta: { ...meta, fatal: true, message: String(e?.message || e) } };
    }
  });

  console.log("[ipc] stock.registerStockIPC: OK");
}

module.exports = { registerStockIPC };
