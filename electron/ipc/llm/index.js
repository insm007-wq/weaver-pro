/**
 * LLM 라우터 - 최소 라우팅만
 */

const { ipcMain } = require("electron");
const { callAnthropic, expandThumbnailPrompt, expandScenePrompt } = require("./anthropic");
const { callReplicate } = require("./replicate");

ipcMain.handle("llm/generateScript", async (event, payload) => {
  const llm = payload?.llm;
  if (!llm) throw new Error("AI 엔진을 선택해주세요.");

  // 타입 안전성 확보: llm이 객체든 문자열이든 안전하게 처리
  let llmString = '';
  if (typeof llm === 'string') {
    llmString = llm;
  } else if (typeof llm === 'object' && llm !== null) {
    llmString = llm?.value || llm?.data || llm?.key || '';
  } else {
    llmString = '';
  }

  // 기본값 설정
  if (!llmString || llmString.trim() === '') {
    llmString = 'anthropic';
  }

  llmString = llmString.toLowerCase().trim();

  switch (llmString) {
    case "anthropic":
      // event 객체를 전달하여 진행률 전송 가능하도록
      return await callAnthropic(payload, event);

    case "replicate":
    case "replicate-llama3":
      return await callReplicate(payload);

    default:
      throw new Error(`지원하지 않는 AI 엔진: ${llmString} (전달된 값: ${typeof llm === 'string' ? llm : 'object'})`);
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

// 씬 이미지용 프롬프트 확장 핸들러
ipcMain.handle("scene:expand-prompt", async (event, sceneText) => {
  try {
    if (!sceneText || !sceneText.trim()) {
      throw new Error("씬 텍스트 입력이 필요합니다.");
    }
    const expandedPrompt = await expandScenePrompt(sceneText.trim());
    return { ok: true, prompt: expandedPrompt };
  } catch (error) {
    console.error("[scene:expand-prompt] 오류:", error);
    return {
      ok: false,
      message: error.message,
      // 폴백: 원본 입력 + 기본 스타일
      fallbackPrompt: `${sceneText}, photorealistic scene illustration, natural lighting, cinematic composition, detailed background, 4K quality`
    };
  }
});