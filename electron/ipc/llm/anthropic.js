/**
 * Anthropic Claude API Provider
 * 협력업체 검증 방식, 안정성 중심
 */

const { getSecret } = require("../../services/secrets");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-3-5-sonnet-latest";
const MAX_TOKENS = 8192;
const TTS_SAFE_CHAR_LIMIT = 1450;
function normalizeText(text) {
  if (!text) return "";
  return String(text)
    .normalize("NFC")
    .replace(/\r\n/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function countKoreanChars(text) {
  return Array.from(normalizeText(text)).length;
}
function parseJsonResponse(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch {}

  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
  } catch {}

  return null;
}
function extractSceneText(scene) {
  if (!scene) return "";
  if (typeof scene === "string") return scene.trim();

  const textFields = ["text", "content", "narration", "description", "dialogue"];
  for (const field of textFields) {
    if (scene[field] && typeof scene[field] === "string") {
      return scene[field].trim();
    }
  }
  return "";
}

function validateScript(data) {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.scenes) || data.scenes.length === 0) return false;
  return data.scenes.every((scene) => extractSceneText(scene).length > 0);
}
function buildPrompt({ topic, style, duration, maxScenes, referenceText, cpmMin, cpmMax }) {
  const minChars = Math.round(duration * (cpmMin || 1100));
  const maxChars = Math.round(duration * (cpmMax || 1210));
  const avgCharsPerScene = Math.round((minChars + maxChars) / 2 / maxScenes);

  const parts = [
    `다음 조건에 맞는 ${duration}분 길이의 영상 대본을 작성해주세요.`,
    "",
    `📋 기본 정보:`,
    `• 주제: ${topic || "(미지정)"}`,
    `• 스타일: ${style || "전문가 톤, 쉽고 차분하게"}`,
    `• 언어: 한국어`,
    "",
    `📊 분량 요구사항:`,
    `• 정확히 ${maxScenes}개 장면으로 구성`,
    `• 총 글자수: ${minChars} ~ ${maxChars}자`,
    `• 장면당 평균: 약 ${avgCharsPerScene}자`,
    `• 각 장면 최대 ${TTS_SAFE_CHAR_LIMIT}자 (TTS 제한)`,
    "",
    `⚠️ 중요 규칙:`,
    `• 장면 수는 반드시 ${maxScenes}개를 준수하세요`,
    `• 전체 재생시간이 ${duration}분에 맞도록 조절하세요`,
    `• 마크다운, 불릿포인트, 목차 등 금지`,
    `• 자연스러운 문단 형태로 작성`,
  ];

  // 레퍼런스 대본이 있으면 추가
  if (referenceText && referenceText.trim()) {
    parts.push("", `📄 참고 대본:`, `아래 대본의 구조와 스타일을 참고하여 더 나은 대본을 작성하세요.`, "", referenceText.trim());
  }

  parts.push(
    "",
    `📤 응답 형식 (JSON만 반환):`,
    `{`,
    `  "title": "대본 제목",`,
    `  "scenes": [`,
    `    {`,
    `      "text": "장면 내용",`,
    `      "duration": 시간(초)`,
    `    }`,
    `  ]`,
    `}`,
    "",
    `⚡ JSON만 출력하고 다른 설명은 절대 포함하지 마세요.`
  );

  return parts.join("\n");
}

async function _buildPrompt(topic, duration, style, maxScenes, customPrompt = null, referenceScript = null) {
  const minCharacters = duration * 1100;
  const maxCharacters = duration * 1210;
  const avgCharactersPerScene = Math.floor((minCharacters + maxCharacters) / 2 / maxScenes);

  let prompt;

  if (customPrompt && customPrompt.trim()) {
    // 사용자 프롬프트 변수 치환
    prompt = customPrompt
      .replace(/\{topic\}/g, topic)
      .replace(/\{duration\}/g, duration)
      .replace(/\{style\}/g, style)
      .replace(/\{maxScenes\}/g, maxScenes)
      .replace(/\{minCharacters\}/g, minCharacters)
      .replace(/\{maxCharacters\}/g, maxCharacters)
      .replace(/\{avgCharactersPerScene\}/g, avgCharactersPerScene);
  } else {
    // 기본 프롬프트 사용
    prompt = buildPrompt({ topic, style, duration, maxScenes, referenceText: referenceScript, cpmMin: 1100, cpmMax: 1210 });
  }

  if (referenceScript && referenceScript.trim()) {
    prompt += `\n\n## 레퍼런스 대본 분석\n${referenceScript}`;
  }

  return prompt;
}

