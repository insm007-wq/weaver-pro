// src/services/videoAssignment.js [VREW Style Enhanced Version]
// ============================================================================
// VREW 스타일 자동 영상-씬 매칭 서비스
// - 고도화된 키워드 기반 유사도 계산
// - 한국어-영어 동의어 매칭
// - 실시간 키워드 분석 및 추천
// ============================================================================

import { getSetting } from "../utils/ipcSafe";
import { checkFileExists } from "../utils/fileManager";

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

    // 패턴 1: 영상 - keyword1_1920x1080 또는 keyword_1920x1080 (숫자 접미사 제거 + 해상도 앞까지가 키워드)
    let match = nameWithoutExt.match(/^(.+?)_(\d+x\d+)$/);
    if (match && match[1]) {
      // 숫자 접미사 제거: "목동공원1" → "목동공원"
      const keywordWithNumber = match[1];
      const keywordOnly = keywordWithNumber.replace(/\d+$/, ''); // 끝의 숫자 제거
      return keywordOnly.toLowerCase().trim();
    }

    // 패턴 2: 사진 - keyword_photo (마지막 _photo 제거)
    if (nameWithoutExt.endsWith('_photo')) {
      const keyword = nameWithoutExt.replace(/_photo$/, '');
      if (keyword) {
        return keyword.toLowerCase().trim();
      }
    }

    // 패턴 3: AI 이미지 - ai-keyword-timestamp (ai- 제거 후 마지막 -timestamp 제거)
    match = nameWithoutExt.match(/^ai-(.+)-(\d+)$/);
    if (match && match[1]) {
      return match[1].toLowerCase().trim();
    }

    // 패턴 4: 씬 생성 이미지 - scene-001 (scene 키워드 반환)
    if (nameWithoutExt.match(/^scene-\d+$/)) {
      return "scene";
    }

    // 패턴 5: 폴백 - 첫 번째 구분자 전까지
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
    const dirExists = await checkFileExists(videoPath);
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

    return videos;

  } catch (error) {
    console.error("[영상 발견] 오류:", error.message);
    return [];
  }
}

/**
 * videoSaveFolder/images 디렉토리에서 이미지 스캔
 * 사진(.jpeg, .jpg)과 AI 이미지(.webp)를 구분하여 반환
 */
