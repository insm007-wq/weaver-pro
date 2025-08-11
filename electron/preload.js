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
});
