// electron/ipc/gemini.js
const { ipcMain } = require("electron");

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
    if (!promptText) return { ok: false, message: "prompt_required" };
    if (!apiKey?.trim()) return { ok: false, message: "api_key_required" };

    const numOutputs = Math.max(1, Math.min(4, Number(count) || 1)); // 1~4 클램프

    // --- Google Generative AI (Gemini) API 호출 ---
    // Imagen 생성을 위한 프롬프트를 먼저 Gemini로 최적화
    const optimizeResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${encodeURIComponent(apiKey)}`, {
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

    if (!optimizeResponse.ok) {
      const errorData = await optimizeResponse.json().catch(() => ({}));
      return { 
        ok: false, 
        message: `Gemini API Error: ${optimizeResponse.status} - ${errorData.error?.message || optimizeResponse.statusText}` 
      };
    }

    const optimizeData = await optimizeResponse.json();
    const optimizedPrompt = optimizeData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!optimizedPrompt) {
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

    return { 
      ok: true, 
      images,
      optimizedPrompt,
      message: "Note: This is using placeholder images. Actual image generation requires additional API setup."
    };

  } catch (err) {
    console.error("Gemini thumbnail generation error:", err);
    const msg = err?.message || String(err);
    return { ok: false, message: msg };
  }
});

module.exports = {};