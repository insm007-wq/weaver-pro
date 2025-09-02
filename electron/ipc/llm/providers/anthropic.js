const { getSecret } = require("../../../services/secrets");
const {
  DEFAULT_ANTHROPIC_MODEL,
  clampAnthropicTokens,
  sleep,
  dumpRaw,
  stripFence,
  tryParse,
  pickText,
  coerceToScenesShape,
  validateScriptDocLoose,
  formatScenes,
  estimateMaxTokens,
  buildRepairInput,
  buildRepairInstruction,
} = require("../common");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/* ======================================================================
   공통: 글자수(공백 포함) 통일 계산기
   - NFC 정규화 + 제로폭 제거 + 코드포인트 길이
====================================================================== */
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

/* ======================================================================
   DEBUG
====================================================================== */
const DEBUG_LEN = false;
function debug(...args) {
  try {
    if (DEBUG_LEN) console.log("[CLAUDE]", ...args);
  } catch {}
}
function debugScenes(label, scenes, policy) {
  if (!DEBUG_LEN) return;
  try {
    const rows = (scenes || []).map((s, i) => {
      const sec = Number(s?.duration) || 0;
      const n = Number.isFinite(s?.charCount)
        ? s.charCount
        : countCharsKo(s?.text);
      const b = policy?.boundsForSec ? policy.boundsForSec(sec) : null;
      return { i, sec, chars: n, min: b?.min, tgt: b?.tgt, max: b?.max };
    });
    debug(label, rows);
  } catch {}
}

/* ======================================================================
   길이-우선 가이드(자동/레퍼런스 전용)
====================================================================== */
const LENGTH_FIRST_GUIDE = [
  "- 길이 정책을 최우선으로 지키세요(문장 수 제한 없음).",
  "- 장면별 목표 글자수에 맞추되, 의미/논리/맥락은 풍부하게 유지하세요.",
  "- 중복을 피하고, 구체 예시/수치/근거를 활용해 자연스럽게 분량을 채우세요.",
  "- 불릿/목록/마크다운/코드펜스 금지. 자연스러운 문단 2~3개.",
].join("\n");

/* ======================================================================
   길이 정책 계산 (분당 300~400자) + Google TTS 안전 상한(≈1450자/scene)
====================================================================== */
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

  // Google TTS 텍스트 입력 안전 상한
  const SAFE_BYTE_LIMIT = 4800; // bytes
  const AVG_BYTES_PER_KO_CHAR = 3; // 한국어 평균 바이트(보수적)
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

/* ======================================================================
   정책형 프롬프트(자동/레퍼런스 전용)
====================================================================== */
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
    "- 각 씬은 scene.duration × 300자(최소치)를 반드시 충족해야 합니다.",
    LENGTH_FIRST_GUIDE,
    '반드시 {"title":"...","scenes":[{"text":"...","duration":number,"charCount":number}]} JSON만 반환.',
  ]
    .filter(Boolean)
    .join("\n");
}

/* ======================================================================
   정책 위반 판정
====================================================================== */
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
      if (n < min) anyStrictFail = true; // 최소 미달 즉시 실패
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

