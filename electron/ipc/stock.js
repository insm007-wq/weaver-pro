// electron/ipc/stock.js
const { ipcMain } = require("electron");
const axios = require("axios");

const DBG = process.env.DEBUG_STOCK === "1";
const log = (...a) => {
  if (DBG) console.log("[stock]", ...a);
};
const errlog = (...a) => console.warn("[stock:ERR]", ...a);

// ---------------- helpers ----------------
function closestRes(files, target) {
  if (!Array.isArray(files) || !files.length) return null;
  const { w: tw = 0, h: th = 0 } = target || {};
  const scored = files
    .filter((f) => f && f.url && f.width && f.height)
    .map((f) => ({ ...f, _score: Math.abs(f.width - tw) + Math.abs(f.height - th) }))
    .sort((a, b) => a._score - b._score);
  return scored[0] || null;
}

function withinBytes(size, minB, maxB) {
  if (!size || size <= 0) return false;
  if (minB && size < minB) return false;
  if (maxB && size > maxB) return false;
  return true;
}

function normTerms(inputQuery, inputQueries) {
  const out = [];
  if (typeof inputQuery === "string" && inputQuery.trim()) out.push(inputQuery.trim());
  if (Array.isArray(inputQueries)) {
    for (const t of inputQueries) {
      const s = String(t || "").trim();
      if (s && !out.includes(s)) out.push(s);
    }
  }
  return out;
}

// ---------------- providers ----------------
async function searchPexels({ apiKey, query, perPage, targetRes, minBytes, maxBytes }) {
  if (!apiKey) return [];
  const url = "https://api.pexels.com/videos/search";
  const params = { query, per_page: Math.min(perPage || 6, 80), locale: "ko-KR" };

  log("Pexels req", params);
  const r = await axios.get(url, {
    headers: { Authorization: apiKey },
    params,
    timeout: 15000,
  });

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
      const filename = `pexels-${id}-${best.width}x${best.height}.mp4`;
      out.push({
        provider: "pexels",
        url: best.url,
        filename,
        width: best.width,
        height: best.height,
        size: best.size || 0,
        quality: best.quality || "",
        // Pexels는 명시적 tags가 없어서 스코어 강제 필터는 어려움
        tags: [],
      });
    }
  }
  log("Pexels out", out.length);
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

  log("Pixabay req", params);
  const r = await axios.get(url, { params, timeout: 15000 });

  const out = [];
  for (const hit of r.data?.hits || []) {
    const variants = [];
    for (const k of ["large", "medium", "small", "tiny"]) {
      const v = hit.videos?.[k];
      if (v?.url) {
        variants.push({
          url: v.url,
          width: v.width || 0,
          height: v.height || 0,
          size: v.size || 0,
          label: k,
        });
      }
    }
    const sized = variants.filter((v) => withinBytes(v.size, minBytes, maxBytes));
    const best = closestRes(sized.length ? sized : variants, targetRes);
    if (best?.url) {
      const id = hit.id;
      const filename = `pixabay-${id}-${best.width}x${best.height}.mp4`;
      // Pixabay는 tags 문자열 제공
      const tags = String(hit.tags || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      out.push({
        provider: "pixabay",
        url: best.url,
        filename,
        width: best.width,
        height: best.height,
        size: best.size || 0,
        quality: best.label || "",
        tags,
      });
    }
  }
  log("Pixabay out", out.length);
  return out;
}

// ---------------- IPC ----------------
function registerStockIPC() {
  ipcMain.removeHandler?.("stock:search");
  ipcMain.handle("stock:search", async (_e, payload = {}) => {
    const {
      query = "",
      queries = [], // ✅ 새로 지원: 배열
      perPage = 6,
      providers = ["pexels", "pixabay"],
      pexelsKey,
      pixabayKey,
      targetRes = { w: 2560, h: 1440 },
      minBytes = 0,
      maxBytes = 0,
      type = "videos",
      strictKeyword = false, // ✅ 옵션: (가능한 범위에서) 태그 매칭 강화
    } = payload || {};

    const qTerms = normTerms(query, queries);
    if (!qTerms.length) return { ok: false, message: "query_required", items: [] };
    if (type !== "videos") return { ok: false, message: "only_videos_supported", items: [] };

    log("search start:", { qTerms, perPage, providers, targetRes, minBytes, maxBytes, strictKeyword });

    try {
      let results = [];
      // 각 용어별로 검색 → 모읍
      for (const q of qTerms) {
        if (providers.includes("pexels") && pexelsKey) {
          try {
            const items = await searchPexels({ apiKey: pexelsKey, query: q, perPage, targetRes, minBytes, maxBytes });
            results = results.concat(items.map((it) => ({ ...it, _q: q })));
          } catch (e) {
            errlog("pexels", e?.message || e);
          }
        }
        if (providers.includes("pixabay") && pixabayKey) {
          try {
            const items = await searchPixabay({ apiKey: pixabayKey, query: q, perPage, targetRes, minBytes, maxBytes });
            results = results.concat(items.map((it) => ({ ...it, _q: q })));
          } catch (e) {
            errlog("pixabay", e?.message || e);
          }
        }
      }

      // 중복 제거 (URL 기준)
      const uniq = [];
      const seen = new Set();
      for (const r of results) {
        if (!r?.url) continue;
        const key = r.url.split("?")[0];
        if (seen.has(key)) continue;
        seen.add(key);
        uniq.push(r);
      }

      // 옵션: strictKeyword → Pixabay 태그 기반으로 1차 필터 (Pexels는 태그 없음 → 통과)
      let filtered = uniq;
      if (strictKeyword) {
        const needles = qTerms.map((s) => s.toLowerCase());
        filtered = uniq.filter((it) => {
          if (it.provider === "pixabay" && Array.isArray(it.tags) && it.tags.length) {
            // terms 중 하나라도 태그에 포함되면 OK
            return needles.some((t) => it.tags.some((tag) => tag.includes(t)));
          }
          // Pexels는 검색 쿼리 자체 신뢰
          return true;
        });
      }

      // 타겟 해상도 근접 + (가능하면) 용량 근접 정렬
      filtered.sort((a, b) => {
        const aScore = Math.abs((a.width || 0) - (targetRes.w || 0)) + Math.abs((a.height || 0) - (targetRes.h || 0));
        const bScore = Math.abs((b.width || 0) - (targetRes.w || 0)) + Math.abs((b.height || 0) - (targetRes.h || 0));
        if (aScore !== bScore) return aScore - bScore;
        const mid = minBytes && maxBytes ? (minBytes + maxBytes) / 2 : 0;
        const aDiff = mid ? Math.abs((a.size || 0) - mid) : 0;
        const bDiff = mid ? Math.abs((b.size || 0) - mid) : 0;
        return aDiff - bDiff;
      });

      log("search done:", `${filtered.length} items`);
      return { ok: true, items: filtered };
    } catch (e) {
      errlog("search fatal", e?.message || e);
      return { ok: false, message: String(e?.message || e), items: [] };
    }
  });

  console.log("[ipc] stock.registerStockIPC: OK");
}

module.exports = { registerStockIPC };
