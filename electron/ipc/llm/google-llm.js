/**
 * Google Gemini API Provider - 빠른 생성
 *
 * @description
 * - 빠른 응답 속도로 모든 길이 대본 지원
 * - 간단하고 직관적인 프롬프트 구조
 * - 비용 효율적인 대본 생성
 *
 * @author Weaver Pro Team
 * @version 1.0.0 - 롱폼 지원 버전
 */

const { getSecret } = require("../../services/secrets");

// ==================== 설정 상수 ====================
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";
const MAX_TOKENS = 8192;
const TTS_SAFE_CHAR_LIMIT = 1450;

/**
 * 한국어 글자수 계산
 */
function countKoreanChars(text) {
  if (!text) return 0;
  return Array.from(String(text).normalize("NFC")).length;
}

/**
 * JSON 파싱 (마크다운 코드블록 처리)
 */
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

/**
 * 씬 텍스트 추출
 */
function extractSceneText(scene) {
  if (!scene) return "";
  if (typeof scene === "string") return scene.trim();

  const textFields = ["text", "content", "narration", "description"];
  for (const field of textFields) {
    if (scene[field] && typeof scene[field] === "string") {
      return scene[field].trim();
    }
  }
  return "";
}

/**
 * 대본 구조 검증
 */
function validateScript(data) {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.scenes) || data.scenes.length === 0) return false;
  return data.scenes.every(scene => extractSceneText(scene).length > 0);
}

/**
 * Gemini 프롬프트 생성 (모든 길이 지원)
 */
function buildGeminiPrompt({ topic, style, duration, maxScenes, referenceText, cpmMin, cpmMax }) {
  const minChars = Math.round(duration * (cpmMin || 1100));
  const maxChars = Math.round(duration * (cpmMax || 1200));
  const avgCharsPerScene = Math.round((minChars + maxChars) / 2 / maxScenes);

  const parts = [
    `다음 조건에 맞는 ${duration}분 길이의 영상 대본을 작성해주세요.`,
    "",
    `📋 기본 정보:`,
    `• 주제: ${topic || "미지정"}`,
    `• 스타일: ${style || "친근하고 흥미롭게"}`,
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

async function _buildGeminiPrompt(topic, duration, style, maxScenes, customPrompt = null, referenceScript = null) {
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
    // 기본 Gemini 프롬프트 사용
    prompt = buildGeminiPrompt({ topic, style, duration, maxScenes, referenceText: referenceScript, cpmMin: 1100, cpmMax: 1210 });
  }

  if (referenceScript && referenceScript.trim()) {
    prompt += `\n\n## 레퍼런스 대본 분석\n${referenceScript}`;
  }

  return prompt;
}

/**
 * 씬 데이터 정규화
 */
function normalizeScenes(scenes, targetDuration, maxScenes) {
  const normalizedScenes = scenes.map((scene, index) => {
    const text = extractSceneText(scene);
    const charCount = countKoreanChars(text);

    return {
      id: scene.id || `s${index + 1}`,
      text: text,
      duration: scene.duration || Math.round(targetDuration * 60 / maxScenes),
      charCount: charCount,
      scene_number: index + 1
    };
  });

  // duration 총합 조정
  const totalDuration = normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0);
  const targetSeconds = targetDuration * 60;

  if (Math.abs(totalDuration - targetSeconds) > 2) {
    const scale = targetSeconds / totalDuration;
    let accumulatedDuration = 0;

    normalizedScenes.forEach((scene, index) => {
      if (index === normalizedScenes.length - 1) {
        scene.duration = Math.max(1, targetSeconds - accumulatedDuration);
      } else {
        scene.duration = Math.max(1, Math.round(scene.duration * scale));
        accumulatedDuration += scene.duration;
      }
    });
  }

  return normalizedScenes;
}

/**
 * Gemini API 호출
 */
