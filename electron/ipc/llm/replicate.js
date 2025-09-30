/**
 * Replicate LLM Provider - Llama 3 기반 대본 생성
 * 기존 Replicate API 키 재사용, 비용 효율적
 */

const { getSecret } = require("../../services/secrets");
const { createReplicate, resolveLatestVersionId } = require("../../services/replicateClient");

// Llama 3 모델 설정
const LLAMA_MODELS = {
  "llama-3-70b": "meta/meta-llama-3-70b-instruct",
  "llama-3-8b": "meta/meta-llama-3-8b-instruct",
  "llama-3-13b": "meta/meta-llama-3-8b-instruct" // 폴백용
};

const DEFAULT_MODEL = "llama-3-70b";
const MAX_TOKENS = 8192;
const TTS_SAFE_CHAR_LIMIT = 1450;

// 한국어 글자수 계산 (기존 방식과 동일)
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

// JSON 파싱 유틸
function parseJsonResponse(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {}

  // 코드 블록에서 JSON 추출
  try {
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
  } catch {}

  // 첫 번째 {} 블록 추출
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
  } catch {}

  return null;
}

// 대본 유효성 검증
function validateScript(data) {
  if (!data || typeof data !== "object") return false;
  if (!Array.isArray(data.scenes) || data.scenes.length === 0) return false;
  return data.scenes.every((scene) => {
    const text = extractSceneText(scene);
    return text && text.length > 0;
  });
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

// 프롬프트 생성 (기존 Anthropic 방식 참고)
function buildPrompt({ topic, style, duration, maxScenes, referenceText, cpmMin, cpmMax }) {
  const minChars = Math.round(duration * (cpmMin || 300));
  const maxChars = Math.round(duration * (cpmMax || 400));
  const avgCharsPerScene = Math.round((minChars + maxChars) / 2 / maxScenes);

  const isLongContent = duration >= 20;
  const contentDepthInstruction = isLongContent ?
    `\n⭐ 긴 영상 특별 요구사항:\n• 각 주제를 상세하고 구체적으로 설명\n• 실제 사례와 예시를 풍부하게 포함\n• 다양한 관점에서 접근하여 내용 확장\n• 시청자가 지루하지 않도록 흥미로운 요소 추가\n• 실습이나 적용 방법을 단계별로 설명\n• 전문적이면서도 이해하기 쉽게 작성` :
    ``;

  const parts = [
    `다음 조건에 맞는 ${duration}분 길이의 ${isLongContent ? '상세한 ' : ''}영상 대본을 작성해주세요.`,
    "",
    `📋 기본 정보:`,
    `• 주제: ${topic || "(미지정)"}`,
    `• 스타일: ${style || "전문가 톤, 쉽고 차분하게"}`,
    `• 언어: 한국어`,
    contentDepthInstruction,
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

// 장면 정규화 (기존 방식 유지)
function normalizeScenes(scenes, targetDuration, maxScenes) {
  let normalizedScenes = scenes.map((scene, index) => {
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

  // 장면 수 조정
  normalizedScenes = adjustSceneCount(normalizedScenes, maxScenes, targetDuration);

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

// 장면 수 조정 로직
function adjustSceneCount(scenes, targetCount, duration) {
  const currentCount = scenes.length;

  console.log(`🔧 Replicate 장면 수 조정: ${currentCount}개 → ${targetCount}개`);

  if (currentCount === targetCount) {
    return scenes;
  }

  if (currentCount < targetCount) {
    return splitScenes(scenes, targetCount, duration);
  } else {
    return mergeScenes(scenes, targetCount, duration);
  }
}

function splitScenes(scenes, targetCount, duration) {
  const needed = targetCount - scenes.length;
  console.log(`➕ ${needed}개 장면 분할 필요`);

  let result = [...scenes];

  for (let i = 0; i < needed && result.length < targetCount; i++) {
    const longestIndex = result.reduce((maxIdx, scene, idx) =>
      scene.charCount > result[maxIdx].charCount ? idx : maxIdx, 0);

    const sceneToSplit = result[longestIndex];
    if (sceneToSplit.charCount < 100) break;

    const text = sceneToSplit.text;
    const sentences = text.split(/[.!?。]/);

    if (sentences.length > 1) {
      const halfSentences = Math.floor(sentences.length / 2);
      const firstPart = sentences.slice(0, halfSentences).join('.').trim() + '.';
      const secondPart = sentences.slice(halfSentences).join('.').trim();

      const baseDuration = Math.round((duration * 60) / targetCount);

      result[longestIndex] = {
        ...sceneToSplit,
        text: firstPart,
        charCount: countKoreanChars(firstPart),
        duration: baseDuration
      };

      result.splice(longestIndex + 1, 0, {
        id: `${sceneToSplit.id}_split`,
        text: secondPart,
        charCount: countKoreanChars(secondPart),
        duration: baseDuration,
        scene_number: longestIndex + 2
      });

      console.log(`  ✂️ 장면 ${longestIndex + 1} 분할: ${sceneToSplit.charCount}자 → ${countKoreanChars(firstPart)}자 + ${countKoreanChars(secondPart)}자`);
    }
  }

  return result.slice(0, targetCount).map((scene, index) => ({
    ...scene,
    scene_number: index + 1
  }));
}

function mergeScenes(scenes, targetCount, duration) {
  const excess = scenes.length - targetCount;
  console.log(`➖ ${excess}개 장면 병합 필요`);

  let result = [...scenes];

  for (let i = 0; i < excess && result.length > targetCount; i++) {
    let shortestPairIndex = 0;
    let shortestPairLength = Infinity;

    for (let j = 0; j < result.length - 1; j++) {
      const combinedLength = result[j].charCount + result[j + 1].charCount;
      if (combinedLength < shortestPairLength) {
        shortestPairLength = combinedLength;
        shortestPairIndex = j;
      }
    }

    const first = result[shortestPairIndex];
    const second = result[shortestPairIndex + 1];

    const merged = {
      id: first.id,
      text: first.text + ' ' + second.text,
      charCount: first.charCount + second.charCount,
      duration: Math.round((duration * 60) / targetCount),
      scene_number: first.scene_number
    };

    console.log(`  🔗 장면 ${shortestPairIndex + 1}, ${shortestPairIndex + 2} 병합: ${first.charCount}자 + ${second.charCount}자 = ${merged.charCount}자`);

    result.splice(shortestPairIndex, 2, merged);
  }

  return result.map((scene, index) => ({
    ...scene,
    scene_number: index + 1
  }));
}

// 메인 Replicate 호출 함수
async function callReplicate(params) {
  const {
    topic = "",
    style = "",
    duration = 5,
    maxScenes = 10,
    referenceText = "",
    cpmMin = 300,
    cpmMax = 400,
    model = DEFAULT_MODEL
  } = params;

  console.log("🤖 Replicate 대본 생성 시작 (Llama 3 기반)");
  console.log(`📊 설정: ${duration}분, ${maxScenes}개 장면, CPM ${cpmMin}-${cpmMax}`);
  console.log(`🦙 모델: ${model}`);

  // 1. API 키 확인 (기존 Replicate 키 재사용)
  const apiKey = await getSecret("replicateKey");
  if (!apiKey) {
    throw new Error("Replicate API Key가 설정되지 않았습니다. 설정에서 API 키를 등록해주세요.");
  }

  // 2. 모델 설정
  const modelSlug = LLAMA_MODELS[model] || LLAMA_MODELS[DEFAULT_MODEL];

  try {
    // 3. 프롬프트 생성
    const prompt = buildPrompt({ topic, style, duration, maxScenes, referenceText, cpmMin, cpmMax });

    console.log("📝 프롬프트 길이:", prompt.length, "자");

    // 4. Replicate 클라이언트 생성
    const replicate = createReplicate(apiKey);

    // 5. 모델 버전 해결
    const versionId = await resolveLatestVersionId(modelSlug, apiKey);
    if (!versionId) {
      throw new Error(`모델 버전을 찾을 수 없습니다: ${modelSlug}`);
    }

    // 6. 예측 생성
    console.log(`🚀 Replicate 예측 시작: ${modelSlug}`);

    let prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        prompt: prompt,
        max_tokens: MAX_TOKENS,
        temperature: 0.1,
        top_p: 0.9,
        system_prompt: "You are a professional Korean scriptwriter. Return ONLY valid JSON without any explanations or markdown."
      }
    });

    console.log(`🔄 Replicate prediction 생성: ${prediction.id}`);

    // 7. 결과 폴링 (최대 3분)
    const maxTries = 180; // 3분
    let tries = 0;

    while (
      ["starting", "processing", "queued"].includes(prediction.status) &&
      tries < maxTries
    ) {
      if (tries % 15 === 0) {
        console.log(`⏳ Replicate 대기 중: ${prediction.status} (${tries}/${maxTries})`);
      }
      await new Promise((r) => setTimeout(r, 1000));
      prediction = await replicate.predictions.get(prediction.id);
      tries++;
    }

    if (tries >= maxTries) {
      console.error("❌ Replicate 타임아웃: 3분 초과");
      throw new Error("대본 생성 시간이 초과되었습니다. 다시 시도해주세요.");
    }

    console.log(`🎯 Replicate 최종 상태: ${prediction.status}`);

    if (prediction.status !== "succeeded") {
      console.error("❌ Replicate 실패:", prediction.error);
      throw new Error(`대본 생성 실패: ${prediction.error || "알 수 없는 오류"}`);
    }

    // 8. 응답 처리
    const rawResponse = Array.isArray(prediction.output)
      ? prediction.output.join("")
      : String(prediction.output || "");

    console.log("✅ Replicate 응답 수신, 길이:", rawResponse.length, "자");

    // 9. JSON 파싱
    const parsedData = parseJsonResponse(rawResponse);
    if (!parsedData) {
      throw new Error("AI 응답을 JSON으로 파싱할 수 없습니다.");
    }

    // 10. 구조 검증
    if (!validateScript(parsedData)) {
      throw new Error("생성된 대본의 구조가 올바르지 않습니다.");
    }

    // 11. 장면 수 검증
    const actualScenes = parsedData.scenes.length;
    const allowableRange = Math.ceil(maxScenes * 0.5);
    const sceneDiff = Math.abs(actualScenes - maxScenes);

    console.log(`🎯 장면 수 검증: 요청 ${maxScenes}개 vs 실제 ${actualScenes}개 (차이: ${sceneDiff}개)`);

    if (sceneDiff > allowableRange) {
      console.warn(`⚠️ 장면 수 차이가 큼, 후처리로 조정 (±${sceneDiff}개)`);
    }

    // 12. 씬 데이터 정규화
    const normalizedScenes = normalizeScenes(parsedData.scenes, duration, maxScenes);

    // 13. 최종 결과 구성
    const result = {
      title: parsedData.title || topic || "AI 생성 대본",
      scenes: normalizedScenes,
    };

    // 14. 통계 출력
    const totalChars = normalizedScenes.reduce((sum, scene) => sum + scene.charCount, 0);
    const totalDuration = normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0);
    const actualDurationMinutes = totalDuration / 60;
    const actualCPM = Math.round(totalChars / duration);

    console.log(`🎉 Replicate 대본 생성 완료!`);
    console.log(`📈 기본 통계: ${normalizedScenes.length}개 장면, ${totalChars}자, ${actualDurationMinutes.toFixed(1)}분`);
    console.log(`📊 실제 CPM: ${actualCPM}자/분 (목표: ${cpmMin}-${cpmMax})`);

    return { success: true, data: result };

  } catch (error) {
    console.error(`❌ Replicate 대본 생성 실패:`, error.message);
    throw new Error(`Replicate 대본 생성 실패: ${error.message}`);
  }
}

module.exports = { callReplicate };