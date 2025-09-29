// src/services/videoAssignment.js [VREW Style Enhanced Version]
// ============================================================================
// VREW 스타일 자동 영상-씬 매칭 서비스
// - 고도화된 키워드 기반 유사도 계산
// - 한국어-영어 동의어 매칭
// - 실시간 키워드 분석 및 추천
// - 테스트 모드 지원 (설정 무관 작동)
// ============================================================================

console.log("🔥 [videoAssignment.js] VREW 스타일 파일 로드됨 - Enhanced 2025 v2.0");

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

  console.log(`[키워드 추출] "${text}" → [${words.join(', ')}]`);
  return words;
}

/**
 * 고도화된 키워드 유사도 계산 (VREW 스타일)
 */
function calculateKeywordSimilarity(keyword1, keyword2) {
  if (!keyword1 || !keyword2) return 0;

  const k1 = normalizeText(keyword1);
  const k2 = normalizeText(keyword2);

  console.log(`[키워드 유사도] "${k1}" vs "${k2}"`);

  // 1. 완전 일치
  if (k1 === k2) {
    console.log(`[키워드 유사도] 완전 일치: 1.0`);
    return 1.0;
  }

  // 2. 부분 포함
  if (k1.includes(k2) || k2.includes(k1)) {
    console.log(`[키워드 유사도] 부분 포함: 0.8`);
    return 0.8;
  }

  // 3. 한국어-영어 매핑 확인
  for (const [korean, englishList] of Object.entries(KEYWORD_MAPPING)) {
    if (k1 === korean && englishList.some(eng => eng === k2)) {
      console.log(`[키워드 유사도] 한→영 매칭 (${korean}→${k2}): 0.9`);
      return 0.9;
    }
    if (k2 === korean && englishList.some(eng => eng === k1)) {
      console.log(`[키워드 유사도] 영→한 매칭 (${k1}→${korean}): 0.9`);
      return 0.9;
    }
    if (englishList.includes(k1) && englishList.includes(k2)) {
      console.log(`[키워드 유사도] 동의어 매칭: 0.7`);
      return 0.7;
    }
  }

  // 4. 앞 3글자 매칭 (영어 단어)
  if (k1.length >= 3 && k2.length >= 3 && k1.substring(0, 3) === k2.substring(0, 3)) {
    console.log(`[키워드 유사도] 앞 3글자 매칭: 0.4`);
    return 0.4;
  }

  // 5. 첫 글자 매칭 (한국어)
  if (k1.length >= 2 && k2.length >= 2 && /[가-힣]/.test(k1[0]) && k1[0] === k2[0]) {
    console.log(`[키워드 유사도] 한국어 첫글자 매칭: 0.3`);
    return 0.3;
  }

  console.log(`[키워드 유사도] 매치 없음: 0`);
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
    console.log(`[매칭 점수] "${bestMatch}" ↔ "${videoKeyword}" = ${maxScore.toFixed(3)}`);
  }

  return maxScore;
}


/**
 * videoSaveFolder/video 디렉토리에서 영상 스캔
 */
