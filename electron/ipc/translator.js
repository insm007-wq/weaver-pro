// electron/ipc/translator.js
const axios = require("axios");

// 초간단 TTL 캐시 (메모리)
const cache = new Map();
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    cache.delete(key);
    return null;
  }
  return hit.val;
}
function setCache(key, val) {
  cache.set(key, { val, exp: Date.now() + TTL_MS });
}

/**
 * Azure Translator 클라이언트 생성
 * @param {{key:string, region:string, endpoint?:string}} cfg
 */
function createTranslator(cfg) {
  const endpoint =
    cfg.endpoint?.replace(/\/+$/, "") ||
    "https://api.cognitive.microsofttranslator.com";

  async function translate({ text, from = "auto", to = "en" }) {
    const t = (text || "").trim();
    if (!t) return { text: "" };

    const key = `v1|${from}|${to}|${t}`;
    const cached = getCache(key);
    if (cached) return { text: cached, cached: true };

    const params = new URLSearchParams({
      "api-version": "3.0",
      to,
    });
    if (from && from !== "auto") params.set("from", from);

    const url = `${endpoint}/translate?${params.toString()}`;
    const res = await axios.post(url, [{ Text: t }], {
      headers: {
        "Ocp-Apim-Subscription-Key": cfg.key,
        "Ocp-Apim-Subscription-Region": cfg.region,
        "Content-Type": "application/json; charset=UTF-8",
      },
      timeout: 10000,
    });

    const item = res.data?.[0];
    const out = item?.translations?.[0]?.text || "";
    const detected = item?.detectedLanguage?.language;

    setCache(key, out);
    return { text: out, detected };
  }

  async function health() {
    try {
      const r = await translate({ text: "ping", from: "en", to: "en" });
      return !!r.text;
    } catch {
      return false;
    }
  }

  return { translate, health };
}

module.exports = { createTranslator };
