// src/services/videoAssignment.js
// ============================================================================
// 자동 영상-씬 매칭 서비스
// - 다운로드된 영상을 씬 텍스트 내용에 따라 자동으로 할당
// - 키워드 기반 유사도 계산 및 최적 매칭
// ============================================================================

import { getSetting } from "../utils/ipcSafe";

/**
 * 파일명에서 키워드 추출
 * 예: "nature_pexels_1920x1080.mp4" → "nature"
 * 예: "sunset2_pixabay_1280x720.mp4" → "sunset"
 */
function extractKeywordFromFilename(filename) {
  if (!filename) return "";

  // 파일명에서 확장자 제거
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

  // 패턴: {keyword}[숫자]_{provider}_{resolution}
  // 예: nature_pexels_1920x1080, sunset2_pixabay_1280x720
  const match = nameWithoutExt.match(/^([^_]+?)(\d+)?_([^_]+)_(\d+x\d+)$/);

  if (match) {
    return match[1]; // 키워드 부분만 반환
  }

  // 매치되지 않으면 첫 번째 언더스코어 전까지 반환
  const parts = nameWithoutExt.split('_');
  return parts[0] || "";
}

/**
 * 텍스트 정규화 (한국어/영어 키워드 매칭용)
 */
function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ') // 특수문자를 공백으로
    .replace(/\s+/g, ' ') // 연속된 공백을 하나로
    .trim();
}

/**
 * 텍스트에서 키워드 추출 (공백/구두점으로 분리)
 */
function extractKeywordsFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  return normalized.split(' ')
    .filter(word => word.length > 1) // 1글자 단어 제외
    .filter(Boolean);
}

/**
 * 두 키워드 간의 유사도 계산 (0-1 사이)
 * - 완전 일치: 1.0
 * - 부분 포함: 0.7
 * - 유사 단어: 0.5 (확장 가능)
 */
function calculateKeywordSimilarity(keyword1, keyword2) {
  if (!keyword1 || !keyword2) return 0;

  const k1 = normalizeText(keyword1);
  const k2 = normalizeText(keyword2);

  // 완전 일치
  if (k1 === k2) return 1.0;

  // 부분 포함 (longer includes shorter)
  if (k1.includes(k2) || k2.includes(k1)) return 0.7;

  // TODO: 추후 동의어 사전이나 임베딩 기반 유사도 추가 가능
  // 예: "sunset"과 "일몰", "ocean"과 "바다" 등

  return 0;
}

/**
 * 씬과 영상 간의 매칭 점수 계산
 */
function calculateSceneVideoScore(scene, videoInfo) {
  if (!scene?.text || !videoInfo?.keyword) return 0;

  const sceneKeywords = extractKeywordsFromText(scene.text);
  const videoKeyword = videoInfo.keyword;

  let maxScore = 0;

  // 씬의 각 키워드와 영상 키워드 간의 최대 유사도
  for (const sceneKeyword of sceneKeywords) {
    const similarity = calculateKeywordSimilarity(sceneKeyword, videoKeyword);
    maxScore = Math.max(maxScore, similarity);
  }

  return maxScore;
}

/**
 * videoSaveFolder/video 디렉토리에서 모든 영상 파일 스캔
 */
export async function discoverAvailableVideos() {
  try {
    const videoSaveFolder = await getSetting("videoSaveFolder");
    if (!videoSaveFolder) {
      console.warn("[영상 발견] videoSaveFolder가 설정되지 않음");
      return [];
    }

    const videoPath = `${videoSaveFolder}/video`;

    // 디렉토리 존재 확인
    const dirExists = await window.api?.checkPathExists?.(videoPath);
    if (!dirExists?.exists) {
      console.warn("[영상 발견] 영상 디렉토리가 존재하지 않음:", videoPath);
      return [];
    }

    // 디렉토리 내 파일 목록 가져오기
    const result = await window.api?.listDirectory?.(videoPath);
    if (!result?.success || !result.files) {
      console.warn("[영상 발견] 파일 목록을 가져올 수 없음:", result?.message);
      return [];
    }

    const files = result.files;

    const videos = [];

    for (const file of files) {
      // MP4 파일만 처리
      if (!file.name.toLowerCase().endsWith('.mp4') || !file.isFile) {
        continue;
      }

      const keyword = extractKeywordFromFilename(file.name);
      if (!keyword) {
        console.warn("[영상 발견] 키워드를 추출할 수 없음:", file.name);
        continue;
      }

      videos.push({
        filename: file.name,
        path: `${videoPath}/${file.name}`,
        keyword,
        size: file.size || 0,
        // 파일명에서 해상도 추출
        resolution: extractResolutionFromFilename(file.name),
        provider: extractProviderFromFilename(file.name),
      });
    }

    console.log(`[영상 발견] ${videos.length}개 영상 발견:`, videos.map(v => v.keyword));
    return videos;

  } catch (error) {
    console.error("[영상 발견] 오류:", error);
    return [];
  }
}

