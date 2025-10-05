// electron/ipc/video-download.js
// ============================================================================
// 영상 다운로드 IPC 핸들러 (최적화 버전) - FIXED
// - 키워드 기반 Pexels/Pixabay 영상 검색 및 다운로드
// - videoSaveFolder/video 경로에 저장
// - 기존 files/saveUrlToProject API 활용
// - 안정성 및 오류 처리 강화
// - BUGFIX: store.get 분해할당 제거로 private member 에러 해결
// - BUGFIX: axios 미임포트 추가
// ============================================================================

const { ipcMain } = require("electron");
const path = require("path");
const axios = require("axios"); // ✅ 누락된 임포트 추가
const https = require("https");
const http = require("http");
const fs = require("fs").promises;

const store = require("../services/store"); // ✅ 인스턴스를 그대로 사용 (분해할당 금지)
const { getSecret } = require("../services/secrets"); // keytar 기반 API 키 조회

// ---------------------------------------------------------------------------
// 취소 관리
// ---------------------------------------------------------------------------
let downloadCancelled = false;
let currentRequests = [];

function resetCancellation() {
  downloadCancelled = false;
  currentRequests = [];
}

function cancelDownload() {
  downloadCancelled = true;
  // 진행 중인 모든 HTTP 요청 중단
  currentRequests.forEach(req => {
    try {
      req.destroy();
    } catch (e) {
      console.warn("[취소] 요청 중단 실패:", e.message);
    }
  });
  currentRequests = [];
  console.log("[영상 다운로드] 취소 요청됨");
}

function isCancelled() {
  return downloadCancelled;
}

// ---------------------------------------------------------------------------
// 공통 유틸
// ---------------------------------------------------------------------------
function assertVideoSaveFolder() {
  const videoSaveFolder = store.get("videoSaveFolder"); // ✅ this 유지
  if (!videoSaveFolder || typeof videoSaveFolder !== "string" || videoSaveFolder.trim() === "") {
    throw new Error("영상 저장 폴더가 설정되지 않았습니다. 설정 > 기본 설정에서 영상 저장 폴더를 지정해주세요.");
  }
  return videoSaveFolder;
}

// ---------------------------------------------------------------------------
// 해상도 문자열을 픽셀로 변환
// ---------------------------------------------------------------------------
function parseResolution(resolution) {
  const resolutions = {
    "480p": { width: 854, height: 480, maxWidth: 1279, maxHeight: 719 },
    "720p": { width: 1280, height: 720, maxWidth: 1919, maxHeight: 1079 },
    "1080p": { width: 1920, height: 1080, maxWidth: 2559, maxHeight: 1439 },
    "1440p": { width: 2560, height: 1440, maxWidth: 9999, maxHeight: 9999 }
  };
  return resolutions[resolution] || resolutions["1080p"];
}

// ---------------------------------------------------------------------------
// 파일 크기를 MB로 변환
// ---------------------------------------------------------------------------
function bytesToMB(bytes) {
  return bytes / (1024 * 1024);
}

// ---------------------------------------------------------------------------
// 화면 비율 계산 및 확인
// ---------------------------------------------------------------------------
function checkAspectRatio(width, height, targetRatio) {
  if (!width || !height || targetRatio === "any") return true;

  const ratio = width / height;
  const tolerance = 0.1; // 10% 허용 오차

  const ratios = {
    "16:9": 16/9,
    "4:3": 4/3,
    "1:1": 1,
    "9:16": 9/16
  };

  const target = ratios[targetRatio];
  if (!target) return true;

  return Math.abs(ratio - target) <= tolerance;
}

