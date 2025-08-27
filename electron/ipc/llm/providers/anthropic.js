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

/* ======================= 글자수(공백 포함) 통일 계산기 ======================= */
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

/* ======================= DEBUG HELPERS ======================= */
const DEBUG_LEN = true;
function debug(...args) {
  try {
    if (DEBUG_LEN) console.log("[LEN]", ...args);
  } catch {}
}
function debugScenes(label, scenes, policy) {
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

/* =======================================================================
   길이-우선 가이드(자동/레퍼런스 전용)
======================================================================= */
const LENGTH_FIRST_GUIDE = [
  "- 길이 정책을 최우선으로 지키세요(문장 수 제한 없음).",
  "- 장면별 목표 글자수에 맞추되, 의미/논리/맥락은 풍부하게 유지하세요.",
  "- 중복을 피하고, 구체 예시/수치/근거를 활용해 자연스럽게 분량을 채우세요.",
  "- 불릿/목록/마크다운/코드펜스 금지. 자연스러운 문단 2~3개로 작성하세요.",
].join("\n");

/* =======================================================================
   길이 정책 계산 (분당 300~400자) + Google TTS 안전 상한(≈1450자/scene)
======================================================================= */
function calcLengthPolicy({ duration, maxScenes, cpmMin, cpmMax }) {
  const secs = Math.max(1, Number(duration || 0) * 60);
  const scenes = Math.max(1, Number(maxScenes) || 1);

  const minCpm = Number.isFinite(Number(cpmMin)) ? Number(cpmMin) : 300;
  const maxCpm = Number.isFinite(Number(cpmMax)) ? Number(cpmMax) : 400;
  const tgtCpm = Math.round((minCpm + maxCpm) / 2); // ≈ 350

  const perSecMin = minCpm / 60;
  const perSecMax = maxCpm / 60;
  const perSecTgt = tgtCpm / 60;

  const totalMin = Math.round(secs * perSecMin);
  const totalMax = Math.round(secs * perSecMax);
  const totalTgt = Math.round(secs * perSecTgt);

  const SAFE_BYTE_LIMIT = 4800;
  const AVG_BYTES_PER_KO_CHAR = 3;
  const SAFE_CHAR_CAP = Math.floor(SAFE_BYTE_LIMIT / AVG_BYTES_PER_KO_CHAR);
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
    cpmMin: minCpm,
    cpmMax: maxCpm,
    totalMin,
    totalTgt,
    totalMax,
    hardCap,
  });

  return policy;
}

/* =======================================================================
   정책형 프롬프트(자동/레퍼런스 전용)
======================================================================= */
function buildPolicyUserPrompt({ topic, style, type, referenceText, policy }) {
  return [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
    "",
    "길이 정책(매우 중요):",
    `- 전체 글자수 목표(대략): ${policy.totalTgt}자 (허용 ${policy.totalMin}~${policy.totalMax}자).`,
    `- 각 scene.text는 scene.duration(초)에 비례하여 작성(1초당 ${policy.perSecMin.toFixed(
      2
    )}~${policy.perSecMax.toFixed(2)}자, 타깃 ${policy.perSecTgt.toFixed(
      2
    )}자).`,
    `- 장면당 최대 ${policy.hardCap}자(TTS 안전 한도).`,
    `- 모든 scene.duration의 합은 총 재생시간(${policy.secs}s)과 거의 같아야 함(±2s).`,
    "",
    "- 각 씬은 scene.duration × 300자(최소치)를 반드시 충족해야 합니다. 하나라도 미달이면 결과를 반려합니다.",
    LENGTH_FIRST_GUIDE,
    '반드시 {"title":"...","scenes":[{"text":"...","duration":number,"charCount":number}]} JSON만 반환.',
  ]
    .filter(Boolean)
    .join("\n");
}

/* =======================================================================
   정책 위반 판정
======================================================================= */
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

/* ----------------------- per-scene rewrite helper ---------------------- */
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
    "",
    `주제: ${topic || "(생략)"}`,
    `스타일: ${style || "(자유)"}`,
    "",
    '반환 JSON 예: {"text":"...","charCount":123}',
    "",
    "[원문]",
    baseText,
  ].join("\n");

  const perSceneBudget = clampAnthropicTokens(
    Math.max(1500, Math.floor(budget * 0.25)),
    DEFAULT_ANTHROPIC_MODEL
  );

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: perSceneBudget,
      system,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    debug("scene rewrite http fail", res.status);
    return null;
  }
  const data = await res.json().catch(() => null);
  const raw = data?.content?.[0]?.text || "";
  const unfenced = stripFence(raw);
  const obj = tryParse(unfenced) || {};
  const newText = String(obj?.text || baseText);
  const newLen = countCharsKo(newText);

  return { text: newText, charCount: newLen };
}