/* ======================================================================
   Anthropic 호출 유틸
====================================================================== */
async function claudeJson(apiKey, body) {
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
    const t = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${t}`);
  }
  const data = await res.json().catch(() => null);
  const raw = data?.content?.[0]?.text || "";
  return stripFence(raw);
}

/* ======================================================================
   (A) 롱폼 아웃라인 생성 (25분 이상 분기)
   - 장면수: 총길이/40초(±) → 28~60 범위
   - 각 씬: {duration(sec), beats:[...]} 형태
====================================================================== */
async function generateOutline({ apiKey, topic, style, policy }) {
  const approxScenes = Math.max(28, Math.min(60, Math.round(policy.secs / 40)));
  const sys = [
    "You are a professional Korean long‑form script outliner.",
    'Return ONLY JSON like {"title":"...","scenes":[{"duration":N,"beats":["..."]}]}.',
  ].join(" ");
  const user = [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    "",
    `총 길이 목표: ${policy.secs}s (±2s 이내)`,
    `장면 수: 약 ${approxScenes} (최소 28, 최대 60)`,
    "각 장면 duration은 20~75초.",
    "beats에는 그 장면에서 다룰 핵심 소주제 2~4개.",
  ].join("\n");

  const raw = await claudeJson(apiKey, {
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: clampAnthropicTokens(3200, DEFAULT_ANTHROPIC_MODEL),
    system: sys,
    messages: [{ role: "user", content: user }],
    temperature: 0.1,
  });
  const parsed = coerceToScenesShape(tryParse(raw) || {});
  if (!Array.isArray(parsed?.scenes)) throw new Error("아웃라인 생성 실패");

  // duration 정규화(총합 = policy.secs 수렴)
  const sum =
    parsed.scenes.reduce((s, x) => s + (Number(x?.duration) || 0), 0) || 1;
  const scale = policy.secs / sum;
  parsed.scenes = parsed.scenes.map((s, i) => ({
    id: s?.id ? String(s.id) : `o${i + 1}`,
    duration: Math.max(20, Math.round((Number(s?.duration) || 30) * scale)),
    beats: Array.isArray(s?.beats) ? s.beats.slice(0, 4) : [],
  }));
  return parsed;
}

/* ======================================================================
   (B) 아웃라인 → 씬 텍스트 생성
   - 각 씬을 별도 호출(동시 4개)로 생성해 길이 정책 준수
====================================================================== */
async function generateScenesFromOutline({
  apiKey,
  outline,
  policy,
  topic,
  style,
}) {
  const scenes = [...outline.scenes];
  const out = [];
  const CONCURRENCY = 4;

  async function one(idx) {
    const base = scenes[idx];
    const sec = Math.max(10, Math.round(Number(base?.duration) || 30));
    const { min, max, tgt } = policy.boundsForSec(sec);
    const sys = 'Return ONLY JSON with {"text":"...","charCount":N}.';
    const user = [
      `주제: ${topic || "(미지정)"}`,
      `스타일: ${style || "(자유)"}`,
      `씬 #${idx + 1} (duration=${sec}s)`,
      base?.beats?.length ? `소주제: ${base.beats.join(" / ")}` : "",
      "",
      `분량 규칙: 공백 포함 ${min}~${max}자 (목표 ${tgt}자).`,
      "장면당 최대 1450자(TTS 안전 한도).",
      "목차/불릿/마크다운 금지, 자연스러운 문단 2~3개",
      '반환 예: {"text":"...","charCount":123}',
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await claudeJson(apiKey, {
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: clampAnthropicTokens(2800, DEFAULT_ANTHROPIC_MODEL),
      system: sys,
      messages: [{ role: "user", content: user }],
      temperature: 0.2,
    });
    const obj = tryParse(raw) || {};
    const text = String(obj?.text || "").trim();
    const cc = countCharsKo(text);
    return { id: `s${idx + 1}`, text, duration: sec, charCount: cc };
  }

  for (let i = 0; i < scenes.length; i += CONCURRENCY) {
    const batch = Array.from(
      { length: Math.min(CONCURRENCY, scenes.length - i) },
      (_, k) => i + k
    );
    const part = await Promise.all(batch.map(one));
    out.push(...part);
  }
  return { title: outline.title || "", scenes: out };
}

