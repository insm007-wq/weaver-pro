// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] loaded");

/**
 * 안전한 렌더러 브릿지
 * - 모든 호출은 ipcRenderer.invoke 기반 (Promise 반환)
 * - 채널명은 main 쪽 ipcMain.handle 등록과 일치해야 함
 */
contextBridge.exposeInMainWorld("api", {
  // =========================
  // 공통 Invoke
  // =========================
  invoke: (channel, payload) => {
    console.log("[preload] invoke:", channel);
    return ipcRenderer.invoke(channel, payload);
  },

  // =========================
  // 기능 브릿지
  // =========================
  imagefxAnalyze: (payload) => ipcRenderer.invoke("imagefx:analyze", payload),
  healthCheck: () => ipcRenderer.invoke("health:check"),

  // --- AI 키워드 추출 (GPT-5 mini)
  aiExtractKeywords: (payload) => ipcRenderer.invoke("ai:extractKeywords", payload),

  // --- 테스트 채널들 ---
  testOpenAI: (apiKey) => ipcRenderer.invoke("openai:test", apiKey),
  testReplicate: (token) => ipcRenderer.invoke("replicate:test", token),
  testAnthropic: (apiKey) => ipcRenderer.invoke("anthropic:test", apiKey),
  testMiniMax: (payload) => ipcRenderer.invoke("minimax:test", payload),
  testGoogleTTS: (apiKey) => ipcRenderer.invoke("testGoogleTTS", apiKey),
  testPexels: (key) => ipcRenderer.invoke("pexels:test", key),
  testPixabay: (key) => ipcRenderer.invoke("pixabay:test", key),

  // --- 설정/시크릿 ---
  getSetting: (key) => ipcRenderer.invoke("settings:get", key),
  setSetting: (payload) => ipcRenderer.invoke("settings:set", payload),
  getSecret: (key) => ipcRenderer.invoke("secrets:get", key),
  setSecret: (payload) => ipcRenderer.invoke("secrets:set", payload),

  // --- LLM/생성 ---
  generateScript: (payload) => ipcRenderer.invoke("llm/generateScript", payload),

  // --- 오디오/자막 ---
  scriptToSrt: (payload) => ipcRenderer.invoke("script/toSrt", payload),
  ttsSynthesizeByScenes: (payload) => ipcRenderer.invoke("tts/synthesizeByScenes", payload),
  audioConcatScenes: (payload) => ipcRenderer.invoke("audio/concatScenes", payload),

  // --- 이미지 생성 ---
  generateThumbnails: (payload) => ipcRenderer.invoke("replicate:generate", payload),
  generateThumbnailsGoogleImagen3: (payload) => ipcRenderer.invoke("generateThumbnailsGoogleImagen3", payload),

  // --- 파일/저장 ---
  selectSrt: () => ipcRenderer.invoke("files/select", { type: "srt" }),
  selectMp3: () => ipcRenderer.invoke("files/select", { type: "mp3" }),
  saveUrlToFile: (payload) => ipcRenderer.invoke("file:save-url", payload),
  // 🔽 새로 추가: 대화창 없이 프로젝트에 바로 저장 (영상 등)
  saveUrlToProject: (payload) => ipcRenderer.invoke("files/saveUrlToProject", payload),
  saveBufferToProject: ({ category, fileName, buffer }) => ipcRenderer.invoke("files/saveToProject", { category, fileName, buffer }),
  readTextFile: (p) => ipcRenderer.invoke("files/readText", { path: p }),

  // --- 동영상 검색 ---
  stockSearch: (payload) => ipcRenderer.invoke("stock:search", payload),

  // 번역
  aiTranslateTerms: (payload) => ipcRenderer.invoke("ai:translateTerms", payload),
});
