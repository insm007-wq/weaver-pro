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
 * 범용 대체 키워드 (폴백용)
 */
const FALLBACK_KEYWORDS = [
  'nature', 'landscape', 'scenery', 'background',
  'abstract', 'motion', 'light', 'texture'
];

/**
 * 영상 다운로드 (키워드 기반, 다단계 폴백)
 * @param {Object} scene - 씬 객체
 * @param {number} sceneIndex - 씬 인덱스
 * @param {Object} options - 다운로드 옵션
 * @returns {Object|null} - 다운로드된 asset 객체 또는 null
 */
export async function downloadVideoForKeyword(scene, sceneIndex, options = {}) {
  try {
    if (!scene?.text) {
      console.warn(`[영상 다운로드] 씬 ${sceneIndex + 1}: 텍스트 없음`);
      return null;
    }

    const {
      provider = 'pexels',
      minResolution = '1080p',
      aspectRatio = '16:9',
      maxFileSize = 20,
    } = options;

    // 1단계: 씬 텍스트에서 키워드 추출
    const sceneKeywords = extractKeywordsFromText(scene.text);
    console.log(`[영상 다운로드] 씬 ${sceneIndex + 1}: 추출된 키워드 -`, sceneKeywords);

    // 2단계: 폴백 키워드 목록 구성
    const fallbackKeywords = [];

    // 2-1: 원본 키워드들 (상위 5개)
    fallbackKeywords.push(...sceneKeywords.slice(0, 5));

    // 2-2: 한국어 키워드 → 영어 매핑
    for (const keyword of sceneKeywords) {
      const mapped = KEYWORD_MAPPING[keyword];
      if (mapped && Array.isArray(mapped)) {
        fallbackKeywords.push(...mapped);
      }
    }

    // 2-3: 범용 대체 키워드
    fallbackKeywords.push(...FALLBACK_KEYWORDS);

    // 중복 제거
    const uniqueKeywords = [...new Set(fallbackKeywords)];
    console.log(`[영상 다운로드] 씬 ${sceneIndex + 1}: 폴백 키워드 목록 (${uniqueKeywords.length}개)`, uniqueKeywords.slice(0, 10));

    // 3단계: 키워드 순회하며 다운로드 시도
    for (let i = 0; i < uniqueKeywords.length; i++) {
      const keyword = uniqueKeywords[i];

      try {
        console.log(`[영상 다운로드] 씬 ${sceneIndex + 1}: "${keyword}" 검색 시도 (${i + 1}/${Math.min(10, uniqueKeywords.length)})`);

        // window.api.downloadVideosByKeywords 호출
        const result = await window.api.downloadVideosByKeywords({
          keywords: [keyword],
          provider: provider,
          options: {
            videosPerKeyword: 1,
            maxFileSize: maxFileSize,
            minResolution: minResolution,
            aspectRatio: aspectRatio,
          },
        });

        if (result.success && result.summary.success > 0) {
          // 다운로드 성공
          console.log(`[영상 다운로드] 씬 ${sceneIndex + 1}: "${keyword}" 다운로드 성공`);

          // videoSaveFolder에서 다운로드된 파일 찾기
          const videoSaveFolderResult = await getSetting("videoSaveFolder");
          let videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

          if (!videoSaveFolder) {
            console.error(`[영상 다운로드] videoSaveFolder 설정 없음`);
            continue;
          }

          videoSaveFolder = videoSaveFolder.replace(/\\/g, '/');
          const videoPath = `${videoSaveFolder}/video`;

          // 방금 다운로드된 파일 찾기 (최신 파일)
          const listResult = await window.api.listDirectory(videoPath);
          if (listResult?.success && Array.isArray(listResult.files)) {
            // keyword를 포함하는 최신 파일 찾기
            const matchingFiles = listResult.files
              .filter(f => f.isFile && f.name.toLowerCase().includes(keyword.toLowerCase()) && f.name.toLowerCase().endsWith('.mp4'))
              .sort((a, b) => (b.modifiedTime || 0) - (a.modifiedTime || 0));

            if (matchingFiles.length > 0) {
              const videoFile = matchingFiles[0];
              return {
                type: 'video',
                path: `${videoPath}/${videoFile.name}`,
                keyword: keyword,
                filename: videoFile.name,
                resolution: extractResolutionFromFilename(videoFile.name),
                provider: provider,
                downloaded: true,
              };
            }
          }

          console.warn(`[영상 다운로드] 씬 ${sceneIndex + 1}: 다운로드 성공했으나 파일을 찾을 수 없음`);
        } else {
          console.log(`[영상 다운로드] 씬 ${sceneIndex + 1}: "${keyword}" 검색 결과 없음`);
        }

      } catch (error) {
        console.error(`[영상 다운로드] 씬 ${sceneIndex + 1}: "${keyword}" 다운로드 오류 -`, error.message);
      }

      // 처음 10개 키워드만 시도 (너무 많이 시도하지 않도록)
      if (i >= 9) {
        console.log(`[영상 다운로드] 씬 ${sceneIndex + 1}: 10개 키워드 시도 완료, 중단`);
        break;
      }
    }

    console.warn(`[영상 다운로드] 씬 ${sceneIndex + 1}: 모든 키워드로 다운로드 실패`);
    return null;

  } catch (error) {
    console.error(`[영상 다운로드] 씬 ${sceneIndex + 1}: 전체 오류 -`, error.message);
    return null;
  }
}

