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

// 기본 프롬프트 생성
function buildPrompt({ topic, style, duration, referenceText, cpmMin, cpmMax }) {
  // Vrew 스타일: 장면 수 기반 계산
  const totalSeconds = duration * 60;
  const secondsPerScene = 8; // 각 장면 약 8초 (Anthropic과 동일)
  const targetSceneCount = Math.round(totalSeconds / secondsPerScene);
  const minSceneCount = Math.max(3, Math.floor(targetSceneCount * 0.9)); // 최소 90%
  const maxSceneCount = Math.ceil(targetSceneCount * 1.3); // 최대 130% (여유 확보)

  // 각 장면당 글자수 (한국어 TTS 기준: 약 5-6자/초)
  const minCharsPerScene = 50; // 최소 50자
  const maxCharsPerScene = 60; // 최대 60자

  const isLongForm = duration >= 20;

  const parts = [
    `다음 조건에 맞는 ${duration}분 길이의 ${isLongForm ? '장편 ' : ''}영상 대본을 작성해주세요.`,
    "",
    `📋 기본 정보:`,
    `• 주제: ${topic || "(미지정)"}`,
    `• 스타일: ${style || "전문가 톤, 쉽고 차분하게"}`,
    `• 언어: 한국어`,
    isLongForm ? `• 장편 콘텐츠: 각 주제를 상세하고 깊이 있게 다루세요` : "",
    "",
    `📺 영상 구성 (반드시 준수):`,
    `• 총 길이: ${duration}분 (${totalSeconds}초)`,
    `• 장면 구성: ${minSceneCount}~${maxSceneCount}개 장면 (권장: ${targetSceneCount}개)`,
    `• 각 장면: 약 ${secondsPerScene}초 분량 (${minCharsPerScene}~${maxCharsPerScene}자)`,
    `• 각 장면 최대: ${TTS_SAFE_CHAR_LIMIT}자 (TTS 제한)`,
    "",
    `📝 작성 방식:`,
    `• 각 장면은 50~60자 (너무 짧으면 안됨!)`,
    `• 각 장면마다 하나의 완결된 메시지 전달`,
    `• 장면 간 자연스러운 흐름 유지`,
    `• 지루하지 않게 적절한 템포 유지`,
    `• 마크다운, 불릿포인트, 목차 등 금지`,
    `• 자연스러운 구어체 문단으로 작성`,
    "",
    `⚠️ 중요:`,
    `1. 반드시 ${minSceneCount}개 이상 장면 포함 (${isLongForm ? '장편이므로 많은 장면 필수' : '최소한 이 개수는 꼭 지켜야 함'})`,
    `2. 각 장면은 50자 이상 작성 (40자 이하는 불합격)`,
    `3. 요청 시간보다 최대 30% 길어져도 괜찮음`,
  ].filter(line => line !== ""); // 빈 줄 제거

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
    `    {"text": "첫 번째 장면 (50~60자)", "duration": ${secondsPerScene}},`,
    `    {"text": "두 번째 장면 (50~60자)", "duration": ${secondsPerScene}},`,
    `    {"text": "세 번째 장면 (50~60자)", "duration": ${secondsPerScene}},`,
    `    ... (총 ${minSceneCount}~${maxSceneCount}개 장면)`,
    `  ]`,
    `}`,
    "",
    `⚡ 중요: 반드시 ${minSceneCount}개 이상의 장면을 배열에 포함하세요!`,
    `⚡ 각 장면은 50~60자로 작성 (40자 이하는 불합격)`,
    `⚡ JSON만 출력하고 다른 설명은 절대 포함하지 마세요.`
  );

  return parts.join("\n");
}

// 커스텀 프롬프트 변수 치환 (Anthropic과 동일)
function _buildPrompt(topic, duration, style, customPrompt = null, referenceScript = null, cpmMin = 220, cpmMax = 250) {
  const minCharacters = duration * cpmMin;
  const maxCharacters = duration * cpmMax;
  const totalSeconds = duration * 60;
  const secondsPerScene = 8;
  const targetSceneCount = Math.round(totalSeconds / secondsPerScene);
  const minSceneCount = Math.max(3, Math.floor(targetSceneCount * 0.9));
  const maxSceneCount = Math.ceil(targetSceneCount * 1.3);
  const avgCharactersPerScene = Math.round((minCharacters + maxCharacters) / 2 / targetSceneCount);

  let prompt;

  if (customPrompt && customPrompt.trim()) {
    prompt = customPrompt
      .replace(/\{topic\}/g, topic)
      .replace(/\{duration\}/g, duration)
      .replace(/\{style\}/g, style)
      .replace(/\{minCharacters\}/g, minCharacters)
      .replace(/\{maxCharacters\}/g, maxCharacters)
      .replace(/\{totalSeconds\}/g, totalSeconds)
      .replace(/\{minSceneCount\}/g, minSceneCount)
      .replace(/\{maxSceneCount\}/g, maxSceneCount)
      .replace(/\{targetSceneCount\}/g, targetSceneCount)
      .replace(/\{avgCharactersPerScene\}/g, avgCharactersPerScene);
  } else {
    prompt = buildPrompt({
      topic,
      style,
      duration,
      referenceText: referenceScript,
      cpmMin,
      cpmMax,
    });
  }

  if (referenceScript && referenceScript.trim()) {
    prompt += `\n\n## 레퍼런스 대본 분석\n${referenceScript}`;
  }

  return prompt;
}