// ---------------------------------------------------------------------------
// 비디오 필터링 및 정렬 (옵션 기반)
// ---------------------------------------------------------------------------
function filterAndSortVideos(videos, options = {}) {
  const {
    maxFileSize = 20, // 20MB (1080p 영상 기준)
    minResolution = "1080p", // 1080p FHD (선명한 고화질)
    aspectRatio = "16:9" // 16:9 와이드 (표준 비율)
  } = options;

  const minRes = parseResolution(minResolution);

  // 필터링
  let filtered = videos.filter(video => {
    // 해상도 범위 확인 (최소~최대)
    if (video.width < minRes.width || video.height < minRes.height) {
      return false;
    }
    if (video.width > minRes.maxWidth || video.height > minRes.maxHeight) {
      return false;
    }

    // 최대 파일 크기 확인
    if (video.size > 0 && bytesToMB(video.size) > maxFileSize) {
      return false;
    }

    // 화면 비율 확인
    if (!checkAspectRatio(video.width, video.height, aspectRatio)) {
      return false;
    }

    return true;
  });

  // 간단한 정렬: 해상도 높은 순 (최고 화질 우선)
  filtered.sort((a, b) => {
    const aRes = a.width * a.height;
    const bRes = b.width * b.height;
    return bRes - aRes;
  });

  return filtered;
}