/**
 * AI 이미지 생성 (씬 텍스트 기반)
 * @param {Object} scene - 씬 객체
 * @param {number} sceneIndex - 씬 인덱스
 * @returns {Object|null} - 생성된 asset 객체 또는 null
 */
export async function generateImageForScene(scene, sceneIndex) {
  try {
    if (!scene?.text) {
      console.warn(`[이미지 생성] 씬 ${sceneIndex + 1}: 텍스트 없음`);
      return null;
    }

    // 1. 씬 텍스트에서 키워드 추출
    const keywords = extractKeywordsFromText(scene.text);
    if (keywords.length === 0) {
      console.warn(`[이미지 생성] 씬 ${sceneIndex + 1}: 키워드 없음`);
      return null;
    }

    // 상위 3개 키워드 선택
    const topKeywords = keywords.slice(0, 3).join(', ');
    console.log(`[이미지 생성] 씬 ${sceneIndex + 1}: 키워드 - ${topKeywords}`);

    // 2. 프롬프트 확장 (Anthropic)
    let finalPrompt = topKeywords;
    try {
      const expandResult = await window.api.expandThumbnailPrompt(topKeywords);
      if (expandResult?.ok && expandResult?.prompt) {
        finalPrompt = expandResult.prompt;
        console.log(`[이미지 생성] 씬 ${sceneIndex + 1}: 프롬프트 확장 완료`);
      }
    } catch (error) {
      console.warn(`[이미지 생성] 씬 ${sceneIndex + 1}: 프롬프트 확장 실패, 원본 사용`);
    }

    // 3. 이미지 생성 (Replicate Flux)
    const generateResult = await window.api.generateThumbnails({
      prompt: finalPrompt,
      count: 1,
    });

    if (!generateResult?.ok || !generateResult?.images || generateResult.images.length === 0) {
      console.error(`[이미지 생성] 씬 ${sceneIndex + 1}: 생성 실패`);
      return null;
    }

    const imagePath = generateResult.images[0].path;
    console.log(`[이미지 생성] 씬 ${sceneIndex + 1}: 생성 완료 - ${imagePath}`);

    // 4. asset 객체 반환
    return {
      type: 'image',
      path: imagePath,
      keyword: topKeywords,
      provider: 'ai-generated',
      source: 'replicate-flux',
    };

  } catch (error) {
    console.error(`[이미지 생성] 씨 ${sceneIndex + 1}: 오류 -`, error.message);
    return null;
  }
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
 * 통합 미디어 자동 할당 (영상 + AI 이미지)
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Array} - 미디어가 할당된 씬 배열
 */
