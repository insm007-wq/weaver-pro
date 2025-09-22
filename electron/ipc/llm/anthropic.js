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
  const minChars = Math.round(duration * (cpmMin || 300));
  const maxChars = Math.round(duration * (cpmMax || 400));
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

async function _buildPrompt(topic, duration, style, maxScenes, customPrompt = null, referenceScript = null, cpmMin = 300, cpmMax = 400) {
  const minCharacters = duration * cpmMin;
  const maxCharacters = duration * cpmMax;
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
    prompt = buildPrompt({ topic, style, duration, maxScenes, referenceText: referenceScript, cpmMin, cpmMax });
  }

  if (referenceScript && referenceScript.trim()) {
    prompt += `\n\n## 레퍼런스 대본 분석\n${referenceScript}`;
  }

  return prompt;
}

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

  // 협력업체 방식: 장면 수 조정
  normalizedScenes = adjustAnthropicSceneCount(normalizedScenes, maxScenes, targetDuration);

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

// 협력업체 방식: Anthropic용 장면 수 조정
function adjustAnthropicSceneCount(scenes, targetCount, duration) {
  const currentCount = scenes.length;

  console.log(`🔧 Anthropic 장면 수 조정: ${currentCount}개 → ${targetCount}개`);

  if (currentCount === targetCount) {
    return scenes;
  }

  if (currentCount < targetCount) {
    // 부족한 경우: 긴 장면들을 분할
    return splitAnthropicScenes(scenes, targetCount, duration);
  } else {
    // 초과한 경우: 짧은 장면들을 병합
    return mergeAnthropicScenes(scenes, targetCount, duration);
  }
}

// Anthropic 장면 분할
function splitAnthropicScenes(scenes, targetCount, duration) {
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

  // scene_number 재정렬
  return result.slice(0, targetCount).map((scene, index) => ({
    ...scene,
    scene_number: index + 1
  }));
}