/* =======================================================================
   씬별 확장/축약 보정 — 안정/병렬(동시 3)
======================================================================= */
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
      const under = bounds.min - len;
      const over = len - Math.round(bounds.max * 1.05);
      const gap = Math.max(under, over, 0);
      return { i, gap, len, sec, bounds };
    })
    .filter((x) => x.gap > 0)
    .sort((a, b) => b.gap - a.gap);

  debug(
    "rewrite target idx",
    targets.map((t) => t.i)
  );

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
      debug(`scene#${t.i} after`, {
        newLen: r.charCount,
        min: t.bounds.min,
        tgt: t.bounds.tgt,
        max: t.bounds.max,
      });
    });
  }

  return out;
}

function ANTRHOPIC_URL_SAFE() {
  return ANTHROPIC_URL;
}

/* =======================================================================
   메인 호출
======================================================================= */
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

  debug("callAnthropic start", {
    type,
    durationMin: duration,
    maxScenes,
    useCompiled,
    cpmMin,
    cpmMax,
    model: DEFAULT_ANTHROPIC_MODEL,
  });

  const policy = calcLengthPolicy({ duration, maxScenes, cpmMin, cpmMax });

  const sys = [
    "You are a professional Korean scriptwriter for YouTube long-form.",
    "Return ONLY JSON.",
  ].join("\n");

  const user = useCompiled
    ? compiled
    : buildPolicyUserPrompt({ topic, style, type, referenceText, policy });

  const requested = Math.max(
    6000,
    Math.ceil(policy.totalTgt * 1.2),
    estimateMaxTokens({
      maxScenes: Number(maxScenes) || 10,
      duration: Number(duration) || 5,
    })
  );
  const budget = clampAnthropicTokens(requested, DEFAULT_ANTHROPIC_MODEL);
  debug("token budget", { requested, budget });

  const body = {
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: budget,
    system: sys,
    messages: [{ role: "user", content: user }],
  };

  let lastRaw = null;
  let parsedOut = null;

  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(ANTRHOPIC_URL_SAFE(), {
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
      debug(
        "http fail",
        res.status,
        "retryable:",
        retryable,
        "attempt:",
        attempt
      );
      if (retryable && attempt < maxRetries) {
        await sleep(800 * Math.pow(2, attempt));
        continue;
      }
      dumpRaw("anthropic-response-error", txt);
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

    debugScenes("parsed scenes", parsed.scenes, policy);

    parsedOut = formatScenes(parsed, topic, duration, maxScenes, {
      fromCustomPrompt: !!customPrompt || useCompiled,
    });
    break;
  }

  if (!parsedOut) {
    const p = dumpRaw("anthropic-fail-final", lastRaw || "(empty)");
    throw new Error(
      "Anthropic 요청 실패: 대본 JSON 파싱/검증 실패" +
        (p ? ` (raw: ${p})` : "")
    );
  }

  // 자동/레퍼런스만 길이 정책 보정 (프롬프트 탭은 분량 보정은 건너뛰되 카운트는 이미 통일)
  if (!customPrompt && (type === "auto" || type === "reference")) {
    let violated = violatesLengthPolicy(parsedOut, policy);
    debug("violates after parse:", violated);

    // (a) 구조/시간 보정 1회
    if (violated) {
      try {
        const repairPrompt = buildRepairInstruction(topic, style);
        const repairInput = buildRepairInput(parsedOut);
        const res = await fetch(ANTRHOPIC_URL_SAFE(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: DEFAULT_ANTHROPIC_MODEL,
            max_tokens: Math.max(1200, Math.floor(budget * 0.6)),
            system: "Return ONLY JSON.",
            messages: [
              {
                role: "user",
                content: repairPrompt + "\n\n[INPUT JSON]\n" + repairInput,
              },
            ],
          }),
        });
        const data = await res.json().catch(() => null);
        const raw = data?.content?.[0]?.text || "";
        const unfenced = stripFence(raw);
        const fixed = coerceToScenesShape(tryParse(unfenced));
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
          debugScenes("after repair", fixed.scenes, policy);
          parsedOut = formatScenes(fixed, topic, duration, maxScenes, {
            fromCustomPrompt: false,
          });
        }
      } catch (e) {
        dumpRaw("anthropic-repair-fail", String(e?.message || e));
      }

      // (b) 씬별 확장/축약 — 동시 3개
      if (violatesLengthPolicy(parsedOut, policy)) {
        debug("expand/condense (parallel) start");
        try {
          parsedOut = await expandOrCondenseScenes({
            apiKey,
            doc: parsedOut,
            policy,
            budget,
            topic,
            style,
          });
          debugScenes("after expand/condense", parsedOut.scenes, policy);
        } catch (e) {
          dumpRaw("anthropic-length-expand-fail", String(e?.message || e));
        }
        debug("violates final:", violatesLengthPolicy(parsedOut, policy));
      }
    }
  }

  return parsedOut;
}

module.exports = { callAnthropic };
