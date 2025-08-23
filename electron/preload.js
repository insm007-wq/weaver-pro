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
  // Canva
  // =========================
  canva: {
    /** OAuth 로그인 (dot 우선, slash 호환) */
    login: async () => {
      try {
        return await ipcRenderer.invoke("canva.login");
      } catch {
        return ipcRenderer.invoke("canva/login");
      }
    },

    /** 수동 검색/다운로드 창 열기 (dot 우선, slash 호환) */
    openBrowser: async (payload) => {
      try {
        return await ipcRenderer.invoke("canva.openBrowser", payload);
      } catch {
        return ipcRenderer.invoke("canva/openBrowser", payload);
      }
    },

    /** 자동 스캔 & CDN 다운로드 (dot/slash 모두 등록) */
    scanAndDownload: async (opts) => {
      try {
        return await ipcRenderer.invoke("canva.scanAndDownload", opts);
      } catch {
        return ipcRenderer.invoke("canva/scanAndDownload", opts);
      }
    },

    /** 다운로드/검색 진행 이벤트 수신 (off 함수 반환) */
    onProgress: (cb) => {
      if (typeof cb !== "function") return () => {};
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("canva:progress", handler);
      ipcRenderer.on("canva/progress", handler);
      return () => {
        ipcRenderer.removeListener("canva:progress", handler);
        ipcRenderer.removeListener("canva/progress", handler);
      };
    },
  },

  /** 레거시 별칭: 기존 코드가 window.api.canvaOpenBrowser를 호출해도 동작 */
  canvaOpenBrowser: async (payload) => {
    try {
      return await ipcRenderer.invoke("canva.openBrowser", payload);
    } catch {
      return ipcRenderer.invoke("canva/openBrowser", payload);
    }
  },

  /** 다운로드 완료 이벤트 수신 (off 함수 반환) */
  onCanvaDownloaded: (cb) => {
    if (typeof cb !== "function") return () => {};
    const listener = (_e, data) => cb(data);
    ipcRenderer.on("canva:downloaded", listener);
    return () => ipcRenderer.removeListener("canva:downloaded", listener);
  },

  /** 진행 이벤트 수신(레거시 최상위 헬퍼, canva.onProgress와 동일 채널) */
  onCanvaProgress: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("canva:progress", handler);
    ipcRenderer.on("canva/progress", handler);
    return () => {
      ipcRenderer.removeListener("canva:progress", handler);
      ipcRenderer.removeListener("canva/progress", handler);
    };
  },

  // =========================
  // 공통 Invoke
  // =========================
  invoke: (channel, payload) => {
    console.log("[preload] invoke:", channel);
    return ipcRenderer.invoke(channel, payload);
  },

  // =========================
  // 나머지 기존 브릿지
  // =========================
  imagefxAnalyze: (payload) => ipcRenderer.invoke("imagefx:analyze", payload),
  healthCheck: () => ipcRenderer.invoke("health:check"),
  testOpenAI: (apiKey) => ipcRenderer.invoke("openai:test", apiKey),
  testReplicate: (token) => ipcRenderer.invoke("replicate:test", token),
  testAnthropic: (apiKey) => ipcRenderer.invoke("anthropic:test", apiKey),
  testMiniMax: (payload) => ipcRenderer.invoke("minimax:test", payload),
  testGoogleTTS: (apiKey) => ipcRenderer.invoke("testGoogleTTS", apiKey),

  getSetting: (key) => ipcRenderer.invoke("settings:get", key),
  setSetting: (payload) => ipcRenderer.invoke("settings:set", payload),

  getSecret: (key) => ipcRenderer.invoke("secrets:get", key),
  setSecret: (payload) => ipcRenderer.invoke("secrets:set", payload),

  generateScript: (payload) => ipcRenderer.invoke("llm/generateScript", payload),

  scriptToSrt: (payload) => ipcRenderer.invoke("script/toSrt", payload),
  ttsSynthesizeByScenes: (payload) => ipcRenderer.invoke("tts/synthesizeByScenes", payload),
  audioConcatScenes: (payload) => ipcRenderer.invoke("audio/concatScenes", payload),

  generateThumbnails: (payload) => ipcRenderer.invoke("replicate:generate", payload),
  generateThumbnailsGoogleImagen3: (payload) => ipcRenderer.invoke("generateThumbnailsGoogleImagen3", payload),

  selectSrt: () => ipcRenderer.invoke("files/select", { type: "srt" }),
  selectMp3: () => ipcRenderer.invoke("files/select", { type: "mp3" }),

  saveUrlToFile: (payload) => ipcRenderer.invoke("file:save-url", payload),
  saveBufferToProject: ({ category, fileName, buffer }) => ipcRenderer.invoke("files/saveToProject", { category, fileName, buffer }),

  readTextFile: (p) => ipcRenderer.invoke("files/readText", { path: p }),
});