export async function discoverAvailableImages() {
  try {
    // 설정에서 videoSaveFolder 가져오기
    const videoSaveFolderResult = await getSetting("videoSaveFolder");
    let videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

    if (!videoSaveFolder || typeof videoSaveFolder !== 'string') {
      console.error("[이미지 발견] videoSaveFolder 설정이 없음");
      return { photos: [], aiImages: [] };
    }

    // Node.js/Electron 표준: 슬래시(/) 사용
    videoSaveFolder = videoSaveFolder.replace(/\\/g, '/');
    const imagesPath = `${videoSaveFolder}/images`;

    // 디렉토리 존재 확인
    const dirExists = await checkFileExists(imagesPath);
    if (!dirExists?.exists) {
      console.warn("[이미지 발견] 디렉토리 없음:", imagesPath);
      return { photos: [], aiImages: [] };
    }

    if (dirExists?.isFile === true) {
      console.error("[이미지 발견] 파일임 (디렉토리 아님):", imagesPath);
      return { photos: [], aiImages: [] };
    }

    // 파일 목록 가져오기
    if (!window?.api?.listDirectory) {
      console.error("[이미지 발견] listDirectory API 없음");
      return { photos: [], aiImages: [] };
    }

    const result = await window.api.listDirectory(imagesPath);
    if (!result?.success || !Array.isArray(result.files)) {
      console.error("[이미지 발견] 파일 목록 가져오기 실패");
      return { photos: [], aiImages: [] };
    }

    if (result.files.length === 0) {
      console.warn("[이미지 발견] 디렉토리 비어있음:", imagesPath);
      return { photos: [], aiImages: [] };
    }

    const files = result.files;
    const photos = [];
    const aiImages = [];

    for (const file of files) {
      if (!file.isFile) {
        continue;
      }

      const lowerName = file.name.toLowerCase();
      const keyword = extractKeywordFromFilename(file.name);

      if (lowerName.endsWith('.jpeg') || lowerName.endsWith('.jpg')) {
        // 사진 (다운로드된 이미지)
        photos.push({
          filename: file.name,
          path: `${imagesPath}/${file.name}`,
          keyword: keyword || "photo",
          size: file.size || 0,
          type: 'photo',
        });
      } else if (lowerName.endsWith('.webp')) {
        // AI 생성 이미지
        aiImages.push({
          filename: file.name,
          path: `${imagesPath}/${file.name}`,
          keyword: keyword || "ai-image",
          size: file.size || 0,
          type: 'ai-image',
        });
      }
    }

    return { photos, aiImages };

  } catch (error) {
    console.error("[이미지 발견] 오류:", error.message);
    return { photos: [], aiImages: [] };
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

    // 3단계: 키워드 순회하며 다운로드 시도
    for (let i = 0; i < uniqueKeywords.length; i++) {
      const keyword = uniqueKeywords[i];

      try {
        // window.api.downloadVideosByKeywords 호출 (조건 완화)
        const result = await window.api.downloadVideosByKeywords({
          keywords: [keyword],
          provider: provider,
          options: {
            videosPerKeyword: 1,
            maxFileSize: maxFileSize,
            // minResolution과 aspectRatio 조건 완화 (빠른 다운로드)
          },
        });

        if (result.success && result.summary.success > 0) {
          // 다운로드 성공

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
        }

      } catch (error) {
        console.error(`[영상 다운로드] 씬 ${sceneIndex + 1}: "${keyword}" 다운로드 오류 -`, error.message);
      }

      // 처음 3개 키워드만 시도 (속도 개선)
      if (i >= 2) {
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
 * @param {Object} options - 옵션 { skipPromptExpansion: boolean }
 * @returns {Object|null} - 생성된 asset 객체 또는 null
 */
export async function generateImageForScene(scene, sceneIndex, options = {}) {
  try {
    if (!scene?.text) {
      console.warn(`[이미지 생성] 씬 ${sceneIndex + 1}: 텍스트 없음`);
      return null;
    }

    // 1. videoSaveFolder 가져오기
    const videoSaveFolderResult = await getSetting("videoSaveFolder");
    let videoSaveFolder = videoSaveFolderResult?.value || videoSaveFolderResult;

    if (!videoSaveFolder) {
      console.error(`[이미지 생성] 씬 ${sceneIndex + 1}: videoSaveFolder 설정 없음`);
      return null;
    }

    // 경로 정규화
    videoSaveFolder = videoSaveFolder.replace(/\\/g, '/');
    const imagesFolder = `${videoSaveFolder}/images`;

    // images 폴더 존재 확인 및 생성
    try {
      const folderExists = await checkFileExists(imagesFolder);
      if (!folderExists?.exists) {
        await window.api.invoke("fs:mkDirRecursive", { dirPath: imagesFolder });
      }
    } catch (error) {
      console.warn(`[이미지 생성] images 폴더 생성 실패:`, error);
    }

    // 2. 씬 텍스트에서 키워드 추출 (원래 방식 복원)
    const keywords = extractKeywordsFromText(scene.text);
    if (keywords.length === 0) {
      console.warn(`[이미지 생성] 씬 ${sceneIndex + 1}: 키워드 없음`);
      return null;
    }

    // 상위 3개 키워드 선택
    const topKeywords = keywords.slice(0, 3).join(', ');

    // 3. 씬용 프롬프트 확장 (Anthropic) - 속도 개선을 위해 스킵 가능
    const { skipPromptExpansion = false } = options;
    let finalPrompt = topKeywords;

    if (skipPromptExpansion) {
      // 🚀 빠른 모드: 프롬프트 확장 스킵, 폴백만 사용
      finalPrompt = `${topKeywords}, photorealistic scene illustration, natural lighting, cinematic composition, detailed background, 4K quality`;
    } else {
      // 일반 모드: AI 프롬프트 확장 사용 (씬 텍스트 전체를 영어로 변환)
      try {
        const expandResult = await window.api.expandScenePrompt(scene.text);
        if (expandResult?.ok && expandResult?.prompt) {
          finalPrompt = expandResult.prompt;
        } else {
          // 폴백: 키워드 + 기본 스타일
          finalPrompt = `${topKeywords}, photorealistic scene illustration, natural lighting, cinematic composition, detailed background, 4K quality`;
        }
      } catch (error) {
        console.warn(`[이미지 생성] 씬 ${sceneIndex + 1}: 프롬프트 확장 실패, 폴백 사용`);
        finalPrompt = `${topKeywords}, photorealistic scene illustration, natural lighting, cinematic composition, detailed background, 4K quality`;
      }
    }

    // 4. 이미지 생성 (Replicate Flux)
    const generateResult = await window.api.generateThumbnails({
      prompt: finalPrompt,
      count: 1,
    });

    if (!generateResult?.ok || !generateResult?.images || generateResult.images.length === 0) {
      console.error(`[이미지 생성] 씬 ${sceneIndex + 1}: 생성 실패`);

      // 📋 관리자 페이지에 이미지 API 생성 실패 로그 기록
      if (window.api?.logActivity) {
        window.api.logActivity({
          type: "image",
          title: "이미지 생성",
          detail: `씬 ${sceneIndex + 1} - Replicate API 호출 실패`,
          status: "error",
          metadata: {
            sceneIndex: sceneIndex,
            error: "API 응답 없음"
          }
        });
      }

      return null;
    }

    const imageUrl = generateResult.images[0]; // URL 받기

    // 5. 이미지 URL을 images 폴더에 다운로드
    const sceneNumber = String(sceneIndex + 1).padStart(3, '0');

    // URL에서 확장자 추출 (webp, jpg, png 등)
    const urlExtension = imageUrl.split('.').pop().split('?')[0].toLowerCase(); // 쿼리 파라미터 제거
    const fileExtension = ['webp', 'jpg', 'jpeg', 'png'].includes(urlExtension)
      ? urlExtension
      : 'webp'; // 기본값

    const suggestedFileName = `scene-${sceneNumber}.${fileExtension}`;
    const fullImagePath = `${imagesFolder}/${suggestedFileName}`;

    try {
      // URL에서 Blob 가져오기
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      // ✅ 원본 그대로 저장 (변환 없음)
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // 파일 저장 (Windows 경로 형식으로 변환)
      const windowsPath = fullImagePath.replace(/\//g, '\\');

      // Node.js Buffer 형식으로 변환
      const bufferData = {
        type: "Buffer",
        data: Array.from(buffer)
      };

      const saveResult = await window.api.invoke("files:writeBuffer", {
        filePath: windowsPath,
        buffer: bufferData,
      });

      if (!saveResult?.success || !saveResult?.data?.ok) {
        throw new Error(saveResult?.message || saveResult?.data?.message || "파일 저장 실패");
      }

      const savedImagePath = saveResult.data.path;

      // 📋 관리자 페이지에 이미지 생성 성공 로그 기록
      if (window.api?.logActivity) {
        window.api.logActivity({
          type: "image",
          title: "이미지 생성",
          detail: `씬 ${sceneIndex + 1} - 키워드: "${topKeywords}"`,
          status: "success",
          metadata: {
            sceneIndex: sceneIndex,
            keywords: topKeywords,
            filePath: savedImagePath,
            provider: 'replicate-flux'
          }
        });
      }

      // 6. asset 객체 반환
      return {
        type: 'image',
        path: savedImagePath,
        keyword: topKeywords, // 추출된 키워드 저장
        provider: 'ai-generated',
        source: 'replicate-flux',
      };
    } catch (saveError) {
      console.error(`[이미지 생성] 씬 ${sceneIndex + 1}: 이미지 저장 실패 ❌ -`, saveError);
      console.error(`[이미지 생성] 씬 ${sceneIndex + 1}: 에러 상세:`, saveError.message, saveError.stack);

      // 📋 관리자 페이지에 이미지 생성 실패 로그 기록
      if (window.api?.logActivity) {
        window.api.logActivity({
          type: "image",
          title: "이미지 생성",
          detail: `씬 ${sceneIndex + 1} - 이미지 저장 실패: ${saveError.message}`,
          status: "error",
          metadata: {
            sceneIndex: sceneIndex,
            error: saveError.message
          }
        });
      }

      return null;
    }

  } catch (error) {
    console.error(`[이미지 생성] 씬 ${sceneIndex + 1}: 오류 -`, error.message);
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
    const usedVideoSizes = new Set(); // 파일 크기 기반 중복 체크

    // ✅ 이미 할당된 영상들을 usedVideos에 추가 (중복 방지)
    // 경로 정규화하여 비교 (Windows/Unix 경로 형식 통일)
    for (const scene of scenes) {
      if (scene.asset?.path && scene.asset.type === 'video') {
        const normalizedPath = scene.asset.path.replace(/\\/g, '/').toLowerCase();
        usedVideos.add(normalizedPath);

        // 파일 크기도 등록
        if (scene.asset.size) {
          usedVideoSizes.add(scene.asset.size);
        }
      }
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      if (scene.asset?.path) {
        assignments.push({ scene, video: null, score: 0 });
        continue;
      }

      let bestVideo = null;
      let bestScore = 0;

      // 키워드 매칭 시도 (minScore 이상만 할당)
      for (const video of availableVideos) {
        const normalizedVideoPath = video.path.replace(/\\/g, '/').toLowerCase();

        // 중복 체크: 경로 또는 파일 크기가 같으면 스킵
        if (!allowDuplicates) {
          if (usedVideos.has(normalizedVideoPath)) {
            continue;
          }
          if (video.size && usedVideoSizes.has(video.size)) {
            continue;
          }
        }

        const score = calculateSceneVideoScore(scene, video);
        if (score > bestScore && score >= minScore) {
          bestVideo = video;
          bestScore = score;
        }
      }

      // 매칭 점수가 minScore 이상인 경우만 할당 (랜덤 할당 제거)
      if (bestVideo && !allowDuplicates) {
        const normalizedPath = bestVideo.path.replace(/\\/g, '/').toLowerCase();
        usedVideos.add(normalizedPath);
        if (bestVideo.size) {
          usedVideoSizes.add(bestVideo.size);
        }
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
          size: video.size, // 파일 크기 저장
        }
      };
    });

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

    const availableVideos = await discoverAvailableVideos();
    const assignments = [];
    const usedVideos = new Set();
    const usedVideoSizes = new Set(); // 파일 크기 기반 중복 체크
    let videoAssignedCount = 0;

    // ✅ 이미 할당된 영상들을 usedVideos에 추가 (중복 방지)
    // 경로 정규화하여 비교 (Windows/Unix 경로 형식 통일)
    for (const scene of scenes) {
      if (scene.asset?.path && scene.asset.type === 'video') {
        const normalizedPath = scene.asset.path.replace(/\\/g, '/').toLowerCase();
        usedVideos.add(normalizedPath);

        // 파일 크기도 등록
        if (scene.asset.size) {
          usedVideoSizes.add(scene.asset.size);
        }
      }
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // 이미 asset이 있으면 스킵
      if (scene.asset?.path) {
        assignments.push({ scene, video: null, score: 0 });
        continue;
      }

      let bestVideo = null;
      let bestScore = 0;

      // 키워드 매칭 시도 (minScore 이상만 할당)
      for (const video of availableVideos) {
        const normalizedVideoPath = video.path.replace(/\\/g, '/').toLowerCase();

        // 중복 체크: 경로 또는 파일 크기가 같으면 스킵
        if (!allowDuplicates) {
          if (usedVideos.has(normalizedVideoPath)) {
            continue;
          }
          if (video.size && usedVideoSizes.has(video.size)) {
            continue;
          }
        }

        const score = calculateSceneVideoScore(scene, video);
        if (score > bestScore && score >= minScore) {
          bestVideo = video;
          bestScore = score;
        }
      }

      // 매칭 점수가 minScore 이상인 경우만 할당 (랜덤 할당 제거)
      if (bestVideo) {
        const normalizedPath = bestVideo.path.replace(/\\/g, '/').toLowerCase();
        if (!allowDuplicates) {
          usedVideos.add(normalizedPath);
          if (bestVideo.size) {
            usedVideoSizes.add(bestVideo.size);
          }
        }
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
          size: video.size, // 파일 크기 저장
        }
      };
    });

    // ========== Phase 2: AI 이미지 생성 ==========

    // asset이 없는 씬 찾기
    const pendingScenes = assignedScenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path);

    let imageGeneratedCount = 0;

    if (pendingScenes.length > 0) {
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

        // AI 이미지 생성 (씬 텍스트 기반 프롬프트 확장)
        const imageAsset = await generateImageForScene(scene, sceneIndex, {
          skipPromptExpansion: false  // AI 프롬프트 확장 사용 (한국어 → 영어 변환)
        });

        if (imageAsset) {
          assignedScenes[sceneIndex] = {
            ...scene,
            asset: imageAsset,
          };
          imageGeneratedCount++;
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
    }

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

    const availableVideos = await discoverAvailableVideos();
    const assignments = [];
    const usedVideos = new Set();
    const usedVideoSizes = new Set(); // 파일 크기 기반 중복 체크
    let localAssignedCount = 0;

    // ✅ 이미 할당된 영상들을 usedVideos에 추가 (중복 방지)
    // 경로 정규화하여 비교 (Windows/Unix 경로 형식 통일)
    for (const scene of scenes) {
      if (scene.asset?.path && scene.asset.type === 'video') {
        const normalizedPath = scene.asset.path.replace(/\\/g, '/').toLowerCase();
        usedVideos.add(normalizedPath);

        // 파일 크기도 등록
        if (scene.asset.size) {
          usedVideoSizes.add(scene.asset.size);
        }
      }
    }

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // 이미 asset이 있으면 스킵
      if (scene.asset?.path) {
        assignments.push({ scene, video: null, score: 0 });
        continue;
      }

      let bestVideo = null;
      let bestScore = 0;

      // 키워드 매칭 시도 (minScore 이상만 할당)
      for (const video of availableVideos) {
        const normalizedVideoPath = video.path.replace(/\\/g, '/').toLowerCase();

        // 중복 체크: 경로 또는 파일 크기가 같으면 스킵
        if (!allowDuplicates) {
          if (usedVideos.has(normalizedVideoPath)) {
            continue;
          }
          if (video.size && usedVideoSizes.has(video.size)) {
            continue;
          }
        }

        const score = calculateSceneVideoScore(scene, video);
        if (score > bestScore && score >= minScore) {
          bestVideo = video;
          bestScore = score;
        }
      }

      // 매칭 점수가 minScore 이상인 경우만 할당 (랜덤 할당 제거)
      if (bestVideo) {
        const normalizedPath = bestVideo.path.replace(/\\/g, '/').toLowerCase();
        if (!allowDuplicates) {
          usedVideos.add(normalizedPath);
          if (bestVideo.size) {
            usedVideoSizes.add(bestVideo.size);
          }
        }
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
          size: video.size, // 파일 크기 저장
        }
      };
    });

    // ========== Phase 2: 영상 다운로드 ==========

    // asset이 없는 씬 찾기
    const pendingScenes = assignedScenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path);

    let downloadedCount = 0;

    if (pendingScenes.length > 0) {
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
    }

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

