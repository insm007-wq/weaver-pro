// electron/ipc/llm.js
const { ipcMain, app } = require("electron");
const { getSecret } = require("../services/secrets");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

/* ---------- 모델별 출력 토큰 상한(여유 마진 포함) ---------- */
const ANTHROPIC_MODEL_CAPS = {
  "claude-3-5-sonnet-latest": 8192, // 출력 토큰 최대치
};
function clampAnthropicTokens(requested, model) {
  const cap = ANTHROPIC_MODEL_CAPS[model] || 8192;
  // 마진 64 토큰 확보해서 경계값 에러 회피
  return Math.max(1000, Math.min(requested, cap - 64));
}

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

function nowStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(
    d.getHours()
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function dumpRaw(label, raw) {
  try {
    const dir = path.join(app.getPath("userData"), "logs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `llm-${nowStr()}-${label}.txt`);
    fs.writeFileSync(file, String(raw ?? ""), "utf8");
    return file;
  } catch {
    return null;
  }
}

/* ---------- JSON 파싱/보정 강화 ---------- */
function stripFence(raw = "") {
  let m = raw.match(/```json\s*([\s\S]*?)```/i);
  if (m) return m[1];
  m = raw.match(/```\s*([\s\S]*?)```/);
  if (m) return m[1];
  return raw;
}
function tryParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {}
  // 가장 큰 {...}
  const s1 = raw.indexOf("{");
  const e1 = raw.lastIndexOf("}");
  if (s1 !== -1 && e1 > s1) {
    const slice = raw.slice(s1, e1 + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }
  // 가장 큰 [...]
  const s2 = raw.indexOf("[");
  const e2 = raw.lastIndexOf("]");
  if (s2 !== -1 && e2 > s2) {
    const slice = raw.slice(s2, e2 + 1);
    try {
      const arr = JSON.parse(slice);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }
  return null;
}

/** 문자열/객체 어디서든 텍스트 추출 */
function pickText(s) {
  if (s == null) return "";
  if (typeof s === "string") return s.trim();
  if (typeof s !== "object") return "";
  const cand = [
    s.text,
    s.content,
    s.narration,
    s.body,
    s.description,
    s.dialogue,
    s.value,
  ];
  for (const v of cand) if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(s.lines)) return s.lines.filter(Boolean).join(" ").trim();
  if (typeof s.summary === "string") return s.summary.trim();
  return "";
}

function deepFindScenes(obj) {
  const visited = new Set();
  function walk(node) {
    if (!node || typeof node !== "object") return null;
    if (visited.has(node)) return null;
    visited.add(node);

    if (Array.isArray(node)) {
      const hasTextish = node.some((it) => pickText(it));
      if (hasTextish) return node;
      for (const it of node) {
        const found = walk(it);
        if (found) return found;
      }
      return null;
    } else {
      const keys = Object.keys(node);
      for (const k of [
        "scenes",
        "scenario",
        "scene_list",
        "segments",
        "steps",
        "items",
        "parts",
        "chapters",
        "story",
        "content",
      ]) {
        if (Array.isArray(node[k])) {
          const arr = node[k];
          const ok = arr.some((it) => pickText(it));
          if (ok) return arr;
          const deeper = walk(arr);
          if (deeper) return deeper;
        }
      }
      for (const k of keys) {
        const v = node[k];
        const found = walk(v);
        if (found) return found;
      }
      return null;
    }
  }
  return walk(obj);
}
function coerceToScenesShape(obj) {
  if (!obj) return null;
  if (Array.isArray(obj)) return { scenes: obj };
  if (Array.isArray(obj.scenes))
    return { title: obj.title || obj.name, scenes: obj.scenes };
  const nests = [
    ["result", "scenes"],
    ["output", "scenes"],
    ["script", "scenes"],
    ["data", "scenes"],
  ];
  for (const [a, b] of nests) {
    if (Array.isArray(obj?.[a]?.[b]))
      return { title: obj.title || obj?.[a]?.title, scenes: obj[a][b] };
  }
  const arr = deepFindScenes(obj);
  if (Array.isArray(arr)) return { title: obj.title || obj.name, scenes: arr };
  return obj;
}
function validateScriptDocLoose(json) {
  if (!json || typeof json !== "object") return false;
  if (!Array.isArray(json.scenes) || json.scenes.length === 0) return false;
  for (const s of json.scenes) {
    const t = pickText(s);
    if (!t || typeof t !== "string") return false;
  }
  return true;
}

/** 목표 씬 수로 강제 분할(자동/레퍼런스에서만 사용) */
function expandScenesToTarget(scenes, target) {
  if (!Array.isArray(scenes) || scenes.length >= target) return scenes;
  const out = [
    ...scenes.map((s) => ({ id: s.id, text: String(pickText(s) || "") })),
  ];
  let i = 0;
  while (out.length < target && i < out.length) {
    const cur = out[i];
    const t = cur.text;
    if (t.length < 400) {
      i += 1;
      continue;
    }
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

/** 결과 정규화: 프롬프트-우선 모드(custom)일 때는 씬/길이 그대로 존중 */
function formatScenes(
  parsedIn,
  topic,
  durationMin,
  maxScenes,
  { fromCustomPrompt = false } = {}
) {
  let parsed = coerceToScenesShape(parsedIn) || parsedIn;

  let scenesRaw = (parsed.scenes || [])
    .map((s, i) => {
      const text = pickText(s);
      const duration = Number(
        s?.duration ?? s?.seconds ?? s?.length ?? s?.time ?? NaN
      );
      const sceneNo = Number(s?.scene_number ?? s?.no ?? s?.index ?? i + 1);
      const id =
        s?.id != null
          ? String(s.id)
          : Number.isFinite(sceneNo)
          ? `s${sceneNo}`
          : `s${i + 1}`;
      return {
        id,
        scene_number: Number.isFinite(sceneNo) ? sceneNo : i + 1,
        text,
        duration:
          Number.isFinite(duration) && duration > 0
            ? Math.round(duration)
            : undefined,
        character_count: Number(s?.character_count ?? s?.charCount ?? NaN),
        visual_description:
          typeof s?.visual_description === "string"
            ? s.visual_description
            : undefined,
      };
    })
    .filter((s) => s.text);

  // 자동/레퍼런스에서만 목표 씬 수에 맞게 분할
  if (!fromCustomPrompt && maxScenes && Number(maxScenes) > 0) {
    scenesRaw = expandScenesToTarget(scenesRaw, Number(maxScenes));
  }

  const n = Math.max(1, scenesRaw.length);

  // 목표 총 초
  let totalSecsTarget;
  if (fromCustomPrompt) {
    const sumModel = scenesRaw.reduce(
      (a, s) => a + (Number.isFinite(s.duration) ? s.duration : 0),
      0
    );
    if (sumModel > 0) {
      totalSecsTarget = sumModel;
    } else if (Number.isFinite(parsed?.total_duration)) {
      const td = Number(parsed.total_duration);
      totalSecsTarget = td <= 25 ? Math.round(td * 60) : Math.round(td);
    } else {
      totalSecsTarget = Math.max(1, Math.round(Number(durationMin || 5) * 60));
    }
  } else {
    totalSecsTarget = Math.max(1, Math.round(Number(durationMin || 5) * 60));
  }

  const hasModelDur = scenesRaw.some((s) => Number.isFinite(s.duration));
  let durations = new Array(n).fill(Math.floor(totalSecsTarget / n));

  if (hasModelDur) {
    durations = scenesRaw.map((s) =>
      Number.isFinite(s.duration) ? Math.max(1, Math.round(s.duration)) : 0
    );
    const miss = durations
      .map((d, i) => (d <= 0 ? i : -1))
      .filter((i) => i >= 0);
    if (miss.length) {
      const fallback = Math.max(1, Math.floor(totalSecsTarget / n));
      for (const idx of miss) durations[idx] = fallback;
    }
    const sum = durations.reduce((a, b) => a + b, 0);

    if (!fromCustomPrompt) {
      // 자동/레퍼런스: 총 길이에 리스케일
      if (sum !== totalSecsTarget && sum > 0) {
        const scale = totalSecsTarget / sum;
        let acc = 0;
        durations = durations.map((d, i) => {
          let v = Math.max(1, Math.round(d * scale));
          if (i === n - 1) v = Math.max(1, totalSecsTarget - acc);
          acc += v;
          return v;
        });
      }
    } else {
      // 커스텀: 모델 값 존중
      totalSecsTarget = sum > 0 ? sum : totalSecsTarget;
    }
  } else {
    // duration 없으면 균등
    let acc = 0;
    durations = durations.map((d, i) => {
      let v = d;
      if (i === n - 1) v = Math.max(1, totalSecsTarget - acc);
      acc += v;
      return v;
    });
  }

  let cursor = 0;
  const scenes = scenesRaw.map((s, i) => {
    const dur = durations[i] || 1;
    const start = cursor;
    const end = Math.min(totalSecsTarget, start + dur);
    cursor = end;
    const charCount = Number.isFinite(s.character_count)
      ? s.character_count
      : s.text.length;
    return {
      id: s.id,
      start,
      end,
      text: s.text,
      charCount,
      scene_number: s.scene_number,
      duration: dur,
      visual_description: s.visual_description,
    };
  });

  const title =
    parsed.title && String(parsed.title).trim()
      ? String(parsed.title).trim()
      : parsed.name && String(parsed.name).trim()
      ? String(parsed.name).trim()
      : topic || "자동 생성 대본";

  return { title, scenes };
}

/** 토큰 버짓(대략치) */
function estimateMaxTokens({
  maxScenes = 10,
  duration = 5,
  perSceneChars = 700,
  cap = 12000,
  floor = 2000,
}) {
  const expectChars =
    Math.max(Number(maxScenes) || 1, 1) * (perSceneChars || 700);
  const expectTokens = Math.ceil(expectChars / 3.0) + 600;
  return Math.max(floor, Math.min(cap, expectTokens));
}

/* ---------------- OpenAI: GPT-5 mini ---------------- */
async function callOpenAIGpt5Mini({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
  compiledPrompt, // 사용자 프롬프트(치환 완료) 그대로
  customPrompt, // true면 '프롬프트 우선' 모드
}) {
  const apiKey = await getSecret("openaiKey");
  if (!apiKey) throw new Error("OpenAI API Key가 설정되지 않았습니다.");

  const useCompiled =
    typeof compiledPrompt === "string" && compiledPrompt.trim().length > 0;

  const system = [
    "You are a professional Korean scriptwriter for YouTube long-form.",
    "Return ONLY JSON. No extra prose or Markdown.",
  ].join("\n");

  const SCHEMA_HINT = `
반드시 아래 JSON 스키마로만 응답하세요. 마크다운 금지.
{
  "title": "string (선택)",
  "scenes": [
    {
      "text": "string (필수)",
      "duration":  number (선택, 초),
      "visual_description": "string (선택)"
    }
  ]
}`;

  // 커스텀 프롬프트 모드에서는 사용자가 쓴 프롬프트만 그대로 전달
  const user = useCompiled
    ? compiledPrompt
    : [
        `주제: ${topic || "(미지정)"}`,
        `스타일: ${style || "(자유)"}`,
        `목표 길이(분): ${duration}`,
        `최대 장면 수(상한): ${maxScenes}`,
        type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
        "\n**요구사항**",
        "- 결과는 JSON만 반환",
        "- 각 장면 객체는 최소 { text } 포함",
        SCHEMA_HINT,
      ]
        .filter(Boolean)
        .join("\n");

  const budget = estimateMaxTokens({
    maxScenes: Number(maxScenes) || 10,
    duration: Number(duration) || 5,
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
    additionalProperties: true,
    required: ["scenes"],
    properties: {
      title: { type: "string" },
      scenes: {
        type: "array",
        minItems: 1,
        items: { type: "object", additionalProperties: true },
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
            strict: false,
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
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_completion_tokens: budget,
      },
      label: "free_text",
    },
  ];

  let lastRaw = null;
  for (let mode = 0; mode < attempts.length; mode++) {
    const { body } = attempts[mode];
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const r = await axios.post(
          "https://api.openai.com/v1/chat/completions",
          body,
          cfg
        );
        let raw = r?.data?.choices?.[0]?.message?.content;
        if (Array.isArray(raw))
          raw = raw
            .map((c) =>
              typeof c === "string" ? c : c?.text || c?.output_text || ""
            )
            .join("");
        if (typeof raw !== "string") raw = String(raw ?? "");
        lastRaw = raw;

        const unfenced = stripFence(raw);
        let parsed = tryParse(unfenced);
        if (!parsed) throw new Error("parse failed");

        parsed = coerceToScenesShape(parsed);
        if (!validateScriptDocLoose(parsed)) throw new Error("shape invalid");

        parsed.scenes = parsed.scenes.map((s, idx) => ({
          ...(typeof s === "object" ? s : {}),
          id: s?.id ? String(s.id) : `s${idx + 1}`,
          text: pickText(s),
        }));

        return formatScenes(parsed, topic, duration, maxScenes, {
          fromCustomPrompt: !!customPrompt || useCompiled,
        });
      } catch (err) {
        const { status } = normalizeErr(err);
        const retryable = status === 429 || (status >= 500 && status < 600);
        if (retryable && attempt < 2) {
          await sleep(800 * Math.pow(2, attempt));
          continue;
        }
        break;
      }
    }
  }

  const p = dumpRaw("openai-fail", lastRaw);
  const hint = p ? ` (raw: ${p})` : "";
  throw new Error("OpenAI 요청 실패: 대본 JSON 파싱/검증 실패" + hint);
}

/* ---------------- Anthropic ---------------- */
async function callAnthropic({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
  compiledPrompt, // 프롬프트 그대로
  customPrompt, // true면 '프롬프트 우선'
}) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  const useCompiled =
    typeof compiledPrompt === "string" && compiledPrompt.trim().length > 0;

  const sys = [
    "You are a professional Korean scriptwriter for YouTube long-form.",
    "Return ONLY JSON.",
  ].join("\n");

  // 커스텀 프롬프트면 그대로, 기본 탭이면 안내 문구
  const user = useCompiled
    ? compiledPrompt
    : [
        `주제: ${topic || "(미지정)"}`,
        `스타일: ${style || "(자유)"}`,
        `목표 길이(분): ${duration}`,
        `최대 장면 수(상한): ${maxScenes}`,
        type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
        "\n**요구사항**",
        "- 결과는 JSON만 반환",
      ]
        .filter(Boolean)
        .join("\n");

  // 추정치 → 모델 상한으로 캡
  const requested = Math.max(
    3000,
    estimateMaxTokens({
      maxScenes: Number(maxScenes) || 10,
      duration: Number(duration) || 5,
      perSceneChars: 800,
      cap: 16000,
      floor: 3000,
    })
  );
  const budget = clampAnthropicTokens(requested, DEFAULT_ANTHROPIC_MODEL);

  const body = {
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: budget,
    system: sys,
    messages: [{ role: "user", content: user }],
  };

  let lastRaw = null;
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
    const raw = data?.content?.[0]?.text || "";
    lastRaw = raw;

    const unfenced = stripFence(raw);
    let parsed = tryParse(unfenced);
    if (!parsed) break;

    parsed = coerceToScenesShape(parsed);
    if (!validateScriptDocLoose(parsed)) break;

    parsed.scenes = parsed.scenes.map((s, idx) => ({
      ...(typeof s === "object" ? s : {}),
      id: s?.id ? String(s.id) : `s${idx + 1}`,
      text: pickText(s),
    }));

    return formatScenes(parsed, topic, duration, maxScenes, {
      fromCustomPrompt: !!customPrompt || useCompiled,
    });
  }

  const p = dumpRaw("anthropic-fail", lastRaw);
  const hint = p ? ` (raw: ${p})` : "";
  throw new Error("Anthropic 요청 실패: 대본 JSON 파싱/검증 실패" + hint);
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
