// electron/preload.js
// ============================================================================
// 안전한 Renderer 브릿지 (contextBridge)
// - 모든 호출은 ipcRenderer.invoke 기반 (Promise 반환)
// - 이벤트 수신은 on/off 래퍼 제공
// - 기존 기능 유지 + (settings 변경 브로드캐스트, 파일 유틸) 추가
// ============================================================================

const { contextBridge, ipcRenderer } = require("electron");

console.log("[preload] loaded");

/* ----------------------------------------------------------------------------
 * helpers
 * --------------------------------------------------------------------------*/

/** 문자열/객체 혼용 인자 안전 처리 (예: cancel("job_123") 또는 { jobId:"job_123" }) */
function asPayloadJobId(jobIdOrPayload) {
  return typeof jobIdOrPayload === "string"
    ? { jobId: jobIdOrPayload }
    : jobIdOrPayload || {};
}

/** file:// 경로를 blob: URL로 변환 (video 재생용) */
async function pathToBlobUrlViaIPC(
  p,
  mimeFallback = "application/octet-stream"
) {
  if (!p) return null;
  const raw = String(p).replace(/^file:\/\//, ""); // file:// 제거
  const res = await ipcRenderer.invoke("files/readBinary", { path: raw });
  if (!res?.ok) throw new Error(res?.message || "read_failed");

  const b64 = res.data;
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  const mime = res.mime || mimeFallback;
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob); // blob:… URL
}

/** settings:changed 브로드캐스트 구독기 */
function onSettingsChanged(handler) {
  if (typeof handler !== "function") return () => {};
  const wrapped = (_e, payload) => {
    try {
      handler(payload);
    } catch (err) {
      console.warn("[preload] settings:changed handler error:", err);
    }
  };
  ipcRenderer.on("settings:changed", wrapped);
  // 반드시 해제 가능하도록 unsubscribe 반환
  return () => ipcRenderer.removeListener("settings:changed", wrapped);
}

/** files:downloaded 브로드캐스트 구독기 (다운로드 → 프로젝트 저장 완료) */
function onFileDownloaded(handler) {
  if (typeof handler !== "function") return () => {};
  const wrapped = (_e, payload) => {
    try {
      handler(payload); // { path, category, fileName }
    } catch (err) {
      console.warn("[preload] files:downloaded handler error:", err);
    }
  };
  ipcRenderer.on("files:downloaded", wrapped);
  // 언구독 함수 반환
  return () => ipcRenderer.removeListener("files:downloaded", wrapped);
}

/* ----------------------------------------------------------------------------
 * expose API
 * --------------------------------------------------------------------------*/
