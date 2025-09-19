// ============================================================================
// electron/ipc/llm/providers/openai.js
// 롱폼(>=25분) 대본도 안정적으로 생성되도록 보강한 버전
// - ① 출력 토큰 예산을 길이 기반 산정(안전 상한 클램프)
// - ② 롱폼은 2단계(아웃라인→씬별 텍스트)로 분할 생성
// - ③ referenceText도 롱폼 경로에 반영(요약 일부만 사용해 토큰 폭주 방지)
// - 주의: UI/IPC 인터페이스, 함수 시그니처 동일 (callOpenAIGpt5Mini)
// - 원칙: 사용자가 요청한 변경만 반영. 기존 로직은 유지하면서 롱폼 분기만 추가
// ============================================================================

const OpenAI = require("openai");
const { getSecret } = require("../../services/secrets");

// Utility functions (previously from common.js)
function dumpRaw(type, data) {
  try {
    console.log(`[RAW:${type}]`, data);
  } catch {}
}

function stripFence(text) {
  if (!text) return "";
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function coerceToScenesShape(obj) {
  if (!obj || typeof obj !== "object") return { title: "", scenes: [] };

  const scenes = Array.isArray(obj.scenes) ? obj.scenes : [];
  return {
    title: String(obj.title || ""),
    scenes: scenes.map((scene, i) => ({
      id: scene?.id || `s${i + 1}`,
      text: String(scene?.text || ""),
      duration: Number(scene?.duration) || 0,
      charCount: scene?.charCount || 0
    }))
  };
}

function validateScriptDocLoose(doc) {
  return doc &&
         typeof doc === "object" &&
         Array.isArray(doc.scenes) &&
         doc.scenes.length > 0 &&
         doc.scenes.every(s => s && typeof s.text === "string" && s.text.trim());
}

function pickText(scene) {
  return String(scene?.text || "").trim();
}

function formatScenes(doc, topic, duration, maxScenes, options = {}) {
  if (!doc || !Array.isArray(doc.scenes)) {
    return { title: topic || "", scenes: [] };
  }

  return {
    title: doc.title || topic || "",
    scenes: doc.scenes.slice(0, maxScenes || 20).map((scene, i) => ({
      id: scene?.id || `s${i + 1}`,
      text: String(scene?.text || "").trim(),
      duration: Number(scene?.duration) || Math.max(1, Math.round((duration || 5) * 60 / (maxScenes || 10))),
      charCount: scene?.charCount || countCharsKo(scene?.text || "")
    }))
  };
}

function estimateMaxTokens({ maxScenes = 10, duration = 5 }) {
  const avgCharsPerScene = (duration * 350) / maxScenes; // 350 chars per minute average
  const totalChars = avgCharsPerScene * maxScenes;
  return Math.max(6000, Math.ceil(totalChars * 1.2) + 2000); // Add overhead
}

function buildRepairInput(doc) {
  return JSON.stringify(doc, null, 2);
}

function buildRepairInstruction(topic, style) {
  return `Fix the following script JSON to ensure proper structure and timing. Topic: ${topic || "N/A"}, Style: ${style || "N/A"}. Return valid JSON only.`;
}

/* ======================= 글자수(공백 포함) 통일 계산기 ======================= */
// - NFC 정규화
// - 제로폭 문자 제거(U+200B~U+200D, U+FEFF)
// - 코드포인트 기준 길이(Array.from)
function normalizeForCount(s) {
  let t = String(s ?? "");
  try {
    t = t.normalize("NFC");
  } catch {}
  t = t.replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
  return t;
}
function countCharsKo(s) {
  return Array.from(normalizeForCount(s)).length;
}

/* ======================= DEBUG ======================= */
const DEBUG_LEN = false;
function debug(...args) {
  try {
    if (DEBUG_LEN) console.log("[OPENAI LEN]", ...args);
  } catch {}
}
function debugScenes(label, scenes, policy) {
  if (!DEBUG_LEN) return;
  try {
    const rows = (scenes || []).map((s, i) => {
      const sec = Number(s?.duration) || 0;
      const n =
        Number.isFinite(s?.charCount) && s.charCount >= 0
          ? s.charCount
          : countCharsKo(s?.text);
      const b = policy?.boundsForSec ? policy.boundsForSec(sec) : null;
      return {
        i,
        sec,
        chars: n,
        min: b ? b.min : undefined,
        tgt: b ? b.tgt : undefined,
        max: b ? b.max : undefined,
      };
    });
    debug(label, rows);
  } catch {}
}

/* ======================= 모델/폴백 ======================= */
function resolveOpenAIModels(payload = {}) {
  const want = String(payload.model || payload.llm || "").toLowerCase();

  if (
    want.includes("gpt5") ||
    want.includes("gpt-5") ||
    want.includes("gpt_5")
  ) {
    return {
      primary: "gpt-5.0-mini",
      fallback: "gpt-4.1-mini",
      wantedFamily: "gpt-5",
    };
  }
  if (want.includes("4o")) {
    return {
      primary: "gpt-4o-mini",
      fallback: "gpt-4.1-mini",
      wantedFamily: "gpt-4",
    };
  }
  if (want.includes("4.1") || want.includes("4-1")) {
    return {
      primary: "gpt-4.1-mini",
      fallback: "gpt-4.1-mini",
      wantedFamily: "gpt-4",
    };
  }
  return {
    primary: "gpt-4.1-mini",
    fallback: "gpt-4.1-mini",
    wantedFamily: "gpt-4",
  };
}

/* ======================= JSON 추출 ======================= */
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

/* ======================= 에러 분류(폴백 허용) ======================= */
function isQuotaOrTokenError(err) {
  const m =
    (
      err &&
      (err.message || err.error?.message || err.toString())
    )?.toLowerCase() || "";
  return (
    err?.status === 402 ||
    m.includes("insufficient_quota") ||
    m.includes("exceeded your current quota") ||
    m.includes("billing") ||
    m.includes("out of tokens") ||
    (err?.status === 429 && (m.includes("quota") || m.includes("rate")))
  );
}
function isModelUnsupported(err) {
  const m =
    (
      err &&
      (err.message || err.error?.message || err.toString())
    )?.toLowerCase() || "";
  return (
    err?.status === 404 ||
    (m.includes("model") &&
      (m.includes("not found") || m.includes("unsupported")))
  );
}

/* ======================= 길이 정책 (분당 300~400자) ======================= */
const LENGTH_FIRST_GUIDE = [
  "- 길이 정책을 최우선으로 지키세요(문장 수 제한 없음).",
  "- 장면별 목표 글자수에 맞추되, 의미/논리/맥락은 풍부하게 유지하세요.",
  "- 중복을 피하고, 구체 예시/수치/근거를 활용해 자연스럽게 분량을 채우세요.",
  "- 불릿/목록/마크다운/코드펜스 금지. 자연스러운 문단 2~3개로 작성.",
].join("\n");

function calcLengthPolicy({ duration, maxScenes, cpmMin, cpmMax }) {
  const secs = Math.max(1, Number(duration || 0) * 60);
  const scenes = Math.max(1, Number(maxScenes) || 1);

  const minCpm = Number.isFinite(Number(cpmMin)) ? Number(cpmMin) : 300;
  const maxCpm = Number.isFinite(Number(cpmMax)) ? Number(cpmMax) : 400;
  const tgtCpm = Math.round((minCpm + maxCpm) / 2); // ≈350

  const perSecMin = minCpm / 60;
  const perSecMax = maxCpm / 60;
  const perSecTgt = tgtCpm / 60;

  const totalMin = Math.round(secs * perSecMin);
  const totalMax = Math.round(secs * perSecMax);
  const totalTgt = Math.round(secs * perSecTgt);

  // Google TTS 안전 상한 (~5000 bytes 입력 한도 대비 여유)
  const SAFE_BYTE_LIMIT = 4800;
  const AVG_BYTES_PER_KO_CHAR = 3;
  const SAFE_CHAR_CAP = Math.floor(SAFE_BYTE_LIMIT / AVG_BYTES_PER_KO_CHAR); // ≈1600
  const HARD_CAP = 1450;
  const hardCap = Math.min(SAFE_CHAR_CAP, HARD_CAP);

  const boundsForSec = (sec = 0) => {
    const s = Math.max(1, Math.round(sec));
    const min = Math.round(s * perSecMin);
    const max = Math.min(Math.round(s * perSecMax), hardCap);
    const tgt = Math.min(Math.round(s * perSecTgt), hardCap - 20);
    return { min, max, tgt };
  };

  const policy = {
    secs,
    scenes,
    minCpm,
    maxCpm,
    tgtCpm,
    perSecMin,
    perSecMax,
    perSecTgt,
    totalMin,
    totalMax,
    totalTgt,
    hardCap,
    boundsForSec,
  };

  debug("policy", {
    durationMin: duration,
    scenes,
    totalMin,
    totalTgt,
    totalMax,
    hardCap,
  });
  return policy;
}

function buildPolicyUserPrompt({ topic, style, type, referenceText, policy }) {
  return [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
    "",
    "길이 정책(매우 중요):",
    `- 전체 글자수 목표: 약 ${policy.totalTgt}자 (허용 ${policy.totalMin}~${policy.totalMax}자).`,
    `- 각 scene.text는 scene.duration(초)에 비례(1초당 ${policy.perSecMin.toFixed(
      2
    )}~${policy.perSecMax.toFixed(2)}자, 타깃 ${policy.perSecTgt.toFixed(
      2
    )}자).`,
    `- 장면당 최대 ${policy.hardCap}자(TTS 안전 한도).`,
    `- 모든 scene.duration 합계는 총 재생시간(${policy.secs}s)과 거의 같아야 함(±2s).`,
    "- 각 씬은 scene.duration × 300자(최소치)를 반드시 충족해야 합니다. 미달이면 반려.",
    LENGTH_FIRST_GUIDE,
    '반드시 {"title":"...","scenes":[{"text":"...","duration":number,"charCount":number}]} JSON만 반환.',
  ]
    .filter(Boolean)
    .join("\n");
}

function violatesLengthPolicy(doc, policy) {
  try {
    const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];
    const totalChars = scenes.reduce(
      (s, x) =>
        s +
        (Number.isFinite(x?.charCount) ? x.charCount : countCharsKo(x?.text)),
      0
    );
    const totalBad =
      totalChars < policy.totalMin * 0.95 ||
      totalChars > policy.totalMax * 1.05;

    let anyStrictFail = false;
    let softOutCount = 0;

    for (const sc of scenes) {
      const sec = Number.isFinite(sc?.duration) ? Number(sc.duration) : 0;
      const { min, max } = policy.boundsForSec(sec);
      const n = Number.isFinite(sc?.charCount)
        ? sc.charCount
        : countCharsKo(sc?.text);
      if (n < min) anyStrictFail = true; // 최소치 미만 즉시 실패
      if (n && (n < min * 0.9 || n > max * 1.1)) softOutCount++;
    }
    const ratioBad = scenes.length ? softOutCount / scenes.length : 0;

    debug("violates check", {
      totalChars,
      totalMin: policy.totalMin,
      totalMax: policy.totalMax,
      totalBad,
      anyStrictFail,
      softOutRatio: ratioBad,
    });

    return anyStrictFail || totalBad || ratioBad >= 0.2;
  } catch {
    return false;
  }
}