export async function discoverAvailableVideos() {
  try {
    console.log("[영상 발견] 🚀 영상 발견 시작");

    // 설정에서 videoSaveFolder 가져오기
    const videoSaveFolder = await getSetting("videoSaveFolder");
    console.log("[영상 발견] videoSaveFolder 설정:", videoSaveFolder);

    if (!videoSaveFolder) {
      console.warn("[영상 발견] videoSaveFolder 설정이 없음");
      return [];
    }

    const videoPath = `${videoSaveFolder}/video`;
    console.log("[영상 발견] 영상 경로:", videoPath);

    // 디렉토리 존재 확인
    if (!window?.api?.checkPathExists) {
      console.error("[영상 발견] window.api.checkPathExists API 없음");
      return [];
    }

    const dirExists = await window.api.checkPathExists(videoPath);
    console.log("[영상 발견] 디렉토리 존재 확인:", dirExists);

    if (!dirExists?.exists) {
      console.warn("[영상 발견] 영상 디렉토리가 존재하지 않음:", videoPath);
      return [];
    }

    // 실제 파일 목록 가져오기
    if (!window?.api?.listDirectory) {
      console.error("[영상 발견] window.api.listDirectory API 없음");
      return [];
    }

    const result = await window.api.listDirectory(videoPath);
    console.log("[영상 발견] 파일 목록 결과:", result);

    if (!result?.success || !result.files) {
      console.warn("[영상 발견] 파일 목록을 가져올 수 없음:", result?.message);
      return [];
    }

    const files = result.files;
    const videos = [];

    console.log(`[영상 발견] ${files.length}개 파일 발견, MP4 파일 필터링 중...`);

    for (const file of files) {
      // MP4 파일만 처리
      if (!file.name.toLowerCase().endsWith('.mp4') || !file.isFile) {
        continue;
      }

      console.log(`[영상 발견] 처리 중: ${file.name}`);

      const keyword = extractKeywordFromFilename(file.name);
      if (!keyword || keyword === "unknown") {
        console.warn("[영상 발견] 키워드를 추출할 수 없음:", file.name);
        continue;
      }

      const videoInfo = {
        filename: file.name,
        path: `${videoPath}/${file.name}`,
        keyword,
        size: file.size || 0,
        resolution: extractResolutionFromFilename(file.name),
        provider: extractProviderFromFilename(file.name),
      };

      videos.push(videoInfo);
      console.log(`[영상 발견] ✅ 추가됨: ${videoInfo.keyword} (${videoInfo.filename})`);
    }

    console.log(`[영상 발견] 총 ${videos.length}개 영상 발견:`, videos.map(v => v.keyword));
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
 * VREW 스타일 자동 영상 할당 (고도화)
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @returns {Array} - 영상이 할당된 씬 배열
 */
export async function assignVideosToScenes(scenes, options = {}) {
  try {
    console.log("[영상 할당] 🎬 VREW 스타일 자동 할당 시작");
    console.log("[영상 할당] 입력 씬 수:", scenes?.length || 0);

    const {
      minScore = 0.1, // VREW 스타일: 더 관대한 매칭
      allowDuplicates = false,
    } = options;

    console.log("[영상 할당] 옵션:", { minScore, allowDuplicates });

    if (!Array.isArray(scenes) || scenes.length === 0) {
      console.warn("[영상 할당] 씬이 없음");
      return [];
    }

    // 1. 사용 가능한 영상 발견
    console.log("[영상 할당] 1️⃣ 영상 발견 단계");
    const availableVideos = await discoverAvailableVideos();

    if (availableVideos.length === 0) {
      console.warn("[영상 할당] 사용 가능한 영상이 없음");
      return scenes;
    }

    console.log(`[영상 할당] ✅ ${availableVideos.length}개 영상 사용 가능`);
    availableVideos.forEach(video => {
      console.log(`[영상 할당] 📹 ${video.keyword} (${video.filename})`);
    });

    // 2. 씬별 매칭 점수 계산
    console.log("[영상 할당] 2️⃣ 씬별 매칭 점수 계산");
    const assignments = [];
    const usedVideos = new Set();

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`[영상 할당] 🎯 씬 ${i + 1}/${scenes.length} 처리 중`);
      console.log(`[영상 할당] 씬 텍스트: "${scene.text}"`);

      // 이미 영상이 할당된 씬은 스킵
      if (scene.asset?.path) {
        console.log(`[영상 할당] ⏭️ 씬 ${i + 1} 이미 할당됨: ${scene.asset.path}`);
        assignments.push({ scene, video: null, score: 0 });
        continue;
      }

      // 씬 키워드 추출
      const sceneKeywords = extractKeywordsFromText(scene.text);
      console.log(`[영상 할당] 씬 키워드: [${sceneKeywords.join(', ')}]`);

      let bestVideo = null;
      let bestScore = 0;

      // 각 영상과의 매칭 점수 계산
      for (const video of availableVideos) {
        if (!allowDuplicates && usedVideos.has(video.path)) {
          console.log(`[영상 할당] ⏭️ 영상 "${video.keyword}" 이미 사용됨`);
          continue;
        }

        const score = calculateSceneVideoScore(scene, video);
        console.log(`[영상 할당] 점수: "${video.keyword}" = ${score.toFixed(3)}`);

        if (score > bestScore && score >= minScore) {
          bestVideo = video;
          bestScore = score;
        }
      }

      if (bestVideo) {
        console.log(`[영상 할당] ✅ 씬 ${i + 1} → "${bestVideo.keyword}" (점수: ${bestScore.toFixed(3)})`);
        if (!allowDuplicates) {
          usedVideos.add(bestVideo.path);
        }
      } else {
        console.log(`[영상 할당] ❌ 씬 ${i + 1} 매칭 실패 (최소 점수: ${minScore})`);
      }

      assignments.push({ scene, video: bestVideo, score: bestScore });
    }

    // 3. 할당 결과를 씬에 적용
    console.log("[영상 할당] 3️⃣ 할당 결과 적용");
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
    console.log(`[영상 할당] 🏁 완료: ${assignedCount}/${scenes.length}개 씬에 영상 할당`);

    return assignedScenes;

  } catch (error) {
    console.error("[영상 할당] 치명적 오류:", error);
    return scenes;
  }
}

/**
 * 특정 씬에 대해 추천 영상 목록 반환 (VREW 스타일)
 */
export async function getRecommendedVideosForScene(scene, limit = 5) {
  if (!scene?.text) return [];

  console.log(`[영상 추천] 씬 "${scene.text}"에 대한 추천 영상 검색`);

  const availableVideos = await discoverAvailableVideos();

  const scored = availableVideos
    .map(video => ({
      ...video,
      score: calculateSceneVideoScore(scene, video)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  console.log(`[영상 추천] ${scored.length}개 추천 영상:`,
    scored.map(v => `${v.keyword}(${v.score.toFixed(2)})`));

  return scored;
}

/**
 * 실시간 키워드 분석 (텍스트 변경 시 호출)
 */
export function analyzeSceneKeywords(sceneText) {
  if (!sceneText) return [];

  const keywords = extractKeywordsFromText(sceneText);
  const analysis = keywords.map(keyword => {
    // 한국어 키워드인 경우 영어 매핑 찾기
    const englishMappings = KEYWORD_MAPPING[keyword] || [];

    return {
      korean: keyword,
      english: englishMappings,
      type: /[가-힣]/.test(keyword) ? 'korean' : 'english'
    };
  });

  console.log(`[키워드 분석] "${sceneText}" →`, analysis);
  return analysis;
}

export default {
  assignVideosToScenes,
  getRecommendedVideosForScene,
  discoverAvailableVideos,
  analyzeSceneKeywords
};