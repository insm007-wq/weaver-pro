// electron/ipc/llm.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");
const axios = require("axios");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

/* ---------------- 유틸 ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizeErr = (err) => ({
  status: err?.response?.status ?? null,
  data: err?.response?.data ?? null,
  message:
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    err?.message ||
    "Unknown error",
});

/** 느슨 검증: scenes[] 있고 각 item에 text만 있으면 OK (title/id는 optional) */
function validateScriptDocLoose(json) {
  if (!json || typeof json !== "object") return false;
  if (!Array.isArray(json.scenes) || json.scenes.length === 0) return false;
  for (const s of json.scenes) {
    if (!s || typeof s !== "object") return false;
    if (typeof s.text !== "string" || !s.text.trim()) return false;
  }
  return true;
}

/** 씬 수 보정: 씬이 너무 적으면 text 길이로 잘라서 maxScenes 근사치로 확장 */
function expandScenesToTarget(scenes, target) {
  if (!Array.isArray(scenes) || scenes.length >= target) return scenes;
  // 긴 씬부터 잘라서 늘림
  const out = [
    ...scenes.map((s) => ({ id: s.id, text: String(s.text || "") })),
  ];
  let i = 0;
  while (out.length < target && i < out.length) {
    const cur = out[i];
    const t = cur.text;
    if (t.length < 400) {
      // 너무 짧으면 패스
      i += 1;
      continue;
    }
    // 문장 단위 분할 시도 → 없으면 길이 기준
    const parts = t.split(/(?<=\.|\?|!|。|！|？)\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const mid = Math.ceil(parts.length / 2);
      const a = parts.slice(0, mid).join(" ");
      const b = parts.slice(mid).join(" ");
      out.splice(i, 1, { id: cur.id, text: a }, { id: undefined, text: b });
    } else {
      const midIdx = Math.floor(t.length / 2);
      out.splice(
        i,
        1,
        { id: cur.id, text: t.slice(0, midIdx) },
        { id: undefined, text: t.slice(midIdx) }
      );
    }
  }
  return out.slice(0, target);
}

/** 공통 장면 포맷팅 + 길이 균등 분배 */
function formatScenes(parsed, topic, durationMin, maxScenes) {
  // 씬 수 보정
  let scenesRaw = parsed.scenes || [];
  if (maxScenes && Number(maxScenes) > 0) {
    scenesRaw = expandScenesToTarget(scenesRaw, Number(maxScenes));
  }
  const totalSecs = Math.max(1, Number(durationMin || 5) * 60);
  const n = Math.max(1, scenesRaw.length);
  const step = Math.max(1, Math.floor(totalSecs / n));

  const scenes = scenesRaw.map((s, i) => {
    const start = i * step;
    const end = i === n - 1 ? totalSecs : (i + 1) * step;
    const text = String(s.text || "").trim();
    return {
      id: String(s.id || `s${i + 1}`),
      start,
      end,
      text,
      charCount: text.length,
    };
  });

  return {
    title:
      parsed.title && String(parsed.title).trim()
        ? String(parsed.title).trim()
        : topic || "자동 생성 대본",
    scenes,
  };
}

/** 예상 토큰 수(대략) → GPT-5 mini/Anthropic 토큰 버짓 계산 */
function estimateMaxTokens({
  maxScenes = 10,
  duration = 5,
  perSceneChars = 700,
  cap = 12000,
  floor = 2000,
}) {
  // 한국어 평균 2.5~3.5 chars/token → 보수적으로 3.0 가정
  const expectChars = Math.max(maxScenes, 1) * perSceneChars;
  const expectTokens = Math.ceil(expectChars / 3.0) + 600; // 여유 버퍼
  return Math.max(floor, Math.min(cap, expectTokens));
}

/* ---------------- OpenAI: GPT-5 mini ---------------- */
/**
 * 견고한 호출 순서
 * 1) json_schema(strict) → 실패 시
 * 2) json_object → 실패 시
 * 3) free_text (모델에게 "JSON만" 다시 지시)
 * + 동적 토큰 버짓
 */
