// src/services/videoAssignment.js [VREW Style Enhanced Version]
// ============================================================================
// VREW 스타일 자동 영상-씬 매칭 서비스
// - 고도화된 키워드 기반 유사도 계산
// - 한국어-영어 동의어 매칭
// - 실시간 키워드 분석 및 추천
// ============================================================================

import { getSetting } from "../utils/ipcSafe";

/**
 * 한국어-영어 키워드 매핑 (VREW 스타일)
 */
const KEYWORD_MAPPING = {
  // 자연/풍경
  '자연': ['nature', 'natural', 'wild', 'outdoor'],
  '바다': ['ocean', 'sea', 'water', 'beach', 'coast'],
  '해변': ['beach', 'shore', 'coast', 'sand'],
  '산': ['mountain', 'hill', 'peak', 'range'],
  '하늘': ['sky', 'cloud', 'heaven', 'air'],
  '일몰': ['sunset', 'evening', 'dusk', 'twilight'],
  '일출': ['sunrise', 'dawn', 'morning'],
  '숲': ['forest', 'wood', 'tree', 'jungle'],
  '강': ['river', 'stream', 'flow', 'current'],
  '호수': ['lake', 'pond', 'water'],

  // 도시/건물
  '도시': ['city', 'urban', 'town', 'metropolitan'],
  '건물': ['building', 'structure', 'architecture'],
  '거리': ['street', 'road', 'path', 'avenue'],
  '교통': ['traffic', 'transport', 'vehicle', 'car'],
  '기술': ['technology', 'tech', 'digital', 'innovation'],

  // 사람/활동
  '사람': ['people', 'person', 'human', 'individual'],
  '가족': ['family', 'relative', 'parent', 'child'],
  '운동': ['exercise', 'sport', 'fitness', 'activity'],
  '음식': ['food', 'meal', 'cooking', 'restaurant'],
  '여행': ['travel', 'trip', 'journey', 'vacation'],

  // 감정/개념
  '행복': ['happy', 'joy', 'smile', 'cheerful'],
  '평화': ['peace', 'calm', 'quiet', 'serene'],
  '성공': ['success', 'achievement', 'victory', 'win'],
  '미래': ['future', 'tomorrow', 'next', 'advance'],
  '발전': ['development', 'progress', 'growth', 'improvement']
};

/**
 * 파일명에서 키워드 추출 (개선된 버전)
 */
function extractKeywordFromFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    console.warn("[키워드 추출] 잘못된 파일명:", filename);
    return "unknown";
  }

  try {
    // 파일명에서 확장자 제거
    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

    // 패턴 1: keyword_provider_resolution 형태
    let match = nameWithoutExt.match(/^([^_]+?)(\d+)?_([^_]+)_(\d+x\d+)$/);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }

    // 패턴 2: keyword-provider-resolution 형태
    match = nameWithoutExt.match(/^([^-]+?)(\d+)?-([^-]+)-(\d+x\d+)$/);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }

    // 패턴 3: 첫 번째 구분자 전까지
    const parts = nameWithoutExt.split(/[_\-\s]+/);
    if (parts[0] && parts[0].length > 0) {
      return parts[0].toLowerCase().trim();
    }

    return "unknown";
  } catch (error) {
    console.error("[키워드 추출] 오류:", error);
    return "unknown";
  }
}

/**
 * 텍스트 정규화 (VREW 스타일)
 */
function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 텍스트에서 키워드 추출 (고도화)
 */
function extractKeywordsFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const words = normalized.split(' ')
    .filter(word => word.length > 1)
    .filter(Boolean);

  return words;
}

/**
 * 고도화된 키워드 유사도 계산 (VREW 스타일)
 */
function calculateKeywordSimilarity(keyword1, keyword2) {
  if (!keyword1 || !keyword2) return 0;

  const k1 = normalizeText(keyword1);
  const k2 = normalizeText(keyword2);

  // 1. 완전 일치
  if (k1 === k2) {
    return 1.0;
  }

  // 2. 부분 포함
  if (k1.includes(k2) || k2.includes(k1)) {
    return 0.8;
  }

  // 3. 한국어-영어 매핑 확인
  for (const [korean, englishList] of Object.entries(KEYWORD_MAPPING)) {
    if (k1 === korean && englishList.some(eng => eng === k2)) {
      return 0.9;
    }
    if (k2 === korean && englishList.some(eng => eng === k1)) {
      return 0.9;
    }
    if (englishList.includes(k1) && englishList.includes(k2)) {
      return 0.7;
    }
  }

  // 4. 앞 3글자 매칭 (영어 단어)
  if (k1.length >= 3 && k2.length >= 3 && k1.substring(0, 3) === k2.substring(0, 3)) {
    return 0.4;
  }

  // 5. 첫 글자 매칭 (한국어)
  if (k1.length >= 2 && k2.length >= 2 && /[가-힣]/.test(k1[0]) && k1[0] === k2[0]) {
    return 0.3;
  }
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
  let bestMatch = "";

  for (const sceneKeyword of sceneKeywords) {
    const similarity = calculateKeywordSimilarity(sceneKeyword, videoKeyword);
    if (similarity > maxScore) {
      maxScore = similarity;
      bestMatch = sceneKeyword;
    }
  }

  if (maxScore > 0) {
  }

  return maxScore;
}


/**
 * videoSaveFolder/video 디렉토리에서 영상 스캔
 */
