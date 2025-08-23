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
  // 시스템/헬스
  // =========================
  healthCheck: () => ipcRenderer.invoke("health:check"),

  // =========================
  // 설정/시크릿
  // =========================
  getSetting: (key) => ipcRenderer.invoke("settings:get", key),
  setSetting: (payload) => ipcRenderer.invoke("settings:set", payload),
  getSecret: (key) => ipcRenderer.invoke("secrets:get", key),
  setSecret: (payload) => ipcRenderer.invoke("secrets:set", payload),

  // =========================
  // 프로젝트 루트 (날짜 폴더)
  // =========================
  selectDatedProjectRoot: () => ipcRenderer.invoke("files/selectDatedProjectRoot"),
  getProjectRoot: () => ipcRenderer.invoke("files/getProjectRoot"),

  // =========================
  // 파일 선택/저장
  // =========================
  // SRT/MP3 파일 선택: files/select 사용 → 실패 시 pickers:select* 폴백
  selectSrt: () => ipcRenderer.invoke("files/select", { type: "srt" }).catch(() => ipcRenderer.invoke("pickers:selectSrt")),
  selectMp3: () => ipcRenderer.invoke("files/select", { type: "mp3" }).catch(() => ipcRenderer.invoke("pickers:selectMp3")),

  // 이미지/데이터 URL 저장(대화상자)
  saveUrlToFile: (payload) => ipcRenderer.invoke("file:save-url", payload),

  // 대화상자 없이 현재 프로젝트에 바로 저장 (영상 등 대용량)
  saveUrlToProject: (payload) => ipcRenderer.invoke("files/saveUrlToProject", payload),

  // 버퍼를 프로젝트 폴더에 저장
  saveBufferToProject: ({ category, fileName, buffer }) => ipcRenderer.invoke("files/saveToProject", { category, fileName, buffer }),

  // 텍스트 읽기 (SRT/일반 텍스트) — 문자열 경로/옵션 객체 모두 지원
  readText: (fileOrOpts) => {
    const payload = typeof fileOrOpts === "string" ? { path: fileOrOpts } : fileOrOpts || {};
    return ipcRenderer.invoke("files/readText", payload);
  },
  // 호환 alias
  readTextFile: (p) => ipcRenderer.invoke("files/readText", { path: p }),

  // =========================
  // LLM/분석/번역
  // =========================
  generateScript: (payload) => ipcRenderer.invoke("llm/generateScript", payload),
  aiExtractKeywords: (payload) => ipcRenderer.invoke("ai:extractKeywords", payload),
  aiTranslateTerms: (payload) => ipcRenderer.invoke("ai:translateTerms", payload),
  imagefxAnalyze: (payload) => ipcRenderer.invoke("imagefx:analyze", payload),

  // =========================
  // 스톡/검색
  // =========================
  stockSearch: (payload) => ipcRenderer.invoke("stock:search", payload),

  // =========================
  // 스크립트/오디오/TTS
  // =========================
  scriptToSrt: (payload) => ipcRenderer.invoke("script/toSrt", payload),
  ttsSynthesizeByScenes: (payload) => ipcRenderer.invoke("tts/synthesizeByScenes", payload),

  // 오디오: 길이 조회/병합 스텁
  getMp3Duration: (path) => ipcRenderer.invoke("audio/getDuration", { path }),
  audioConcatScenes: (payload) => ipcRenderer.invoke("audio/concatScenes", payload),

  // =========================
  // 이미지 생성
  // =========================
  generateThumbnails: (payload) => ipcRenderer.invoke("replicate:generate", payload),
  generateThumbnailsGoogleImagen3: (payload) => ipcRenderer.invoke("generateThumbnailsGoogleImagen3", payload),

  // =========================
  // 테스트 채널들
  // =========================
  testOpenAI: (apiKey) => ipcRenderer.invoke("openai:test", apiKey),
  testReplicate: (token) => ipcRenderer.invoke("replicate:test", token),
  testAnthropic: (apiKey) => ipcRenderer.invoke("anthropic:test", apiKey),
  testMiniMax: (payload) => ipcRenderer.invoke("minimax:test", payload),
  testGoogleTTS: (apiKey) => ipcRenderer.invoke("testGoogleTTS", apiKey),
  testPexels: (key) => ipcRenderer.invoke("pexels:test", key),
  testPixabay: (key) => ipcRenderer.invoke("pixabay:test", key),
});
