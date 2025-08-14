// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] loaded");

/**
 * 안전한 렌더러 브릿지
 * - 모든 호출은 ipcRenderer.invoke 기반 (Promise 반환)
 * - 필요 채널은 invoke로 직접 호출하거나, 아래 편의 메서드를 사용
 */
contextBridge.exposeInMainWorld("api", {
  // =========================
  // ✅ 공통 Invoke 브릿지
  // =========================
  /**
   * 메인 프로세스 IPC 핸들러를 직접 호출합니다.
   * 예) window.api.invoke("llm/generateScript", {...})
   * @param {string} channel
   * @param {any} payload
   * @returns {Promise<any>}
   */
  invoke: (channel, payload) => {
    console.log("[preload] invoke:", channel);
    return ipcRenderer.invoke(channel, payload);
  },

  // =========================
  // Image Analyzer (Anthropic)
  // =========================
  /**
   * 이미지/설명을 보내 분석 프롬프트 생성
   * @param {{ filePath?: string, description?: string }} payload
   */
  imagefxAnalyze: (payload) => {
    console.log("[preload] invoke imagefx:analyze");
    return ipcRenderer.invoke("imagefx:analyze", payload);
  },

  // =========================
  // Connectivity / Health
  // =========================
  /** 헬스 체크 (Anthropic / Replicate / MiniMax) */
  healthCheck: () => {
    console.log("[preload] invoke health:check");
    return ipcRenderer.invoke("health:check");
  },

  // =========================
  // API Connectivity Tests
  // =========================
  /** OpenAI API 연결 테스트 */
  testOpenAI: (apiKey) => {
    console.log("[preload] invoke openai:test");
    return ipcRenderer.invoke("openai:test", apiKey);
  },
  /** Replicate API 연결 테스트 */
  testReplicate: (token) => {
    console.log("[preload] invoke replicate:test");
    return ipcRenderer.invoke("replicate:test", token);
  },
  /** Anthropic API 연결 테스트 */
  testAnthropic: (apiKey) => {
    console.log("[preload] invoke anthropic:test");
    return ipcRenderer.invoke("anthropic:test", apiKey);
  },
  /** MiniMax API 연결 테스트 */
  testMiniMax: (payload) => {
    console.log("[preload] invoke minimax:test");
    return ipcRenderer.invoke("minimax:test", payload);
  },
  /** Google TTS 연결 테스트(있으면 사용, 없으면 메인에서 무시 가능) */
  testGoogleTTS: (apiKey) => {
    console.log("[preload] invoke testGoogleTTS");
    return ipcRenderer.invoke("testGoogleTTS", apiKey);
  },

  // =========================
  // Settings (electron-store)
  // =========================
  getSetting: (key) => {
    console.log("[preload] invoke settings:get", key);
    return ipcRenderer.invoke("settings:get", key);
  },
  setSetting: (payload) => {
    console.log("[preload] invoke settings:set", payload?.key);
    return ipcRenderer.invoke("settings:set", payload);
  },

  // =========================
  // Secrets (keytar)
  // =========================
  getSecret: (key) => {
    console.log("[preload] invoke secrets:get", key);
    return ipcRenderer.invoke("secrets:get", key);
  },
  setSecret: (payload) => {
    console.log("[preload] invoke secrets:set", payload?.key);
    return ipcRenderer.invoke("secrets:set", payload);
  },

  // =========================
  // LLM (대본 생성)
  // =========================
  /** OpenAI GPT-5/mini 기반 대본 생성 */
  generateScript: (payload) => {
    console.log("[preload] invoke llm/generateScript");
    return ipcRenderer.invoke("llm/generateScript", payload);
  },

  // =========================
  // Script / Audio
  // =========================
  /** 자막(SRT) 변환 */
  scriptToSrt: (payload) => {
    console.log("[preload] invoke script/toSrt");
    return ipcRenderer.invoke("script/toSrt", payload);
  },
  /** 장면별 합성(텍스트→음성) */
  ttsSynthesizeByScenes: (payload) => {
    console.log("[preload] invoke tts/synthesizeByScenes");
    return ipcRenderer.invoke("tts/synthesizeByScenes", payload);
  },
  /** 장면 오디오 병합 */
  audioConcatScenes: (payload) => {
    console.log("[preload] invoke audio/concatScenes");
    return ipcRenderer.invoke("audio/concatScenes", payload);
  },

  // =========================
  // Image Generation
  // =========================
  /** Replicate 썸네일 생성 */
  generateThumbnails: (payload) => {
    console.log("[preload] invoke replicate:generate");
    return ipcRenderer.invoke("replicate:generate", payload);
  },
  /** Google Imagen3 썸네일 생성 */
  generateThumbnailsGoogleImagen3: (payload) => {
    console.log("[preload] invoke generateThumbnailsGoogleImagen3");
    return ipcRenderer.invoke("generateThumbnailsGoogleImagen3", payload);
  },

  // =========================
  // File I/O
  // =========================
  /** 이미지 URL/데이터URL을 파일로 저장 (시스템 저장 대화상자 표시) */
  saveUrlToFile: (payload) => {
    console.log("[preload] invoke file:save-url");
    return ipcRenderer.invoke("file:save-url", payload);
  },
  /** 프로젝트 폴더에 버퍼 저장 (ScriptVoiceGenerator에서 사용) */
  saveBufferToProject: ({ category, fileName, buffer }) => {
    console.log("[preload] invoke files/saveToProject", category, fileName);
    return ipcRenderer.invoke("files/saveToProject", {
      category,
      fileName,
      buffer,
    });
  },
});