export async function discoverAvailableVideos() {
  try {
    // 설정에서 videoSaveFolder 가져오기
    const videoSaveFolderResult = await getSetting("videoSaveFolder");
    let videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

    if (!videoSaveFolder || typeof videoSaveFolder !== 'string') {
      console.error("[영상 발견] videoSaveFolder 설정이 없음");
      return [];
    }

    // Node.js/Electron 표준: 슬래시(/) 사용
    videoSaveFolder = videoSaveFolder.replace(/\\/g, '/');
    const videoPath = `${videoSaveFolder}/video`;

    // 디렉토리 존재 확인
    if (!window?.api?.checkPathExists) {
      console.error("[영상 발견] API 없음");
      return [];
    }

    const dirExists = await window.api.checkPathExists(videoPath);
    if (!dirExists?.exists) {
      console.error("[영상 발견] 디렉토리 없음:", videoPath);
      return [];
    }

    if (dirExists?.isFile === true) {
      console.error("[영상 발견] 파일임 (디렉토리 아님):", videoPath);
      return [];
    }

    // 파일 목록 가져오기
    if (!window?.api?.listDirectory) {
      console.error("[영상 발견] listDirectory API 없음");
      return [];
    }

    const result = await window.api.listDirectory(videoPath);
    if (!result?.success || !Array.isArray(result.files)) {
      console.error("[영상 발견] 파일 목록 가져오기 실패");
      return [];
    }

    if (result.files.length === 0) {
      console.warn("[영상 발견] 디렉토리 비어있음:", videoPath);
      return [];
    }

    const files = result.files;
    const videos = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.mp4') || !file.isFile) {
        continue;
      }

      const keyword = extractKeywordFromFilename(file.name);
      if (!keyword || keyword === "unknown") {
        continue;
      }

      videos.push({
        filename: file.name,
        path: `${videoPath}/${file.name}`,
        keyword,
        size: file.size || 0,
        resolution: extractResolutionFromFilename(file.name),
        provider: extractProviderFromFilename(file.name),
      });
    }

    console.log(`[영상 발견] ${videos.length}개 영상 발견 (${videoPath})`);
    return videos;

  } catch (error) {
    console.error("[영상 발견] 오류:", error.message);
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
 * VREW 스타일 자동 영상 할당 (고도화)
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @returns {Array} - 영상이 할당된 씬 배열
 */
export async function assignVideosToScenes(scenes, options = {}) {
  try {
    const { minScore = 0.1, allowDuplicates = false } = options;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return [];
    }

    const availableVideos = await discoverAvailableVideos();
    if (availableVideos.length === 0) {
      console.warn("[영상 할당] 사용 가능한 영상이 없음");
      return scenes;
    }

    const assignments = [];
    const usedVideos = new Set();

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      if (scene.asset?.path) {
        assignments.push({ scene, video: null, score: 0 });
        continue;
      }

      let bestVideo = null;
      let bestScore = 0;

      // 1차: 키워드 매칭 시도
      for (const video of availableVideos) {
        if (!allowDuplicates && usedVideos.has(video.path)) {
          continue;
        }

        const score = calculateSceneVideoScore(scene, video);
        if (score > bestScore && score >= minScore) {
          bestVideo = video;
          bestScore = score;
        }
      }

      // 2차: 매칭 실패 시 사용 가능한 영상 중 랜덤 선택
      if (!bestVideo && availableVideos.length > 0) {
        const unusedVideos = availableVideos.filter(v => !usedVideos.has(v.path));
        if (unusedVideos.length > 0) {
          bestVideo = unusedVideos[Math.floor(Math.random() * unusedVideos.length)];
          bestScore = 0; // 랜덤 할당이므로 점수 0
          console.log(`[영상 할당] 씬 ${i + 1}: 키워드 매칭 실패, 랜덤 할당 - ${bestVideo.filename}`);
        } else if (allowDuplicates) {
          // 중복 허용이면 전체에서 랜덤 선택
          bestVideo = availableVideos[Math.floor(Math.random() * availableVideos.length)];
          bestScore = 0;
          console.log(`[영상 할당] 씬 ${i + 1}: 중복 허용 랜덤 할당 - ${bestVideo.filename}`);
        }
      }

      if (bestVideo && !allowDuplicates) {
        usedVideos.add(bestVideo.path);
      }

      assignments.push({ scene, video: bestVideo, score: bestScore });
    }

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
    console.log(`[영상 할당] 완료: ${assignedCount}/${scenes.length}개 씬에 할당`);

    return assignedScenes;

  } catch (error) {
    console.error("[영상 할당] 오류:", error.message);
    return scenes;
  }
}

/**
 * 특정 씬에 대해 추천 영상 목록 반환 (VREW 스타일)
 */
export async function getRecommendedVideosForScene(scene, limit = 5) {
  if (!scene?.text) return [];

  const availableVideos = await discoverAvailableVideos();

  return availableVideos
    .map(video => ({
      ...video,
      score: calculateSceneVideoScore(scene, video)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * 실시간 키워드 분석 (텍스트 변경 시 호출)
 */
export function analyzeSceneKeywords(sceneText) {
  if (!sceneText) return [];

  const keywords = extractKeywordsFromText(sceneText);
  return keywords.map(keyword => {
    const englishMappings = KEYWORD_MAPPING[keyword] || [];
    return {
      korean: keyword,
      english: englishMappings,
      type: /[가-힣]/.test(keyword) ? 'korean' : 'english'
    };
  });
}

export default {
  assignVideosToScenes,
  getRecommendedVideosForScene,
  discoverAvailableVideos,
  analyzeSceneKeywords
};