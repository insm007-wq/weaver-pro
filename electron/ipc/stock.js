// electron/ipc/stock.js
// ============================================================================
// 스톡 영상 검색 IPC
// - 목적: 실패(네트워크/429/무결과) 시 "바로 건너뛰기" 하여 다음 작업을 진행
// - 최적화:
//   * 공급사/쿼리 단위 요청을 Promise.allSettled 로 병렬/안전 실행(에러는 무시)
//   * 429 응답은 withRateLimit 에서 지수 백오프로 내부적으로 대기 → 호출부는 빈 결과로 간주
//   * 결과 결합 시 중복 URL 제거, 해상도/용량 근접 정렬
// - API: ipcMain.handle("stock:search", payload)
//   반환: { ok, items, meta }  // meta는 통계용(호환성 위해 추가 필드)
// ============================================================================

const { ipcMain } = require("electron");
const axios = require("axios");

const DBG = process.env.DEBUG_STOCK === "1";
const log = (...a) => DBG && console.log("[stock]", ...a);
const errlog = (...a) => console.warn("[stock:ERR]", ...a);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 프로바이더별 레이트리밋 상태 ─────────────────────────────────────────── */
/** 각 프로바이더의 지수 백오프(429 대응) 상태 */
const providerState = {
  pexels: { backoff: 0, nextAt: 0 },
  pixabay: { backoff: 0, nextAt: 0 },
};
const BASE_BACKOFF = 1200; // 시작 1.2s
const MAX_BACKOFF = 60000; // 최대 60s

/**
 * 레이트리밋(429) 자동 처리 래퍼
 * - 429면 Retry-After 또는 지수 백오프 후 "빈 결과(_rateLimited=true)"를 반환
 * - 그 외 에러는 throw (호출부에서 allSettled로 받아 스킵)
 */
