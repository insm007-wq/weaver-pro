/**
 * Anthropic Claude API Provider
 * Vrew 스타일 + Google TTS 보정
 * - 씬당 40~60자
 * - CPM 320~360 (3분이면 960~1080자 보장)
 * - 요청 시간보다 짧으면 불합격, 10~20% 길어도 허용
 */

const { getSecret } = require("../../services/secrets");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-3-5-sonnet-latest";
const MAX_TOKENS = 8192;
const TTS_SAFE_CHAR_LIMIT = 1450;

// ============================================================
// 유틸 함수
// ============================================================
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

// ============================================================
// Vrew 스타일 프롬프트 빌더
// ============================================================
function buildPrompt({ topic, style, duration, referenceText, cpmMin, cpmMax }) {
  const totalSeconds = duration * 60;
  const secondsPerScene = 8;
  const targetSceneCount = Math.round(totalSeconds / secondsPerScene);
  const minSceneCount = Math.max(3, Math.floor(targetSceneCount * 0.9));
  const maxSceneCount = Math.ceil(targetSceneCount * 1.3); // 최대 30% 더 허용

  // 최소 글자수 설정 (장편/단편 구분)
  const isLongForm = duration >= 20; // 20분 이상은 장편
  const expectedMinChars = isLongForm
    ? Math.round(duration * cpmMin * 1.4)  // 장편: 140% (20분 = 8,960자, 30분 = 13,440자)
    : Math.round(duration * cpmMin * 1.25); // 단편: 125% (3분 = 1,200자)
  const expectedMaxChars = Math.round(duration * cpmMax * 1.5); // 최대 50% 더 허용

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
    `• 장면 구성: ${minSceneCount}~${maxSceneCount}개 (권장: ${targetSceneCount}개)`,
    `• 각 장면: 7~10초 (40~60자)`,
    `• 각 장면 최대: ${TTS_SAFE_CHAR_LIMIT}자 (TTS 제한)`,
    "",
    `📝 작성 방식:`,
    `• 각 장면은 50~60자 (너무 짧으면 안됨!)`,
    `• 각 장면마다 하나의 완결된 메시지 전달`,
    `• 장면 간 자연스러운 흐름 유지`,
    `• 지루하지 않게 적절한 템포 유지`,
    `• 마크다운/불릿포인트 금지`,
    `• 자연스러운 구어체 문단`,
    "",
    `⚠️ 중요:`,
    `1. 반드시 ${minSceneCount}개 이상 장면 포함 (${isLongForm ? '장편이므로 많은 장면 필수' : '최소한 이 개수는 꼭 지켜야 함'})`,
    `2. 전체 글자 수는 최소 ${expectedMinChars}자 이상 ${isLongForm ? '권장' : '필수'}! (짧으면 ${isLongForm ? '재시도' : '불합격'})`,
    `3. 각 장면은 50자 이상 작성 (40자 이하는 불합격)`,
    `4. 요청 시간보다 최대 30% 길어져도 괜찮음`,
  ].filter(line => line !== ""); // 빈 줄 제거

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
    `    ... (총 ${minSceneCount}~${maxSceneCount}개 장면)`,
    `  ]`,
    `}`,
    "",
    `⚡ JSON만 출력하고 다른 설명은 절대 포함하지 마세요.`
  );

  return parts.join("\n");
}