async function callGeminiAPI(apiKey, prompt) {
  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
        temperature: 0.2,
        topP: 0.8,
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

/**
 * 메인 진입점: Google Gemini 대본 생성
 */
async function callGoogleGemini(params) {
  const {
    topic = "",
    style = "",
    duration = 5,
    maxScenes = 10,
    referenceText = "",
    compiledPrompt = "",
    cpmMin = 1100,
    cpmMax = 1210
  } = params;

  console.log("🔥 Google Gemini 대본 생성 시작 (빠른 생성)");
  console.log(`📊 설정: ${duration}분, ${maxScenes}개 장면, CPM ${cpmMin}-${cpmMax}`);

  // 1. API 키 확인
  const apiKey = await getSecret("geminiKey");
  if (!apiKey) {
    throw new Error("Google Gemini API Key가 설정되지 않았습니다.");
  }

  // 2. 프롬프트 준비
  const prompt = await _buildGeminiPrompt(topic, duration, style, maxScenes, params.prompt, referenceText);

  console.log("📝 프롬프트 길이:", prompt.length, "자");

  // 롱폼 컨텐츠 대응 타임아웃 (anthropic.js와 동일한 로직)
  const getTimeoutForDuration = (minutes) => {
    if (minutes >= 90) return 1800000;  // 90분+: 30분 타임아웃
    if (minutes >= 60) return 1200000;  // 60분+: 20분 타임아웃
    if (minutes >= 30) return 900000;   // 30분+: 15분 타임아웃
    if (minutes >= 20) return 600000;   // 20분+: 10분 타임아웃
    return 300000; // 기본: 5분 타임아웃
  };

  const timeoutMs = getTimeoutForDuration(duration);
  console.log(`⏱️ 타임아웃 설정: ${duration}분 → ${timeoutMs/60000}분 대기`);

  try {
    // 3. API 호출
    const rawResponse = await callGeminiAPI(apiKey, prompt);
    console.log("✅ Gemini 응답 수신, 길이:", rawResponse.length, "자");

    // 4. JSON 파싱
    const parsedData = parseJsonResponse(rawResponse);
    if (!parsedData) {
      throw new Error("Gemini 응답을 JSON으로 파싱할 수 없습니다.");
    }

    // 5. 구조 검증
    if (!validateScript(parsedData)) {
      throw new Error("생성된 대본 구조가 올바르지 않습니다.");
    }

    // 6. 씬 데이터 정규화
    const normalizedScenes = normalizeScenes(parsedData.scenes, duration, maxScenes);

    // 실제 생성된 장면 수 검증 (협력업체 방식)
    const actualScenes = normalizedScenes.length;
    const requestedScenes = maxScenes;

    console.log("✅ Script generation validation (협력업체 방식):");
    console.log(`  - 요청 장면 수: ${requestedScenes}개`);
    console.log(`  - 실제 생성 장면 수: ${actualScenes}개`);
    console.log(`  - 일치도: ${actualScenes === requestedScenes ? '완전일치' : `차이 ${Math.abs(actualScenes - requestedScenes)}개`}`);

    // 실제 대본 분량 분석
    const totalChars = normalizedScenes.reduce((sum, scene) => sum + scene.charCount, 0);
    const avgCharsPerScene = Math.round(totalChars / actualScenes);
    console.log(`  - 총 글자 수: ${totalChars}자`);
    console.log(`  - 장면당 평균: ${avgCharsPerScene}자`);

    // 7. 최종 결과 구성
    const result = {
      title: parsedData.title || topic || "Gemini 생성 대본",
      scenes: normalizedScenes
    };

    // 8. 결과 통계
    const totalDuration = normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0);

    console.log("🎉 Gemini 대본 생성 완료!");
    console.log(`📈 통계: ${normalizedScenes.length}개 장면, ${totalChars}자, ${Math.round((totalDuration / 60) * 10) / 10}분`);
    console.log(`📊 장면당 평균: ${Math.round(totalChars / normalizedScenes.length)}자`);

    return { success: true, data: result };

  } catch (error) {
    console.error("❌ Gemini 대본 생성 실패:", error.message);
    throw new Error(`Gemini 대본 생성 실패: ${error.message}`);
  }
}

module.exports = { callGoogleGemini };