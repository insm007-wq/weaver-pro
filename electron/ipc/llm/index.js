/**
 * LLM 라우터 - 최소 라우팅만
 */

const { ipcMain } = require("electron");
const { callAnthropic } = require("./anthropic");
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

console.log("🚀 LLM 라우터 초기화: Claude, Replicate Llama 3");