async function _buildPrompt(topic, duration, style, customPrompt = null, referenceScript = null, cpmMin = 220, cpmMax = 250) {
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

// ============================================================
// 씬 정규화 (Vrew 스타일)
// ============================================================
function normalizeScenes(scenes, targetDuration) {
  const targetSeconds = targetDuration * 60;
  const sceneCount = scenes.length;
  const avgDuration = Math.round(targetSeconds / sceneCount);

  let normalizedScenes = scenes.map((scene, index) => {
    const text = extractSceneText(scene);
    const charCount = countKoreanChars(text);

    return {
      id: scene.id || `s${index + 1}`,
      text,
      duration: avgDuration,
      charCount,
      scene_number: index + 1,
    };
  });

  // 마지막 씬에 남은 시간 보정
  const totalDuration = normalizedScenes.reduce((sum, s) => sum + s.duration, 0);
  if (totalDuration !== targetSeconds) {
    normalizedScenes[sceneCount - 1].duration += targetSeconds - totalDuration;
  }

  return normalizedScenes;
}

// ============================================================
// API 호출 (타임아웃 및 재시도 로직 추가)
// ============================================================
async function callAnthropicAPI(apiKey, prompt, minSceneCount = 5, isLongForm = false, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 재시도 시 지수 백오프 (여유있게)
      if (attempt > 0) {
        const backoffMs = Math.min(3000 * Math.pow(2, attempt - 1), 15000);  // 3초, 6초, 12초
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      // 타임아웃 설정 (여유있게 증가)
      const timeoutMs = isLongForm ? 180000 : 90000;  // 장편: 3분, 단편: 1.5분
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: isLongForm ? MAX_TOKENS : MAX_TOKENS - 100,
          system: `You are a professional Korean scriptwriter.
CRITICAL RULES:
1. Return ONLY valid JSON without any explanations or markdown.
2. The "scenes" array MUST contain at least ${minSceneCount} scenes.
3. ${isLongForm ? 'This is a LONG-FORM content. Generate as many scenes as possible (aim for ' + minSceneCount + '+).' : 'Each scene duration MUST sum to the requested total video time.'}
4. Each scene text MUST be 50~60 Korean characters (not less than 50).
5. ${isLongForm ? 'You MUST generate at least ' + minSceneCount + ' scenes or the response will be rejected.' : ''}`,
          messages: [{ role: "user", content: prompt }],
          temperature: isLongForm ? 0.7 : 0.2,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        // 429 Rate Limit은 재시도, 401 등은 즉시 실패
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Anthropic API 인증 오류 ${response.status}: API 키를 확인해주세요.`);
        }

        throw new Error(`Anthropic API Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const result = data?.content?.[0]?.text || "";

      if (!result) {
        throw new Error("API 응답이 비어있습니다.");
      }

      return result;

    } catch (error) {
      lastError = error;
      console.error(`❌ LLM API 시도 ${attempt + 1}/${maxRetries} 실패:`, error.message);

      // 타임아웃 또는 네트워크 오류는 재시도
      const isRetryable = error.name === 'AbortError' ||
                          error.message.includes('fetch') ||
                          error.message.includes('network') ||
                          error.message.includes('429');

      if (!isRetryable || attempt === maxRetries - 1) {
        break;
      }
    }
  }

  throw new Error(`LLM API 호출 실패 (${maxRetries}회 재시도): ${lastError?.message}`);
}

// ============================================================
// 대본 생성 메인 함수 (청크 방식 지원)
// ============================================================
async function callAnthropic(params, event = null) {
  const {
    topic = "",
    style = "",
    duration = 5,
    referenceText = "",
    cpmMin = 320,
    cpmMax = 360,
  } = params;

  const isLongForm = duration >= 20;

  // 장편(20분 이상)은 청크로 나눠서 생성
  if (isLongForm) {
    return await generateLongFormScript({
      topic,
      style,
      duration,
      referenceText,
      cpmMin,
      cpmMax,
      customPrompt: params.prompt,
      event  // 진행률 전송을 위해 event 전달
    });
  }

  // 단편은 기존 방식 그대로
  const targetSceneCount = Math.round((duration * 60) / 8);
  const minSceneCount = Math.max(3, Math.floor(targetSceneCount * 0.9));
  const maxSceneCount = Math.ceil(targetSceneCount * 1.3);

  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  const prompt = await _buildPrompt(topic, duration, style, params.prompt, referenceText, cpmMin, cpmMax);

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const rawResponse = await callAnthropicAPI(apiKey, prompt, minSceneCount, false);
      const parsedData = parseJsonResponse(rawResponse);
      if (!parsedData || !validateScript(parsedData)) {
        throw new Error("AI 응답 파싱 실패");
      }

      const normalizedScenes = normalizeScenes(parsedData.scenes, duration);
      const totalChars = normalizedScenes.reduce((sum, s) => sum + s.charCount, 0);
      const isLongFormCheck = duration >= 20;
      const expectedMinCharsCheck = isLongFormCheck
        ? duration * cpmMin * 1.4  // 장편: 140%
        : duration * cpmMin * 1.25; // 단편: 125%

      if (totalChars < expectedMinCharsCheck && attempt < 3) {
        console.warn(`⚠️ 글자 수 부족: ${totalChars}자 < ${expectedMinCharsCheck}자`);
        throw new Error(`글자 수 부족: ${totalChars} < ${expectedMinCharsCheck}, 재시도`);
      }

      return {
        success: true,
        data: {
          title: parsedData.title || topic || "AI 생성 대본",
          scenes: normalizedScenes,
        },
      };
    } catch (err) {
      lastError = err;
      console.error(`❌ 시도 ${attempt} 실패:`, err.message);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  throw new Error(`대본 생성 실패: ${lastError?.message}`);
}

