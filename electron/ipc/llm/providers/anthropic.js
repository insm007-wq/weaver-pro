// electron/ipc/llm/providers/anthropic.js
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
  RATE_GUIDE,
  buildRepairInput,
  buildRepairInstruction,
  // ANTHROPIC
} = require("../common");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

/**
 * 프롬프트 탭을 강제 반영하는 규칙
 * - compiledPrompt 가 비었어도, payload.prompt 가 있으면 그것을 사용한다.
 * - customPrompt 플래그/compiled 존재 시: "사용자 프롬프트 기반"으로 간주(리페어 스킵 등).
 */
async function callAnthropic({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
  compiledPrompt, // 프론트에서 전달(없을 수 있음)
  customPrompt, // 프론트에서 전달(없을 수 있음)
  prompt, // 백워드 호환: prompt만 넘어오는 경우 지원
  cpmMin, // 선택: 분당 최소 글자 (auto 탭에서 전달)
  cpmMax, // 선택: 분당 최대 글자
}) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  // compiledPrompt 우선, 없으면 prompt를 compiled로 승격
  const compiled =
    (typeof compiledPrompt === "string" && compiledPrompt.trim()) ||
    (typeof prompt === "string" && prompt.trim()) ||
    "";

  const useCompiled = compiled.length > 0;

  // 숫자 안전 변환
  const cpmMinNum = Number(cpmMin);
  const cpmMaxNum = Number(cpmMax);
  const hasCpmGuide = Number.isFinite(cpmMinNum) && Number.isFinite(cpmMaxNum);

  const sys = [
    "You are a professional Korean scriptwriter for YouTube long-form.",
    "Return ONLY JSON.",
  ].join("\n");

  // 사용자 프롬프트가 있으면 그대로 사용, 없으면 안전한 fallback 구성
  const user = useCompiled
    ? compiled
    : [
        `주제: ${topic || "(미지정)"}`,
        `스타일: ${style || "(자유)"}`,
        `목표 길이(분): ${Number(duration) || 5}`,
        `최대 장면 수(상한): ${Number(maxScenes) || 10}`,
        type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
        "\n요구사항:",
        hasCpmGuide
          ? `- 한국어 발화 속도: 분당 ${cpmMinNum}~${cpmMaxNum}자 기준으로 전체 분량을 맞추세요.`
          : "",
        RATE_GUIDE,
        '최상위는 {"title": "...", "scenes":[{ "text": "...", "duration": number }]} 형태의 JSON만.',
      ]
        .filter(Boolean)
        .join("\n");

  const requested = Math.max(
    3500,
    estimateMaxTokens({
      maxScenes: Number(maxScenes) || 10,
      duration: Number(duration) || 5,
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
  let parsedOut = null;

  const maxRetries = 1;
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

    parsed.scenes = parsed.scenes.map((s, idx) => ({
      ...(typeof s === "object" ? s : {}),
      id: s?.id ? String(s.id) : `s${idx + 1}`,
      text: pickText(s),
      duration: Number.isFinite(s?.duration)
        ? Math.round(Number(s.duration))
        : undefined,
    }));

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

  // 자동/레퍼런스 모드에서만 길이 보정; 사용자 프롬프트 기반이면 건드리지 않음
  if (
    !useCompiled &&
    !customPrompt &&
    (type === "auto" || type === "reference")
  ) {
    const { needsRepair } = require("../common");
    if (needsRepair(parsedOut.scenes)) {
      try {
        const repairPrompt = buildRepairInstruction(topic, style);
        const repairInput = buildRepairInput(parsedOut);
        const res = await fetch(ANTHROPIC_URL, {
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
          fixed.scenes = fixed.scenes.map((s, i) => ({
            ...(typeof s === "object" ? s : {}),
            id: parsedOut.scenes[i]?.id || `s${i + 1}`,
            text: pickText(s),
            duration: Number.isFinite(s?.duration)
              ? Math.round(Number(s.duration))
              : parsedOut.scenes[i].duration,
          }));
          return formatScenes(fixed, topic, duration, maxScenes, {
            fromCustomPrompt: false,
          });
        }
      } catch (e) {
        dumpRaw("anthropic-repair-fail", String(e?.message || e));
      }
    }
  }

  return parsedOut;
}

module.exports = { callAnthropic };
