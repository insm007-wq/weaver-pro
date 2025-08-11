// preload.js
const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] loaded");

// 렌더러에 노출할 안전한 API (IPC 기반)
contextBridge.exposeInMainWorld("api", {
  /**
   * Replicate API 연결 테스트
   * @param {string} token - Replicate API Token
   * @returns {Promise<{ok: boolean, count?: number, message?: any, status?: number}>}
   */
  testReplicate: (token) => {
    console.log("[preload] invoke replicate:test");
    return ipcRenderer.invoke("replicate:test", token);
  },

  /**
   * Anthropic API 연결 테스트
   * @param {string} apiKey - Anthropic API Key
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

  /**
   * 헬스 체크 (3개 API 상태 한 번에 확인)
   * @returns {Promise<{ ok: boolean, timestamp: number, anthropic: object, replicate: object, minimax: object }>}
   */
  healthCheck: () => {
    console.log("[preload] invoke health:check");
    return ipcRenderer.invoke("health:check");
  },

  /**
   * 일반 설정 가져오기 (electron-store)
   * @param {string} key
   * @returns {Promise<any>}
   */
  getSetting: (key) => {
    console.log("[preload] invoke settings:get", key);
    return ipcRenderer.invoke("settings:get", key);
  },

  /**
   * 일반 설정 저장하기 (electron-store)
   * @param {{ key: string, value: any }} payload
   * @returns {Promise<{ok: boolean}>}
   */
  setSetting: (payload) => {
    console.log("[preload] invoke settings:set", payload.key);
    return ipcRenderer.invoke("settings:set", payload);
  },

  /**
   * 민감 정보 가져오기 (keytar)
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  getSecret: (key) => {
    console.log("[preload] invoke secrets:get", key);
    return ipcRenderer.invoke("secrets:get", key);
  },

  /**
   * 민감 정보 저장하기 (keytar)
   * @param {{ key: string, value: string }} payload
   * @returns {Promise<{ok: boolean}>}
   */
  setSecret: (payload) => {
    console.log("[preload] invoke secrets:set", payload.key);
    return ipcRenderer.invoke("secrets:set", payload);
  },

  /**
   * 썸네일 생성 (Replicate 실행)
   * @param {{ prompt: string, count: number, mode: 'dramatic'|'calm', referenceImage?: string, token?: string }} payload
   * @returns {Promise<{ok: boolean, images?: string[], message?: any}>}
   */
  generateThumbnails: (payload) => {
    console.log("[preload] invoke replicate:generate");
    return ipcRenderer.invoke("replicate:generate", payload);
  },
});