function normalizeScenes(scenes, targetDuration, maxScenes) {
  const normalizedScenes = scenes.map((scene, index) => {
    const text = extractSceneText(scene);
    const charCount = countKoreanChars(text);

    return {
      id: scene.id || `s${index + 1}`,
      text: text,
      duration: scene.duration || Math.round((targetDuration * 60) / maxScenes),
      charCount: charCount,
      scene_number: index + 1,
    };
  });

  // duration 총합이 목표와 맞는지 확인 및 조정
  const totalDuration = normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0);
  const targetSeconds = targetDuration * 60;

  if (Math.abs(totalDuration - targetSeconds) > 2) {
    // 비례 조정
    const scale = targetSeconds / totalDuration;
    let accumulatedDuration = 0;

    normalizedScenes.forEach((scene, index) => {
      if (index === normalizedScenes.length - 1) {
        // 마지막 씬은 남은 시간 모두 할당
        scene.duration = Math.max(1, targetSeconds - accumulatedDuration);
      } else {
        scene.duration = Math.max(1, Math.round(scene.duration * scale));
        accumulatedDuration += scene.duration;
      }
    });
  }

  return normalizedScenes;
}

async function callAnthropicAPI(apiKey, prompt) {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: MAX_TOKENS - 100, // 안전 마진
      system: "You are a professional Korean scriptwriter. Return ONLY valid JSON without any explanations or markdown.",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1, // 일관성을 위해 낮은 온도
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Anthropic API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data?.content?.[0]?.text || "";
}

async function callAnthropic(params) {
  const {
    topic = "",
    style = "",
    duration = 5,
    maxScenes = 10,
    referenceText = "",
    compiledPrompt = "",
    cpmMin = 1100,
    cpmMax = 1210,
  } = params;

  console.log("🤖 Anthropic 대본 생성 시작 (협력업체 방식)");
  console.log(`📊 설정: ${duration}분, ${maxScenes}개 장면, CPM ${cpmMin}-${cpmMax}`);

  // 1. API 키 확인
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) {
    throw new Error("Anthropic API Key가 설정되지 않았습니다. 설정에서 API 키를 등록해주세요.");
  }

  // 2. 프롬프트 준비
  const prompt = await _buildPrompt(topic, duration, style, maxScenes, params.prompt, referenceText);

  console.log("📝 프롬프트 길이:", prompt.length, "자");

  try {
    // 3. API 호출
    const rawResponse = await callAnthropicAPI(apiKey, prompt);
    console.log("✅ API 응답 수신, 길이:", rawResponse.length, "자");

    // 4. JSON 파싱
    const parsedData = parseJsonResponse(rawResponse);
    if (!parsedData) {
      throw new Error("AI 응답을 JSON으로 파싱할 수 없습니다. 다시 시도해주세요.");
    }

    // 5. 구조 검증
    if (!validateScript(parsedData)) {
      throw new Error("생성된 대본의 구조가 올바르지 않습니다. 다시 시도해주세요.");
    }

    // 6. 씬 데이터 정규화
    const normalizedScenes = normalizeScenes(parsedData.scenes, duration, maxScenes);

    // 7. 최종 결과 구성
    const result = {
      title: parsedData.title || topic || "AI 생성 대본",
      scenes: normalizedScenes,
    };

    // 8. 결과 통계 출력
    const totalChars = normalizedScenes.reduce((sum, scene) => sum + scene.charCount, 0);
    const totalDuration = normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0);

    console.log("🎉 대본 생성 완료!");
    console.log(`📈 통계: ${normalizedScenes.length}개 장면, ${totalChars}자, ${Math.round((totalDuration / 60) * 10) / 10}분`);
    console.log(`📊 장면당 평균: ${Math.round(totalChars / normalizedScenes.length)}자`);

    return { success: true, data: result };
  } catch (error) {
    console.error("❌ Anthropic 대본 생성 실패:", error.message);
    throw new Error(`대본 생성 실패: ${error.message}`);
  }
}

module.exports = { callAnthropic };