export async function assignMediaToScenes(scenes, options = {}) {
  try {
    const {
      minScore = 0.1,
      allowDuplicates = false,
      onProgress = null
    } = options;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return [];
    }

    // ========== Phase 1: 영상 할당 ==========
    console.log(`\n[미디어 할당] Phase 1 시작: 영상 할당`);

    const availableVideos = await discoverAvailableVideos();
    const assignments = [];
    const usedVideos = new Set();
    let videoAssignedCount = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // 이미 asset이 있으면 스킵
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
          bestScore = 0;
        } else if (allowDuplicates) {
          bestVideo = availableVideos[Math.floor(Math.random() * availableVideos.length)];
          bestScore = 0;
        }
      }

      if (bestVideo && !allowDuplicates) {
        usedVideos.add(bestVideo.path);
        videoAssignedCount++;
      }

      assignments.push({ scene, video: bestVideo, score: bestScore });

      // 진행 상황 콜백 (Phase 1)
      if (onProgress) {
        onProgress({
          phase: 'video',
          current: i + 1,
          total: scenes.length,
          message: `영상 할당 중... (${i + 1}/${scenes.length})`,
          videoCount: videoAssignedCount,
          imageCount: 0,
        });
      }
    }

    // 영상이 할당된 씬 배열 생성
    let assignedScenes = assignments.map(({ scene, video }) => {
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

    console.log(`[미디어 할당] Phase 1 완료: ${videoAssignedCount}개 영상 할당`);

    // ========== Phase 2: AI 이미지 생성 ==========
    console.log(`\n[미디어 할당] Phase 2 시작: AI 이미지 생성`);

    // asset이 없는 씬 찾기
    const pendingScenes = assignedScenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path);

    let imageGeneratedCount = 0;

    if (pendingScenes.length > 0) {
      console.log(`[미디어 할당] ${pendingScenes.length}개 씬에 이미지 생성 필요`);

      for (let i = 0; i < pendingScenes.length; i++) {
        const { scene, index: sceneIndex } = pendingScenes[i];

        // 진행 상황 콜백 (Phase 2 시작)
        if (onProgress) {
          onProgress({
            phase: 'image',
            current: i + 1,
            total: pendingScenes.length,
            message: `AI 이미지 생성 중... (${i + 1}/${pendingScenes.length})`,
            videoCount: videoAssignedCount,
            imageCount: imageGeneratedCount,
            currentScene: {
              index: sceneIndex,
              text: scene.text?.substring(0, 50) + (scene.text?.length > 50 ? '...' : ''),
            }
          });
        }

        // AI 이미지 생성
        const imageAsset = await generateImageForScene(scene, sceneIndex);

        if (imageAsset) {
          assignedScenes[sceneIndex] = {
            ...scene,
            asset: imageAsset,
          };
          imageGeneratedCount++;
          console.log(`[미디어 할당] 씬 ${sceneIndex + 1}: 이미지 생성 완료`);
        } else {
          console.warn(`[미디어 할당] 씬 ${sceneIndex + 1}: 이미지 생성 실패`);
        }

        // 진행 상황 콜백 (Phase 2 진행)
        if (onProgress) {
          onProgress({
            phase: 'image',
            current: i + 1,
            total: pendingScenes.length,
            message: `AI 이미지 생성 중... (${i + 1}/${pendingScenes.length})`,
            videoCount: videoAssignedCount,
            imageCount: imageGeneratedCount,
          });
        }
      }
    } else {
      console.log(`[미디어 할당] Phase 2: 이미지 생성 불필요 (모든 씬에 영상 할당됨)`);
    }

    console.log(`[미디어 할당] Phase 2 완료: ${imageGeneratedCount}개 이미지 생성`);

    // ========== 완료 ==========
    if (onProgress) {
      onProgress({
        phase: 'completed',
        current: scenes.length,
        total: scenes.length,
        message: `완료! 영상 ${videoAssignedCount}개, AI 이미지 ${imageGeneratedCount}개`,
        videoCount: videoAssignedCount,
        imageCount: imageGeneratedCount,
      });
    }

    console.log(`[미디어 할당] 전체 완료: 영상 ${videoAssignedCount}개, 이미지 ${imageGeneratedCount}개`);
    return assignedScenes;

  } catch (error) {
    console.error("[미디어 할당] 오류:", error.message);

    if (options.onProgress) {
      options.onProgress({
        phase: 'error',
        message: `오류 발생: ${error.message}`,
      });
    }

    return scenes;
  }
}

/**
 * 영상 자동 할당 (다운로드 포함)
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Array} - 영상이 할당된 씬 배열
 */
