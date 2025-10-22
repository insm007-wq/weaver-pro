/**
 * 파일 관리 유틸리티
 *
 * @description
 * 프로젝트의 모든 파일 작업을 통합 관리하는 유틸리티
 * - 파일 존재 확인 및 조작
 * - 텍스트/바이너리 파일 읽기/쓰기
 * - SRT 자막 파일 처리
 * - 오디오 파일 처리
 * - 파일 검증 및 포맷팅
 * - 프로젝트 통합 작업
 *
 * @features
 * - 📁 파일 존재 확인, 디렉토리 생성
 * - 📖 파일 읽기 (텍스트, SRT, 바이너리)
 * - 📝 파일 쓰기
 * - 🎵 오디오 파일 처리 (길이 측정)
 * - 📋 파일 검증 및 정보 추출
 * - 📂 프로젝트 파일 일괄 로드
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 */

import { getSetting } from './ipcSafe';
import { parseSrtToScenes } from './parseSrt';
import { MAX_UPLOAD_MB, SUPPORTED_IMAGE_TYPES } from '../constants/thumbnailConstants';

/* ========================================
 * 📁 기본 파일 작업 (IPC)
 * ======================================== */

/**
 * 파일/폴더 존재 여부 확인
 * @param {string} path - 확인할 파일/폴더 경로
 * @returns {Promise<{exists: boolean, isFile?: boolean, isDirectory?: boolean}>}
 * @example
 * const result = await checkFileExists('C:/WeaverPro/3333/scripts/subtitle.srt');
 * if (result.exists) { ... }
 */
export async function checkFileExists(path) {
  const result = await window.api?.checkPathExists?.(path);
  return result || { exists: false };
}

/**
 * 텍스트 파일 읽기
 * @param {string} path - 파일 경로
 * @param {string} encoding - 문자 인코딩 (기본값: 'utf8')
 * @returns {Promise<string>} 파일 내용
 * @example
 * const content = await readTextFile('C:/project/script.txt');
 */
export async function readTextFile(path, encoding = 'utf8') {
  const content = await window.api?.readText?.({ path, encoding });
  return content || null;
}

/**
 * 바이너리 파일 읽기
 * @param {string} path - 파일 경로
 * @returns {Promise<string>} base64 인코딩된 데이터
 */
export async function readBinaryFile(path) {
  const result = await window.api?.readBinary?.(path);
  return result?.data || null;
}

/**
 * 텍스트 파일 쓰기
 * @param {string} path - 파일 경로
 * @param {string} content - 파일 내용
 * @returns {Promise<{success: boolean, filePath?: string, message?: string}>}
 * @example
 * await writeTextFile('C:/project/output.srt', srtContent);
 */
export async function writeTextFile(path, content) {
  return await window.api?.invoke?.('files:writeText', { filePath: path, content }) ||
         { success: false, message: 'API 사용 불가' };
}

/**
 * 버퍼를 파일로 저장
 * @param {string} path - 파일 경로
 * @param {Buffer|ArrayBuffer} buffer - 저장할 데이터
 * @returns {Promise<{success: boolean, data?: {ok: boolean, path: string}}>}
 */
export async function writeBufferFile(path, buffer) {
  return await window.api?.invoke?.('files:writeBuffer', { filePath: path, buffer }) ||
         { success: false, message: 'API 사용 불가' };
}

/**
 * 디렉토리 생성 (재귀적)
 * @param {string} dirPath - 생성할 디렉토리 경로
 * @returns {Promise<{ok: boolean, message?: string}>}
 * @example
 * await ensureDirectory('C:/WeaverPro/3333/scripts');
 */
export async function ensureDirectory(dirPath) {
  return await window.api?.mkDirRecursive?.(dirPath) ||
         { ok: false, message: 'API 사용 불가' };
}

/**
 * 디렉토리 내 파일 목록 조회
 * @param {string} dirPath - 디렉토리 경로
 * @returns {Promise<{success: boolean, files?: Array, message?: string}>}
 */
export async function listDirectory(dirPath) {
  return await window.api?.listDirectory?.(dirPath) ||
         { success: false, files: [], message: 'API 사용 불가' };
}

/* ========================================
 * 📝 SRT 자막 파일 작업
 * ======================================== */

