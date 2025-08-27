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
  estimateMaxTokens,
  buildRepairInput,
  buildRepairInstruction,
} = require("../common");

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
      const n = Number.isFinite(s?.charCount)
        ? Number(s.charCount)
        : measureCharCount(s?.text || "");
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

/* ======================= 문자수 측정(일관화) ======================= */
/** 코드포인트 기준 문자수. NFC 정규화 + 제로폭/불가시 공백 제거 */
function measureCharCount(s = "") {
  const cleaned = String(s)
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ""); // ZWJ/ZWNJ/ZWSP/BOM/NBSP 제거
  return Array.from(cleaned).length;
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
      (s, x) => s + measureCharCount(x?.text || ""),
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
      const n = measureCharCount(sc?.text || "");
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

/* ===== 씬별 확장/축약 (duration 목표) ===== */
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
      const len = measureCharCount(s?.text || "");
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
    const curLen = measureCharCount(baseText);

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
    const newLen = measureCharCount(newText);

    out.scenes[i] = {
      ...sc,
      text: newText,
      charCount: newLen, // ✅ 우리 측정값
      _aiCharCount: Number.isFinite(obj?.charCount)
        ? Math.round(Number(obj.charCount))
        : sc._aiCharCount,
    };
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
    prompt, // 프롬프트 탭에서 온 원문
    compiledPrompt, // 일부 탭에서 전달될 수 있음
    customPrompt, // 프롬프트 우선 모드 플래그
    type, // 'auto' | 'reference' | 'import' | 'prompt-gen' | 'prompt-ref' ...
    topic,
    style,
    duration,
    maxScenes,
    cpmMin,
    cpmMax,
  } = payload || {};

  const client = new OpenAI({ apiKey });
  const { primary, fallback, wantedFamily } = resolveOpenAIModels(payload);

  const policy = calcLengthPolicy({ duration, maxScenes, cpmMin, cpmMax });

  // 프롬프트 선택: 프롬프트 탭은 원문, auto/ref는 정책형 프롬프트
  const useCompiled = !!(compiledPrompt && String(compiledPrompt).trim());
  const userPrompt =
    useCompiled || customPrompt
      ? String(compiledPrompt || prompt || "")
      : buildPolicyUserPrompt({
          topic,
          style,
          type,
          referenceText: payload?.referenceText,
          policy,
        });

  // 디버그: 보낸 프롬프트 일부 저장
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

  // 토큰 예산
  const requested = Math.max(
    6000,
    Math.ceil(policy.totalTgt * 1.2),
    estimateMaxTokens({
      maxScenes: Number(maxScenes) || 10,
      duration: Number(duration) || 5,
    })
  );
  const budget = requested;
  debug("token budget", { requested });

  let rawText = "";
  let usedModel = primary;
  let notice = null;

  // 1차(GPT-5) 시도
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

  // 폴백 조건: 응답 없음/파싱 실패
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

  // 정규화 + charCount 강제 재측정
  parsed.scenes = parsed.scenes.map((s, i) => {
    const text = pickText(s);
    const measured = measureCharCount(text);
    return {
      ...(typeof s === "object" ? s : {}),
      id: s?.id ? String(s.id) : `s${i + 1}`,
      text,
      duration: Number.isFinite(s?.duration)
        ? Math.round(Number(s.duration))
        : undefined,
      _aiCharCount:
        Number.isFinite(s?.charCount) && s.charCount > 0
          ? Math.round(Number(s.charCount))
          : undefined,
      charCount: measured, // ✅ 우리 측정값 사용
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

  // 길이 정책 강제: 자동/레퍼런스 탭(프롬프트 중심이 아닐 때만)
  if ((type === "auto" || type === "reference") && !customPrompt) {
    let violated = violatesLengthPolicy(out, policy);
    debug("violates after parse:", violated);

    if (violated) {
      // (a) 구조/시간 보정 1회
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
            const t = pickText(s);
            return {
              ...(typeof s === "object" ? s : {}),
              id: out.scenes[i]?.id || `s${i + 1}`,
              text: t,
              duration: Number.isFinite(s?.duration)
                ? Math.round(Number(s.duration))
                : out.scenes[i].duration,
              _aiCharCount:
                Number.isFinite(s?.charCount) && s.charCount > 0
                  ? Math.round(Number(s.charCount))
                  : undefined,
              charCount: measureCharCount(t),
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

      // (b) 씬별 확장/축약 — 최대 2패스
      let pass = 0;
      while (violatesLengthPolicy(out, policy) && pass < 2) {
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