/* ===== OpenAI 호출 유틸 (JSON 우선 → 프리텍스트 재시도) ===== */
async function chatJsonOrFallbackFreeText(
  client,
  model,
  messages,
  maxTokens = 6000
) {
  let rawText = "";
  try {
    const r = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: maxTokens,
    });
    rawText = r?.choices?.[0]?.message?.content || "";
    dumpRaw("openai-chat_json_object", { model, usage: r?.usage });
  } catch (e) {
    dumpRaw("openai-chat_json_object-http-fail", {
      model,
      error: String(e?.message || e),
      status: e?.status,
    });
  }

  if (!rawText) {
    try {
      const r2 = await client.chat.completions.create({
        model,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
      });
      rawText = r2?.choices?.[0]?.message?.content || "";
      dumpRaw("openai-chat_free_text", { model, usage: r2?.usage });
    } catch (e) {
      dumpRaw("openai-free_text-http-fail", {
        model,
        error: String(e?.message || e),
        status: e?.status,
      });
    }
  }
  return rawText;
}

/* ======================= 롱폼 전용: 2단계 생성 ======================= */
// ── 상수: 출력 토큰 예산/패스 수/경계값
const KR_CHAR_TO_TOKENS = 1.0; // 한국어 대략 토큰≈문자
const OUT_TOKENS_HEADROOM = 1200; // JSON 오버헤드 여유
const MAX_OUT_TOKENS = 8000; // 출력 토큰 안전 상한(모델 한도 고려, 안정 클램프)
const LONGFORM_MIN_MINUTES = 25; // 25분 이상이면 롱폼 경로
const MAX_EXPAND_PASSES_LONG = 6; // 롱폼 확장/축약 최대 패스
const MAX_EXPAND_PASSES_SHORT = 3; // 숏폼 패스
const SCENE_TOKEN_BUDGET = 1300; // 씬별 텍스트 생성시 토큰 예산(안정)

