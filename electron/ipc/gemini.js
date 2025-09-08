// electron/ipc/gemini.js
const { ipcMain } = require("electron");
const RetryHandler = require("../services/retryHandler");
const { getThumbnailCache } = require("../services/thumbnailCache");

ipcMain.handle("generateThumbnailsGemini", async (_e, payload = {}) => {
  const {
    prompt,
    count = 1,
    aspectRatio = "16:9",
    apiKey,
  } = payload;

  try {
    // --- 입력 검증 ---
    const promptText = (prompt || "").trim();
    if (!promptText) {
      console.error("[gemini] Empty prompt provided");
      return { ok: false, message: "prompt_required" };
    }
    if (!apiKey?.trim()) {
      console.error("[gemini] No API key provided");
      return { ok: false, message: "api_key_required" };
    }

    const numOutputs = Math.max(1, Math.min(4, Number(count) || 1)); // 1~4 클램프
    console.log(`[gemini] Starting thumbnail generation for ${numOutputs} images`);

    // 캐시 체크
    const cache = getThumbnailCache();
    const cacheSettings = { 
      provider: 'gemini',
      count: numOutputs, 
      aspectRatio,
      quality: payload.quality 
    };
    
    const cached = await cache.get(promptText, cacheSettings);
    if (cached) {
      console.log('[gemini] Returning cached result');
      return { ok: true, images: cached, fromCache: true };
    }

    // 재시도 핸들러 생성
    const retryHandler = new RetryHandler(3, 1000);

    // --- Google Generative AI (Gemini) API 호출 ---
    // Imagen 생성을 위한 프롬프트를 먼저 Gemini로 최적화
    const optimizeResponse = await retryHandler.execute(async () => {
      return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are an expert at creating YouTube thumbnail prompts for Imagen-3. Take this input and create an optimized, eye-catching thumbnail prompt:

INPUT: ${promptText}

Create an English prompt for Imagen-3 that will generate a compelling YouTube thumbnail. The prompt should:
- Include "Korean person" or "Asian person" if people are involved
- Be dramatic and attention-grabbing
- Include "no text, no words, no letters"
- Include "16:9 aspect ratio"
- Include "ultra-realistic, cinematic style"
- Include "dramatic lighting"
- Be optimized for high click-through rates

Output only the optimized English prompt:`
          }]
        }]
      }),
    });
    }, { operationName: 'Gemini API Call' });

    if (!optimizeResponse.ok) {
      const errorData = await optimizeResponse.json().catch(() => ({}));
      console.error(`[gemini] API optimization failed: ${optimizeResponse.status}`, errorData);
      return { 
        ok: false, 
        message: `Gemini API Error: ${optimizeResponse.status} - ${errorData.error?.message || optimizeResponse.statusText}` 
      };
    }

    const optimizeData = await optimizeResponse.json();
    const optimizedPrompt = optimizeData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!optimizedPrompt) {
      console.error("[gemini] No optimized prompt returned from Gemini API", optimizeData);
      return { ok: false, message: "Failed to optimize prompt with Gemini" };
    }

    console.log("🧠 Gemini optimized prompt:", optimizedPrompt);

    // --- ImageFX API 호출 (Google의 이미지 생성 서비스) ---
    // ImageFX는 현재 공개 API가 없으므로 폴백으로 Imagen-3와 유사한 결과 시뮬레이션
    // 실제 구현에서는 적절한 이미지 생성 API를 사용해야 합니다.
    
    // 임시로 optimizedPrompt를 사용하여 응답 생성 (실제 이미지 생성은 별도 구현 필요)
    const images = [];
    for (let i = 0; i < numOutputs; i++) {
      // 실제로는 이미지 생성 API를 호출해야 합니다.
      // 현재는 placeholder 이미지 URL을 반환
      const placeholderUrl = `data:image/svg+xml;base64,${Buffer.from(`
        <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
          <rect width="1920" height="1080" fill="#1a365d"/>
          <text x="960" y="500" text-anchor="middle" fill="white" font-family="Arial" font-size="48">
            Gemini Optimized Thumbnail ${i + 1}
          </text>
          <text x="960" y="580" text-anchor="middle" fill="#63b3ed" font-family="Arial" font-size="24">
            ${optimizedPrompt.substring(0, 100)}...
          </text>
        </svg>
      `).toString('base64')}`;
      images.push(placeholderUrl);
    }

    // 결과 캐싱
    await cache.set(promptText, cacheSettings, images);
    
    return { 
      ok: true, 
      images,
      optimizedPrompt,
      message: "Note: This is using placeholder images. Actual image generation requires additional API setup."
    };

  } catch (err) {
    console.error("[gemini] Thumbnail generation error:", err);
    const msg = err?.message || String(err);
    
    // 네트워크 오류 처리
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return { ok: false, message: "네트워크 연결을 확인해주세요." };
    }
    
    // API 키 관련 오류 처리
    if (msg.includes('API_KEY_INVALID') || msg.includes('403')) {
      return { ok: false, message: "API 키가 유효하지 않습니다. 설정을 확인해주세요." };
    }
    
    return { ok: false, message: `오류가 발생했습니다: ${msg}` };
  }
});

module.exports = {};