export async function assignVideosWithDownload(scenes, options = {}) {
  try {
    const {
      minScore = 0.1,
      allowDuplicates = false,
      provider = 'pexels',
      downloadOptions = {},
      onProgress = null
    } = options;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return [];
    }

    // ========== Phase 1: 로컬 영상 할당 ==========
    console.log(`\n[영상 할당] Phase 1 시작: 로컬 영상 할당`);

    const availableVideos = await discoverAvailableVideos();
    const assignments = [];
    const usedVideos = new Set();
    let localAssignedCount = 0;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // 이미 asset이 있으면 스킵
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
          bestScore = 0;
        } else if (allowDuplicates) {
          bestVideo = availableVideos[Math.floor(Math.random() * availableVideos.length)];
          bestScore = 0;
        }
      }

      if (bestVideo && !allowDuplicates) {
        usedVideos.add(bestVideo.path);
        localAssignedCount++;
      }

      assignments.push({ scene, video: bestVideo, score: bestScore });

      // 진행 상황 콜백 (Phase 1)
      if (onProgress) {
        onProgress({
          phase: 'local',
          current: i + 1,
          total: scenes.length,
          message: `로컬 영상 할당 중... (${i + 1}/${scenes.length})`,
          assignedCount: localAssignedCount,
          downloadedCount: 0,
        });
      }
    }

    // 로컬 영상이 할당된 씬 배열 생성
    let assignedScenes = assignments.map(({ scene, video }) => {
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

    console.log(`[영상 할당] Phase 1 완료: ${localAssignedCount}개 로컬 영상 할당`);

    // ========== Phase 2: 영상 다운로드 ==========
    console.log(`\n[영상 할당] Phase 2 시작: 영상 다운로드`);

    // asset이 없는 씬 찾기
    const pendingScenes = assignedScenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path);

    let downloadedCount = 0;

    if (pendingScenes.length > 0) {
      console.log(`[영상 할당] ${pendingScenes.length}개 씬에 영상 다운로드 필요`);

      for (let i = 0; i < pendingScenes.length; i++) {
        const { scene, index: sceneIndex } = pendingScenes[i];

        // 진행 상황 콜백 (Phase 2 시작)
        if (onProgress) {
          onProgress({
            phase: 'download',
            current: i + 1,
            total: pendingScenes.length,
            message: `영상 다운로드 중... (${i + 1}/${pendingScenes.length})`,
            assignedCount: localAssignedCount,
            downloadedCount: downloadedCount,
            currentScene: {
              index: sceneIndex,
              text: scene.text?.substring(0, 50) + (scene.text?.length > 50 ? '...' : ''),
            }
          });
        }

        // 영상 다운로드
        const videoAsset = await downloadVideoForKeyword(scene, sceneIndex, {
          provider,
          ...downloadOptions
        });

        if (videoAsset) {
          assignedScenes[sceneIndex] = {
            ...scene,
            asset: videoAsset,
          };
          downloadedCount++;
          console.log(`[영상 할당] 씬 ${sceneIndex + 1}: 영상 다운로드 완료`);
        } else {
          console.warn(`[영상 할당] 씬 ${sceneIndex + 1}: 영상 다운로드 실패`);
        }

        // 진행 상황 콜백 (Phase 2 진행)
        if (onProgress) {
          onProgress({
            phase: 'download',
            current: i + 1,
            total: pendingScenes.length,
            message: `영상 다운로드 중... (${i + 1}/${pendingScenes.length})`,
            assignedCount: localAssignedCount,
            downloadedCount: downloadedCount,
          });
        }
      }
    } else {
      console.log(`[영상 할당] Phase 2: 영상 다운로드 불필요 (모든 씬에 로컬 영상 할당됨)`);
    }

    console.log(`[영상 할당] Phase 2 완료: ${downloadedCount}개 영상 다운로드`);

    // ========== 완료 ==========
    if (onProgress) {
      onProgress({
        phase: 'completed',
        current: scenes.length,
        total: scenes.length,
        message: `완료! 로컬 ${localAssignedCount}개, 다운로드 ${downloadedCount}개`,
        assignedCount: localAssignedCount,
        downloadedCount: downloadedCount,
      });
    }

    console.log(`[영상 할당] 전체 완료: 로컬 ${localAssignedCount}개, 다운로드 ${downloadedCount}개`);
    return assignedScenes;

  } catch (error) {
    console.error("[영상 할당] 오류:", error.message);

    if (options.onProgress) {
      options.onProgress({
        phase: 'error',
        message: `오류 발생: ${error.message}`,
      });
    }

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
  assignMediaToScenes,
  assignVideosWithDownload,
  downloadVideoForKeyword,
  generateImageForScene,
  getRecommendedVideosForScene,
  discoverAvailableVideos,
  analyzeSceneKeywords
};