/* 레퍼런스 텍스트 일부만 안전 추출(토큰 폭주 방지) */
function safeExcerpt(s, limit = 1200) {
  const t = normalizeForCount(s || "");
  if (!t) return "";
  if (Array.from(t).length <= limit) return t;
  // 앞·뒤에서 조금씩 취해 요약 힌트 제공
  const arr = Array.from(t);
  const head = arr.slice(0, Math.floor(limit * 0.7)).join("");
  const tail = arr.slice(-Math.floor(limit * 0.2)).join("");
  return `${head}\n...\n${tail}`;
}

// 1단계: 아웃라인(JSON)
async function generateOutline({
  client,
  model,
  topic,
  style,
  policy,
  referenceText,
  isReference,
}) {
  const targetScenes = policy.scenes; // UI의 maxScenes 사용
  const refHint =
    isReference && referenceText
      ? `\n[레퍼런스(발췌)]\n${safeExcerpt(referenceText, 1200)}\n`
      : "";

  const sys =
    'Return ONLY JSON like {"title":"...","scenes":[{"duration":N,"brief":"..."}]}';
  const user = [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    refHint,
    "[요구사항]",
    `- 총 재생시간: ${policy.secs}s (씬 durations 합계가 ±2s 이내).`,
    `- 씬 개수: ${targetScenes}개(±0).`,
    "- 각 씬에는 한 문장 요약 brief만 간단히 포함.",
    "- 제목(title)도 포함.",
    '반드시 {"title":"...","scenes":[{"duration":N,"brief":"..."}]} JSON만 반환.',
  ].join("\n");

  const raw = await chatJsonOrFallbackFreeText(
    client,
    model,
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    Math.min(MAX_OUT_TOKENS, 4000) // 아웃라인은 가볍게
  );

  const parsed = coerceToScenesShape(extractLargestJson(raw) || {});
  if (!Array.isArray(parsed?.scenes) || !parsed.scenes.length) {
    throw new Error("아웃라인 생성 실패");
  }

  // duration 합계 보정(±2s 이내가 아니면 비율 보정)
  const sum = parsed.scenes.reduce((s, x) => s + (Number(x?.duration) || 0), 0);
  if (sum && Math.abs(sum - policy.secs) > 2) {
    const f = policy.secs / sum;
    parsed.scenes = parsed.scenes.map((s) => ({
      ...s,
      duration: Math.max(1, Math.round((Number(s?.duration) || 1) * f)),
    }));
  }

  // id 부여
  parsed.scenes = parsed.scenes.map((s, i) => ({
    id: s?.id ? String(s.id) : `s${i + 1}`,
    duration: Number(s?.duration) || 1,
    brief: String(s?.brief || ""),
  }));

  return { title: String(parsed.title || topic || ""), scenes: parsed.scenes };
}