/**
 * 파일명에서 해상도 추출
 */
function extractResolutionFromFilename(filename) {
  const match = filename.match(/(\d+x\d+)/);
  return match ? match[1] : "unknown";
}

/**
 * 파일명에서 프로바이더 추출
 */
function extractProviderFromFilename(filename) {
  const match = filename.match(/_([^_]+)_\d+x\d+/);
  return match ? match[1] : "unknown";
}

/**
 * 씬 배열에 대해 자동 영상 할당 수행
 * @param {Array} scenes - 씬 배열 (parseSrt에서 생성된 형태)
 * @param {Object} options - 할당 옵션
 * @returns {Array} - 영상이 할당된 씬 배열
 */
export async function assignVideosToScenes(scenes, options = {}) {
  const {
    minScore = 0.5, // 최소 매칭 점수 (이하는 할당하지 않음)
    allowDuplicates = false, // 같은 영상을 여러 씬에 할당 허용 여부
  } = options;

  if (!Array.isArray(scenes) || scenes.length === 0) {
    console.warn("[영상 할당] 씬이 없음");
    return scenes;
  }

  console.log(`[영상 할당] ${scenes.length}개 씬에 대해 자동 할당 시작`);

  // 1. 사용 가능한 영상 발견
  const availableVideos = await discoverAvailableVideos();
  if (availableVideos.length === 0) {
    console.warn("[영상 할당] 사용 가능한 영상이 없음");
    return scenes;
  }

  console.log(`[영상 할당] ${availableVideos.length}개 영상 사용 가능`);

  // 2. 각 씬에 대해 매칭 점수 계산
  const assignments = [];
  const usedVideos = new Set();

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // 이미 영상이 할당된 씬은 스킵
    if (scene.asset?.path) {
      console.log(`[영상 할당] 씬 ${i + 1} 이미 할당됨: ${scene.asset.path}`);
      assignments.push({ scene, video: null, score: 0 });
      continue;
    }

    let bestVideo = null;
    let bestScore = 0;

    // 사용 가능한 각 영상에 대해 점수 계산
    for (const video of availableVideos) {
      // 중복 방지 옵션이 활성화되었고 이미 사용된 영상이면 스킵
      if (!allowDuplicates && usedVideos.has(video.path)) {
        continue;
      }

      const score = calculateSceneVideoScore(scene, video);

      if (score > bestScore && score >= minScore) {
        bestVideo = video;
        bestScore = score;
      }
    }

    if (bestVideo) {
      console.log(`[영상 할당] 씬 ${i + 1} "${scene.text}" → "${bestVideo.keyword}" (점수: ${bestScore.toFixed(2)})`);
      if (!allowDuplicates) {
        usedVideos.add(bestVideo.path);
      }
    } else {
      console.log(`[영상 할당] 씬 ${i + 1} "${scene.text}" → 매칭 없음 (최소 점수 ${minScore})`);
    }

    assignments.push({ scene, video: bestVideo, score: bestScore });
  }

  // 3. 할당 결과를 씬에 적용
  const assignedScenes = assignments.map(({ scene, video }) => {
    if (!video) return scene;

    return {
      ...scene,
      asset: {
        type: 'video',
        path: video.path,
        keyword: video.keyword,
        filename: video.filename,
        resolution: video.resolution,
        provider: video.provider,
      }
    };
  });

  const assignedCount = assignments.filter(a => a.video).length;
  console.log(`[영상 할당] 완료: ${assignedCount}/${scenes.length}개 씬에 영상 할당`);

  return assignedScenes;
}

/**
 * 특정 씬에 대해 추천 영상 목록 반환 (수동 선택용)
 */
export async function getRecommendedVideosForScene(scene, limit = 5) {
  if (!scene?.text) return [];

  const availableVideos = await discoverAvailableVideos();

  const scored = availableVideos
    .map(video => ({
      ...video,
      score: calculateSceneVideoScore(scene, video)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  console.log(`[영상 추천] 씬 "${scene.text}"에 대해 ${scored.length}개 추천:`,
    scored.map(v => `${v.keyword}(${v.score.toFixed(2)})`));

  return scored;
}

export default {
  assignVideosToScenes,
  getRecommendedVideosForScene,
  discoverAvailableVideos
};