contextBridge.exposeInMainWorld("api", {
  // ==========================================================================
  // 공통 Invoke
  // ==========================================================================
  invoke: (channel, payload) => {
    console.log("[preload] invoke:", channel);
    return ipcRenderer.invoke(channel, payload);
  },

  // ==========================================================================
  // 시스템/헬스
  // ==========================================================================
  healthCheck: () => ipcRenderer.invoke("health:check"),

  // ==========================================================================
  // 설정/시크릿
  // ==========================================================================
  getSetting: (key) => ipcRenderer.invoke("settings:get", key),
  setSetting: (payload) => ipcRenderer.invoke("settings:set", payload),
  // 배치 저장(선택사항): [{key,value}, ...]
  setSettings: (items) => ipcRenderer.invoke("settings:setMany", items),
  // ✅ settings 변경 브로드캐스트 구독 추가
  onSettingsChanged,

  getSecret: (key) => ipcRenderer.invoke("secrets:get", key),
  setSecret: (payload) => ipcRenderer.invoke("secrets:set", payload),

  // ==========================================================================
  // 프로젝트 루트 (날짜 폴더)
  // ==========================================================================
  selectDatedProjectRoot: () =>
    ipcRenderer.invoke("files/selectDatedProjectRoot"),
  getProjectRoot: () => ipcRenderer.invoke("files/getProjectRoot"),

  // ==========================================================================
  // 파일 유틸 (신규 추가)
  // ==========================================================================
  /** ✅ 경로 존재 확인: {exists, isFile, isDir} */
  checkPathExists: (p) => ipcRenderer.invoke("files:exists", p),
  /** ✅ 윈도우 스타일 이름 제안: {dir, base, kind:"file"|"dir", ext?} → {name, fullPath} */
  nextAvailableName: (opts) =>
    ipcRenderer.invoke("files:nextAvailableName", opts),
  /** ✅ 오늘 날짜 "YYYY-MM-DD" */
  todayStr: () => ipcRenderer.invoke("files:todayStr"),
  /** ✅ 디렉터리 재귀 생성 */
  mkDirRecursive: (dirPath) =>
    ipcRenderer.invoke("fs:mkDirRecursive", { dirPath }),

  // ==========================================================================
  // 파일 선택/저장
  // ==========================================================================
  // SRT/MP3 파일 선택: files/select 우선 → 실패 시 pickers:* 폴백 (기존 로직 유지)
  selectSrt: () =>
    ipcRenderer
      .invoke("files/select", { type: "srt" })
      .catch(() => ipcRenderer.invoke("pickers:selectSrt")),
  selectMp3: () =>
    ipcRenderer
      .invoke("files/select", { type: "mp3" })
      .catch(() => ipcRenderer.invoke("pickers:selectMp3")),

  // 이미지/데이터 URL 저장(대화상자)
  saveUrlToFile: (payload) => ipcRenderer.invoke("file:save-url", payload),

  // 대화상자 없이 현재 프로젝트에 바로 저장 (영상 등 대용량)
  saveUrlToProject: (payload) =>
    ipcRenderer.invoke("files/saveUrlToProject", payload),

  // 버퍼를 프로젝트 폴더에 저장
  saveBufferToProject: ({ category, fileName, buffer }) =>
    ipcRenderer.invoke("files/saveToProject", { category, fileName, buffer }),

  // 텍스트 읽기 (SRT/일반 텍스트)
  readText: (fileOrOpts) => {
    const payload =
      typeof fileOrOpts === "string" ? { path: fileOrOpts } : fileOrOpts || {};
    return ipcRenderer.invoke("files/readText", payload);
  },
  // 호환 alias
  readTextFile: (p) => ipcRenderer.invoke("files/readText", { path: p }),

  // 로컬 파일 바이너리 읽기
  readBinary: (p) => ipcRenderer.invoke("files/readBinary", { path: p }),

  // 로컬 경로/파일URL → blob: URL 변환 (video 재생용)
  videoPathToUrl: (p) => pathToBlobUrlViaIPC(p),

  // ✅ 새로 추가: 다운로드 완료 브로드캐스트 구독
  onFileDownloaded,

  // ==========================================================================
  // LLM/분석/번역
  // ==========================================================================
  generateScript: (payload) =>
    ipcRenderer.invoke("llm/generateScript", payload),
  aiExtractKeywords: (payload) =>
    ipcRenderer.invoke("ai:extractKeywords", payload),
  aiTranslateTerms: (payload) =>
    ipcRenderer.invoke("ai:translateTerms", payload),
  imagefxAnalyze: (payload) => ipcRenderer.invoke("imagefx:analyze", payload),

  // ==========================================================================
  // 스톡/검색
  // ==========================================================================
  stockSearch: (payload) => ipcRenderer.invoke("stock:search", payload),

  // ==========================================================================
  // 스크립트/오디오/TTS
  // ==========================================================================
  scriptToSrt: (payload) => ipcRenderer.invoke("script/toSrt", payload),
  ttsSynthesizeByScenes: (payload) =>
    ipcRenderer.invoke("tts/synthesizeByScenes", payload),

  // 오디오: 길이 조회/병합 스텁
  getMp3Duration: (path) => ipcRenderer.invoke("audio/getDuration", { path }),
  audioConcatScenes: (payload) =>
    ipcRenderer.invoke("audio/concatScenes", payload),

  // ==========================================================================
  // 이미지 생성
  // ==========================================================================
  generateThumbnails: (payload) =>
    ipcRenderer.invoke("replicate:generate", payload),
  generateThumbnailsGoogleImagen3: (payload) =>
    ipcRenderer.invoke("generateThumbnailsGoogleImagen3", payload),

  // ==========================================================================
  // 테스트 채널들
  // ==========================================================================
  testOpenAI: (apiKey) => ipcRenderer.invoke("openai:test", apiKey),
  testReplicate: (token) => ipcRenderer.invoke("replicate:test", token),
  testAnthropic: (apiKey) => ipcRenderer.invoke("anthropic:test", apiKey),
  testMiniMax: (payload) => ipcRenderer.invoke("minimax:test", payload),
  testGoogleTTS: (apiKey) => ipcRenderer.invoke("testGoogleTTS", apiKey),
  testPexels: (key) => ipcRenderer.invoke("pexels:test", key),
  testPixabay: (key) => ipcRenderer.invoke("pixabay:test", key),

  // ==========================================================================
  // 프리뷰(초안 내보내기)
  // ==========================================================================
  /**
   * preview.compose(payload)
   * - payload: { scenes, cues, width, height, bitrateK, burnSubtitles, durationSec, jobId?, outputName? }
   * - return: { url, path, duration }
   */
  preview: {
    compose: (payload) => ipcRenderer.invoke("preview:compose", payload),

    /** preview.cancel("job_xxx" | {jobId}) */
    cancel: (jobIdOrPayload) =>
      ipcRenderer.invoke("preview:cancel", asPayloadJobId(jobIdOrPayload)),

    /** 진행률 수신 subscribe → unsubscribe 반환 */
    onProgress: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (_e, data) => handler(data);
      ipcRenderer.on("preview:progress", wrapped);
      return () => ipcRenderer.off("preview:progress", wrapped);
    },

    /** 특정 핸들러만 or 전체 해제 */
    offProgress: (handler) => {
      if (handler) ipcRenderer.off("preview:progress", handler);
      else ipcRenderer.removeAllListeners("preview:progress");
    },
  },
});
