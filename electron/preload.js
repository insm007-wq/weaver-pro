// preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] loaded");

/**
 * 안전한 렌더러 브릿지
 * - 모든 호출은 ipcRenderer.invoke 기반 (Promise 반환)
 * - 인자/반환 타입은 JSDoc로 문서화
 */
contextBridge.exposeInMainWorld("api", {
  // ---------------------------
  // Image Analyzer (Anthropic)
  // ---------------------------
  /**
   * 이미지/설명을 보내 분석 프롬프트를 생성
   * @param {{ filePath?: string, description?: string }} payload
   * @returns {Promise<{ok: boolean, english?: string, korean?: string, message?: string, raw?: string}>}
   */
  imagefxAnalyze: (payload) => {
    console.log("[preload] invoke imagefx:analyze");
    return ipcRenderer.invoke("imagefx:analyze", payload);
  },

  // ---------------------------
  // Connectivity / Health
  // ---------------------------
  /**
   * 헬스 체크 (Anthropic / Replicate / MiniMax)
   * @returns {Promise<{ ok: boolean, timestamp: number, anthropic: object, replicate: object, minimax: object }>}
   */
  healthCheck: () => {
    console.log("[preload] invoke health:check");
    return ipcRenderer.invoke("health:check");
  },

  // ---------------------------
  // API Connectivity Tests
  // ---------------------------
  /**
   * Replicate API 연결 테스트
   * @param {string} token
   * @returns {Promise<{ok: boolean, count?: number, message?: any, status?: number}>}
   */
  testReplicate: (token) => {
    console.log("[preload] invoke replicate:test");
    return ipcRenderer.invoke("replicate:test", token);
  },

  /**
   * Anthropic API 연결 테스트
   * @param {string} apiKey
   * @returns {Promise<{ok: boolean, model?: string, message?: any, status?: number}>}
   */
  testAnthropic: (apiKey) => {
    console.log("[preload] invoke anthropic:test");
    return ipcRenderer.invoke("anthropic:test", apiKey);
  },

  /**
   * MiniMax API 연결 테스트
   * @param {{ key: string, groupId: string }} payload
   * @returns {Promise<{ok: boolean, model?: string, reply?: string, message?: any, status?: number}>}
   */
  testMiniMax: (payload) => {
    console.log("[preload] invoke minimax:test");
    return ipcRenderer.invoke("minimax:test", payload);
  },

  // ---------------------------
  // Settings (electron-store)
  // ---------------------------
  /**
   * 일반 설정 가져오기
   * @param {string} key
   * @returns {Promise<any>}
   */
  getSetting: (key) => {
    console.log("[preload] invoke settings:get", key);
    return ipcRenderer.invoke("settings:get", key);
  },

  /**
   * 일반 설정 저장하기
   * @param {{ key: string, value: any }} payload
   * @returns {Promise<{ok: boolean}>}
   */
  setSetting: (payload) => {
    console.log("[preload] invoke settings:set", payload?.key);
    return ipcRenderer.invoke("settings:set", payload);
  },

  // ---------------------------
  // Secrets (keytar)
  // ---------------------------
  /**
   * 비밀 값 가져오기
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  getSecret: (key) => {
    console.log("[preload] invoke secrets:get", key);
    return ipcRenderer.invoke("secrets:get", key);
  },

  /**
   * 비밀 값 저장하기
   * @param {{ key: string, value: string }} payload
   * @returns {Promise<{ok: boolean}>}
   */
  setSecret: (payload) => {
    console.log("[preload] invoke secrets:set", payload?.key);
    return ipcRenderer.invoke("secrets:set", payload);
  },

  // ---------------------------
  // Image Generation (Replicate)
  // ---------------------------
  /**
   * 썸네일 생성
   * @param {{ prompt: string, count: number, mode: 'dramatic'|'calm', referenceImage?: string, token?: string }} payload
   * @returns {Promise<{ok: boolean, images?: string[], message?: any}>}
   */
  generateThumbnails: (payload) => {
    console.log("[preload] invoke replicate:generate");
    return ipcRenderer.invoke("replicate:generate", payload);
  },

  // ---------------------------
  // File I/O (Save Dialog)
  // ---------------------------
  /**
   * 이미지 URL/데이터URL을 파일로 저장 (시스템 저장 대화상자 표시)
   * @param {{ url: string, suggestedName?: string }} payload
   * @returns {Promise<{ok: boolean, path?: string, message?: string}>}
   */
  saveUrlToFile: (payload) => {
    console.log("[preload] invoke file:save-url");
    return ipcRenderer.invoke("file:save-url", payload);
  },
});