// 2단계: 씬별 텍스트 생성(JSON)
async function generateSceneText({
  client,
  model,
  topic,
  style,
  policy,
  scene,
  referenceText,
  isReference,
}) {
  const { duration, brief } = scene;
  const { min, max, tgt } = policy.boundsForSec(duration);

  const refHint =
    isReference && referenceText
      ? `\n[레퍼런스(발췌)]\n${safeExcerpt(referenceText, 800)}\n`
      : "";

  const sys = 'Return ONLY JSON like {"text":"...","charCount":N}';
  const user = [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    refHint,
    LENGTH_FIRST_GUIDE,
    `- 이 씬의 duration=${duration}s, 분량: ${min}~${max}자(목표 ${tgt}자).`,
    "- 불릿/목록/마크다운/코드펜스 금지. 자연스러운 문단 2~3개.",
    brief ? `\n[요약 힌트]\n${brief}` : "",
    '\n반드시 {"text":"...","charCount":N} JSON만 반환.',
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await chatJsonOrFallbackFreeText(
    client,
    model,
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    SCENE_TOKEN_BUDGET
  );
  const obj = tryParse(stripFence(raw)) || {};
  const text = String(obj?.text || "");
  const n = countCharsKo(text);
  return { text, charCount: n };
}

/* ===== 씬별 확장/축약 (기존 함수 유지) ===== */
async function expandOrCondenseScenesOpenAI({
  client,
  model,
  doc,
  policy,
  topic,
  style,
  budget,
}) {
  const out = { ...doc, scenes: [...doc.scenes] };

  const badIdx = out.scenes
    .map((s, i) => {
      const sec = Number.isFinite(s?.duration) ? Number(s.duration) : 0;
      const { min, max } = policy.boundsForSec(sec);
      const len = Number.isFinite(s?.charCount)
        ? s.charCount
        : countCharsKo(s?.text);
      const under = min - len; // 양수면 부족
      const over = len - Math.round(max * 1.05); // 양수면 초과
      const gap = Math.max(under, over, 0);
      return { i, gap, len, sec, min, max };
    })
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .map((x) => x.i);

  debug("rewrite target idx", badIdx);

  for (const i of badIdx) {
    const sc = out.scenes[i];
    const baseText = String(sc.text || "");
    const curLen = Number.isFinite(sc?.charCount)
      ? sc.charCount
      : countCharsKo(baseText);

    const sec = Number.isFinite(sc?.duration) ? Number(sc.duration) : 0;
    const {
      min: targetMin,
      max: targetMax,
      tgt: targetTgt,
    } = policy.boundsForSec(sec);

    if (curLen >= targetMin && curLen <= Math.round(targetMax * 1.05)) continue;

    const system = 'Return ONLY JSON with {"text":"...","charCount":N}.';
    const need = curLen < targetMin ? "확장" : "축약";
    debug(`scene#${i} ${need} before`, {
      sec,
      curLen,
      targetMin,
      targetTgt,
      targetMax,
    });

    const prompt = [
      `주제/스타일은 유지하고, 아래 문장을 ${need}하여`,
      `scene.duration=${sec}s 기준으로 공백 포함 ${targetMin}~${targetMax}자(목표 ${targetTgt}자) 분량으로 재작성하세요.`,
      `- 최소 ${targetMin}자 미만은 허용하지 않습니다.`,
      `- 장면당 최대 ${policy.hardCap}자(TTS 안전 한도).`,
      "목차/불릿/마크다운 금지, 자연스러운 문단 2~3개.",
      "",
      `주제: ${topic || "(생략)"}`,
      `스타일: ${style || "(자유)"}`,
      "",
      '반환 JSON 예: {"text":"...","charCount":123}',
      "",
      "[원문]",
      baseText,
    ].join("\n");

    let raw = "";
    try {
      raw = await chatJsonOrFallbackFreeText(
        client,
        model,
        [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        Math.max(900, Math.floor(budget * 0.18))
      );
    } catch {
      // skip
    }
    const unfenced = stripFence(raw || "");
    const obj = tryParse(unfenced) || {};
    const newText = String(obj?.text || baseText);
    const newLen = countCharsKo(newText);

    out.scenes[i] = { ...sc, text: newText, charCount: newLen };
    debug(`scene#${i} after`, {
      newLen,
      min: targetMin,
      tgt: targetTgt,
      max: targetMax,
    });
  }

  return out;
}

/* ======================= 메인 ======================= */
async function callOpenAIGpt5Mini(payload) {
  const apiKey = await getSecret("openaiKey");
  if (!apiKey) throw new Error("OpenAI API Key가 설정되지 않았습니다.");

  const {
    prompt,
    compiledPrompt,
    customPrompt,
    type, // 'auto' | 'reference' | 'import' | ...
    topic,
    style,
    duration,
    maxScenes,
    cpmMin,
    cpmMax,
    referenceText, // 추가: 레퍼런스 텍스트(있으면 롱폼에도 반영)
  } = payload || {};

  const client = new OpenAI({ apiKey });
  const { primary, fallback, wantedFamily } = resolveOpenAIModels(payload);

  const policy = calcLengthPolicy({ duration, maxScenes, cpmMin, cpmMax });

  // ──────────────────────────────────────────────────────────────────────────
  // 롱폼 분기: 25분 이상이면 2단계(아웃라인 → 씬별 텍스트) 경로로 안전 생성
  // ──────────────────────────────────────────────────────────────────────────
  const isLongForm = Number(duration) >= LONGFORM_MIN_MINUTES;
  const isReference = type === "reference";
  if ((type === "auto" || isReference) && !customPrompt && isLongForm) {
    let usedModel = primary;
    let notice = null;

    // 1) 아웃라인
    let outline;
    try {
      outline = await generateOutline({
        client,
        model: primary,
        topic,
        style,
        policy,
        referenceText,
        isReference,
      });
    } catch (e) {
      // 모델 이슈 시 폴백
      usedModel = fallback;
      notice =
        wantedFamily === "gpt-5"
          ? "OpenAI GPT-5 사용 불가로 GPT-4로 자동 전환했습니다."
          : "요청 모델 사용 불가로 안정 모델로 전환했습니다.";
      outline = await generateOutline({
        client,
        model: fallback,
        topic,
        style,
        policy,
        referenceText,
        isReference,
      });
    }

    // 2) 씬별 텍스트 생성(씬당 소량 토큰 → 전체 길이는 크게 나와도 안전)
    const scenes = [];
    for (const s of outline.scenes) {
      const fill = await generateSceneText({
        client,
        model: usedModel,
        topic,
        style,
        policy,
        scene: s,
        referenceText,
        isReference,
      });
      scenes.push({
        id: s.id,
        duration: s.duration,
        text: fill.text,
        charCount: fill.charCount,
      });
    }

    // 3) 조립
    let out = formatScenes(
      { title: outline.title, scenes },
      topic,
      duration,
      maxScenes,
      {
        fromCustomPrompt: false,
      }
    );

    // 4) 길이 정책 강화 패스(최대 6회)
    const PASS_LIMIT = MAX_EXPAND_PASSES_LONG;
    let pass = 0;
    while (violatesLengthPolicy(out, policy) && pass < PASS_LIMIT) {
      try {
        const expanded = await expandOrCondenseScenesOpenAI({
          client,
          model: usedModel,
          doc: out,
          policy,
          topic,
          style,
          budget: 4000,
        });
        out = expanded;
      } catch (e) {
        dumpRaw("openai-length-expand-fail", String(e?.message || e));
        break;
      }
      pass++;
    }

    if (notice) out._notice = notice + ` (사용 모델: ${usedModel})`;
    debugScenes("final longform", out.scenes, policy);
    return out;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 기존(숏폼/중폼) 경로: 한 번에 JSON 생성 → 필요 시 보정
  // ──────────────────────────────────────────────────────────────────────────
  const useCompiled = !!(compiledPrompt && String(compiledPrompt).trim());
  const userPrompt =
    useCompiled || customPrompt
      ? String(compiledPrompt || prompt || "")
      : buildPolicyUserPrompt({
          topic,
          style,
          type,
          referenceText,
          policy,
        });

  // 디버그 저장
  try {
    dumpRaw("openai-user-prompt", {
      modelPrimary: primary,
      wantedFamily,
      usedCompiled: !!(useCompiled || customPrompt),
      length: userPrompt.length,
      head: userPrompt.slice(0, 800),
    });
  } catch {}

  const systemMsg = [
    "You are a professional Korean scriptwriter.",
    'Return ONLY JSON like: {"title":"...","scenes":[{"text":"...","duration":N,"charCount":N}]}',
    "No Markdown. No explanation.",
  ].join(" ");

  const messages = [
    { role: "system", content: systemMsg },
    { role: "user", content: userPrompt },
  ];

  // 목표 총 문자수를 토대로 출력 토큰 예산 산정(한글≈CJK: 토큰≈문자)
  const targetOutTokens =
    Math.ceil(policy.totalTgt * KR_CHAR_TO_TOKENS) + OUT_TOKENS_HEADROOM;
  const requested = Math.min(
    MAX_OUT_TOKENS,
    Math.max(
      6000,
      targetOutTokens,
      estimateMaxTokens({
        maxScenes: Number(maxScenes) || 10,
        duration: Number(duration) || 5,
      })
    )
  );
  const budget = requested;
  debug("token budget", { requested });

  let rawText = "";
  let usedModel = primary;
  let notice = null;

  // 1차
  try {
    rawText = await chatJsonOrFallbackFreeText(
      client,
      primary,
      messages,
      budget
    );
  } catch (e) {
    if (isQuotaOrTokenError(e) || isModelUnsupported(e)) {
      notice =
        wantedFamily === "gpt-5"
          ? "OpenAI GPT-5 토큰 소진/미지원으로 GPT-4로 자동 전환했습니다."
          : "요청 모델 사용 불가로 안정 모델로 전환했습니다.";
    } else {
      throw e;
    }
  }

  // 파싱
  let parsed = null;
  if (rawText) parsed = coerceToScenesShape(extractLargestJson(rawText) || {});

  // 폴백
  if (!rawText || !validateScriptDocLoose(parsed)) {
    if (!notice) {
      notice =
        wantedFamily === "gpt-5"
          ? "OpenAI GPT-5 응답이 유효하지 않아 GPT-4로 자동 전환했습니다."
          : "요청 모델 응답이 유효하지 않아 안정 모델로 전환했습니다.";
    }
    usedModel = fallback;
    rawText = await chatJsonOrFallbackFreeText(
      client,
      fallback,
      messages,
      budget
    );
    parsed = coerceToScenesShape(extractLargestJson(rawText) || {});
    if (!validateScriptDocLoose(parsed)) {
      dumpRaw("openai-fallback-json-invalid", { raw: rawText });
      throw new Error("OpenAI 응답(JSON) 구조가 유효하지 않습니다.");
    }
  }

  // 정규화 + charCount 강제 재계산
  parsed.scenes = parsed.scenes.map((s, i) => {
    const text = pickText(s);
    return {
      ...(typeof s === "object" ? s : {}),
      id: s?.id ? String(s.id) : `s${i + 1}`,
      text,
      duration: Number.isFinite(s?.duration)
        ? Math.round(Number(s.duration))
        : undefined,
      charCount: countCharsKo(text),
    };
  });
  debugScenes("parsed scenes", parsed.scenes, policy);

  let out = formatScenes(parsed, topic, duration, maxScenes, {
    fromCustomPrompt: !!(
      customPrompt ||
      useCompiled ||
      (typeof prompt === "string" && prompt.trim())
    ),
  });

  // 길이 정책 강제: 자동/레퍼런스만
  if ((type === "auto" || type === "reference") && !customPrompt) {
    let violated = violatesLengthPolicy(out, policy);
    debug("violates after parse:", violated);

    if (violated) {
      // (a) 구조/시간 보정
      try {
        const repairPrompt = buildRepairInstruction(topic, style);
        const repairInput = buildRepairInput(out);
        const repairMsgs = [
          { role: "system", content: "Return ONLY JSON." },
          {
            role: "user",
            content: repairPrompt + "\n\n[INPUT JSON]\n" + repairInput,
          },
        ];
        const repairText = await chatJsonOrFallbackFreeText(
          client,
          usedModel,
          repairMsgs,
          Math.max(1200, Math.floor(budget * 0.6))
        );
        const fixed = coerceToScenesShape(
          tryParse(stripFence(repairText)) || {}
        );
        if (validateScriptDocLoose(fixed)) {
          fixed.scenes = fixed.scenes.map((s, i) => {
            const text = pickText(s);
            return {
              ...(typeof s === "object" ? s : {}),
              id: out.scenes[i]?.id || `s${i + 1}`,
              text,
              duration: Number.isFinite(s?.duration)
                ? Math.round(Number(s.duration))
                : out.scenes[i].duration,
              charCount: countCharsKo(text),
            };
          });
          out = formatScenes(fixed, topic, duration, maxScenes, {
            fromCustomPrompt: false,
          });
          debugScenes("after repair", out.scenes, policy);
        }
      } catch (e) {
        dumpRaw("openai-repair-fail", String(e?.message || e));
      }

      // (b) 씬별 확장/축약 — 패스 제한(숏폼 3회)
      const PASS_LIMIT = MAX_EXPAND_PASSES_SHORT;
      let pass = 0;
      while (violatesLengthPolicy(out, policy) && pass < PASS_LIMIT) {
        debug("expand/condense pass", pass + 1);
        try {
          const expanded = await expandOrCondenseScenesOpenAI({
            client,
            model: usedModel,
            doc: out,
            policy,
            topic,
            style,
            budget,
          });
          out = expanded;
          debugScenes("after expand/condense", out.scenes, policy);
        } catch (e) {
          dumpRaw("openai-length-expand-fail", String(e?.message || e));
          break;
        }
        pass++;
      }
      debug("violates final:", violatesLengthPolicy(out, policy));
    }
  }

  if (notice) {
    out._notice = notice + ` (사용 모델: ${usedModel})`;
    try {
      console.warn("[OPENAI] NOTICE:", out._notice);
    } catch {}
  }

  return out;
}

module.exports = { callOpenAIGpt5Mini };
