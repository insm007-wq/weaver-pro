/**
 * LLM 라우터 - 최소 라우팅만
 */

const { ipcMain } = require("electron");
const { callAnthropic, expandThumbnailPrompt } = require("./anthropic");
const { callReplicate } = require("./replicate");

ipcMain.handle("llm/generateScript", async (event, payload) => {
  const llm = payload?.llm;
  if (!llm) throw new Error("AI 엔진을 선택해주세요.");

  switch (llm.toLowerCase()) {
    case "anthropic":
      return await callAnthropic(payload);

    case "replicate":
    case "replicate-llama3":
      return await callReplicate(payload);

    default:
      throw new Error(`지원하지 않는 AI 엔진: ${llm}`);
  }
});

// 썸네일 프롬프트 확장 핸들러
ipcMain.handle("thumbnail:expand-prompt", async (event, userInput) => {
  try {
    if (!userInput || !userInput.trim()) {
      throw new Error("프롬프트 입력이 필요합니다.");
    }
    const expandedPrompt = await expandThumbnailPrompt(userInput.trim());
    return { ok: true, prompt: expandedPrompt };
  } catch (error) {
    console.error("[thumbnail:expand-prompt] 오류:", error);
    return {
      ok: false,
      message: error.message,
      // 폴백: 원본 입력 + 기본 키워드
      fallbackPrompt: `${userInput}, ultra-realistic, cinematic YouTube thumbnail, dramatic lighting, 16:9 aspect ratio, no text`
    };
  }
});

console.log("🚀 LLM 라우터 초기화: Claude, Replicate Llama 3, 썸네일 프롬프트 확장");