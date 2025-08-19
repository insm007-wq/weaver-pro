// electron/ipc/llm/common.js
const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";
const ANTHROPIC_MODEL_CAPS = { "claude-3-5-sonnet-latest": 8192 };

function clampAnthropicTokens(requested, model = DEFAULT_ANTHROPIC_MODEL) {
  const cap = ANTHROPIC_MODEL_CAPS[model] || 8192;
  return Math.max(1000, Math.min(requested, cap - 64));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function normalizeErr(err) {
  return {
    status: err?.response?.status ?? null,
    data: err?.response?.data ?? null,
    message:
      err?.response?.data?.error?.message ||
      err?.response?.data?.message ||
      err?.message ||
      "Unknown error",
  };
}

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
    fs.writeFileSync(
      file,
      typeof raw === "string" ? raw : JSON.stringify(raw ?? "", null, 2),
      "utf8"
    );
    return file;
  } catch {
    return null;
  }
}

/* ---------- JSON 파싱 유틸 ---------- */
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
  const s1 = raw.indexOf("{");
  const e1 = raw.lastIndexOf("}");
  if (s1 !== -1 && e1 > s1) {
    const slice = raw.slice(s1, e1 + 1);
    try {
      return JSON.parse(slice);
    } catch {}
  }
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

/* ---------- 씬 탐색/정규화 ---------- */
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

/* ---------- 한국어 발화 속도 & 길이 검증 ---------- */
function charRangeForSeconds(sec) {
  const p = [
    { s: 5, min: 25, max: 35 },
    { s: 10, min: 50, max: 70 },
    { s: 30, min: 150, max: 200 },
    { s: 60, min: 300, max: 400 },
  ];
  if (sec <= p[0].s) return { min: p[0].min, max: p[0].max };
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i],
      b = p[i + 1];
    if (sec <= b.s) {
      const t = (sec - a.s) / (b.s - a.s);
      return {
        min: Math.round(a.min + t * (b.min - a.min)),
        max: Math.round(a.max + t * (b.max - a.max)),
      };
    }
  }
  const a = p[p.length - 2],
    b = p[p.length - 1];
  const t = (sec - b.s) / (b.s - a.s);
  return {
    min: Math.max(1, Math.round(b.min + t * (b.min - a.min))),
    max: Math.max(20, Math.round(b.max + t * (b.max - a.max))),
  };
}
const RATE_GUIDE =
  "- 한국어 발화 속도 기준으로 장면별 글자수(공백 제외)를 맞추세요.\n" +
  "  • 5초 = 25–35자\n" +
  "  • 10초 = 50–70자\n" +
  "  • 30초 = 150–200자\n" +
  "  • 60초 = 300–400자\n" +
  "- 각 장면 객체는 { text, duration(초) }를 포함합니다.\n" +
  "- 총 길이는 duration(분)*60초, 장면 수는 maxScenes(상한)입니다.";

function koLen(s = "") {
  return String(s).replace(/\s+/g, "").length;
}
function needsRepair(scenes = []) {
  for (const s of scenes) {
    const sec = Number.isFinite(s.duration)
      ? s.duration
      : Math.max(1, (s.end ?? 0) - (s.start ?? 0));
    const { min, max } = charRangeForSeconds(sec || 5);
    const n = koLen(s.text);
    if (n < min || n > max) return true;
  }
  return false;
}

/* ---------- 씬 수/길이 분배 & 출력 정규화 ---------- */
function expandScenesToTarget(scenes, target) {
  if (!Array.isArray(scenes) || scenes.length >= target) return scenes;
  const out = scenes.map((s) => ({ id: s.id, text: pickText(s) || "" }));
  let i = 0;
  while (out.length < target && i < out.length) {
    const t = out[i].text;
    if (t.length < 400) {
      i++;
      continue;
    }
    const parts = t.split(/(?<=\.|\?|!|。|！|？)\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const mid = Math.ceil(parts.length / 2);
      out.splice(
        i,
        1,
        { id: out[i].id, text: parts.slice(0, mid).join(" ") },
        { id: undefined, text: parts.slice(mid).join(" ") }
      );
    } else {
      const midIdx = Math.floor(t.length / 2);
      out.splice(
        i,
        1,
        { id: out[i].id, text: t.slice(0, midIdx) },
        { id: undefined, text: t.slice(midIdx) }
      );
    }
  }
  return out.slice(0, target);
}
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

  if (!fromCustomPrompt && maxScenes && Number(maxScenes) > 0) {
    scenesRaw = expandScenesToTarget(scenesRaw, Number(maxScenes));
  }

  const n = Math.max(1, scenesRaw.length);
  let totalSecsTarget;
  if (fromCustomPrompt) {
    const sumModel = scenesRaw.reduce(
      (a, s) => a + (Number.isFinite(s.duration) ? s.duration : 0),
      0
    );
    if (sumModel > 0) totalSecsTarget = sumModel;
    else if (Number.isFinite(parsed?.total_duration)) {
      const td = Number(parsed.total_duration);
      totalSecsTarget = td <= 25 ? Math.round(td * 60) : Math.round(td);
    } else
      totalSecsTarget = Math.max(1, Math.round(Number(durationMin || 5) * 60));
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
      totalSecsTarget = sum > 0 ? sum : totalSecsTarget;
    }
  } else {
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

function estimateMaxTokens({
  maxScenes = 10,
  duration = 5,
  perSceneChars = 800,
  cap = 16000,
  floor = 2500,
}) {
  const expectChars =
    Math.max(Number(maxScenes) || 1, 1) * (perSceneChars || 800);
  const expectTokens = Math.ceil(expectChars / 3.0) + 600;
  return Math.max(floor, Math.min(cap, expectTokens));
}

/* ---------- 리페어 패스 프롬프트 ---------- */
function buildRepairInput(doc) {
  return JSON.stringify(
    {
      scenes: doc.scenes.map((s, i) => ({
        scene_number: s.scene_number ?? i + 1,
        duration: s.duration,
        text: s.text,
      })),
    },
    null,
    2
  );
}
function buildRepairInstruction(topic, style) {
  return [
    "아래 JSON의 scenes 배열을 **같은 개수/순서**로 유지하면서, 각 장면의 text 길이를 duration(초)에 맞는 한국어 글자수 범위로 맞춰 다시 작성하세요.",
    RATE_GUIDE,
    "- 의미/맥락은 유지하되, 문장을 더 풍부하게 하거나 간결하게 조정하세요.",
    "- 장면 개수, 순서, duration 값은 변경 금지. 최종 결과는 JSON만 반환.",
    topic ? `- 주제: ${topic}` : "",
    style ? `- 스타일: ${style}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = {
  DEFAULT_ANTHROPIC_MODEL,
  clampAnthropicTokens,
  sleep,
  normalizeErr,
  dumpRaw,
  stripFence,
  tryParse,
  pickText,
  deepFindScenes,
  coerceToScenesShape,
  validateScriptDocLoose,
  charRangeForSeconds,
  RATE_GUIDE,
  needsRepair,
  expandScenesToTarget,
  formatScenes,
  estimateMaxTokens,
  buildRepairInput,
  buildRepairInstruction,
};
