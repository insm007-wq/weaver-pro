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
      return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
      
      // 503 과부하 오류에 대한 사용자 친화적 메시지
      if (optimizeResponse.status === 503) {
        return { 
          ok: false, 
          message: "🔄 Gemini 서비스가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요." 
        };
      }
      
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

    // --- Imagen-3 API 호출로 실제 이미지 생성 ---
    console.log("🎨 Imagen-3로 이미지 생성 중...", optimizedPrompt);
    
    const images = [];
    
    try {
      // Google GenAI SDK 사용하여 Imagen-3 API 호출
      const { GoogleGenAI } = require('@google/genai');
      const genAI = new GoogleGenAI({ apiKey });
      
      const imageResponse = await retryHandler.execute(async () => {
        return await genAI.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: optimizedPrompt,
          config: {
            numberOfImages: numOutputs,
            aspectRatio: aspectRatio === "16:9" ? "16:9" : "1:1" // 16:9 또는 1:1 지원
          }
        });
      }, { operationName: 'Imagen-3 API Call' });

      // 생성된 이미지를 base64 데이터 URL로 변환
      for (const generatedImage of imageResponse.generatedImages) {
        const imageBytes = generatedImage.image.imageBytes;
        const dataUrl = `data:image/png;base64,${imageBytes}`;
        images.push(dataUrl);
      }

      console.log(`✅ Imagen-3로 ${images.length}개 이미지 생성 완료`);
      
    } catch (imagenError) {
      console.error("❌ Imagen-3 API 오류:", imagenError);
      
      // 구체적인 오류 메시지 생성
      let errorReason = "일시적 오류";
      if (imagenError.message?.includes("billed users")) {
        errorReason = "유료 결제 필요 (Google Cloud 결제 계정 연결 필요)";
      } else if (imagenError.message?.includes("quota")) {
        errorReason = "사용량 할당 초과";
      } else if (imagenError.message?.includes("API_KEY")) {
        errorReason = "API 키 오류";
      }
      
      // Imagen-3 실패 시 placeholder 이미지로 폴백
      console.log(`📝 Placeholder 이미지로 폴백 (사유: ${errorReason})`);
      for (let i = 0; i < numOutputs; i++) {
        const placeholderUrl = `data:image/svg+xml;base64,${Buffer.from(`
          <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
            <rect width="1920" height="1080" fill="#1a365d"/>
            <text x="960" y="430" text-anchor="middle" fill="white" font-family="Arial" font-size="32">
              Imagen-3: ${errorReason}
            </text>
            <text x="960" y="520" text-anchor="middle" fill="#63b3ed" font-family="Arial" font-size="20">
              Gemini 최적화된 프롬프트: 
            </text>
            <text x="960" y="580" text-anchor="middle" fill="#63b3ed" font-family="Arial" font-size="16">
              ${optimizedPrompt.substring(0, 80)}...
            </text>
          </svg>
        `).toString('base64')}`;
        images.push(placeholderUrl);
      }
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

// 캐시 클리어 IPC 핸들러
ipcMain.handle("cache:clear", async (_e) => {
  try {
    const { getThumbnailCache } = require("../services/thumbnailCache");
    const cache = getThumbnailCache();
    await cache.clear();
    return { ok: true, message: "캐시가 성공적으로 삭제되었습니다." };
  } catch (err) {
    console.error("[cache:clear] error", err);
    return { ok: false, message: String(err?.message || err) };
  }
});

// 캐시 상태 확인 IPC 핸들러
ipcMain.handle("cache:stats", async (_e) => {
  try {
    const { getThumbnailCache } = require("../services/thumbnailCache");
    const cache = getThumbnailCache();
    const stats = cache.getStats();
    return { ok: true, stats };
  } catch (err) {
    console.error("[cache:stats] error", err);
    return { ok: false, message: String(err?.message || err) };
  }
});

module.exports = {};