async function withRateLimit(provider, doRequest) {
  const st = providerState[provider];
  const now = Date.now();
  if (now < st.nextAt) {
    await sleep(st.nextAt - now);
  }

  try {
    const res = await doRequest();
    // 성공 → 백오프 해제
    st.backoff = 0;
    st.nextAt = Date.now();
    return res;
  } catch (e) {
    const status = e?.response?.status;
    if (status === 429) {
      const ra = parseInt(e?.response?.headers?.["retry-after"] || "", 10);
      let wait = Number.isFinite(ra)
        ? ra * 1000
        : st.backoff
        ? Math.min(MAX_BACKOFF, st.backoff * 2)
        : BASE_BACKOFF;
      // 지터 추가
      wait = Math.min(
        MAX_BACKOFF,
        Math.round(wait * (1 + Math.random() * 0.25))
      );
      st.backoff = wait;
      st.nextAt = Date.now() + wait;
      errlog(`${provider} 429 rate-limited. backoff(ms)= ${wait}`);
      // 호출부가 "스킵"으로 판단할 수 있게 플래그를 붙여 빈 결과처럼 반환
      return { _rateLimited: true, data: null };
    }
    // 그 외 에러는 상위(allSettled)에서 스킵 처리
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
/** Pexels 영상 검색(빈 결과 또는 429 → 빈 배열로) */
async function searchPexels({
  apiKey,
  query,
  perPage,
  targetRes,
  minBytes,
  maxBytes,
}) {
  if (!apiKey) return [];
  const url = "https://api.pexels.com/videos/search";
  const params = {
    query,
    per_page: Math.min(perPage || 6, 80),
    locale: "ko-KR",
  };

  const r = await withRateLimit("pexels", () =>
    axios.get(url, {
      headers: { Authorization: apiKey },
      params,
      timeout: 15000,
    })
  );
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

/** Pixabay 영상 검색(빈 결과 또는 429 → 빈 배열로) */
async function searchPixabay({
  apiKey,
  query,
  perPage,
  targetRes,
  minBytes,
  maxBytes,
}) {
  if (!apiKey) return [];
  const url = "https://pixabay.com/api/videos/";
  const params = {
    key: apiKey,
    q: query,
    per_page: Math.min(perPage || 6, 200),
    video_type: "film",
    safesearch: "true",
  };

  const r = await withRateLimit("pixabay", () =>
    axios.get(url, { params, timeout: 15000 })
  );
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
    const sized = variants.filter((v) =>
      withinBytes(v.size, minBytes, maxBytes)
    );
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
/**
 * stock:search
 * payload:
 *  - query, queries[], perPage, providers[], pexelsKey, pixabayKey,
 *    targetRes{w,h}, minBytes, maxBytes, type="videos", strictKeyword=false
 * 반환:
 *  - { ok: true, items: [...], meta: {...통계} }
 *  - 실패/에러는 최대한 "스킵"으로 처리하여 ok:true + items:[] 를 선호
 */
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
    if (!qTerms.length)
      return { ok: false, message: "query_required", items: [] };
    if (type !== "videos")
      return { ok: false, message: "only_videos_supported", items: [] };

    // ── 통계(meta) ──
    const meta = {
      queries: qTerms.length,
      providerCalls: 0,
      providerErrors: 0,
      rateLimitedSkips: 0,
      emptyResults: 0,
      usedProviders: providers.filter(Boolean),
    };

    try {
      let results = [];

      // 각 쿼리마다 프로바이더 검색을 "안전 병렬(allSettled)"로 실행
      for (const q of qTerms) {
        const tasks = [];

        if (providers.includes("pexels") && pexelsKey) {
          meta.providerCalls++;
          tasks.push(
            searchPexels({
              apiKey: pexelsKey,
              query: q,
              perPage,
              targetRes,
              minBytes,
              maxBytes,
            })
          );
        }
        if (providers.includes("pixabay") && pixabayKey) {
          meta.providerCalls++;
          tasks.push(
            searchPixabay({
              apiKey: pixabayKey,
              query: q,
              perPage,
              targetRes,
              minBytes,
              maxBytes,
            })
          );
        }

        if (!tasks.length) continue;

        const settled = await Promise.allSettled(tasks);

        for (const s of settled) {
          if (s.status === "fulfilled") {
            const arr = Array.isArray(s.value) ? s.value : [];
            if (!arr.length) meta.emptyResults++;
            // 수집
            for (const it of arr) results.push({ ...it, _q: q });
          } else {
            // 호출 실패도 "스킵"으로 간주
            meta.providerErrors++;
            errlog("provider call failed:", s.reason?.message || s.reason);
          }
        }
      }

      // ── 중복 제거(쿼리/공급사 상관 없이 동일 URL 제거) ──
      const seen = new Set();
      const uniq = [];
      for (const r of results) {
        const key = (r?.url || "").split("?")[0];
        if (!key || seen.has(key)) continue;
        seen.add(key);
        uniq.push(r);
      }

      // ── strict 키워드 필터(가능한 범위 내) ──
      let filtered = uniq;
      if (strictKeyword) {
        const needles = qTerms.map((s) => s.toLowerCase());
        filtered = uniq.filter((it) => {
          if (it.provider === "pixabay" && it.tags?.length) {
            return needles.some((t) => it.tags.some((tag) => tag.includes(t)));
          }
          // Pexels는 태그가 거의 없으므로 필터 제외(스킵하면 너무 빈번히 0건)
          return true;
        });
      }

      // ── 해상도/용량 근접 정렬 ──
      filtered.sort((a, b) => {
        const aS =
          Math.abs((a.width || 0) - (targetRes.w || 0)) +
          Math.abs((a.height || 0) - (targetRes.h || 0));
        const bS =
          Math.abs((b.width || 0) - (targetRes.w || 0)) +
          Math.abs((b.height || 0) - (targetRes.h || 0));
        if (aS !== bS) return aS - bS;
        const mid = minBytes && maxBytes ? (minBytes + maxBytes) / 2 : 0;
        const aD = mid ? Math.abs((a.size || 0) - mid) : 0;
        const bD = mid ? Math.abs((b.size || 0) - mid) : 0;
        return aD - bD;
      });

      log("search done:", {
        terms: qTerms.length,
        results: filtered.length,
        meta,
      });

      return { ok: true, items: filtered, meta };
    } catch (e) {
      // 총체적 실패 시에도 "스킵" 취지로 ok:true + 빈 결과 반환 권장
      errlog("search fatal", e?.message || e);
      return {
        ok: true,
        items: [],
        meta: { ...meta, fatal: true, message: String(e?.message || e) },
      };
    }
  });

  console.log("[ipc] stock.registerStockIPC: OK");
}

module.exports = { registerStockIPC };