/**
 * SRT 파일 읽기 및 파싱
 * @param {string} path - SRT 파일 경로
 * @returns {Promise<Array>} 파싱된 씬 배열
 * @example
 * const scenes = await readSrtFile('C:/project/subtitle.srt');
 */
export async function readSrtFile(path) {
  try {
    const content = await readTextFile(path);
    if (!content) {
      throw new Error('SRT 파일 내용을 읽을 수 없습니다.');
    }

    const scenes = parseSrtToScenes(content);
    if (scenes.length === 0) {
      throw new Error('유효한 SRT 형식이 아닙니다.');
    }

    return scenes;
  } catch (error) {
    console.error('❌ SRT 파일 읽기 오류:', error);
    throw error;
  }
}

/**
 * SRT 파일 쓰기
 * @param {string} path - SRT 파일 경로
 * @param {string} content - SRT 파일 내용
 * @returns {Promise<{success: boolean, filePath?: string, message?: string}>}
 */
export async function writeSrtFile(path, content) {
  try {
    const result = await writeTextFile(path, content);
    if (result.success) {
      console.log(`✅ SRT 파일 저장: ${path}`);
    } else {
      console.error(`❌ SRT 파일 저장 실패: ${result.message}`);
    }
    return result;
  } catch (error) {
    console.error('❌ SRT 파일 쓰기 오류:', error);
    throw error;
  }
}

/* ========================================
 * 🎵 오디오 파일 작업
 * ======================================== */

/**
 * MP3 파일 길이 측정
 * @param {string} path - MP3 파일 경로
 * @returns {Promise<number>} 오디오 길이 (초 단위)
 * @example
 * const duration = await getAudioDuration('C:/project/audio/scene-001.mp3');
 */
export async function getAudioDuration(path) {
  const a = await window.api?.getMp3Duration?.(path);
  if (a != null) return Number(a) || 0;
  return 0;
}

/* ========================================
 * 📋 파일 정보 및 검증
 * ======================================== */

/**
 * 파일 경로에서 파일명과 폴더 경로 추출
 * @param {string} filePath - 전체 파일 경로
 * @returns {{fileName: string, folderPath: string, displayPath: string}} 파일 정보 객체
 * @example
 * const info = getFileInfo('C:/WeaverPro/project/scripts/subtitle.srt');
 * // {
 * //   fileName: 'subtitle.srt',
 * //   folderPath: 'C:/WeaverPro/project/scripts',
 * //   displayPath: '...project/scripts'
 * // }
 */
export function getFileInfo(filePath) {
  if (!filePath) return { fileName: "", folderPath: "", displayPath: "" };

  const normalizedPath = filePath.replace(/\\/g, "/");
  const fileName = normalizedPath.split("/").pop() || "";
  const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
  const displayPath = folderPath.length > 50 ? "..." + folderPath.slice(-47) : folderPath;

  return { fileName, folderPath, displayPath };
}

/**
 * 파일 확장자 검증
 * @param {string} fileName - 파일명
 * @param {string[]} validExtensions - 유효한 확장자 배열 (예: ['.srt', '.txt'])
 * @returns {boolean} 유효성 여부
 * @example
 * isSrt = isValidFileExtension('subtitle.srt', ['.srt']);
 */
export function isValidFileExtension(fileName, validExtensions) {
  if (!fileName || !validExtensions || validExtensions.length === 0) return false;

  const lowerFileName = fileName.toLowerCase();
  return validExtensions.some(ext => lowerFileName.endsWith(ext.toLowerCase()));
}

/**
 * SRT 파일 여부 확인
 * @param {string} fileName - 파일명
 * @returns {boolean}
 */
export function isSrtFile(fileName) {
  return isValidFileExtension(fileName, [".srt", ".txt"]);
}

/**
 * 오디오 파일 여부 확인
 * @param {string} fileName - 파일명
 * @returns {boolean}
 */
export function isAudioFile(fileName) {
  return isValidFileExtension(fileName, [".mp3", ".wav", ".m4a"]);
}

/**
 * 비디오 파일 여부 확인
 * @param {string} fileName - 파일명
 * @returns {boolean}
 */
export function isVideoFile(fileName) {
  return isValidFileExtension(fileName, [".mp4", ".avi", ".mov", ".mkv", ".webm"]);
}