// ============================================================
// 장편 대본 생성 (청크 방식)
// ============================================================
async function generateLongFormScript({ topic, style, duration, referenceText, cpmMin, cpmMax, customPrompt, event = null }) {
  const CHUNK_DURATION = 5; // 5분씩 청크
  const chunkCount = Math.ceil(duration / CHUNK_DURATION);

  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  const allScenes = [];
  let currentSceneNumber = 1;

  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex++) {
    const isLastChunk = chunkIndex === chunkCount - 1;
    const chunkDuration = isLastChunk ? duration - (chunkIndex * CHUNK_DURATION) : CHUNK_DURATION;

    const chunkTopic = chunkIndex === 0
      ? `${topic} (전체 ${duration}분 중 ${chunkIndex + 1}/${chunkCount} 파트)`
      : `${topic} (전체 ${duration}분 중 ${chunkIndex + 1}/${chunkCount} 파트 - 이전 내용에서 자연스럽게 이어지도록)`;

    const prompt = await _buildPrompt(chunkTopic, chunkDuration, style, customPrompt, referenceText, cpmMin, cpmMax);

    const targetSceneCount = Math.round((chunkDuration * 60) / 8);
    const minSceneCount = Math.max(3, Math.floor(targetSceneCount * 0.9));

    let chunkScenes = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawResponse = await callAnthropicAPI(apiKey, prompt, minSceneCount, false);
        const parsedData = parseJsonResponse(rawResponse);

        if (!parsedData || !validateScript(parsedData)) {
          throw new Error("AI 응답 파싱 실패");
        }

        chunkScenes = normalizeScenes(parsedData.scenes, chunkDuration);
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

    // 씬 번호 조정
    chunkScenes.forEach(scene => {
      scene.id = `s${currentSceneNumber}`;
      scene.scene_number = currentSceneNumber;
      currentSceneNumber++;
    });

    allScenes.push(...chunkScenes);

    // 청크 완료 시 진행률 전송 (UI 업데이트)
    if (event && event.sender) {
      const progress = Math.round(((chunkIndex + 1) / chunkCount) * 100);
      event.sender.send('llm:chunk-progress', {
        current: chunkIndex + 1,
        total: chunkCount,
        progress: progress,
        scenesGenerated: allScenes.length,
        message: `청크 ${chunkIndex + 1}/${chunkCount} 완료 (${allScenes.length}개 장면 생성)`
      });
    }
  }

  const totalChars = allScenes.reduce((sum, s) => sum + s.charCount, 0);

  return {
    success: true,
    data: {
      title: topic || "AI 생성 장편 대본",
      scenes: allScenes,
    },
  };
}

// ============================================================
// 썸네일 프롬프트 확장
// ============================================================
async function expandThumbnailPrompt(userInput) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) {
    throw new Error("Anthropic API Key가 설정되지 않았습니다.");
  }

  const systemPrompt = `You are a YouTube thumbnail image prompt expert specializing in viral, high-CTR thumbnails.`;

  const userPrompt = `Create a viral YouTube thumbnail prompt for: "${userInput.trim()}"`;

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Anthropic API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data?.content?.[0]?.text?.trim() || userInput;
  } catch (error) {
    console.error("[Anthropic] 프롬프트 확장 실패:", error);
    return `${userInput}, cinematic thumbnail, vibrant colors, 16:9, no text`;
  }
}