/**
 * 미디어 없는 씬에만 AI 이미지 자동 생성
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Array} - 이미지가 할당된 씬 배열
 */
export async function assignImagesToMissingScenes(scenes, options = {}) {
  try {
    const { onProgress = null } = options;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return [];
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      return scenes;
    }

    const assignedScenes = [...scenes];
    let imageGeneratedCount = 0;

    for (let i = 0; i < missingScenes.length; i++) {
      const { scene, index: sceneIndex } = missingScenes[i];

      // 진행 상황 콜백
      if (onProgress) {
        onProgress({
          phase: 'image',
          current: i + 1,
          total: missingScenes.length,
          message: `AI 이미지 생성 중... (${i + 1}/${missingScenes.length})`,
          imageCount: imageGeneratedCount,
          currentScene: {
            index: sceneIndex,
            text: scene.text?.substring(0, 50) + (scene.text?.length > 50 ? '...' : ''),
          }
        });
      }

      // AI 이미지 생성 (씬 텍스트 기반 프롬프트 확장)
      const imageAsset = await generateImageForScene(scene, sceneIndex, {
        skipPromptExpansion: false  // AI 프롬프트 확장 사용 (한국어 → 영어 변환)
      });

      if (imageAsset) {
        // 씬의 기존 키워드 확인 (미디어 제거 시 유지된 키워드)
        const sceneKeyword = scene.keyword || imageAsset.keyword;

        // 원래 씬의 모든 속성을 유지하면서 keyword와 asset 업데이트
        assignedScenes[sceneIndex] = {
          ...assignedScenes[sceneIndex],
          keyword: sceneKeyword, // 씬 레벨에 키워드 저장 (미디어 제거 후에도 유지)
          asset: imageAsset,
        };
        imageGeneratedCount++;
      } else {
        console.warn(`[이미지 할당] 씬 ${sceneIndex + 1}: 이미지 생성 실패`);
      }
    }

    // 완료 콜백
    if (onProgress) {
      onProgress({
        phase: 'completed',
        current: missingScenes.length,
        total: missingScenes.length,
        message: `완료! AI 이미지 ${imageGeneratedCount}개 생성`,
        imageCount: imageGeneratedCount,
      });
    }

    return assignedScenes;

  } catch (error) {
    console.error("[이미지 할당] 오류:", error.message);

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
 * 미디어 없는 씬에만 사진 자동 할당 (영상 제외, 사진만)
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Array} - 사진이 할당된 씬 배열
 */