async function callOpenAIGpt5Mini({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
}) {
  const apiKey = await getSecret("openaiKey");
  if (!apiKey) throw new Error("OpenAI API Key가 설정되지 않았습니다.");

  const system = [
    "You are a professional Korean scriptwriter for YouTube long-form.",
    "Output JSON only.",
  ].join("\n");

  const user = [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    `목표 길이(분): ${duration}`,
    `목표 장면 수(정확히): ${maxScenes}`,
    type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
    "\n**요구사항**",
    "- 장면 수는 가능한 한 목표 장면 수에 정확히 맞춤",
    "- 각 장면은 500~900자 분량의 자연스러운 구어체(한국어)",
    "- 결과는 JSON만 반환",
    "- 각 장면 객체는 최소 { text } 포함 (id/title은 선택)",
  ].join("\n");

  const budget = estimateMaxTokens({
    maxScenes,
    duration,
    perSceneChars: 800,
    cap: 12000,
    floor: 2500,
  });

  const cfg = {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    timeout: 60000,
  };

  const LOOSE_SCHEMA = {
    type: "object",
    additionalProperties: true, // 유연성 확보
    required: ["scenes"], // scenes만 필수
    properties: {
      title: { type: "string" },
      scenes: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: true,
          required: ["text"],
          properties: {
            id: { type: "string" },
            text: { type: "string" },
          },
        },
      },
    },
  };

  const attempts = [
    {
      body: {
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_completion_tokens: budget,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ScriptDoc",
            schema: LOOSE_SCHEMA,
            strict: true,
          },
        },
      },
      label: "json_schema",
    },
    {
      body: {
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_completion_tokens: budget,
        response_format: { type: "json_object" },
      },
      label: "json_object",
    },
    {
      body: {
        model: "gpt-5-mini",
        messages: [
          { role: "system", content: system + "\nReturn ONLY JSON." },
          { role: "user", content: user },
        ],
        max_completion_tokens: budget,
      },
      label: "free_text",
    },
  ];

  for (let mode = 0; mode < attempts.length; mode++) {
    const { body, label } = attempts[mode];

    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const r = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          body,
          cfg
        );

        // content: string | Part[]
        let raw = r?.data?.choices?.[0]?.message?.content;
        if (Array.isArray(raw)) {
          raw = raw
            .map((c) =>
              typeof c === "string" ? c : c?.text || c?.output_text || ""
            )
            .join("");
        }
        if (typeof raw !== "string") raw = String(raw ?? "");

        // JSON 파싱(여러 단계)
        let parsed;
        try {
          parsed = JSON.parse(raw);
        } catch {
          const m = raw.match(/```json\s*([\s\S]*?)```/i);
          if (m) {
            try {
              parsed = JSON.parse(m[1]);
            } catch {}
          }
          if (!parsed) {
            const s = raw.indexOf("{");
            const e = raw.lastIndexOf("}");
            if (s >= 0 && e > s) {
              try {
                parsed = JSON.parse(raw.slice(s, e + 1));
              } catch {}
            }
          }
          if (!parsed && /\[\s*{/.test(raw)) {
            try {
              parsed = { scenes: JSON.parse(raw) };
            } catch {}
          }
        }

        if (!validateScriptDocLoose(parsed)) {
          throw new Error(`대본 JSON 파싱/검증 실패(${label})`);
        }

        // 보정: id 채우기
        parsed.scenes = parsed.scenes.map((s, idx) => ({
          id: s.id ? String(s.id) : `s${idx + 1}`,
          text: String(s.text ?? ""),
        }));

        return formatScenes(parsed, topic, duration, maxScenes);
      } catch (err) {
        const { status } = normalizeErr(err);
        const retryable = status === 429 || (status >= 500 && status < 600);
        if (retryable && attempt < maxRetries) {
          await sleep(800 * Math.pow(2, attempt));
          continue;
        }
        // 비재시도 오류 → 다음 모드로 폴백
        break;
      }
    }
    // 다음 모드로
  }

  throw new Error("OpenAI 요청 실패: 대본 JSON 파싱/검증 실패");
}

/* ---------------- Anthropic ---------------- */
async function callAnthropic({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
}) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  const sys = [
    "You are a professional Korean scriptwriter for YouTube long-form.",
    "Return ONLY JSON that follows: { title?: string, scenes: { id?: string, text: string }[] }",
  ].join("\n");

  const user = [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    `목표 길이(분): ${duration}`,
    `목표 장면 수(정확히): ${maxScenes}`,
    type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
    "\n**요구사항**",
    "- 장면 수는 가능한 한 목표 장면 수에 정확히 맞춤",
    "- 각 장면은 500~900자 분량의 자연스러운 구어체(한국어)",
    "- 결과는 JSON만 반환",
  ].join("\n");

  const budget = Math.max(
    5000, //  하한(최소) 보장
    estimateMaxTokens({
      maxScenes,
      duration,
      perSceneChars: 800,
      cap: 16000, // 상한 살짝 여유
      floor: 3000, //  너무 낮게 잡히지 않도록 기본 바닥도 올림
    })
  );

  const body = {
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: budget,
    system: sys,
    messages: [{ role: "user", content: user }],
  };

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const retryable =
        res.status === 429 || (res.status >= 500 && res.status < 600);
      if (retryable && attempt < maxRetries) {
        await sleep(800 * Math.pow(2, attempt));
        continue;
      }
      throw new Error(`Anthropic 요청 실패: ${res.status} ${txt}`);
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || "";

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/```json([\s\S]*?)```/i);
      if (m) {
        try {
          parsed = JSON.parse(m[1]);
        } catch {}
      }
    }

    if (!validateScriptDocLoose(parsed))
      throw new Error("대본 JSON 파싱/검증 실패");
    // 보정
    parsed.scenes = parsed.scenes.map((s, idx) => ({
      id: s.id ? String(s.id) : `s${idx + 1}`,
      text: String(s.text ?? ""),
    }));

    return formatScenes(parsed, topic, duration, maxScenes);
  }

  throw new Error("Anthropic 요청 실패: 대본 JSON 파싱/검증 실패");
}

/* ---------------- IPC 라우터 ---------------- */
ipcMain.handle("llm/generateScript", async (_evt, payload) => {
  const { llm } = payload || {};
  if (!llm) throw new Error("llm 값이 필요합니다.");

  switch (llm) {
    case "openai-gpt5mini":
      return await callOpenAIGpt5Mini(payload);
    case "anthropic":
      return await callAnthropic(payload);
    default:
      throw new Error(`지원하지 않는 LLM입니다: ${llm}`);
  }
});
