// electron/ipc/ai-keywords.js
const { ipcMain } = require("electron");
const axios = require("axios");

/* ------------------------ utils ------------------------ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseJSONArrayLoose(str) {
  if (!str || typeof str !== "string") return null;
  const fence = str.match(/```json([\s\S]*?)```/i);
  const raw = fence ? fence[1] : str;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const v = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function parseJSONLoose(str) {
  if (!str || typeof str !== "string") return null;
  const fence = str.match(/```json([\s\S]*?)```/i);
  const raw = fence ? fence[1] : str;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

const KO_STOPWORDS = new Set([
  "그리고",
  "그러나",
  "하지만",
  "또한",
  "및",
  "등",
  "부터",
  "까지",
  "에게",
  "에서",
  "으로",
  "으로서",
  "으로써",
  "로",
  "도",
  "만",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "와",
  "과",
  "하다",
  "했다",
  "하는",
  "해요",
  "합니다",
  "하였다",
  "했다가",
  "있다",
  "있음",
  "있으면",
  "있습니다",
  "없다",
  "없음",
  "없습니다",
  "이다",
  "입니다",
  "되다",
  "됩니다",
  "되는",
  "될",
  "됐다",
  "같다",
  "같은",
  "대한",
  "관련",
  "중",
  "등의",
  "등을",
  "위한",
  "하기",
  "하여",
  "해서",
  "하며",
  "혹은",
  "또는",
  "그",
  "이",
  "저",
  "것",
  "수",
  "때",
  "때문",
  "정도",
  "부분",
  "보다",
  "에도",
  "라도",
]);

function cleanToken(t) {
  let s = (t || "").toString().trim();
  s = s.replace(/[^\p{L}\p{N}\s#\-_.]/gu, ""); // 한글/영문/숫자/공백/일부 기호만
  s = s.replace(/^#/, "");
  if (s.length < 2) return "";
  return s;
}

function looksLikeNounishKorean(s) {
  const badEndings = /(습니다|입니다|이었다|한다|했다|하는|하여|하고|되는|된다|되다|였다|였던|했으며|하면서)$/;
  if (badEndings.test(s)) return false;
  if (KO_STOPWORDS.has(s)) return false;
  if (/^[0-9]+$/.test(s)) return false;
  return true;
}

function postFilterKeywords(arr = [], topK = 20) {
  const out = [];
  const seen = new Set();
  for (const raw of arr) {
    let s = cleanToken(raw);
    if (!s) continue;
    s = s.replace(/\s+/g, " ").trim();
    if (/[\u3131-\uD79D]/.test(s)) {
      // 한글이면 불용형 검사
      if (!looksLikeNounishKorean(s)) continue;
    }
    if (s.length > 20) continue;
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
    if (out.length >= topK) break;
  }
  return out;
}

function normalizeError(err) {
  const status = err?.response?.status ?? null;
  const data = err?.response?.data ?? null;
  const message = data?.error?.message || data?.message || err?.message || "Unknown error";
  return { status, message: data || message };
}

async function callOpenAI({ apiKey, model, messages, maxTokens }) {
  const url = "https://api.openai.com/v1/chat/completions";
  const isGpt5 = /^gpt-5/i.test(model);
  const body = {
    model,
    messages,
    temperature: 0,
    response_format: { type: "json_object" }, // 키워드 추출은 object로 받음
    ...(isGpt5 ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
  };
  return axios.post(url, body, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    timeout: 20000,
  });
}

function buildMessagesForKeywords({ text, topK }) {
  const SYSTEM =
    "You extract high-quality, search-friendly Korean keywords for video asset search. " +
    "Return ONLY JSON. Prefer nouns or short noun phrases. STRICTLY AVOID function words or endings like '있습니다', '있으면', '합니다', '이다', '되는'.";
  const USER = [
    "아래 자막에서 유의미한 키워드만 골라주세요.",
    "- 형태소 어미/조사/불용어 제거 (예: 있습니다, 입니다, 것은, 그리고, 대한, 관련 등)",
    "- 가능한 한 명사/명사구 위주",
    `- 최대 ${topK}개, 중요도 순`,
    "",
    "<자막>",
    String(text || "").slice(0, 12000),
    "</자막>",
    "",
    '반드시 JSON만 출력: { "keywords": ["키워드1","키워드2"] }',
  ].join("\n");
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: USER },
  ];
}

function buildMessagesForTranslate({ terms, targetLang = "en", maxPerTermWords = 3 }) {
  const SYSTEM =
    `Translate each term into ${targetLang}. ` +
    `- Keep game/franchise/proper names in common English form (e.g., "스타크래프트" → "StarCraft"). ` +
    `- Prefer nouns. Avoid particles/verbs/adjectives. ` +
    `- Each term should be <= ${maxPerTermWords} words. ` +
    `- Return ONLY a JSON array in the SAME order as the input.`;
  const USER = `TERMS:\n${JSON.stringify(terms, null, 0)}\n\nReturn JSON array only, same length.`;
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: USER },
  ];
}

/* -------------------- registration -------------------- */
function registerAIKeywords() {
  // 중복 방지(핫리로드)
  ipcMain.removeHandler?.("ai:extractKeywords");
  ipcMain.removeHandler?.("ai:translateTerms");

  // ✅ 키워드 추출
  ipcMain.handle("ai:extractKeywords", async (_e, { text = "", topK = 20, apiKey: keyFromRenderer } = {}) => {
    const apiKey = (keyFromRenderer && String(keyFromRenderer).trim()) || process.env.OPENAI_API_KEY || process.env.OPENAI || process.env.OPENAI_KEY;

    if (!apiKey) return { ok: false, status: 400, message: "OpenAI API 키가 없습니다. 설정에서 저장해 주세요." };
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return { ok: false, status: 400, message: "텍스트가 비어 있습니다." };
    }

    const messages = buildMessagesForKeywords({ text, topK });
    const MODEL_ORDER = ["gpt-5-mini", "gpt-4o-mini", "gpt-4o"];
    const FIRST_MAX = 1024;
    const BUMP_MAX = 2048;

    for (const model of MODEL_ORDER) {
      try {
        let maxTok = FIRST_MAX;
        let r = await callOpenAI({ apiKey, model, messages, maxTokens: maxTok });
        let content = r?.data?.choices?.[0]?.message?.content || "";
        let parsed = parseJSONLoose(content);
        const usage = r?.data?.usage || {};
        const completion = usage?.completion_tokens ?? null;
        const hitCap = completion && maxTok && completion >= maxTok - 2;

        if ((!parsed?.keywords || parsed.keywords.length === 0) && hitCap) {
          maxTok = Math.min(BUMP_MAX, maxTok * 2);
          await sleep(200);
          r = await callOpenAI({ apiKey, model, messages, maxTokens: maxTok });
          content = r?.data?.choices?.[0]?.message?.content || "";
          parsed = parseJSONLoose(content);
        }

        if (parsed?.keywords && Array.isArray(parsed.keywords)) {
          const filtered = postFilterKeywords(parsed.keywords, topK);
          if (filtered.length > 0) {
            return { ok: true, model, keywords: filtered, usage: r?.data?.usage || null };
          }
        }
      } catch (err) {
        const ne = normalizeError(err);
        if (ne.status === 401 || ne.status === 403) return { ok: false, ...ne }; // 키 문제면 즉시 종료
        continue; // 다음 모델 폴백
      }
    }
    return { ok: false, status: 500, message: "키워드 추출 실패(모든 모델 폴백 실패)" };
  });

  // ✅ 용어 번역 (검색 쿼리 강화를 위해)
  ipcMain.handle("ai:translateTerms", async (_e, payload = {}) => {
    const { apiKey: keyFromRenderer, terms = [], targetLang = "en", modelOrder = ["gpt-5-mini", "gpt-4o-mini", "gpt-4o"], maxPerTermWords = 3 } = payload;

    const apiKey = (keyFromRenderer && String(keyFromRenderer).trim()) || process.env.OPENAI_API_KEY || process.env.OPENAI || process.env.OPENAI_KEY;

    const inTerms = (Array.isArray(terms) ? terms : []).map(String).filter(Boolean);
    if (!apiKey) return { ok: false, message: "openai_key_required", terms: inTerms };
    if (!inTerms.length) return { ok: false, message: "terms_required", terms: inTerms };

    const messages = buildMessagesForTranslate({ terms: inTerms, targetLang, maxPerTermWords });

    for (const model of modelOrder) {
      try {
        const url = "https://api.openai.com/v1/chat/completions";
        const isGpt5 = /^gpt-5/i.test(model);
        const body = {
          model,
          messages,
          temperature: 0,
          // 번역은 배열만 필요 → object 강제 필요 없음
          ...(isGpt5 ? { max_completion_tokens: 400 } : { max_tokens: 400 }),
        };
        const r = await axios.post(url, body, {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          timeout: 15000,
        });
        const content = r?.data?.choices?.[0]?.message?.content || "";
        const arr = parseJSONArrayLoose(content) || [];
        const trimmed = arr.map((s) => String(s || "").trim());
        // 길이 불일치 시 원문 보전
        const out = inTerms.map((t, i) => (trimmed[i] ? trimmed[i] : t));
        return { ok: true, terms: Array.from(new Set(out.map((s) => s.toLowerCase()))).map((s) => s) };
      } catch (err) {
        const ne = normalizeError(err);
        if (ne.status === 401 || ne.status === 403) {
          return { ok: false, message: ne.message, terms: inTerms };
        }
        // 다음 모델 폴백
        continue;
      }
    }
    // 최종 실패 시 원문 그대로 반환(검색은 진행되도록)
    return { ok: false, message: "translate_fallback_failed", terms: inTerms };
  });

  console.log("[ipc] ai-keywords.registerAIKeywords: handlers installed");
}

module.exports = { registerAIKeywords };