export async function assignPhotosToMissingScenes(scenes, options = {}) {
  try {
    const { minScore = 0.1, allowDuplicates = false, onProgress = null } = options;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return [];
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      return scenes;
    }

    // 1. 사용 가능한 사진 스캔
    const availableImagesResult = await discoverAvailableImages();
    const { photos } = availableImagesResult;

    if (photos.length === 0) {
      console.warn("[사진 할당] 사용 가능한 사진이 없음");
      return scenes;
    }

    // 2. 이미 사용된 사진 추적
    const assignedScenes = [...scenes];
    const usedPhotos = new Set();
    let photoCount = 0;

    // 이미 할당된 사진들을 추적 (중복 방지)
    for (const scene of scenes) {
      if (scene.asset?.path && scene.asset.type === 'image') {
        const normalizedPath = scene.asset.path.replace(/\\/g, '/').toLowerCase();
        // .jpg, .jpeg 파일만 추적 (.webp는 AI 이미지이므로 제외)
        if (normalizedPath.endsWith('.jpg') || normalizedPath.endsWith('.jpeg')) {
          usedPhotos.add(normalizedPath);
        }
      }
    }

    // 3. 각 씬에 대해 사진 할당
    for (let i = 0; i < missingScenes.length; i++) {
      const { scene, index: sceneIndex } = missingScenes[i];

      // 진행 상황 콜백
      if (onProgress) {
        onProgress({
          phase: 'photo',
          current: i + 1,
          total: missingScenes.length,
          message: `사진 할당 중... (${i + 1}/${missingScenes.length})`,
          photoCount,
          currentScene: {
            index: sceneIndex,
            text: scene.text?.substring(0, 50) + (scene.text?.length > 50 ? '...' : ''),
          }
        });
      }

      let bestPhoto = null;
      let bestScore = 0;
      let exactMatch = false;

      // 1단계: 씬에 키워드가 있으면 완전 일치 우선 검색
      if (scene.keyword) {
        for (const photo of photos) {
          const normalizedPath = photo.path.replace(/\\/g, '/').toLowerCase();

          // 중복 체크
          if (!allowDuplicates && usedPhotos.has(normalizedPath)) continue;

          // 완전 일치 체크 (대소문자 구분 없음)
          if (scene.keyword.toLowerCase() === photo.keyword.toLowerCase()) {
            bestPhoto = photo;
            bestScore = 1.0; // 완전 일치 점수
            exactMatch = true;
            break; // 완전 일치 발견 시 즉시 중단
          }
        }
      }

      // 2단계: 완전 일치 없으면 유사도 검색
      if (!exactMatch) {
        for (const photo of photos) {
          const normalizedPath = photo.path.replace(/\\/g, '/').toLowerCase();

          // 중복 체크
          if (!allowDuplicates && usedPhotos.has(normalizedPath)) continue;

          const score = calculateSceneVideoScore(scene, photo);
          if (score > bestScore && score >= minScore) {
            bestPhoto = photo;
            bestScore = score;
          }
        }
      }

      // 3단계: 키워드 매칭 실패 시 순차 할당 (fallback)
      if (!bestPhoto) {
        for (const photo of photos) {
          const normalizedPath = photo.path.replace(/\\/g, '/').toLowerCase();
          if (!allowDuplicates && usedPhotos.has(normalizedPath)) continue;

          bestPhoto = photo;
          bestScore = -1; // fallback 표시
          break;
        }
      }

      if (bestPhoto) {
        const sceneKeyword = scene.keyword || bestPhoto.keyword;
        assignedScenes[sceneIndex] = {
          ...assignedScenes[sceneIndex],
          keyword: sceneKeyword,
          asset: {
            type: 'image',
            path: bestPhoto.path,
            keyword: bestPhoto.keyword,
            filename: bestPhoto.filename,
            provider: 'photo',
            size: bestPhoto.size,
          }
        };

        if (!allowDuplicates) {
          usedPhotos.add(bestPhoto.path.replace(/\\/g, '/').toLowerCase());
        }

        photoCount++;
      }
    }

    // 완료 콜백
    if (onProgress) {
      onProgress({
        phase: 'completed',
        current: missingScenes.length,
        total: missingScenes.length,
        message: `완료! 사진 ${photoCount}개 할당`,
        photoCount,
      });
    }

    return assignedScenes;

  } catch (error) {
    console.error("[사진 할당] 오류:", error.message);

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
 * 우선순위 기반 미디어 자동 할당 (영상 → 사진 → AI 이미지)
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Array} - 미디어가 할당된 씬 배열
 */
