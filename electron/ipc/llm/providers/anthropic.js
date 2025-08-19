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

async function callAnthropic({
  type,
  topic,
  style,
  duration,
  maxScenes,
  referenceText,
  compiledPrompt,
  customPrompt,
}) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  const useCompiled =
    typeof compiledPrompt === "string" && compiledPrompt.trim().length > 0;

  const sys = [
    "You are a professional Korean scriptwriter for YouTube long-form.",
    "Return ONLY JSON.",
  ].join("\n");

  const user = useCompiled
    ? compiledPrompt
    : [
        `주제: ${topic || "(미지정)"}`,
        `스타일: ${style || "(자유)"}`,
        `목표 길이(분): ${duration}`,
        `최대 장면 수(상한): ${maxScenes}`,
        type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
        "\n요구사항:",
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

  // 자동/레퍼런스 모드에서 길이 보정(필요 시)
  if (!customPrompt && (type === "auto" || type === "reference")) {
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
