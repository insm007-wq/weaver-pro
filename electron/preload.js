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
  testOpenAI: (apiKey) => {
    console.log("[preload] invoke openai:test");
    return ipcRenderer.invoke("openai:test", apiKey);
  },
  testReplicate: (token) => {
    console.log("[preload] invoke replicate:test");
    return ipcRenderer.invoke("replicate:test", token);
  },
  testAnthropic: (apiKey) => {
    console.log("[preload] invoke anthropic:test");
    return ipcRenderer.invoke("anthropic:test", apiKey);
  },
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
  generateScript: (payload) => {
    console.log("[preload] invoke llm/generateScript");
    return ipcRenderer.invoke("llm/generateScript", payload);
  },

  // =========================
  // Script / Audio
  // =========================
  scriptToSrt: (payload) => {
    console.log("[preload] invoke script/toSrt");
    return ipcRenderer.invoke("script/toSrt", payload);
  },
  ttsSynthesizeByScenes: (payload) => {
    console.log("[preload] invoke tts/synthesizeByScenes");
    return ipcRenderer.invoke("tts/synthesizeByScenes", payload);
  },
  audioConcatScenes: (payload) => {
    console.log("[preload] invoke audio/concatScenes");
    return ipcRenderer.invoke("audio/concatScenes", payload);
  },

  // =========================
  // Image Generation
  // =========================
  generateThumbnails: (payload) => {
    console.log("[preload] invoke replicate:generate");
    return ipcRenderer.invoke("replicate:generate", payload);
  },
  generateThumbnailsGoogleImagen3: (payload) => {
    console.log("[preload] invoke generateThumbnailsGoogleImagen3");
    return ipcRenderer.invoke("generateThumbnailsGoogleImagen3", payload);
  },

  // =========================
  // File Pickers
  // =========================
  selectSrt: () => {
    console.log("[preload] invoke files/select (srt)");
    return ipcRenderer.invoke("files/select", { type: "srt" });
  },
  selectMp3: () => {
    console.log("[preload] invoke files/select (mp3)");
    return ipcRenderer.invoke("files/select", { type: "mp3" });
  },

  // =========================
  // Canva (브라우저 열기 & 다운로드 훅)
  // =========================
  /**
   * Canva 검색 창 열기 (사용자 로그인/검색/다운로드 클릭)
   * payload: { query?: string, media?: "videos"|"images", saveDir?: string }
   */
  canvaOpenBrowser: (payload) => {
    console.log("[preload] invoke canva/openBrowser");
    return ipcRenderer.invoke("canva/openBrowser", payload);
  },
  /**
   * Canva에서 다운로드 완료 이벤트 수신
   * 사용법:
   *   const off = window.api.onCanvaDownloaded((d)=>{ ... });
   *   // unmount 시 off() 호출
   */
  onCanvaDownloaded: (cb) => {
    const listener = (_e, data) => cb?.(data);
    ipcRenderer.on("canva:downloaded", listener);
    return () => ipcRenderer.removeListener("canva:downloaded", listener);
  },

  // =========================
  // File I/O
  // =========================
  /** URL을 파일로 저장 */
  saveUrlToFile: (payload) => {
    console.log("[preload] invoke file:save-url");
    return ipcRenderer.invoke("file:save-url", payload);
  },
  /** 프로젝트 폴더에 버퍼 저장 */
  saveBufferToProject: ({ category, fileName, buffer }) => {
    console.log("[preload] invoke files/saveToProject", category, fileName);
    return ipcRenderer.invoke("files/saveToProject", {
      category,
      fileName,
      buffer,
    });
  },
  /** ✅ 텍스트 파일 읽기 (SRT 키워드 추출용) */
  readTextFile: (path) => {
    console.log("[preload] invoke files/readText");
    return ipcRenderer.invoke("files/readText", { path });
  },
});