// Anthropic 장면 병합
function mergeAnthropicScenes(scenes, targetCount, duration) {
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

  // scene_number 재정렬
  return result.map((scene, index) => ({
    ...scene,
    scene_number: index + 1
  }));
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
    cpmMin = 300,
    cpmMax = 400,
  } = params;

  console.log("🤖 Anthropic 대본 생성 시작 (협력업체 방식)");
  console.log(`📊 설정: ${duration}분, ${maxScenes}개 장면, CPM ${cpmMin}-${cpmMax}`);

  // 1. API 키 확인
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) {
    throw new Error("Anthropic API Key가 설정되지 않았습니다. 설정에서 API 키를 등록해주세요.");
  }

  // 2. 프롬프트 준비
  const prompt = await _buildPrompt(topic, duration, style, maxScenes, params.prompt, referenceText, cpmMin, cpmMax);

  const maxRetries = 1; // 속도 우선으로 1회만
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 시도 ${attempt}/${maxRetries}: 장면 수 ${maxScenes}개 대본 생성`);

    try {
      // 2. 프롬프트 준비 (시도할 때마다 더 강하게)
      let currentPrompt = prompt;

      if (attempt > 1) {
        currentPrompt += `\n\n🚨 중요: 이전 시도에서 장면 수가 맞지 않았습니다. 반드시 정확히 ${maxScenes}개 장면으로 생성해주세요!`;
      }
      if (attempt > 2) {
        currentPrompt += `\n\n❌ 마지막 기회입니다! 장면 수가 ${maxScenes}개가 아니면 실패입니다. 다른 개수는 절대 안됩니다!`;
      }

      console.log("📝 프롬프트 길이:", currentPrompt.length, "자");

      // 3. API 호출
      const rawResponse = await callAnthropicAPI(apiKey, currentPrompt);
      console.log("✅ API 응답 수신, 길이:", rawResponse.length, "자");

      // 4. JSON 파싱
      const parsedData = parseJsonResponse(rawResponse);
      if (!parsedData) {
        throw new Error("AI 응답을 JSON으로 파싱할 수 없습니다.");
      }

      // 5. 구조 검증
      if (!validateScript(parsedData)) {
        throw new Error("생성된 대본의 구조가 올바르지 않습니다.");
      }

      // 6. 장면 수 검증 (30% 오차까지 허용, 협력업체 방식)
      const actualScenes = parsedData.scenes.length;
      const allowableRange = Math.ceil(maxScenes * 0.5); // 50% 허용으로 확대
      const sceneDiff = Math.abs(actualScenes - maxScenes);
      console.log(`🎯 Anthropic 장면 수 검증: 요청 ${maxScenes}개 vs 실제 ${actualScenes}개 (차이: ${sceneDiff}개, 허용: ±${allowableRange}개)`);

      if (sceneDiff > allowableRange) {
        const error = `장면 수 차이가 매우 큼: ${maxScenes}개 요청했으나 ${actualScenes}개 생성됨 (허용 오차: ±${allowableRange}개)`;
        console.warn(`⚠️ ${error} (시도 ${attempt}/${maxRetries})`);

        if (attempt < maxRetries) {
          console.log(`🔄 재시도 준비 중... (${maxRetries - attempt}번 남음)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue; // 다음 시도로
        } else {
          throw new Error(error);
        }
      } else if (sceneDiff > 0) {
        console.log(`✅ 허용 오차 내 장면 수 차이 (±${sceneDiff}개), 후처리로 자동 조정`);
      }

      // 7. 씬 데이터 정규화
      const normalizedScenes = normalizeScenes(parsedData.scenes, duration, maxScenes);

      // 8. 최종 결과 구성
      const result = {
        title: parsedData.title || topic || "AI 생성 대본",
        scenes: normalizedScenes,
      };

      // 9. 시간 계산 정확성 검증
      const totalChars = normalizedScenes.reduce((sum, scene) => sum + scene.charCount, 0);
      const totalDuration = normalizedScenes.reduce((sum, scene) => sum + scene.duration, 0);

      // 실제 vs 예상 시간 계산
      const expectedMinChars = duration * cpmMin;
      const expectedMaxChars = duration * cpmMax;
      const expectedDurationSeconds = duration * 60;
      const actualDurationMinutes = totalDuration / 60;

      console.log(`🎉 대본 생성 완료! (시도 ${attempt}/${maxRetries})`);
      console.log(`📈 기본 통계: ${normalizedScenes.length}개 장면, ${totalChars}자, ${Math.round(actualDurationMinutes * 10) / 10}분`);
      console.log(`📊 장면당 평균: ${Math.round(totalChars / normalizedScenes.length)}자`);

      // 정확성 검증 로그
      console.log(`🔍 시간 정확성 검증:`);
      console.log(`  📋 요청 시간: ${duration}분 (${expectedDurationSeconds}초)`);
      console.log(`  ⏱️ 실제 시간: ${actualDurationMinutes.toFixed(1)}분 (${totalDuration}초)`);
      console.log(`  📊 시간 차이: ${Math.abs(actualDurationMinutes - duration).toFixed(1)}분`);
      console.log(`  ✅ 시간 정확도: ${((1 - Math.abs(actualDurationMinutes - duration) / duration) * 100).toFixed(1)}%`);

      console.log(`🔍 글자 수 정확성 검증:`);
      console.log(`  📋 예상 범위: ${expectedMinChars}~${expectedMaxChars}자`);
      console.log(`  📝 실제 글자: ${totalChars}자`);
      console.log(`  ✅ 범위 내 여부: ${totalChars >= expectedMinChars && totalChars <= expectedMaxChars ? '✅ 적합' : '❌ 범위 초과'}`);

      console.log(`🔍 CPM 정확성 검증:`);
      const actualCPM = Math.round(totalChars / duration);
      console.log(`  📋 설정 CPM: ${cpmMin}~${cpmMax}자/분`);
      console.log(`  📝 실제 CPM: ${actualCPM}자/분`);
      console.log(`  ✅ CPM 정확도: ${actualCPM >= cpmMin && actualCPM <= cpmMax ? '✅ 적합' : '❌ 범위 초과'}`);

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

  console.error(`❌ 모든 시도 실패 (${maxRetries}/${maxRetries})`);
  throw new Error(`대본 생성 실패: ${lastError?.message || "알 수 없는 오류"}`);
}

module.exports = { callAnthropic };
