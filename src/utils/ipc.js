// src/utils/ipc.js
// IPC 호출 래퍼 (테스트/로깅/모킹용으로 중앙집중)

export const ipcCall = (channel, payload) =>
  window.api.invoke(channel, payload);
