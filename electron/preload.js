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
   * 일반 설정값 가져오기 (electron-store)
   * @param {string} key - 저장 키 (예: "miniMaxGroupId")
   * @returns {Promise<any>} - 저장된 값 또는 undefined
   */
  getSetting: (key) => {
    console.log("[preload] invoke settings:get", key);
    return ipcRenderer.invoke("settings:get", key);
  },

  /**
   * 일반 설정값 저장 (electron-store)
   * @param {string} key - 저장 키
   * @param {any} value - 저장할 값
   * @returns {Promise<{ok: boolean}>}
   */
  setSetting: (key, value) => {
    console.log("[preload] invoke settings:set", key);
    return ipcRenderer.invoke("settings:set", { key, value });
  },

  /**
   * 민감 정보 가져오기 (keytar)
   * @param {string} key - 시크릿 키 (예: "anthropicKey", "replicateKey", "miniMaxKey")
   * @returns {Promise<string|null>} - 저장된 시크릿 또는 null
   */
  getSecret: (key) => {
    console.log("[preload] invoke secrets:get", key);
    return ipcRenderer.invoke("secrets:get", key);
  },

  /**
   * 민감 정보 저장 (keytar)
   * @param {string} key - 시크릿 키
   * @param {string} value - 저장할 시크릿
   * @returns {Promise<{ok: boolean}>}
   */
  setSecret: (key, value) => {
    console.log("[preload] invoke secrets:set", key);
    return ipcRenderer.invoke("secrets:set", { key, value });
  },
});
