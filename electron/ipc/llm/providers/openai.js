// electron/ipc/llm/providers/openai.js
const OpenAI = require("openai");
const { getSecret } = require("../../../services/secrets");
const {
  dumpRaw,
  stripFence,
  tryParse,
  coerceToScenesShape,
  validateScriptDocLoose,
  pickText,
  formatScenes,
} = require("../common");

const MODEL = "gpt-4.1-mini"; // 필요 시 gpt-4o-mini 등으로 변경

function extractLargestJson(raw = "") {
  const plain = stripFence(raw || "");
  const d1 = tryParse(plain);
  if (d1) return d1;

  const s = plain;
  let best = null;
  let stack = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") stack.push(i);
    else if (ch === "}" && stack.length) {
      const start = stack.pop();
      const cand = s.slice(start, i + 1);
      const obj = tryParse(cand);
      if (obj && (!best || cand.length > best.len)) {
        best = { len: cand.length, obj };
      }
    }
  }
  return best?.obj || null;
}

async function callOpenAIGpt5Mini(payload) {
  const apiKey = await getSecret("openaiKey");
  if (!apiKey) throw new Error("OpenAI API Key가 설정되지 않았습니다.");

  const { prompt, topic, duration, maxScenes } = payload;
  const client = new OpenAI({ apiKey });

  const systemMsg = [
    "You are a professional Korean scriptwriter.",
    'Return ONLY JSON like: {"title":"...","scenes":[{"text":"...","duration":N}]}',
    "No Markdown. No explanation.",
  ].join(" ");

  const messages = [
    { role: "system", content: systemMsg },
    { role: "user", content: prompt },
  ];

  let rawText = "";
  try {
    const r = await client.chat.completions.create({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
    });
    rawText = r?.choices?.[0]?.message?.content || "";
    dumpRaw("openai-chat_json_object", r);
  } catch (e) {
    dumpRaw("openai-chat_json_object-http-fail", String(e?.message || e));
  }

  if (!rawText) {
    try {
      const r2 = await client.chat.completions.create({
        model: MODEL,
        messages,
        temperature: 0.2,
      });
      rawText = r2?.choices?.[0]?.message?.content || "";
      dumpRaw("openai-chat_free_text", r2);
    } catch (e) {
      dumpRaw("openai-free_text-http-fail", String(e?.message || e));
    }
  }

  if (!rawText) throw new Error("OpenAI 응답 구조가 유효하지 않습니다.");

  const parsed = coerceToScenesShape(extractLargestJson(rawText) || {});
  if (!validateScriptDocLoose(parsed)) {
    dumpRaw("openai-json-invalid", { raw: rawText });
    throw new Error("OpenAI 응답 구조가 유효하지 않습니다.");
  }

  parsed.scenes = parsed.scenes.map((s, i) => ({
    ...(typeof s === "object" ? s : {}),
    id: s?.id ? String(s.id) : `s${i + 1}`,
    text: pickText(s),
    duration: Number.isFinite(s?.duration)
      ? Math.round(Number(s.duration))
      : undefined,
  }));

  // 프롬프트가 있으면 사용자 프롬프트 우선(보정 최소화)
  const out = formatScenes(parsed, topic, duration, maxScenes, {
    fromCustomPrompt: !!(typeof prompt === "string" && prompt.trim().length),
  });

  return out;
}

module.exports = { callOpenAIGpt5Mini };