/**
 * 이미지 파일 여부 확인
 * @param {string} fileName - 파일명
 * @returns {boolean}
 */
export function isImageFile(fileName) {
  return isValidFileExtension(fileName, [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]);
}

/**
 * 이미지 파일 유효성 검사 (크기 및 형식)
 * @param {File} file - 검사할 파일
 * @returns {{isValid: boolean, error: string|null}}
 * @example
 * const result = validateImageFile(file);
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 */
export function validateImageFile(file) {
  if (!file) {
    return { isValid: false, error: "파일이 선택되지 않았습니다." };
  }

  // 파일 형식 체크
  if (!SUPPORTED_IMAGE_TYPES.test(file.type)) {
    return {
      isValid: false,
      error: "PNG / JPG / JPEG만 업로드 가능합니다. (WEBP 불가)"
    };
  }

  // 파일 크기 체크
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return {
      isValid: false,
      error: `최대 ${MAX_UPLOAD_MB}MB까지 업로드 가능합니다.`
    };
  }

  return { isValid: true, error: null };
}

/* ========================================
 * 🎨 파일 포맷팅
 * ======================================== */

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 * @param {number} bytes - 바이트 크기
 * @returns {string} 포맷된 크기 (예: "1.2 MB")
 * @example
 * const size = formatFileSize(1234567);  // "1.18 MB"
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * 시간(초)을 MM:SS 형태로 포맷
 * @param {number} seconds - 초 단위 시간
 * @returns {string} 포맷된 시간 (예: "1:23")
 * @example
 * const time = formatDuration(83);  // "1:23"
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/* ========================================
 * 📂 경로 유틸리티
 * ======================================== */

/**
 * 경로 정규화 (백슬래시를 슬래시로 변환)
 * @param {string} path - 파일 경로
 * @returns {string} 정규화된 경로
 */
export function normalizePath(path) {
  if (!path) return "";
  return path.replace(/\\/g, "/");
}

/**
 * 파일 경로가 절대 경로인지 확인
 * @param {string} path - 파일 경로
 * @returns {boolean} 절대 경로 여부
 */
export function isAbsolutePath(path) {
  if (!path) return false;

  // Windows 경로 (C:\\, D:\\, etc.)
  if (/^[A-Za-z]:[\\\/]/.test(path)) return true;

  // Unix/Linux 경로 (/)
  if (path.startsWith("/")) return true;

  return false;
}

/**
 * 상대 경로를 절대 경로로 변환
 * @param {string} basePath - 기준 경로
 * @param {string} relativePath - 상대 경로
 * @returns {string} 절대 경로
 */
export function resolveRelativePath(basePath, relativePath) {
  if (!basePath || !relativePath) return "";

  const normalizedBase = normalizePath(basePath);
  const normalizedRelative = normalizePath(relativePath);

  // 이미 절대 경로인 경우
  if (isAbsolutePath(normalizedRelative)) {
    return normalizedRelative;
  }

  // 상대 경로 해결
  const baseParts = normalizedBase.split("/");
  const relativeParts = normalizedRelative.split("/");

  // 기준 경로에서 파일명 제거 (디렉토리만 남김)
  baseParts.pop();

  for (const part of relativeParts) {
    if (part === "..") {
      baseParts.pop();
    } else if (part !== ".") {
      baseParts.push(part);
    }
  }

  return baseParts.join("/");
}

/**
 * 드래그 앤 드롭 이벤트에서 파일 추출
 * @param {DragEvent} event - 드래그 이벤트
 * @param {string[]} acceptedExtensions - 허용된 확장자 (예: ['.srt', '.txt'])
 * @returns {File[]} 유효한 파일들의 배열
 */
export function extractFilesFromDrop(event, acceptedExtensions) {
  const files = Array.from(event.dataTransfer.files);

  if (acceptedExtensions && acceptedExtensions.length > 0) {
    return files.filter(file => isValidFileExtension(file.name, acceptedExtensions));
  }

  return files;
}

/**
 * Object URL 안전하게 해제
 * @param {Object} urlRef - URL을 담고 있는 ref 객체
 */
export function safeRevokeObjectURL(urlRef) {
  if (urlRef && urlRef.current) {
    URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }
}