// ---------------------------------------------------------------------------
// Pexels 영상 검색
// ---------------------------------------------------------------------------
async function searchPexelsVideos(apiKey, query, perPage = 3, options = {}) {
  try {
    if (!apiKey) throw new Error("Pexels API 키가 없습니다.");

    const response = await axios.get("https://api.pexels.com/videos/search", {
      headers: { Authorization: apiKey },
      params: {
        query,
        per_page: Math.min(perPage * 3, 30), // 필터링을 위해 더 많이 가져옴
        locale: "ko-KR",
      },
      timeout: 15000,
    });

    const allVideos = [];
    for (const video of response.data?.videos || []) {
      const mp4Files = (video.video_files || [])
        .filter((file) => file.file_type === "video/mp4" && file.link);

      for (const file of mp4Files) {
        allVideos.push({
          provider: "pexels",
          id: video.id,
          url: file.link,
          filename: `pexels-${video.id}-${file.width}x${file.height}.mp4`,
          width: file.width || 0,
          height: file.height || 0,
          size: file.file_size || 0,
          quality: file.quality || "",
          thumbnail: video.image || `https://via.placeholder.com/160x90/6366f1/white?text=${encodeURIComponent('Pexels')}`,
        });
      }
    }

    // 옵션에 따라 필터링 및 정렬 후 개수 제한
    const filtered = filterAndSortVideos(allVideos, options);
    return filtered.slice(0, perPage);
  } catch (error) {
    console.error(`[Pexels 검색] "${query}" 실패:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Pixabay 영상 검색
// ---------------------------------------------------------------------------
async function searchPixabayVideos(apiKey, query, perPage = 3, options = {}) {
  try {
    if (!apiKey) throw new Error("Pixabay API 키가 없습니다.");

    const response = await axios.get("https://pixabay.com/api/videos/", {
      params: {
        key: apiKey,
        q: query,
        per_page: Math.min(perPage * 3, 60), // 필터링을 위해 더 많이 가져옴
        video_type: "film",
        safesearch: "true",
      },
      timeout: 15000,
    });

    const allVideos = [];
    for (const hit of response.data?.hits || []) {
      const videoSizes = ["large", "medium", "small", "tiny"];
      for (const size of videoSizes) {
        const videoFile = hit.videos?.[size];
        if (videoFile?.url) {
          // Pixabay 썸네일 우선순위: webformatURL > previewURL > userImageURL
          const thumbnail = hit.webformatURL || hit.previewURL || hit.userImageURL || `https://via.placeholder.com/160x90/02BE6E/white?text=${encodeURIComponent('Pixabay')}`;

          allVideos.push({
            provider: "pixabay",
            id: hit.id,
            url: videoFile.url,
            filename: `pixabay-${hit.id}-${videoFile.width}x${videoFile.height}.mp4`,
            width: videoFile.width || 0,
            height: videoFile.height || 0,
            size: videoFile.size || 0,
            quality: size,
            thumbnail,
            tags: (hit.tags || "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          });
        }
      }
    }

    // 옵션에 따라 필터링 및 정렬 후 개수 제한
    const filtered = filterAndSortVideos(allVideos, options);
    return filtered.slice(0, perPage);
  } catch (error) {
    console.error(`[Pixabay 검색] "${query}" 실패:`, error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 안전하고 최적화된 영상 다운로드
// - videoSaveFolder/video 경로 사용
// ---------------------------------------------------------------------------
async function downloadVideoOptimized(url, filename, onProgress) {
  try {
    console.log(`[영상 다운로드] 시작: ${filename}`);

    const videoSaveFolder = assertVideoSaveFolder();
    const videoPath = path.join(videoSaveFolder, "video");
    const filePath = path.join(videoPath, filename);

    // 디렉토리 생성
    await fs.mkdir(videoPath, { recursive: true });

    // 캐시 체크
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        console.log(`[영상 다운로드] 파일이 이미 존재: ${filename}`);
        return {
          success: true,
          filePath,
          filename,
          size: stats.size,
          cached: true,
        };
      }
    } catch {
      // 없으면 계속
    }

    // 취소 확인
    if (isCancelled()) {
      throw new Error("다운로드가 취소되었습니다");
    }

    // 다운로드
    const { buffer, size } = await new Promise((resolve, reject) => {
      const protocol = url.startsWith("https:") ? https : http;

      const request = protocol.get(url, (response) => {
        // 리다이렉트
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return downloadVideoOptimized(response.headers.location, filename, onProgress).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedSize = 0;
        const chunks = [];

        response.on("data", (chunk) => {
          // 취소 확인
          if (isCancelled()) {
            request.destroy();
            reject(new Error("다운로드가 취소되었습니다"));
            return;
          }

          chunks.push(chunk);
          downloadedSize += chunk.length;

          if (onProgress && totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress);
          }
        });

        response.on("end", () => {
          // 취소 확인
          if (isCancelled()) {
            reject(new Error("다운로드가 취소되었습니다"));
            return;
          }
          resolve({ buffer: Buffer.concat(chunks), size: downloadedSize });
        });

        response.on("error", reject);
      });

      // 요청 추적
      currentRequests.push(request);

      request.on("error", reject);
      request.on("close", () => {
        // 완료된 요청 제거
        const index = currentRequests.indexOf(request);
        if (index > -1) {
          currentRequests.splice(index, 1);
        }
      });

      request.setTimeout(60000, () => {
        request.destroy();
        reject(new Error("다운로드 타임아웃 (60초)"));
      });
    });

    await fs.writeFile(filePath, buffer);
    console.log(`[영상 다운로드] 완료: ${filename} (${Math.round(size / 1024 / 1024)}MB)`);

    return {
      success: true,
      filePath,
      filename,
      size,
      cached: false,
    };
  } catch (error) {
    console.error(`[영상 다운로드] 실패: ${filename}`, error.message);
    return {
      success: false,
      filename,
      error: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// 지원되는 영상 검색 프로바이더 목록
// ---------------------------------------------------------------------------
const SUPPORTED_PROVIDERS = {
  pexels: {
    name: "Pexels",
    searchFunction: searchPexelsVideos,
    apiKeyName: "pexelsApiKey",
  },
  pixabay: {
    name: "Pixabay",
    searchFunction: searchPixabayVideos,
    apiKeyName: "pixabayApiKey",
  },
  // unsplash 등 추가 가능
};

// ---------------------------------------------------------------------------
// 키워드별 영상 검색 및 다운로드
// ---------------------------------------------------------------------------
async function downloadVideosForKeywords(keywords, provider, options = {}, onProgress) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error("키워드가 제공되지 않았습니다.");
  }
  if (!provider || !SUPPORTED_PROVIDERS[provider]) {
    const supportedList = Object.keys(SUPPORTED_PROVIDERS).join(", ");
    throw new Error(`지원되지 않는 프로바이더입니다. 지원 목록: ${supportedList}`);
  }

  assertVideoSaveFolder(); // 미리 검증

  const providerInfo = SUPPORTED_PROVIDERS[provider];
  const apiKey = await getSecret(providerInfo.apiKeyName); // ✅ keytar에서 API 키 조회
  if (!apiKey) {
    throw new Error(`${providerInfo.name} API 키가 설정되지 않았습니다. 설정 > API 설정에서 API 키를 입력해주세요.`);
  }

  console.log(`[영상 다운로드] ${keywords.length}개 키워드로 ${provider} 검색 및 다운로드 시작`);

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < keywords.length; i++) {
    // 취소 확인
    if (isCancelled()) {
      console.log("[영상 다운로드] 취소됨");
      break;
    }

    const keyword = String(keywords[i] || "").trim();
    if (!keyword) {
      console.warn(`[영상 다운로드] 빈 키워드 스킵: 인덱스 ${i}`);
      continue;
    }

    try {
      onProgress?.({
        keyword,
        status: "searching",
        progress: 0,
        totalKeywords: keywords.length,
        currentIndex: i,
      });

      console.log(`[영상 다운로드] ${i + 1}/${keywords.length}: "${keyword}" 검색 중...`);

      // 검색 재시도
      let videos = null;
      let attempts = 0;
      const maxAttempts = 2;

      while (!videos && attempts < maxAttempts) {
        attempts++;
        try {
          const videosPerKeyword = options.videosPerKeyword || 1;
          videos = await providerInfo.searchFunction(apiKey, keyword, videosPerKeyword, options);
        } catch (e) {
          console.warn(`[영상 다운로드] "${keyword}" 검색 실패 (시도 ${attempts}/${maxAttempts}):`, e.message);
          if (attempts >= maxAttempts) throw e;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (!videos?.length) {
        results.push({ keyword, success: false, error: "검색 결과 없음" });
        failureCount++;
        onProgress?.({
          keyword,
          status: "failed",
          progress: 100,
          totalKeywords: keywords.length,
          currentIndex: i,
          error: "검색 결과 없음",
        });
        continue;
      }

      // 여러 영상이 있으면 각각 다운로드
      for (let videoIndex = 0; videoIndex < videos.length; videoIndex++) {
        const video = videos[videoIndex];
        // 일관된 키워드 처리: 항상 원본 키워드 유지, 인덱스는 파일명에만 적용
        const videoKeyword = keyword;
        const videoSuffix = videos.length > 1 ? `_${videoIndex + 1}` : "";

        onProgress?.({
          keyword: videoKeyword,
          status: "downloading",
          progress: 0,
          totalKeywords: keywords.length,
          currentIndex: i,
          filename: video.filename,
          videoIndex: videoIndex + 1,
          totalVideos: videos.length,
          videoSuffix,
        });

        // 새로운 파일명 구조: 키워드_프로바이더_해상도.mp4
        const safeKeyword = keyword.replace(/[^\w가-힣-]/g, "_");
        const keywordNumber = videoIndex + 1; // 1부터 시작
        const keywordName = videos.length > 1 ? `${safeKeyword}${keywordNumber}` : safeKeyword;
        const resolution = `${video.width}x${video.height}`;
        const finalFilename = `${keywordName}_${video.provider}_${resolution}.mp4`;

        const downloadResult = await downloadVideoOptimized(video.url, finalFilename, (progress) => {
          onProgress?.({
            keyword: videoKeyword,
            status: "downloading",
            progress,
            totalKeywords: keywords.length,
            currentIndex: i,
            filename: video.filename,
            videoIndex: videoIndex + 1,
            totalVideos: videos.length,
            videoSuffix,
          });
        });

        results.push({
          keyword: videoKeyword,
          ...downloadResult,
          provider: video.provider,
          originalFilename: video.filename,
          width: video.width,
          height: video.height,
          size: video.size,
          quality: video.quality,
          videoSuffix, // UI에서 구분할 수 있도록
        });

        if (downloadResult.success) {
          successCount++;
          console.log(`[영상 다운로드] "${keyword}${videoSuffix}" 완료 ✓ (${video.width}x${video.height}, ${Math.round(video.size / 1024 / 1024)}MB)`);
        } else {
          failureCount++;
          console.warn(`[영상 다운로드] "${keyword}${videoSuffix}" 실패: ${downloadResult.error}`);
        }

        onProgress?.({
          keyword: videoKeyword,
          status: downloadResult.success ? "completed" : "failed",
          progress: 100,
          totalKeywords: keywords.length,
          currentIndex: i,
          filename: downloadResult.filename,
          error: downloadResult.success ? undefined : downloadResult.error,
          videoIndex: videoIndex + 1,
          totalVideos: videos.length,
          videoSuffix,
          // 영상 정보 추가
          width: video.width,
          height: video.height,
          size: video.size,
          quality: video.quality,
          thumbnail: video.thumbnail,
          originalFilename: video.filename
        });
      }
    } catch (error) {
      console.error(`[영상 다운로드] "${keyword}" 처리 실패:`, error.message);
      failureCount++;
      results.push({ keyword, success: false, error: error.message });

      onProgress?.({
        keyword,
        status: "failed",
        progress: 0,
        totalKeywords: keywords.length,
        currentIndex: i,
        error: error.message,
      });
    }

    if (i < keywords.length - 1) {
      await new Promise((r) => setTimeout(r, 500)); // rate limit 완화
    }
  }

  console.log(`[영상 다운로드] 전체 완료: 성공 ${successCount}개, 실패 ${failureCount}개`);

  return {
    results,
    summary: {
      total: keywords.length,
      success: successCount,
      failed: failureCount,
      videoSaveFolder: store.get("videoSaveFolder"),
      provider,
    },
  };
}

// ---------------------------------------------------------------------------
// IPC 핸들러 등록
// ---------------------------------------------------------------------------
function registerVideoDownloadIPC() {
  ipcMain.removeHandler("video:downloadByKeywords");

  ipcMain.handle("video:downloadByKeywords", async (event, payload) => {
    const startTime = Date.now();
    try {
      const { keywords, provider = "pexels", options = {} } = payload || {};

      if (!Array.isArray(keywords) || keywords.length === 0) {
        return {
          success: false,
          error: "키워드가 제공되지 않았습니다.",
          results: [],
          summary: { total: 0, success: 0, failed: 0 },
        };
      }

      const cleanedKeywords = [...new Set(keywords.map((k) => String(k || "").trim()).filter(Boolean))];

      if (cleanedKeywords.length === 0) {
        return {
          success: false,
          error: "유효한 키워드가 없습니다.",
          results: [],
          summary: { total: 0, success: 0, failed: 0 },
        };
      }

      console.log(`[영상 다운로드 IPC] 시작: ${cleanedKeywords.length}개 키워드, ${provider} 프로바이더`);
      console.log(`[영상 다운로드 IPC] 옵션:`, options);

      // 다운로드 시작 시 취소 플래그 리셋
      resetCancellation();

      const result = await downloadVideosForKeywords(cleanedKeywords, provider, options, (progress) => {
        try {
          event.sender.send("video:downloadProgress", progress);
        } catch (e) {
          console.warn("[영상 다운로드] 진행률 브로드캐스트 실패:", e.message);
        }
      });

      const duration = Date.now() - startTime;
      console.log(`[영상 다운로드 IPC] 완료: ${duration}ms 소요`);

      return { success: true, results: result.results, summary: result.summary, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[영상 다운로드 IPC] 전체 프로세스 실패 (${duration}ms):`, error.message);
      return {
        success: false,
        error: error.message,
        results: [],
        summary: { total: 0, success: 0, failed: 0 },
        duration,
      };
    }
  });

  // 취소 핸들러 등록
  ipcMain.removeHandler("video:cancelDownload");
  ipcMain.handle("video:cancelDownload", async () => {
    try {
      cancelDownload();
      return { success: true };
    } catch (error) {
      console.error("[영상 다운로드 취소 IPC] 실패:", error.message);
      return { success: false, error: error.message };
    }
  });

  console.log("[ipc] video-download: 최적화된 핸들러 등록 완료 ✓");
}

module.exports = { registerVideoDownloadIPC };