// ============================================================
// 키워드를 장면 이미지 프롬프트로 확장 (미디어 다운로드용)
// ============================================================
async function expandKeywordToScenePrompt(keyword) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) {
    throw new Error("Anthropic API Key가 설정되지 않았습니다.");
  }

  const systemPrompt = `You are a professional image generation prompt expert specializing in realistic scene illustrations for video content.`;

  const userPrompt = `Convert this Korean keyword into a detailed English image generation prompt for a video scene:

Keyword: "${keyword.trim()}"

Requirements:
- Create a photorealistic scene illustration prompt
- Describe what would be VISIBLE in a video about this keyword
- Use professional, cinematic style
- Include lighting and composition details
- NO clickbait, NO exaggeration, NO text overlays
- Focus on realistic, natural scenes
- Return ONLY the English prompt, no explanations

Example:
Korean keyword: "도시"
English prompt: modern cityscape, urban skyline, tall buildings, busy streets, people walking, cars on road, photorealistic, cinematic composition, natural lighting, detailed architecture, 4K quality, professional photography

Now convert:`;

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.5, // 중간 temperature로 자연스럽면서도 일관성 있게
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Anthropic API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const expandedPrompt = data?.content?.[0]?.text?.trim();

    if (expandedPrompt) {
      return expandedPrompt;
    }

    // 폴백: 키워드 + 기본 스타일
    const fallback = `${keyword}, photorealistic scene illustration, cinematic composition, natural lighting, detailed background, 4K quality, professional photography`;
    return fallback;
  } catch (error) {
    console.error("[Anthropic] 키워드 프롬프트 확장 실패:", error);
    // 폴백: 키워드 + 기본 스타일
    return `${keyword}, photorealistic scene illustration, cinematic composition, natural lighting, detailed background, 4K quality, professional photography`;
  }
}

// ============================================================
// 씬 이미지용 프롬프트 확장
// ============================================================
async function expandScenePrompt(sceneText) {
  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) {
    throw new Error("Anthropic API Key가 설정되지 않았습니다.");
  }

  const systemPrompt = `You are a professional image generation prompt expert for video scene illustrations.
Your goal is to create natural, photorealistic image prompts that match the scene narration perfectly.`;

  const userPrompt = `Convert this Korean scene narration into a detailed English image generation prompt:

"${sceneText.trim()}"

Requirements:
- Describe the visual scene in detail (setting, objects, people, actions, atmosphere)
- Use photorealistic, cinematic style
- Include lighting and mood description
- NO clickbait, NO exaggeration, NO text overlays
- Keep it natural and professional
- Focus on what would be VISIBLE in the scene
- Return ONLY the English prompt, no explanations or quotes

Example:
Korean: "아름다운 자연 풍경이 펼쳐집니다"
English: beautiful nature landscape, scenic mountain view, lush green forest, clear blue sky with white clouds, golden hour lighting, photorealistic, cinematic composition, wide angle shot, 4K quality

Now convert:`;

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 200,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.3, // 낮은 temperature로 일관성 유지
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`Anthropic API Error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const expandedPrompt = data?.content?.[0]?.text?.trim();

    if (expandedPrompt) {
      return expandedPrompt;
    }

    // 폴백: 원본 텍스트 + 기본 스타일
    const fallback = `${sceneText}, photorealistic scene illustration, natural lighting, cinematic composition, detailed background, 4K quality`;
    return fallback;
  } catch (error) {
    console.error("[Anthropic] 씬 프롬프트 확장 실패:", error);
    // 폴백: 원본 텍스트 + 기본 스타일
    return `${sceneText}, photorealistic scene illustration, natural lighting, cinematic composition, detailed background, 4K quality`;
  }
}

module.exports = { callAnthropic, expandThumbnailPrompt, expandScenePrompt, expandKeywordToScenePrompt };