// 장면 정규화
function normalizeScenes(scenes, targetDuration) {
  const actualSceneCount = scenes.length;

  let normalizedScenes = scenes.map((scene, index) => {
    const text = extractSceneText(scene);
    const charCount = countKoreanChars(text);

    return {
      id: scene.id || `s${index + 1}`,
      text: text,
      duration: scene.duration || Math.round((targetDuration * 60) / actualSceneCount),
      charCount: charCount,
      scene_number: index + 1,
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

// 메인 Replicate 호출 함수 (청크 방식 지원)
async function callReplicate(params) {
  const {
    topic = "",
    style = "",
    duration = 5,
    referenceText = "",
    cpmMin = 300,
    cpmMax = 400,
    model = DEFAULT_MODEL
  } = params;

  console.log("🤖 Replicate 대본 생성 시작 (Llama 3 기반)");
  console.log(`📊 설정: ${duration}분, CPM ${cpmMin}-${cpmMax}`);

  const isLongForm = duration >= 20;

  // 장편(20분 이상)은 청크로 나눠서 생성 (Anthropic과 동일)
  if (isLongForm) {
    return await generateLongFormScriptReplicate({
      topic,
      style,
      duration,
      referenceText,
      cpmMin,
      cpmMax,
      model,
      customPrompt: params.prompt
    });
  }

  // 단편은 기존 방식
  const targetSceneCount = Math.round((duration * 60) / 8);
  const minSceneCount = Math.max(3, Math.floor(targetSceneCount * 0.9));
  const maxSceneCount = Math.ceil(targetSceneCount * 1.3);

  console.log(`📊 예상 장면 수: ${minSceneCount}~${maxSceneCount}개 (권장: ${targetSceneCount}개)`);
  console.log(`🦙 모델: ${model}`);

  // 1. API 키 확인
  const apiKey = await getSecret("replicateKey");
  if (!apiKey) {
    throw new Error("Replicate API Key가 설정되지 않았습니다. 설정에서 API 키를 등록해주세요.");
  }

  // 2. 모델 설정
  const modelSlug = LLAMA_MODELS[model] || LLAMA_MODELS[DEFAULT_MODEL];

  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 시도 ${attempt}/${maxRetries}: Replicate 대본 생성`);

    try {
    // 3. 프롬프트 생성 (커스텀 프롬프트 지원)
    const prompt = await _buildPrompt(topic, duration, style, params.prompt, referenceText, cpmMin, cpmMax);

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

    // 11. 씬 데이터 정규화
    const actualScenes = parsedData.scenes.length;
    console.log(`🎯 AI가 생성한 장면 수: ${actualScenes}개`);

    const normalizedScenes = normalizeScenes(parsedData.scenes, duration);

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

    console.log(`🎉 Replicate 대본 생성 완료! (시도 ${attempt}/${maxRetries})`);
    console.log(`📈 기본 통계: ${normalizedScenes.length}개 장면, ${totalChars}자, ${actualDurationMinutes.toFixed(1)}분`);
    console.log(`📊 실제 CPM: ${actualCPM}자/분 (목표: ${cpmMin}-${cpmMax})`);

    // ⚠️ 글자 수가 최소 기준 미만이면 재시도 (장편/단편 구분)
    const isLongForm = duration >= 20;
    const expectedMinChars = isLongForm
      ? Math.round(duration * cpmMin * 1.4)  // 장편: 140% (20분 = 6,160자)
      : Math.round(duration * cpmMin * 1.25); // 단편: 125% (3분 = 825자)
    const actualSceneCount = normalizedScenes.length;

    console.log(`📊 Replicate 대본 생성 결과 (시도 ${attempt}/${maxRetries}):`);
    console.log(`  - 요청 시간: ${duration}분`);
    console.log(`  - 생성 장면: ${actualSceneCount}개`);
    console.log(`  - 생성 글자: ${totalChars}자`);
    console.log(`  - 최소 요구: ${expectedMinChars}자 (${isLongForm ? '장편 140%' : '단편 125%'})`);
    console.log(`  - CPM 기준: ${cpmMin}-${cpmMax}자/분`);
    console.log(`  - 예상 TTS 길이: ${(totalChars / 220).toFixed(1)}분 (Google TTS speakingRate 1.0 기준: 220자/분)`);
    console.log(`  - 목표 달성률: ${((totalChars / 220) / duration * 100).toFixed(0)}%`);

    if (totalChars < expectedMinChars && attempt < maxRetries) {
      console.warn(`⚠️ 글자 수 부족: ${totalChars}자 < ${expectedMinChars}자 (최소 요구)`);
      console.warn(`🔄 재시도 ${attempt + 1}/${maxRetries}...`);
      throw new Error(`글자 수 부족: ${totalChars}자 < ${expectedMinChars}자, 재시도`);
    }

    // 장면 수 검증 로그
    console.log(`🔍 장면 수 검증:`);
    console.log(`  📋 요청 범위: ${minSceneCount}~${maxSceneCount}개`);
    console.log(`  📝 실제 장면: ${actualSceneCount}개`);
    console.log(`  ✅ 범위 내 여부: ${actualSceneCount >= minSceneCount && actualSceneCount <= maxSceneCount ? '✅ 적합' : '⚠️ 범위 벗어남'}`);

    return { success: true, data: result };

    } catch (error) {
      lastError = error;
      console.error(`❌ 시도 ${attempt} 실패:`, error.message);

      if (attempt < maxRetries) {
        console.log(`⏳ ${2}초 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // 모든 재시도 실패
  console.error(`❌ Replicate 대본 생성 최종 실패 (${maxRetries}회 시도)`);
  throw new Error(`Replicate 대본 생성 실패: ${lastError?.message || '알 수 없는 오류'}`);
}

// ============================================================
// 장편 대본 생성 (청크 방식) - Replicate
// ============================================================
async function generateLongFormScriptReplicate({ topic, style, duration, referenceText, cpmMin, cpmMax, model, customPrompt }) {
  console.log(`🎬 Replicate 장편 콘텐츠 생성 모드: ${duration}분을 청크로 분할`);

  const CHUNK_DURATION = 5;
  const chunkCount = Math.ceil(duration / CHUNK_DURATION);

  console.log(`📦 총 ${chunkCount}개 청크로 분할 (각 ${CHUNK_DURATION}분)`);

  const apiKey = await getSecret("replicateKey");
  if (!apiKey) throw new Error("Replicate API Key가 설정되지 않았습니다.");

  const modelSlug = LLAMA_MODELS[model] || LLAMA_MODELS[DEFAULT_MODEL];
  const replicate = createReplicate(apiKey);
  const versionId = await resolveLatestVersionId(modelSlug, apiKey);

  const allScenes = [];
  let currentSceneNumber = 1;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const isLastChunk = chunkIndex === chunkCount - 1;
    const chunkDuration = isLastChunk ? duration - (chunkIndex * CHUNK_DURATION) : CHUNK_DURATION;

    console.log(`\n🔄 청크 ${chunkIndex + 1}/${chunkCount} 생성 중 (${chunkDuration}분)...`);

    const chunkTopic = chunkIndex === 0
      ? `${topic} (전체 ${duration}분 중 ${chunkIndex + 1}/${chunkCount} 파트)`
      : `${topic} (전체 ${duration}분 중 ${chunkIndex + 1}/${chunkCount} 파트 - 이전 내용에서 자연스럽게 이어지도록)`;

    const prompt = await _buildPrompt(chunkTopic, chunkDuration, style, customPrompt, referenceText, cpmMin, cpmMax);

    const targetSceneCount = Math.round((chunkDuration * 60) / 8);
    const minSceneCount = Math.max(3, Math.floor(targetSceneCount * 0.9));

    let chunkScenes = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
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

        const maxTries = 180;
        let tries = 0;
        while (["starting", "processing", "queued"].includes(prediction.status) && tries < maxTries) {
          await new Promise((r) => setTimeout(r, 1000));
          prediction = await replicate.predictions.get(prediction.id);
          tries++;
        }

        if (prediction.status !== "succeeded") {
          throw new Error(`Replicate 실패: ${prediction.error}`);
        }

        const rawResponse = Array.isArray(prediction.output)
          ? prediction.output.join("")
          : String(prediction.output || "");

        const parsedData = parseJsonResponse(rawResponse);
        if (!parsedData || !validateScript(parsedData)) {
          throw new Error("AI 응답 파싱 실패");
        }

        chunkScenes = normalizeScenes(parsedData.scenes, chunkDuration);
        console.log(`✅ 청크 ${chunkIndex + 1} 완료: ${chunkScenes.length}개 장면`);
        break;
      } catch (err) {
        console.error(`❌ 청크 ${chunkIndex + 1} 시도 ${attempt} 실패:`, err.message);
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    if (!chunkScenes) {
      throw new Error(`청크 ${chunkIndex + 1} 생성 실패`);
    }

    chunkScenes.forEach(scene => {
      scene.id = `s${currentSceneNumber}`;
      scene.scene_number = currentSceneNumber;
      currentSceneNumber++;
    });

    allScenes.push(...chunkScenes);
  }

  const totalChars = allScenes.reduce((sum, s) => sum + s.charCount, 0);
  console.log(`\n🎉 Replicate 장편 대본 생성 완료!`);
  console.log(`📊 총 ${allScenes.length}개 장면, ${totalChars}자`);

  return {
    success: true,
    data: {
      title: topic || "AI 생성 장편 대본",
      scenes: allScenes,
    },
  };
}

module.exports = { callReplicate };