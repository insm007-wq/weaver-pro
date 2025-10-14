// electron/preload.js
// ============================================================================
// 안전한 Renderer 브릿지 (contextBridge)
// - 모든 호출은 ipcRenderer.invoke 기반 (Promise 반환)
// - settings/files 브로드캐스트 on/once/off 지원
// - video path → blob:URL 변환에 캐시/해제 추가(메모리 누수 방지)
// ============================================================================

const { contextBridge, ipcRenderer } = require("electron");

const DBG = process.env.DEBUG_PRELOAD === "1";
const dlog = (...a) => DBG && console.log("[preload]", ...a);
console.log("[preload] loaded");

/* ----------------------------------------------------------------------------
 * helpers
 * --------------------------------------------------------------------------*/

/** 문자열/객체 혼용 인자 안전 처리 (예: cancel("job_123") 또는 { jobId:"job_123" }) */
function asPayloadJobId(jobIdOrPayload) {
  return typeof jobIdOrPayload === "string" ? { jobId: jobIdOrPayload } : jobIdOrPayload || {};
}

/** ipcRenderer.on 래퍼: 핸들러 예외 방어 + unsubscribe 반환 */
function onChannel(channel, handler) {
  if (typeof handler !== "function") return () => {};
  const wrapped = (_e, payload) => {
    try {
      handler(payload);
    } catch (err) {
      console.warn(`[preload] ${channel} handler error:`, err);
    }
  };
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

/** once 래퍼 */
function onceChannel(channel, handler) {
  if (typeof handler !== "function") return () => {};
  const wrapped = (_e, payload) => {
    try {
      handler(payload);
    } catch (err) {
      console.warn(`[preload] ${channel} once handler error:`, err);
    }
  };
  ipcRenderer.once(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

/* ----------------------------------------------------------------------------
 * ✨ 이벤트 버스 on/once/off (handler 매핑 유지 → 정확히 off 가능)
 * --------------------------------------------------------------------------*/
const __handlerMap = new Map(); // event -> Map<origHandler, wrapped>
function busOn(event, handler) {
  if (typeof handler !== "function") return;
  let m = __handlerMap.get(event);
  if (!m) {
    m = new Map();
    __handlerMap.set(event, m);
  }
  if (m.has(handler)) return; // 중복 방지
  const wrapped = (_e, payload) => {
    try {
      handler(payload);
    } catch (err) {
      console.warn(`[preload] bus "${event}" handler error:`, err);
    }
  };
  m.set(handler, wrapped);
  ipcRenderer.on(event, wrapped);
}
function busOnce(event, handler) {
  if (typeof handler !== "function") return;
  const wrapped = (_e, payload) => {
    try {
      handler(payload);
    } catch (err) {
      console.warn(`[preload] bus "${event}" once handler error:`, err);
    } finally {
      busOff(event, handler);
    }
  };
  let m = __handlerMap.get(event);
  if (!m) {
    m = new Map();
    __handlerMap.set(event, m);
  }
  m.set(handler, wrapped);
  ipcRenderer.on(event, wrapped);
}
function busOff(event, handler) {
  const m = __handlerMap.get(event);
  if (!m) {
    // fallback
    if (handler) ipcRenderer.removeListener(event, handler);
    else ipcRenderer.removeAllListeners(event);
    return;
  }
  if (handler) {
    const wrapped = m.get(handler);
    if (wrapped) {
      ipcRenderer.removeListener(event, wrapped);
      m.delete(handler);
    }
    if (!m.size) __handlerMap.delete(event);
  } else {
    // 모든 핸들러 제거
    for (const wrapped of m.values()) {
      ipcRenderer.removeListener(event, wrapped);
    }
    __handlerMap.delete(event);
  }
}

/* ----------------------------------------------------------------------------
 * blob: URL 캐시 (video 재생용) — 동일 경로 재호출 시 재사용, 필요 시 해제 가능
 * --------------------------------------------------------------------------*/
const blobUrlCache = new Map();
/**
 * file:// 또는 로컬 경로 → blob: URL
 * - 같은 경로는 캐시된 blob URL 재사용
 * - { cache:false }로 캐시 무시 가능
 */
async function pathToBlobUrlViaIPC(p, mimeFallback = "application/octet-stream", opts = {}) {
  if (!p) return null;
  const { cache = true } = opts;
  const key = String(p).replace(/^file:\/\//, "");

  if (cache && blobUrlCache.has(key)) {
    return blobUrlCache.get(key);
  }

  const res = await ipcRenderer.invoke("files/readBinary", { path: key });
  if (!res?.ok) throw new Error(res?.message || "read_failed");

  const b64 = res.data;
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

  const mime = res.mime || mimeFallback;
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);

  if (cache) blobUrlCache.set(key, url);
  return url;
}

function revokeVideoUrl(p) {
  if (!p) return;
  const key = String(p).replace(/^file:\/\//, "");
  const u = blobUrlCache.get(key);
  if (u) {
    try {
      URL.revokeObjectURL(u);
    } catch {}
    blobUrlCache.delete(key);
  }
}

function revokeAllBlobUrls() {
  for (const u of blobUrlCache.values()) {
    try {
      URL.revokeObjectURL(u);
    } catch {}
  }
  blobUrlCache.clear();
}

// 윈도우 종료 시 자동 정리
window.addEventListener("beforeunload", revokeAllBlobUrls);

/* ----------------------------------------------------------------------------
 * settings / files 브로드캐스트 구독기
 * --------------------------------------------------------------------------*/
function onSettingsChanged(handler) {
  return onChannel("settings:changed", handler);
}
function onceSettingsChanged(handler) {
  return onceChannel("settings:changed", handler);
}

function onFileDownloaded(handler) {
  // payload: { path, category, fileName }
  return onChannel("files:downloaded", handler);
}
function onceFileDownloaded(handler) {
  return onceChannel("files:downloaded", handler);
}

/* ----------------------------------------------------------------------------
 * expose API
 * --------------------------------------------------------------------------*/
contextBridge.exposeInMainWorld("api", {
  // ========================================================================
  // 공통 Invoke
  // ========================================================================
  invoke: (channel, payload) => {
    dlog("invoke:", channel);
    return ipcRenderer.invoke(channel, payload);
  },

  // ========================================================================
  // ✨ 이벤트 버스
  // ========================================================================
  // 사용법:
  //   const onProg = (p)=>{...}; window.api.on('progress', onProg)
  //   window.api.off('progress', onProg)
  //   window.api.once('foo', (p)=>{...})
  on: (event, handler) => busOn(event, handler),
  once: (event, handler) => busOnce(event, handler),
  off: (event, handler) => busOff(event, handler),

  // ========================================================================
  // 시스템/헬스
  // ========================================================================
  healthCheck: () => ipcRenderer.invoke("health:check"),

  // ========================================================================
  // 설정/시크릿
  // ========================================================================
  getSetting: (key) => ipcRenderer.invoke("settings:get", key),
  setSetting: (payload) => ipcRenderer.invoke("settings:set", payload),
  setSettings: (items) => ipcRenderer.invoke("settings:setMany", items),
  onSettingsChanged,
  onceSettingsChanged,
  getSecret: (key) => ipcRenderer.invoke("secrets:get", key),
  setSecret: (payload) => ipcRenderer.invoke("secrets:set", payload),

  // ========================================================================
  // 프로젝트 루트 (날짜 폴더)
  // ========================================================================
  selectDatedProjectRoot: () => ipcRenderer.invoke("files/selectDatedProjectRoot"),
  selectMediaFile: (options) => ipcRenderer.invoke("files/selectMediaFile", options),
  getProjectRoot: () => ipcRenderer.invoke("files/getProjectRoot"),

  // ========================================================================
  // 파일 유틸
  // ========================================================================
  checkPathExists: (p) => ipcRenderer.invoke("files:exists", p),
  listDirectory: (dirPath) => ipcRenderer.invoke("files:listDirectory", dirPath),
  nextAvailableName: (opts) => ipcRenderer.invoke("files:nextAvailableName", opts),
  todayStr: () => ipcRenderer.invoke("files:todayStr"),
  mkDirRecursive: (dirPath) => ipcRenderer.invoke("fs:mkDirRecursive", { dirPath }),

  // ========================================================================
  // 파일 선택/저장
  // ========================================================================
  selectSrt: () => ipcRenderer.invoke("files/select", { type: "srt" }).catch(() => ipcRenderer.invoke("pickers:selectSrt")),
  selectMp3: () => ipcRenderer.invoke("files/select", { type: "mp3" }).catch(() => ipcRenderer.invoke("pickers:selectMp3")),

  saveUrlToFile: (payload) => ipcRenderer.invoke("file:save-url", payload),
  saveUrlToProject: (payload) => ipcRenderer.invoke("files/saveUrlToProject", payload),
  saveBufferToProject: ({ category, fileName, buffer }) => ipcRenderer.invoke("files/saveToProject", { category, fileName, buffer }),

  readText: (fileOrOpts) => {
    const payload = typeof fileOrOpts === "string" ? { path: fileOrOpts } : fileOrOpts || {};
    return ipcRenderer.invoke("files/readText", payload);
  },
  readTextFile: (p) => ipcRenderer.invoke("files/readText", { path: p }),
  readBinary: (p) => ipcRenderer.invoke("files/readBinary", { path: p }),
  writeText: ({ filePath, content }) => ipcRenderer.invoke("files:writeText", { filePath, content }),

  // 로컬 경로/파일URL → blob: URL 변환 (video 재생용)
  videoPathToUrl: (p, opts) => pathToBlobUrlViaIPC(p, undefined, opts),
  revokeVideoUrl,
  revokeAllBlobUrls,

  // 다운로드 완료 브로드캐스트 구독
  onFileDownloaded,
  onceFileDownloaded,

  // ========================================================================
  // LLM/분석/번역
  // ========================================================================
  generateScript: (payload) => ipcRenderer.invoke("llm/generateScript", payload),
  aiExtractKeywords: (payload) => ipcRenderer.invoke("ai:extractKeywords", payload),
  aiTranslateTerms: (payload) => ipcRenderer.invoke("ai:translateTerms", payload),
  imagefxAnalyze: (payload) => ipcRenderer.invoke("imagefx:analyze", payload),

  // ========================================================================
  // 스톡/검색
  // ========================================================================
  stockSearch: (payload) => ipcRenderer.invoke("stock:search", payload),

  // ========================================================================
  // 영상 다운로드
  // ========================================================================
  downloadVideosByKeywords: (payload) => ipcRenderer.invoke("video:downloadByKeywords", payload),

  // 영상 다운로드 취소
  cancelVideoDownload: () => ipcRenderer.invoke("video:cancelDownload"),

  // 영상 다운로드 진행률 수신
  onVideoDownloadProgress: (handler) => {
    if (typeof handler !== "function") return () => {};
    const wrapped = (_e, payload) => {
      try {
        handler(payload);
      } catch (err) {
        console.warn("[preload] video:downloadProgress handler error:", err);
      }
    };
    ipcRenderer.on("video:downloadProgress", wrapped);
    return () => ipcRenderer.removeListener("video:downloadProgress", wrapped);
  },

  // ========================================================================
  // 스크립트/오디오/TTS
  // ========================================================================
  scriptToSrt: (payload) => ipcRenderer.invoke("script/toSrt", payload),
  getSubtitlePath: (payload) => ipcRenderer.invoke("script:getSubtitlePath", payload),
  ttsSynthesizeByScenes: (payload) => ipcRenderer.invoke("tts/synthesizeByScenes", payload),
  ttsRegenerateScene: (payload) => ipcRenderer.invoke("tts:regenerateScene", payload),
  getMp3Duration: (path) => ipcRenderer.invoke("audio/getDuration", { path }),
  audioConcatScenes: (payload) => ipcRenderer.invoke("audio/concatScenes", payload),
  audioMergeFiles: ({ audioFiles, outputPath }) =>
    ipcRenderer.invoke("audio/mergeFiles", { audioFiles, outputPath }),

  // ========================================================================
  // 이미지 생성
  // ========================================================================
  generateThumbnails: (payload) => ipcRenderer.invoke("replicate:generate", payload),
  expandThumbnailPrompt: (userInput) => ipcRenderer.invoke("thumbnail:expand-prompt", userInput),
  expandScenePrompt: (sceneText) => ipcRenderer.invoke("scene:expand-prompt", sceneText),

  // ========================================================================
  // 캐시 관리
  // ========================================================================
  clearCache: () => ipcRenderer.invoke("cache:clear"),
  cacheStats: () => ipcRenderer.invoke("cache:stats"),

  // ========================================================================
  // 테스트 채널들
  // ========================================================================
  testReplicate: (token) => ipcRenderer.invoke("replicate:test", token),
  testAnthropic: (apiKey) => ipcRenderer.invoke("anthropic:test", apiKey),
  testGoogleTTS: (apiKey) => ipcRenderer.invoke("testGoogleTTS", apiKey),
  testPexels: (key) => ipcRenderer.invoke("pexels:test", key),
  testPixabay: (key) => ipcRenderer.invoke("pixabay:test", key),

  // ========================================================================
  // 프리뷰(미디어 다운로드)
  // ========================================================================
  preview: {
    /**
     * preview.compose(payload)
     * - payload: { scenes, cues, width, height, bitrateK, burnSubtitles, durationSec, jobId?, outputName? }
     * - return: { url, path, duration }
     */
    compose: (payload) => ipcRenderer.invoke("preview:compose", payload),

    /** preview.cancel("job_xxx" | {jobId}) */
    cancel: (jobIdOrPayload) => ipcRenderer.invoke("preview:cancel", asPayloadJobId(jobIdOrPayload)),

    /** 진행률 수신 subscribe → unsubscribe 반환 */
    onProgress: (handler) => {
      if (typeof handler !== "function") return () => {};
      const wrapped = (_e, data) => {
        try {
          handler(data);
        } catch (e) {
          console.warn("[preload] preview:progress handler error:", e);
        }
      };
      ipcRenderer.on("preview:progress", wrapped);
      return () => ipcRenderer.off("preview:progress", wrapped);
    },

    /** 특정 핸들러만 or 전체 해제 */
    offProgress: (handler) => {
      if (handler) ipcRenderer.off("preview:progress", handler);
      else ipcRenderer.removeAllListeners("preview:progress");
    },
  },

  // ========================================================================
  // 비디오 내보내기 (씬 기반 전체 프로젝트 합성)
  // ========================================================================
  exportVideo: (scenes) => ipcRenderer.invoke("video:export", scenes),

  // 비디오 내보내기 취소
  // ========================================================================
  cancelExport: () => ipcRenderer.invoke("video:cancelExport"),

});

// ============================================================================
// ✨ Electron API (기존 window.electron 호환성을 위해 별도 노출)  
// ============================================================================
contextBridge.exposeInMainWorld("electron", {
  // 플랫폼 정보
  platform: process.platform,
  
  // 기본 ipcRenderer 호출
  ipcRenderer: {
    invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  },

  // shell 기능 (IPC를 통해 처리)
  shell: {
    openPath: (path) => ipcRenderer.invoke("shell:openPath", path),
  },


  // 프로젝트 관리
  project: {
    create: ({ topic, options }) => ipcRenderer.invoke("project:create", { topic, options }),
    list: () => ipcRenderer.invoke("project:list"),
    load: (projectId) => ipcRenderer.invoke("project:load", projectId),
    current: () => ipcRenderer.invoke("project:current"),
    delete: (projectId) => ipcRenderer.invoke("project:delete", projectId),
    openOutputFolder: () => ipcRenderer.invoke("project:openOutputFolder"),
    getFilePath: ({ category, filename }) => ipcRenderer.invoke("project:getFilePath", { category, filename }),
    update: (updates) => ipcRenderer.invoke("project:update", updates),
  },

  // FFmpeg 영상 합성
  ffmpeg: {
    compose: ({ audioFiles, imageFiles, outputPath, options }) =>
      ipcRenderer.invoke("ffmpeg:compose", { audioFiles, imageFiles, outputPath, options }),
    check: () => ipcRenderer.invoke("ffmpeg:check"),
  },

  // 음성 파일 관련 API (ffmpeg 모듈에서 제공)
  audio: {
    getDuration: ({ filePath }) => ipcRenderer.invoke("audio:getDuration", { filePath }),
    getDurations: ({ filePaths }) => ipcRenderer.invoke("audio:getDurations", { filePaths }),
  },
});