/* ======================================================================
   per‑scene 재작성 헬퍼 (기존 보정 루틴 재사용)
====================================================================== */
async function rewriteSceneOnce({ apiKey, sc, bounds, topic, style, budget }) {
  const baseText = String(sc.text || "");
  const curLen = Number.isFinite(sc?.charCount)
    ? sc.charCount
    : countCharsKo(baseText);
  const { min: targetMin, max: targetMax, tgt: targetTgt } = bounds;

  const system = 'Return ONLY JSON with {"text":"...","charCount":N}.';
  const need = curLen < targetMin ? "확장" : "축약";
  const prompt = [
    `주제/스타일은 유지하고, 아래 문장을 ${need}하여`,
    `공백 포함 ${targetMin}~${targetMax}자(목표 ${targetTgt}자) 분량으로 재작성하세요.`,
    `- 최소 ${targetMin}자 미만은 허용하지 않습니다.`,
    `- 장면당 최대 ${targetMax}자`,
    "목차/불릿/마크다운 금지, 자연스러운 문단 2~3개.",
    `주제: ${topic || "(생략)"}`,
    `스타일: ${style || "(자유)"}`,
    '반환 JSON 예: {"text":"...","charCount":123}',
    "",
    "[원문]",
    baseText,
  ].join("\n");

  const perSceneBudget = clampAnthropicTokens(
    Math.max(1500, Math.floor(budget * 0.25)),
    DEFAULT_ANTHROPIC_MODEL
  );
  const raw = await claudeJson(apiKey, {
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: perSceneBudget,
    system,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
  });
  const obj = tryParse(raw) || {};
  const newText = String(obj?.text || baseText);
  const newLen = countCharsKo(newText);
  return { text: newText, charCount: newLen };
}

/* ======================================================================
   씬별 확장/축약 보정 — 안정/병렬(동시 3)
====================================================================== */
async function expandOrCondenseScenes({
  apiKey,
  doc,
  policy,
  budget,
  topic,
  style,
}) {
  const out = { ...doc, scenes: [...doc.scenes] };
  const targets = out.scenes
    .map((s, i) => {
      const sec = Number.isFinite(s?.duration) ? Number(s.duration) : 0;
      const bounds = policy.boundsForSec(sec);
      const len = Number.isFinite(s?.charCount)
        ? s.charCount
        : countCharsKo(s?.text);
      const under = bounds.min - len; // 양수면 부족
      const over = len - Math.round(bounds.max * 1.05); // 양수면 초과
      const gap = Math.max(under, over, 0);
      return { i, gap, len, sec, bounds };
    })
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  const CONCURRENCY = 3;
  for (let k = 0; k < targets.length; k += CONCURRENCY) {
    const batch = targets.slice(k, k + CONCURRENCY);
    const results = await Promise.all(
      batch.map((t) =>
        rewriteSceneOnce({
          apiKey,
          sc: out.scenes[t.i],
          bounds: t.bounds,
          topic,
          style,
          budget,
        }).catch(() => null)
      )
    );

    results.forEach((r, idx) => {
      const t = batch[idx];
      if (!r) return;
      out.scenes[t.i] = {
        ...out.scenes[t.i],
        text: r.text,
        charCount: r.charCount,
      };
    });
  }
  return out;
}

