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
// 에러 메시지 새니타이제이션 (프로바이더 정보 제거)
// ---------------------------------------------------------------------------
function sanitizeErrorMessage(errorMessage) {
  if (!errorMessage || typeof errorMessage !== 'string') return '처리 중 오류가 발생했습니다.';

  // 프로바이더 이름 제거
  let sanitized = errorMessage
    .replace(/Pexels/gi, '미디어 서비스')
    .replace(/Pixabay/gi, '미디어 서비스')
    .replace(/Replicate/gi, 'AI 서비스')
    .replace(/Flux Schnell/gi, 'AI 모델')
    .replace(/OpenAI/gi, 'AI 서비스')
    .replace(/API 키가 없습니다/gi, '서비스 설정이 필요합니다')
    .replace(/API 키가 설정되지 않았습니다/gi, '서비스 설정이 필요합니다');

  // 지원 목록 제거 (예: "지원되지 않는 프로바이더입니다. 지원 목록: pexels, pixabay")
  sanitized = sanitized.replace(/지원 목록:\s*[^\.]+/gi, '');

  // 빈 메시지 방지
  if (!sanitized.trim()) {
    return '처리 중 오류가 발생했습니다.';
  }

  return sanitized.trim();
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
          filename: `${video.id}-${file.width}x${file.height}.mp4`,
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
            filename: `${hit.id}-${videoFile.width}x${videoFile.height}.mp4`,
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
// - maxFileSize 실시간 체크 및 스킵 처리
// ---------------------------------------------------------------------------
async function downloadVideoOptimized(url, filename, onProgress, maxFileSize = 20) {
  try {
    const videoSaveFolder = assertVideoSaveFolder();
    const videoPath = path.join(videoSaveFolder, "video");
    const filePath = path.join(videoPath, filename);

    // 디렉토리 생성
    await fs.mkdir(videoPath, { recursive: true });

    // 캐시 체크
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
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
      throw new Error("cancelled");
    }

    // 다운로드
    const { buffer, size, skipped } = await new Promise((resolve, reject) => {
      const protocol = url.startsWith("https:") ? https : http;

      const request = protocol.get(url, (response) => {
        // 리다이렉트
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return downloadVideoOptimized(response.headers.location, filename, onProgress, maxFileSize).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        const maxBytes = maxFileSize * 1024 * 1024;

        // 전체 크기를 알 수 있고 이미 초과한 경우 즉시 스킵
        if (totalSize > 0 && totalSize > maxBytes) {
          request.destroy();
          return resolve({ buffer: null, size: totalSize, skipped: true });
        }

        let downloadedSize = 0;
        const chunks = [];
        let speedCheckTime = Date.now();
        let lastCheckSize = 0;
        let slowServerDetected = false;

        response.on("data", (chunk) => {
          // 취소 확인
          if (isCancelled()) {
            request.destroy();
            reject(new Error("cancelled"));
            return;
          }

          downloadedSize += chunk.length;

          // 실시간 크기 체크 - 초과 시 즉시 중단
          if (downloadedSize > maxBytes) {
            request.destroy();
            return resolve({ buffer: null, size: downloadedSize, skipped: true });
          }

          // ⭐ 5초마다 다운로드 속도 체크 (느린 서버 감지)
          const now = Date.now();
          const elapsedMs = now - speedCheckTime;

          if (elapsedMs >= 5000 && !slowServerDetected) {
            const downloadedInCheck = downloadedSize - lastCheckSize;
            const speedKBps = downloadedInCheck / (elapsedMs / 1000) / 1024; // KB/s

            // 5초에 500KB 미만 = 100KB/s 이하 = 느린 서버
            if (downloadedInCheck < 500 * 1024 && elapsedMs >= 5000) {
              console.warn(`[다운로드 속도 낮음] ${filename}: ${speedKBps.toFixed(1)}KB/s (< 100KB/s) → 스킵`);
              slowServerDetected = true;
              request.destroy();
              return resolve({
                buffer: null,
                size: downloadedSize,
                skipped: true,
                skipReason: `다운로드 속도 너무 느림 (${speedKBps.toFixed(1)}KB/s 이하)`
              });
            }

            // 속도 체크 리셋
            speedCheckTime = now;
            lastCheckSize = downloadedSize;
          }

          chunks.push(chunk);

          if (onProgress && totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress);
          }
        });

        response.on("end", () => {
          // 취소 확인
          if (isCancelled()) {
            reject(new Error("cancelled"));
            return;
          }
          resolve({ buffer: Buffer.concat(chunks), size: downloadedSize, skipped: false });
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

      // ⭐ 타임아웃 60초 → 15초로 단축
      request.setTimeout(15000, () => {
        request.destroy();
        reject(new Error("다운로드 타임아웃 (15초)"));
      });
    });

    // 스킵된 경우 처리
    if (skipped) {
      const skipReason = buffer?.skipReason || `파일 크기 초과 (${bytesToMB(size).toFixed(1)}MB > ${maxFileSize}MB)`;
      return {
        success: false,
        filename,
        error: skipReason,
        skipped: true,
        size,
      };
    }

    // ✅ 파일에 쓰기
    await fs.writeFile(filePath, buffer);

    // ✅ 디스크 동기화: 파일이 완전히 디스크에 저장될 때까지 대기
    try {
      const fd = await fs.open(filePath, 'r');
      await fd.sync();
      await fd.close();
    } catch (syncError) {
      console.warn(`[${filename}] fsync 실패: ${syncError.message} (파일은 쓰여짐)`);
      // fsync 실패해도 파일은 쓰여졌으므로 계속 진행
    }

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
// 안전하고 최적화된 사진 다운로드
// - videoSaveFolder/images 경로 사용
// - Stream 기반 쓰기 (메모리 효율)
// ---------------------------------------------------------------------------
async function downloadPhotoOptimized(url, filename, onProgress) {
  try {
    const videoSaveFolder = assertVideoSaveFolder();
    const imagesPath = path.join(videoSaveFolder, "images");
    const filePath = path.join(imagesPath, filename);

    // 디렉토리 생성
    await fs.mkdir(imagesPath, { recursive: true });

    // 캐시 체크
    try {
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
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
      throw new Error("cancelled");
    }

    // 다운로드
    const { buffer, size } = await new Promise((resolve, reject) => {
      const protocol = url.startsWith("https:") ? https : http;

      const request = protocol.get(url, (response) => {
        // 리다이렉트
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return downloadPhotoOptimized(response.headers.location, filename, onProgress).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        }

        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedSize = 0;
        const chunks = [];
        let speedCheckTime = Date.now();
        let lastCheckSize = 0;
        let slowServerDetected = false;

        response.on("data", (chunk) => {
          // 취소 확인
          if (isCancelled()) {
            request.destroy();
            reject(new Error("cancelled"));
            return;
          }

          downloadedSize += chunk.length;

          // ⭐ 5초마다 다운로드 속도 체크 (느린 서버 감지)
          const now = Date.now();
          const elapsedMs = now - speedCheckTime;

          if (elapsedMs >= 5000 && !slowServerDetected) {
            const downloadedInCheck = downloadedSize - lastCheckSize;
            const speedKBps = downloadedInCheck / (elapsedMs / 1000) / 1024; // KB/s

            // 5초에 500KB 미만 = 100KB/s 이하 = 느린 서버
            if (downloadedInCheck < 500 * 1024 && elapsedMs >= 5000) {
              console.warn(`[사진 다운로드 속도 낮음] ${filename}: ${speedKBps.toFixed(1)}KB/s (< 100KB/s) → 스킵`);
              slowServerDetected = true;
              request.destroy();
              return reject(new Error(`다운로드 속도 너무 느림 (${speedKBps.toFixed(1)}KB/s 이하)`));
            }

            // 속도 체크 리셋
            speedCheckTime = now;
            lastCheckSize = downloadedSize;
          }

          chunks.push(chunk);

          if (onProgress && totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            onProgress(progress);
          }
        });

        response.on("end", () => {
          // 취소 확인
          if (isCancelled()) {
            reject(new Error("cancelled"));
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

      // ⭐ 타임아웃 60초 → 15초로 단축
      request.setTimeout(15000, () => {
        request.destroy();
        reject(new Error("다운로드 타임아웃 (15초)"));
      });
    });

    // ✅ 파일에 쓰기
    await fs.writeFile(filePath, buffer);

    // ✅ 디스크 동기화: 파일이 완전히 디스크에 저장될 때까지 대기
    try {
      const fd = await fs.open(filePath, 'r');
      await fd.sync();
      await fd.close();
    } catch (syncError) {
      console.warn(`[${filename}] fsync 실패: ${syncError.message} (파일은 쓰여짐)`);
      // fsync 실패해도 파일은 쓰여졌으므로 계속 진행
    }

    return {
      success: true,
      filePath,
      filename,
      size,
      cached: false,
    };
  } catch (error) {
    console.error(`[사진 다운로드] 실패: ${filename}`, error.message);
    return {
      success: false,
      filename,
      error: error.message,
    };
  }
}

// ---------------------------------------------------------------------------
// AI 이미지 생성 및 다운로드 (Replicate Flux Schnell)
// - videoSaveFolder/images 경로에 저장
// ---------------------------------------------------------------------------
const {
  resolveLatestVersionId,
  createReplicate
} = require("../services/replicateClient");

/**
 * 텍스트 정규화 및 키워드 추출 (videoAssignment.js와 동일)
 */
function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywordsFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const words = normalized.split(' ')
    .filter(word => word.length > 1)
    .filter(Boolean);

  return words;
}

async function generateAndDownloadAIImage(keyword, onProgress) {
  try {
    // Replicate API 키 가져오기
    const replicateKey = await getSecret("replicateKey");
    if (!replicateKey) {
      throw new Error("Replicate API 키가 설정되지 않았습니다. 설정 > API 설정에서 Replicate API 키를 입력해주세요.");
    }

    onProgress?.(10); // 키 확인 완료

    // ✅ 썸네일 생성기와 동일한 방식: AI를 사용해서 한글 키워드를 영어 장면 프롬프트로 변환
    let finalPrompt = `${keyword}, photorealistic scene illustration, cinematic composition, natural lighting, detailed background, 4K quality`;

    try {
      const { expandKeywordToScenePrompt } = require("./llm/anthropic");
      const expandedPrompt = await expandKeywordToScenePrompt(keyword);

      if (expandedPrompt) {
        finalPrompt = expandedPrompt;
      }
    } catch (error) {
      console.warn(`[AI 이미지 생성] 키워드 확장 오류, 폴백 사용:`, error);
    }

    // Flux Schnell 모델 버전 확인
    const slug = "black-forest-labs/flux-schnell";
    const versionId = await resolveLatestVersionId(slug, replicateKey);
    if (!versionId) {
      throw new Error("Flux Schnell 모델 버전을 확인할 수 없습니다.");
    }

    onProgress?.(20); // 모델 버전 확인 완료

    // Replicate 클라이언트 생성
    const replicate = createReplicate(replicateKey);

    // 이미지 생성 요청
    let prediction = await replicate.predictions.create({
      version: versionId,
      input: {
        prompt: finalPrompt,
        num_outputs: 1,
        aspect_ratio: "16:9",
      },
    });

    onProgress?.(30); // 생성 요청 완료

    // 폴링 (최대 2분)
    const maxTries = 120;
    let tries = 0;

    while (
      ["starting", "processing", "queued"].includes(prediction.status) &&
      tries < maxTries
    ) {
      if (tries % 5 === 0) {
        const progressPercent = 30 + Math.min(50, Math.round((tries / maxTries) * 50));
        onProgress?.(progressPercent);
      }

      await new Promise((r) => setTimeout(r, 1000));
      prediction = await replicate.predictions.get(prediction.id);
      tries++;

      // 취소 확인
      if (isCancelled()) {
        throw new Error("cancelled");
      }
    }

    if (tries >= maxTries) {
      throw new Error("AI 이미지 생성 타임아웃 (2분 초과)");
    }

    if (prediction.status !== "succeeded") {
      const errorMsg = prediction.error || "알 수 없는 오류";
      throw new Error(`AI 이미지 생성 실패: ${errorMsg}`);
    }

    onProgress?.(80); // 생성 완료

    // 생성된 이미지 URL 추출
    const output = prediction.output;
    const imageUrl = Array.isArray(output) ? output[0] : output;

    if (!imageUrl || typeof imageUrl !== "string") {
      throw new Error("생성된 이미지 URL을 찾을 수 없습니다.");
    }

    // ✅ 이미지 자동 할당과 동일: 항상 webp로 저장
    const fileExtension = 'webp';

    // 이미지 다운로드
    const safeKeyword = keyword.replace(/[^\w가-힣-]/g, "_");
    const filename = `ai-${safeKeyword}-${Date.now()}.${fileExtension}`;

    const downloadResult = await downloadPhotoOptimized(imageUrl, filename, (progress) => {
      const finalProgress = 80 + Math.round(progress * 0.2); // 80% ~ 100%
      onProgress?.(finalProgress);
    });

    if (!downloadResult.success) {
      throw new Error(`이미지 다운로드 실패: ${downloadResult.error}`);
    }

    return {
      success: true,
      filePath: downloadResult.filePath,
      filename: downloadResult.filename,
      size: downloadResult.size,
      prompt: finalPrompt,
      predictionId: prediction.id,
      type: "ai-generated",
    };
  } catch (error) {
    console.error(`[AI 이미지 생성] 실패: "${keyword}"`, error.message);
    return {
      success: false,
      error: error.message,
      type: "ai-generated",
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
// Fallback 체인: Pexels 영상 → Pixabay 영상 → Pexels 사진 → Pixabay 사진 → AI 이미지
// - 각 단계에서 실패 시 다음 단계로 진행
// - videosPerKeyword 옵션에 따라 영상 개수 조절
// - 사진은 고품질 필터 적용 (1920x1080 이상, 16:9 비율 우선)
// ---------------------------------------------------------------------------
async function downloadMediaWithFallback(keyword, provider, options = {}, onProgress) {
  const { searchPexelsPhotos, searchPixabayPhotos } = require("./stock");
  const videosPerKeyword = options.videosPerKeyword || 1;
  const safeKeyword = keyword.replace(/[^\w가-힣-]/g, "_");

  // 1단계: Pexels 영상 검색
  try {
    onProgress?.({ keyword, status: "searching", mediaType: "video", step: 1, provider: "pexels" });

    const pexelsKey = await getSecret("pexelsApiKey");
    if (pexelsKey) {
      const videos = await searchPexelsVideos(pexelsKey, keyword, videosPerKeyword, options);

      if (videos && videos.length > 0) {
        // ✅ videosPerKeyword 개수만큼 모두 다운로드
        const downloadedVideos = [];

        for (let videoIndex = 0; videoIndex < videos.length; videoIndex++) {
          const video = videos[videoIndex];
          const resolution = `${video.width}x${video.height}`;
          // 여러 영상 구분: keyword1, keyword2, ...
          const keywordSuffix = videos.length > 1 ? `${videoIndex + 1}` : '';
          const filename = `${safeKeyword}${keywordSuffix}_${resolution}.mp4`;

          onProgress?.({ keyword, status: "downloading", mediaType: "video", step: 1, filename, provider: "pexels", videoIndex: videoIndex + 1, totalVideos: videos.length });

          const downloadResult = await downloadVideoOptimized(video.url, filename, (progress) => {
            onProgress?.({ keyword, status: "downloading", mediaType: "video", step: 1, progress, filename, provider: "pexels", videoIndex: videoIndex + 1, totalVideos: videos.length });
          }, options.maxFileSize || 20);

          if (downloadResult.success) {
            downloadedVideos.push({
              success: true,
              mediaType: "video",
              ...downloadResult,
              provider: "pexels",
              width: video.width,
              height: video.height,
              thumbnail: video.thumbnail,
            });
          }
        }

        // 최소 1개 이상 성공하면 성공으로 처리 (첫 번째 파일 정보 반환)
        if (downloadedVideos.length > 0) {
          return downloadedVideos[0];
        }
      }
    }
  } catch (error) {
    // Failed, try next provider
  }

  // 2단계: Pixabay 영상 검색
  try {
    onProgress?.({ keyword, status: "searching", mediaType: "video", step: 2, provider: "pixabay" });

    const pixabayKey = await getSecret("pixabayApiKey");
    if (pixabayKey) {
      const videos = await searchPixabayVideos(pixabayKey, keyword, videosPerKeyword, options);

      if (videos && videos.length > 0) {
        // ✅ videosPerKeyword 개수만큼 모두 다운로드
        const downloadedVideos = [];

        for (let videoIndex = 0; videoIndex < videos.length; videoIndex++) {
          const video = videos[videoIndex];
          const resolution = `${video.width}x${video.height}`;
          // 여러 영상 구분: keyword1, keyword2, ...
          const keywordSuffix = videos.length > 1 ? `${videoIndex + 1}` : '';
          const filename = `${safeKeyword}${keywordSuffix}_${resolution}.mp4`;

          onProgress?.({ keyword, status: "downloading", mediaType: "video", step: 2, filename, provider: "pixabay", videoIndex: videoIndex + 1, totalVideos: videos.length });

          const downloadResult = await downloadVideoOptimized(video.url, filename, (progress) => {
            onProgress?.({ keyword, status: "downloading", mediaType: "video", step: 2, progress, filename, provider: "pixabay", videoIndex: videoIndex + 1, totalVideos: videos.length });
          }, options.maxFileSize || 20);

          if (downloadResult.success) {
            downloadedVideos.push({
              success: true,
              mediaType: "video",
              ...downloadResult,
              provider: "pixabay",
              width: video.width,
              height: video.height,
              thumbnail: video.thumbnail,
            });
          }
        }

        // 최소 1개 이상 성공하면 성공으로 처리 (첫 번째 파일 정보 반환)
        if (downloadedVideos.length > 0) {
          return downloadedVideos[0];
        }
      }
    }
  } catch (error) {
    // Failed, try next provider
  }

  // 3단계: Pexels 사진 검색 (고품질 필터 적용)
  try {
    onProgress?.({ keyword, status: "searching", mediaType: "photo", step: 3, provider: "pexels" });

    const pexelsKey = await getSecret("pexelsApiKey");
    if (pexelsKey) {
      const photos = await searchPexelsPhotos({
        apiKey: pexelsKey,
        query: keyword,
        perPage: 1,
        targetRes: { w: 1920, h: 1080 }
      });

      if (photos && photos.length > 0) {
        const photo = photos[0];
        const urlExtension = photo.url.split('.').pop().split('?')[0].toLowerCase();
        const fileExtension = ['webp', 'jpg', 'jpeg', 'png'].includes(urlExtension) ? urlExtension : 'jpg';
        const filename = `${safeKeyword}_photo.${fileExtension}`;

        onProgress?.({ keyword, status: "downloading", mediaType: "photo", step: 3, filename, provider: "pexels" });

        const downloadResult = await downloadPhotoOptimized(photo.url, filename, (progress) => {
          onProgress?.({ keyword, status: "downloading", mediaType: "photo", step: 3, progress, filename, provider: "pexels" });
        });

        if (downloadResult.success) {
          return {
            success: true,
            mediaType: "photo",
            ...downloadResult,
            provider: "pexels",
            width: photo.width,
            height: photo.height,
            thumbnail: downloadResult.filePath,
          };
        }
      }
    }
  } catch (error) {
    // Failed, try next provider
  }

  // 4단계: Pixabay 사진 검색 (고품질 필터 적용)
  try {
    onProgress?.({ keyword, status: "searching", mediaType: "photo", step: 4, provider: "pixabay" });

    const pixabayKey = await getSecret("pixabayApiKey");
    if (pixabayKey) {
      const photos = await searchPixabayPhotos({
        apiKey: pixabayKey,
        query: keyword,
        perPage: 1,
        targetRes: { w: 1920, h: 1080 }
      });

      if (photos && photos.length > 0) {
        const photo = photos[0];
        const urlExtension = photo.url.split('.').pop().split('?')[0].toLowerCase();
        const fileExtension = ['webp', 'jpg', 'jpeg', 'png'].includes(urlExtension) ? urlExtension : 'jpg';
        const filename = `${safeKeyword}_photo.${fileExtension}`;

        onProgress?.({ keyword, status: "downloading", mediaType: "photo", step: 4, filename, provider: "pixabay" });

        const downloadResult = await downloadPhotoOptimized(photo.url, filename, (progress) => {
          onProgress?.({ keyword, status: "downloading", mediaType: "photo", step: 4, progress, filename, provider: "pixabay" });
        });

        if (downloadResult.success) {
          return {
            success: true,
            mediaType: "photo",
            ...downloadResult,
            provider: "pixabay",
            width: photo.width,
            height: photo.height,
            thumbnail: downloadResult.filePath,
          };
        }
      }
    }
  } catch (error) {
    // Failed, try AI generation
  }

  // 5단계: AI 이미지 생성 (최종 폴백)
  try {
    onProgress?.({ keyword, status: "generating", mediaType: "ai", step: 5 });

    const aiResult = await generateAndDownloadAIImage(keyword, (progress) => {
      onProgress?.({ keyword, status: "generating", mediaType: "ai", step: 5, progress });
    });

    if (aiResult.success) {
      return {
        success: true,
        mediaType: "ai",
        ...aiResult,
        thumbnail: aiResult.filePath,
      };
    } else {
      return {
        success: false,
        mediaType: "none",
        error: sanitizeErrorMessage(`모든 방법 실패 - 미디어 검색 실패, AI 생성 실패: ${aiResult.error}`),
      };
    }
  } catch (error) {
    return {
      success: false,
      mediaType: "none",
      error: sanitizeErrorMessage(`모든 방법 실패: ${error.message}`),
    };
  }
}

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

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < keywords.length; i++) {
    // 취소 확인
    if (isCancelled()) {
      break;
    }

    const keyword = String(keywords[i] || "").trim();
    if (!keyword) {
      console.warn(`[영상 다운로드] 빈 키워드 스킵: 인덱스 ${i}`);
      continue;
    }

    try {
      // Fallback 모드가 활성화되어 있으면 (기본값) fallback 체인 사용
      if (options.enableFallback !== false) {
        const fallbackResult = await downloadMediaWithFallback(keyword, provider, options, (progress) => {
          onProgress?.({
            ...progress,
            totalKeywords: keywords.length,
            currentIndex: i,
          });
        });

        results.push({
          keyword,
          ...fallbackResult,
        });

        if (fallbackResult.success) {
          successCount++;
        } else {
          failureCount++;
        }

        onProgress?.({
          keyword,
          status: fallbackResult.success ? "completed" : "failed",
          progress: 100,
          totalKeywords: keywords.length,
          currentIndex: i,
          mediaType: fallbackResult.mediaType,
          filename: fallbackResult.filename,
          error: fallbackResult.success ? undefined : sanitizeErrorMessage(fallbackResult.error),
          thumbnail: fallbackResult.thumbnail, // 썸네일 정보 전달
          width: fallbackResult.width,
          height: fallbackResult.height,
          provider: fallbackResult.provider,
        });

        if (i < keywords.length - 1) {
          await new Promise((r) => setTimeout(r, 500));
        }

        continue; // fallback 완료, 다음 키워드로
      }

      // 기존 영상 전용 모드 (enableFallback === false)
      onProgress?.({
        keyword,
        status: "searching",
        progress: 0,
        totalKeywords: keywords.length,
        currentIndex: i,
      });

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

        // 새로운 파일명 구조: 키워드_해상도.mp4
        const safeKeyword = keyword.replace(/[^\w가-힣-]/g, "_");
        const keywordNumber = videoIndex + 1; // 1부터 시작
        const keywordName = videos.length > 1 ? `${safeKeyword}${keywordNumber}` : safeKeyword;
        const resolution = `${video.width}x${video.height}`;
        const finalFilename = `${keywordName}_${resolution}.mp4`;

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
        }, options.maxFileSize || 20);

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
        } else {
          failureCount++;
        }

        onProgress?.({
          keyword: videoKeyword,
          status: downloadResult.success ? "completed" : "failed",
          progress: 100,
          totalKeywords: keywords.length,
          currentIndex: i,
          filename: downloadResult.filename,
          error: downloadResult.success ? undefined : sanitizeErrorMessage(downloadResult.error),
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
      results.push({ keyword, success: false, error: sanitizeErrorMessage(error.message) });

      onProgress?.({
        keyword,
        status: "failed",
        progress: 0,
        totalKeywords: keywords.length,
        currentIndex: i,
        error: sanitizeErrorMessage(error.message),
      });
    }

    if (i < keywords.length - 1) {
      await new Promise((r) => setTimeout(r, 500)); // rate limit 완화
    }
  }

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

      return { success: true, results: result.results, summary: result.summary, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[영상 다운로드 IPC] 전체 프로세스 실패 (${duration}ms):`, error.message);
      return {
        success: false,
        error: sanitizeErrorMessage(error.message),
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

  // 사진 다운로드 핸들러
  ipcMain.removeHandler("media:downloadPhoto");
  ipcMain.handle("media:downloadPhoto", async (event, payload) => {
    try {
      const { url, filename, imagesPath } = payload || {};

      if (!url || !filename || !imagesPath) {
        return {
          success: false,
          error: "필수 매개변수가 누락되었습니다 (url, filename, imagesPath)"
        };
      }

      // imagesPath 디렉토리 생성
      await fs.mkdir(imagesPath, { recursive: true });

      const filePath = path.join(imagesPath, filename);

      const result = await downloadPhotoOptimized(url, filename, (progress) => {
        // 진행률 업데이트 (선택사항)
      });

      return result;
    } catch (error) {
      console.error("[사진 다운로드 IPC] 실패:", error.message);
      return {
        success: false,
        error: sanitizeErrorMessage(error.message)
      };
    }
  });

  // 영상 다운로드 핸들러
  ipcMain.removeHandler("media:downloadVideo");
  ipcMain.handle("media:downloadVideo", async (event, payload) => {
    try {
      const { url, filename, videoPath, maxFileSize = 20 } = payload || {};

      if (!url || !filename || !videoPath) {
        return {
          success: false,
          error: "필수 매개변수가 누락되었습니다 (url, filename, videoPath)"
        };
      }

      // videoPath 디렉토리 생성
      await fs.mkdir(videoPath, { recursive: true });

      const result = await downloadVideoOptimized(url, filename, (progress) => {
        // 진행률 업데이트 (선택사항)
      }, maxFileSize);

      return result;
    } catch (error) {
      console.error("[영상 다운로드 IPC] 실패:", error.message);
      return {
        success: false,
        error: sanitizeErrorMessage(error.message)
      };
    }
  });
}

module.exports = { registerVideoDownloadIPC };