export async function assignPrioritizedMediaToMissingScenes(scenes, options = {}) {
  try {
    const { minScore = 0.1, allowDuplicates = false, onProgress = null } = options;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return [];
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      return scenes;
    }

    // 1. 사용 가능한 미디어 스캔
    const [availableVideos, availableImagesResult] = await Promise.all([
      discoverAvailableVideos(),
      discoverAvailableImages()
    ]);

    const { photos, aiImages } = availableImagesResult;

    // 2. 이미 사용된 미디어 추적
    const assignedScenes = [...scenes];
    const usedVideos = new Set();
    const usedVideoSizes = new Set();
    const usedPhotos = new Set();
    const usedAiImages = new Set();

    let videoCount = 0;
    let photoCount = 0;
    let aiImageCount = 0;

    // 이미 할당된 미디어들을 추적 (중복 방지)
    for (const scene of scenes) {
      if (scene.asset?.path) {
        const normalizedPath = scene.asset.path.replace(/\\/g, '/').toLowerCase();

        if (scene.asset.type === 'video') {
          usedVideos.add(normalizedPath);
          if (scene.asset.size) usedVideoSizes.add(scene.asset.size);
        } else if (scene.asset.type === 'image') {
          // 사진인지 AI 이미지인지 확인
          if (normalizedPath.endsWith('.webp')) {
            usedAiImages.add(normalizedPath);
          } else {
            usedPhotos.add(normalizedPath);
          }
        }
      }
    }

    // 3. 각 씬에 대해 우선순위대로 할당
    for (let i = 0; i < missingScenes.length; i++) {
      const { scene, index: sceneIndex } = missingScenes[i];

      // 진행 상황 콜백
      if (onProgress) {
        onProgress({
          phase: 'assigning',
          current: i + 1,
          total: missingScenes.length,
          message: `미디어 할당 중... (${i + 1}/${missingScenes.length})`,
          videoCount,
          photoCount,
          aiImageCount,
          currentScene: {
            index: sceneIndex,
            text: scene.text?.substring(0, 50) + (scene.text?.length > 50 ? '...' : ''),
          }
        });
      }

      let assigned = false;

      // 우선순위 1: 영상 할당 시도
      if (availableVideos.length > 0) {
        let bestVideo = null;
        let bestScore = 0;
        let exactMatch = false;

        // 1단계: 씬에 키워드가 있으면 완전 일치 우선 검색
        if (scene.keyword) {
          for (const video of availableVideos) {
            const normalizedPath = video.path.replace(/\\/g, '/').toLowerCase();

            // 중복 체크
            if (!allowDuplicates) {
              if (usedVideos.has(normalizedPath)) continue;
              if (video.size && usedVideoSizes.has(video.size)) continue;
            }

            // 완전 일치 체크 (대소문자 구분 없음)
            if (scene.keyword.toLowerCase() === video.keyword.toLowerCase()) {
              bestVideo = video;
              bestScore = 1.0; // 완전 일치 점수
              exactMatch = true;
              break; // 완전 일치 발견 시 즉시 중단
            }
          }
        }

        // 2단계: 완전 일치 없으면 유사도 검색
        if (!exactMatch) {
          for (const video of availableVideos) {
            const normalizedPath = video.path.replace(/\\/g, '/').toLowerCase();

            // 중복 체크
            if (!allowDuplicates) {
              if (usedVideos.has(normalizedPath)) continue;
              if (video.size && usedVideoSizes.has(video.size)) continue;
            }

            const score = calculateSceneVideoScore(scene, video);
            if (score > bestScore && score >= minScore) {
              bestVideo = video;
              bestScore = score;
            }
          }
        }

        if (bestVideo) {
          const sceneKeyword = scene.keyword || bestVideo.keyword;
          assignedScenes[sceneIndex] = {
            ...assignedScenes[sceneIndex],
            keyword: sceneKeyword,
            asset: {
              type: 'video',
              path: bestVideo.path,
              keyword: bestVideo.keyword,
              filename: bestVideo.filename,
              resolution: bestVideo.resolution,
              provider: bestVideo.provider,
              size: bestVideo.size,
            }
          };

          if (!allowDuplicates) {
            usedVideos.add(bestVideo.path.replace(/\\/g, '/').toLowerCase());
            if (bestVideo.size) usedVideoSizes.add(bestVideo.size);
          }

          videoCount++;
          assigned = true;
        }
      }

      // 우선순위 2: 사진 할당 시도 (영상 할당 실패 시)
      if (!assigned && photos.length > 0) {
        let bestPhoto = null;
        let bestScore = 0;
        let exactMatch = false;

        // 1단계: 씬에 키워드가 있으면 완전 일치 우선 검색
        if (scene.keyword) {
          for (const photo of photos) {
            const normalizedPath = photo.path.replace(/\\/g, '/').toLowerCase();

            // 중복 체크
            if (!allowDuplicates && usedPhotos.has(normalizedPath)) continue;

            // 완전 일치 체크 (대소문자 구분 없음)
            if (scene.keyword.toLowerCase() === photo.keyword.toLowerCase()) {
              bestPhoto = photo;
              bestScore = 1.0; // 완전 일치 점수
              exactMatch = true;
              break; // 완전 일치 발견 시 즉시 중단
            }
          }
        }

        // 2단계: 완전 일치 없으면 유사도 검색
        if (!exactMatch) {
          for (const photo of photos) {
            const normalizedPath = photo.path.replace(/\\/g, '/').toLowerCase();

            // 중복 체크
            if (!allowDuplicates && usedPhotos.has(normalizedPath)) continue;

            const score = calculateSceneVideoScore(scene, photo);
            if (score > bestScore && score >= minScore) {
              bestPhoto = photo;
              bestScore = score;
            }
          }
        }

        // 3단계: 키워드 매칭 실패 시 순차 할당 (fallback)
        if (!bestPhoto) {
          for (const photo of photos) {
            const normalizedPath = photo.path.replace(/\\/g, '/').toLowerCase();
            if (!allowDuplicates && usedPhotos.has(normalizedPath)) continue;

            bestPhoto = photo;
            bestScore = -1; // fallback 표시
            break;
          }
        }

        if (bestPhoto) {
          const sceneKeyword = scene.keyword || bestPhoto.keyword;
          assignedScenes[sceneIndex] = {
            ...assignedScenes[sceneIndex],
            keyword: sceneKeyword,
            asset: {
              type: 'image',
              path: bestPhoto.path,
              keyword: bestPhoto.keyword,
              filename: bestPhoto.filename,
              provider: 'photo',
              size: bestPhoto.size,
            }
          };

          if (!allowDuplicates) {
            usedPhotos.add(bestPhoto.path.replace(/\\/g, '/').toLowerCase());
          }

          photoCount++;
          assigned = true;
        }
      }

      // 우선순위 3: AI 이미지 할당 시도 (영상, 사진 모두 실패 시)
      if (!assigned && aiImages.length > 0) {
        let bestAiImage = null;
        let bestScore = 0;
        let exactMatch = false;

        // 1단계: 씬에 키워드가 있으면 완전 일치 우선 검색
        if (scene.keyword) {
          for (const aiImage of aiImages) {
            const normalizedPath = aiImage.path.replace(/\\/g, '/').toLowerCase();

            // 중복 체크
            if (!allowDuplicates && usedAiImages.has(normalizedPath)) continue;

            // 완전 일치 체크 (대소문자 구분 없음)
            if (scene.keyword.toLowerCase() === aiImage.keyword.toLowerCase()) {
              bestAiImage = aiImage;
              bestScore = 1.0; // 완전 일치 점수
              exactMatch = true;
              break; // 완전 일치 발견 시 즉시 중단
            }
          }
        }

        // 2단계: 완전 일치 없으면 유사도 검색
        if (!exactMatch) {
          for (const aiImage of aiImages) {
            const normalizedPath = aiImage.path.replace(/\\/g, '/').toLowerCase();

            // 중복 체크
            if (!allowDuplicates && usedAiImages.has(normalizedPath)) continue;

            const score = calculateSceneVideoScore(scene, aiImage);
            if (score > bestScore && score >= minScore) {
              bestAiImage = aiImage;
              bestScore = score;
            }
          }
        }

        // 3단계: 키워드 매칭 실패 시 순차 할당 (fallback - 무조건)
        if (!bestAiImage) {
          for (const aiImage of aiImages) {
            const normalizedPath = aiImage.path.replace(/\\/g, '/').toLowerCase();
            if (!allowDuplicates && usedAiImages.has(normalizedPath)) continue;

            bestAiImage = aiImage;
            bestScore = -1; // fallback 표시
            break;
          }
        }

        if (bestAiImage) {
          const sceneKeyword = scene.keyword || bestAiImage.keyword;
          assignedScenes[sceneIndex] = {
            ...assignedScenes[sceneIndex],
            keyword: sceneKeyword,
            asset: {
              type: 'image',
              path: bestAiImage.path,
              keyword: bestAiImage.keyword,
              filename: bestAiImage.filename,
              provider: 'ai-generated',
              size: bestAiImage.size,
            }
          };

          if (!allowDuplicates) {
            usedAiImages.add(bestAiImage.path.replace(/\\/g, '/').toLowerCase());
          }

          aiImageCount++;
          assigned = true;
        }
      }
    }

    // 완료 콜백
    if (onProgress) {
      onProgress({
        phase: 'completed',
        current: missingScenes.length,
        total: missingScenes.length,
        message: `완료! 영상 ${videoCount}개, 사진 ${photoCount}개, AI 이미지 ${aiImageCount}개`,
        videoCount,
        photoCount,
        aiImageCount,
      });
    }

    return assignedScenes;

  } catch (error) {
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
 * 미디어 없는 씬에만 영상 자동 할당
 * @param {Array} scenes - 씬 배열
 * @param {Object} options - 할당 옵션
 * @param {Function} options.onProgress - 진행 상황 콜백
 * @returns {Array} - 영상이 할당된 씬 배열
 */
export async function assignVideosToMissingScenes(scenes, options = {}) {
  try {
    const { minScore = 0.1, allowDuplicates = false, onProgress = null } = options;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return [];
    }

    // 미디어가 없는 씬만 필터링
    const missingScenes = scenes
      .map((scene, index) => ({ scene, index }))
      .filter(({ scene }) => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

    if (missingScenes.length === 0) {
      return scenes;
    }

    const availableVideos = await discoverAvailableVideos();
    if (availableVideos.length === 0) {
      console.warn("[영상 할당] 사용 가능한 영상이 없음");
      return scenes;
    }

    const assignedScenes = [...scenes];
    const usedVideos = new Set();
    const usedVideoSizes = new Set(); // 파일 크기 기반 중복 체크
    let videoAssignedCount = 0;

    // 이미 할당된 영상들을 usedVideos에 추가 (중복 방지)
    for (const scene of scenes) {
      if (scene.asset?.path && scene.asset.type === 'video') {
        const normalizedPath = scene.asset.path.replace(/\\/g, '/').toLowerCase();
        usedVideos.add(normalizedPath);

        // 파일 크기도 등록 (같은 영상 다른 파일명 방지)
        if (scene.asset.size) {
          usedVideoSizes.add(scene.asset.size);
        }
      }
    }

    for (let i = 0; i < missingScenes.length; i++) {
      const { scene, index: sceneIndex } = missingScenes[i];

      // 진행 상황 콜백
      if (onProgress) {
        onProgress({
          phase: 'video',
          current: i + 1,
          total: missingScenes.length,
          message: `영상 할당 중... (${i + 1}/${missingScenes.length})`,
          assignedCount: videoAssignedCount,
          currentScene: {
            index: sceneIndex,
            text: scene.text?.substring(0, 50) + (scene.text?.length > 50 ? '...' : ''),
          }
        });
      }

      let bestVideo = null;
      let bestScore = 0;

      // 키워드 매칭 시도 (minScore 이상만 할당)
      for (const video of availableVideos) {
        const normalizedVideoPath = video.path.replace(/\\/g, '/').toLowerCase();

        // 중복 체크: 경로 또는 파일 크기가 같으면 스킵
        if (!allowDuplicates) {
          if (usedVideos.has(normalizedVideoPath)) {
            continue;
          }
          if (video.size && usedVideoSizes.has(video.size)) {
            continue;
          }
        }

        const score = calculateSceneVideoScore(scene, video);
        if (score > bestScore && score >= minScore) {
          bestVideo = video;
          bestScore = score;
        }
      }

      // 매칭 점수가 minScore 이상인 경우만 할당 (랜덤 할당 완전 제거)
      if (bestVideo) {
        // 씬의 기존 키워드 확인 (미디어 제거 시 유지된 키워드)
        const sceneKeyword = scene.keyword || bestVideo.keyword;

        // 원래 씬의 모든 속성을 유지하면서 keyword와 asset 업데이트
        assignedScenes[sceneIndex] = {
          ...assignedScenes[sceneIndex],
          keyword: sceneKeyword, // 씬 레벨에 키워드 저장 (미디어 제거 후에도 유지)
          asset: {
            type: 'video',
            path: bestVideo.path,
            keyword: bestVideo.keyword, // asset 레벨에도 원본 비디오 키워드 유지 (참고용)
            filename: bestVideo.filename,
            resolution: bestVideo.resolution,
            provider: bestVideo.provider,
            size: bestVideo.size, // 파일 크기 저장 (중복 체크용)
          }
        };

        if (!allowDuplicates) {
          const normalizedPath = bestVideo.path.replace(/\\/g, '/').toLowerCase();
          usedVideos.add(normalizedPath);

          // 파일 크기도 등록
          if (bestVideo.size) {
            usedVideoSizes.add(bestVideo.size);
          }
        }

        videoAssignedCount++;
      }
    }

    // 완료 콜백
    if (onProgress) {
      onProgress({
        phase: 'completed',
        current: missingScenes.length,
        total: missingScenes.length,
        message: `완료! 영상 ${videoAssignedCount}개 할당`,
        assignedCount: videoAssignedCount,
      });
    }

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

export default {
  assignVideosToScenes,
  assignMediaToScenes,
  assignVideosWithDownload,
  assignImagesToMissingScenes,
  assignVideosToMissingScenes,
  assignPhotosToMissingScenes,
  assignPrioritizedMediaToMissingScenes,
  downloadVideoForKeyword,
  generateImageForScene,
  getRecommendedVideosForScene,
  discoverAvailableVideos,
  discoverAvailableImages,
  analyzeSceneKeywords
};