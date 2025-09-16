// electron/ipc/llm/index.js
const { ipcMain } = require("electron");
const { callOpenAIGpt5Mini } = require("./providers/openai");
const { callAnthropic } = require("./providers/anthropic");

function ensureString(v, name) {
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`llm/generateScript: ${name}가 비었습니다.`);
  }
  return v.trim();
}
function ensureNumber(v, name) {
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new Error(`llm/generateScript: ${name} 숫자 아님`);
  }
  return n;
}

/* ---------------- 템플릿 변수 치환 ---------------- */
function substituteTemplateVariables(prompt, payload = {}) {
  const topic = String(payload.topic || "");
  const style = String(payload.style || "");
  const duration = Number(payload.duration || 5);
  const maxScenes = Number(payload.maxScenes || 10);
  const referenceText = String(payload.referenceText || "");

  // 분당 글자수 목표 계산
  const cpmMin = Number.isFinite(Number(payload.cpmMin))
    ? Number(payload.cpmMin)
    : 300;
  const cpmMax = Number.isFinite(Number(payload.cpmMax))
    ? Number(payload.cpmMax)
    : 400;

  const minChars = Math.round(duration * cpmMin);
  const maxChars = Math.round(duration * cpmMax);
  const avgCharsPerScene = Math.round((minChars + maxChars) / 2 / maxScenes);

  // 템플릿 변수 치환
  return prompt
    .replace(/\{topic\}/g, topic)
    .replace(/\{style\}/g, style)
    .replace(/\{duration\}/g, duration.toString())
    .replace(/\{maxScenes\}/g, maxScenes.toString())
    .replace(/\{minCharacters\}/g, minChars.toString())
    .replace(/\{maxCharacters\}/g, maxChars.toString())
    .replace(/\{avgCharactersPerScene\}/g, avgCharsPerScene.toString())
    .replace(/\{referenceScript\}/g, referenceText)
    .replace(/\{referenceText\}/g, referenceText)
    .replace(/\{cpmMin\}/g, cpmMin.toString())
    .replace(/\{cpmMax\}/g, cpmMax.toString());
}

/* ---------------- 프롬프트 fallback ---------------- */
function buildPromptFallback(payload = {}) {
  const type = (payload.type || "auto").toLowerCase();
  const topic = String(payload.topic || "");
  const style = String(payload.style || "");
  const duration = Number(payload.duration || 5);
  const maxScenes = Number(payload.maxScenes || 10);
  const referenceText = String(payload.referenceText || "");

  // ⬇️ 분당 글자수 목표 (프론트에서 cpmMin/Max 주면 우선 사용, 문자열도 허용)
  const cpmMin = Number.isFinite(Number(payload.cpmMin))
    ? Number(payload.cpmMin)
    : 300;
  const cpmMax = Number.isFinite(Number(payload.cpmMax))
    ? Number(payload.cpmMax)
    : 400;

  const minChars = Math.round(duration * cpmMin);
  const maxChars = Math.round(duration * cpmMax);

  const lines = [
    `다음 조건에 맞는 ${duration}분 길이의 영상 대본을 작성해주세요.`,
    `주제: ${topic || "(미정)"}`,
    `스타일: ${style || "전문가 톤, 쉽고 차분하게"}`,
    `언어: 한국어`,
    `최대 장면 수: ${maxScenes}개`,
    `총 글자 수: 약 ${minChars} ~ ${maxChars}자 범위를 맞춰주세요.`,
    `장면별로 과도한 편차 없이 균등하게 분할하고, 전체 분량이 길이에 맞아야 합니다.`,
    type === "reference" && referenceText
      ? `\n[레퍼런스]\n${referenceText}`
      : "",
    "",
    "응답 형식(JSON only):",
    '{"title":"...","scenes":[{"text":"...","duration":초수}]}',
    "마크다운/설명 문구 없이 JSON만 출력하세요.",
  ].filter(Boolean);

  return lines.join("\n");
}

/* ---------------- IPC 핸들러 ---------------- */
ipcMain.handle("llm/generateScript", async (_evt, payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("llm/generateScript: payload가 비어 있습니다.");
  }

  const llm = ensureString(payload.llm, "llm");

  // 숫자 파라미터 정규화
  payload.duration = ensureNumber(payload.duration ?? 5, "duration");
  payload.maxScenes = ensureNumber(payload.maxScenes ?? 10, "maxScenes");

  // 문자열 파라미터 정규화
  payload.topic = String(payload.topic ?? "");
  payload.style = String(payload.style ?? "");

  // 프롬프트 탭에서 넘어온 prompt가 있으면 곧바로 사용하도록 승격
  // (Anthropic는 compiledPrompt/customPrompt 신호를 사용)
  const hasUserPrompt =
    typeof payload.prompt === "string" && payload.prompt.trim().length > 0;

  if (hasUserPrompt) {
    // 사용자 프롬프트에 템플릿 변수 치환 적용
    payload.compiledPrompt = substituteTemplateVariables(payload.prompt.trim(), payload);
    payload.customPrompt = true; // 프로바이더에 "사용자 프롬프트 우선" 힌트
  } else {
    // 프롬프트 없으면 안전한 fallback 생성 (자동/레퍼런스 탭)
    payload.prompt = buildPromptFallback(payload);
    payload.customPrompt = false; // 명시적으로 사용자 프롬프트 아님
  }

  // 모델 라우팅
  switch (llm) {
    case "openai-gpt5mini":
      return await callOpenAIGpt5Mini(payload);

    case "anthropic":
      return await callAnthropic(payload);

    default:
      throw new Error(`지원하지 않는 LLM입니다: ${llm}`);
  }
});