/**
 * 이미지 미리보기 URL 생성
 * @param {File} file - 이미지 파일
 * @param {Object} prevUrlRef - 이전 URL ref (정리용)
 * @returns {string} - 새로운 Object URL
 */
export function createImagePreview(file, prevUrlRef) {
  // 이전 URL 정리
  safeRevokeObjectURL(prevUrlRef);

  // 새 URL 생성
  const url = URL.createObjectURL(file);
  if (prevUrlRef) {
    prevUrlRef.current = url;
  }

  return url;
}

/* ========================================
 * 📂 프로젝트 통합 작업
 * ======================================== */

/**
 * 프로젝트에서 SRT 및 MP3 파일들을 일괄 로드
 * @param {string} projectFolder - 프로젝트 폴더 경로
 * @returns {Promise<{srt: Array, mp3Files: Array, audioFolderPath: string}>}
 * @example
 * const { srt, mp3Files } = await loadProjectScriptFiles('C:/WeaverPro/3333');
 */
export async function loadProjectScriptFiles(projectFolder) {
  const debugInfo = [];
  let loadedSrt = false;
  let loadedMp3 = false;

  try {
    // SRT 파일 로드
    const srtPath = `${projectFolder}/scripts/subtitle.srt`;
    let scenes = [];

    try {
      const srtExists = await checkFileExists(srtPath);
      debugInfo.push(`📄 SRT 확인: ${srtPath} → ${srtExists?.exists ? '있음' : '없음'}`);

      if (srtExists?.exists && srtExists?.isFile) {
        scenes = await readSrtFile(srtPath);

        // 각 씬에 audioPath 추가
        scenes = scenes.map((scene, index) => {
          const sceneNumber = String(index + 1).padStart(3, "0");
          return {
            ...scene,
            audioPath: `${projectFolder}\\audio\\parts\\scene-${sceneNumber}.mp3`,
            audioGenerated: true
          };
        });

        loadedSrt = true;
        debugInfo.push(`✅ SRT 로드 성공: ${scenes.length}개 씬`);
      }
    } catch (error) {
      debugInfo.push(`⚠️ SRT 로드 실패: ${error.message}`);
      console.warn('[loadProjectScriptFiles] SRT 로드 오류:', error);
    }

    // MP3 파일들 로드
    const audioPartsFolder = `${projectFolder}/audio/parts`;
    let mp3Files = [];
    let totalDuration = 0;

    try {
      const folderExists = await checkFileExists(audioPartsFolder);
      debugInfo.push(`📁 오디오 폴더 확인: ${audioPartsFolder} → ${folderExists?.exists ? '있음' : '없음'}`);

      if (folderExists?.exists && folderExists?.isDirectory) {
        let foundAudioFiles = 0;

        for (let i = 0; i < (scenes.length || 10); i++) {
          const sceneNumber = String(i + 1).padStart(3, "0");
          const audioPath = `${audioPartsFolder}/scene-${sceneNumber}.mp3`;
          const audioExists = await checkFileExists(audioPath);

          if (audioExists?.exists && audioExists?.isFile) {
            foundAudioFiles++;
            try {
              const duration = await getAudioDuration(audioPath);
              totalDuration += duration;
              mp3Files.push({
                sceneIndex: i,
                path: audioPath,
                duration: duration
              });
            } catch (error) {
              console.warn(`[loadProjectScriptFiles] 오디오 길이 측정 실패 (${sceneNumber}):`, error);
            }
          }
        }

        if (foundAudioFiles > 0) {
          loadedMp3 = true;
          debugInfo.push(`✅ MP3 로드 성공: ${foundAudioFiles}개 파일, 총 ${totalDuration.toFixed(1)}초`);
        }
      }
    } catch (error) {
      debugInfo.push(`⚠️ MP3 폴더 접근 실패: ${error.message}`);
      console.warn('[loadProjectScriptFiles] MP3 폴더 오류:', error);
    }

    return {
      srt: scenes,
      mp3Files: mp3Files,
      audioFolderPath: audioPartsFolder,
      loadedSrt,
      loadedMp3,
      debugInfo,
      totalAudioDuration: totalDuration
    };

  } catch (error) {
    console.error('[loadProjectScriptFiles] 전체 오류:', error);
    throw error;
  }
}