/* ======================================================================
   메인 — 25분 미만: 단일 호출 / 25분 이상: 아웃라인→씬 생성(롱폼 안전)
====================================================================== */
async function callAnthropic({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
  compiledPrompt,
  customPrompt,
  prompt,
  cpmMin,
  cpmMax,
}) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  const compiled =
    (typeof compiledPrompt === "string" && compiledPrompt.trim()) ||
    (typeof prompt === "string" && prompt.trim()) ||
    "";
  const useCompiled = compiled.length > 0;

  const policy = calcLengthPolicy({ duration, maxScenes, cpmMin, cpmMax });

  const requested = Math.max(
    6000,
    Math.ceil(policy.totalTgt * 1.2),
    estimateMaxTokens({
      maxScenes: Number(maxScenes) || 10,
      duration: Number(duration) || 5,
    })
  );
  const budget = clampAnthropicTokens(requested, DEFAULT_ANTHROPIC_MODEL);

  // ── ① 25분 이상: 롱폼 파이프라인(아웃라인→씬 생성)
  if (!useCompiled && !customPrompt && Number(duration) >= 25) {
    // a) 아웃라인
    let outline = await generateOutline({ apiKey, topic, style, policy }).catch(
      () => null
    );
    if (
      !outline ||
      !Array.isArray(outline.scenes) ||
      outline.scenes.length === 0
    ) {
      // 아웃라인 실패 시 폴백: 단일 호출로 진행
      debug("outline failed → falling back to single-shot");
    } else {
      // b) 씬 생성
      let built = await generateScenesFromOutline({
        apiKey,
        outline,
        policy,
        topic,
        style,
      });
      // c) 보정 루프(최대 4패스)
      let pass = 0;
      while (violatesLengthPolicy(built, policy) && pass < 4) {
        built = await expandOrCondenseScenes({
          apiKey,
          doc: built,
          policy,
          budget,
          topic,
          style,
        });
        pass++;
      }
      const out = formatScenes(built, topic, duration, maxScenes, {
        fromCustomPrompt: false,
      });
      debugScenes("final(longform)", out.scenes, policy);
      return out;
    }
  }

  // ── ② 기본(단일 호출) 경로 — 기존 동작 유지
  const sys = [
    "You are a professional Korean scriptwriter for YouTube long‑form.",
    "Return ONLY JSON.",
  ].join("\n");

  const user = useCompiled
    ? compiled
    : buildPolicyUserPrompt({ topic, style, type, referenceText, policy });

  const body = {
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: budget,
    system: sys,
    messages: [{ role: "user", content: user }],
  };

  let lastRaw = null;
  const maxRetries = 1;
  let parsedOut = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const raw = await claudeJson(apiKey, body).catch(async (e) => {
      if (attempt < maxRetries) {
        await sleep(800 * Math.pow(2, attempt));
        return null;
      }
      throw e;
    });
    if (!raw) continue;

    lastRaw = raw;
    let parsed = coerceToScenesShape(tryParse(raw));
    if (!validateScriptDocLoose(parsed)) break;

    parsed.scenes = parsed.scenes.map((s, idx) => {
      const text = pickText(s);
      return {
        ...(typeof s === "object" ? s : {}),
        id: s?.id ? String(s.id) : `s${idx + 1}`,
        text,
        duration: Number.isFinite(s?.duration)
          ? Math.round(Number(s?.duration))
          : undefined,
        charCount: countCharsKo(text),
      };
    });

    parsedOut = formatScenes(parsed, topic, duration, maxScenes, {
      fromCustomPrompt: !!customPrompt || useCompiled,
    });
    break;
  }

  if (!parsedOut)
    throw new Error("Anthropic 요청 실패: 대본 JSON 파싱/검증 실패");

  if (!customPrompt && (type === "auto" || type === "reference")) {
    // (a) 구조/시간 보정
    let violated = violatesLengthPolicy(parsedOut, policy);
    if (violated) {
      try {
        const repairPrompt = buildRepairInstruction(topic, style);
        const repairInput = buildRepairInput(parsedOut);
        const raw = await claudeJson(apiKey, {
          model: DEFAULT_ANTHROPIC_MODEL,
          max_tokens: Math.max(1200, Math.floor(budget * 0.6)),
          system: "Return ONLY JSON.",
          messages: [
            {
              role: "user",
              content: repairPrompt + "\n\n[INPUT JSON]\n" + repairInput,
            },
          ],
        });
        const fixed = coerceToScenesShape(tryParse(raw));
        if (validateScriptDocLoose(fixed)) {
          fixed.scenes = fixed.scenes.map((s, i) => {
            const text = pickText(s);
            return {
              ...(typeof s === "object" ? s : {}),
              id: parsedOut.scenes[i]?.id || `s${i + 1}`,
              text,
              duration: Number.isFinite(s?.duration)
                ? Math.round(Number(s?.duration))
                : parsedOut.scenes[i].duration,
              charCount: countCharsKo(text),
            };
          });
          parsedOut = formatScenes(fixed, topic, duration, maxScenes, {
            fromCustomPrompt: false,
          });
        }
      } catch {}

      // (b) 씬별 확장/축약 — 최대 3패스
      let pass = 0;
      while (violatesLengthPolicy(parsedOut, policy) && pass < 3) {
        parsedOut = await expandOrCondenseScenes({
          apiKey,
          doc: parsedOut,
          policy,
          budget,
          topic,
          style,
        });
        pass++;
      }
    }
  }

  debugScenes("final(single)", parsedOut.scenes, policy);
  return parsedOut;
}

module.exports = { callAnthropic };
