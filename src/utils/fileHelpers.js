/**
 * 파일 관련 유틸리티 함수들
 * AssembleEditor 및 기타 컴포넌트에서 사용하는 파일 처리 관련 헬퍼 함수들
 */

/**
 * 파일 경로에서 파일명과 폴더 경로를 추출
 * @param {string} filePath - 전체 파일 경로
 * @returns {Object} 파일 정보 객체
 */
export const getFileInfo = (filePath) => {
  if (!filePath) return { fileName: "", folderPath: "", displayPath: "" };

  const normalizedPath = filePath.replace(/\\\\/g, "/");
  const fileName = normalizedPath.split("/").pop() || "";
  const folderPath = normalizedPath.substring(0, normalizedPath.lastIndexOf("/"));
  const displayPath = folderPath.length > 50 ? "..." + folderPath.slice(-47) : folderPath;

  return { fileName, folderPath, displayPath };
};

/**
 * 파일 확장자 검증
 * @param {string} fileName - 파일명
 * @param {string[]} validExtensions - 유효한 확장자 배열
 * @returns {boolean} 유효성 여부
 */
export const isValidFileExtension = (fileName, validExtensions) => {
  if (!fileName || !validExtensions || validExtensions.length === 0) return false;

  const lowerFileName = fileName.toLowerCase();
  return validExtensions.some(ext => lowerFileName.endsWith(ext.toLowerCase()));
};

/**
 * SRT 파일 유효성 검사
 * @param {string} fileName - 파일명
 * @returns {boolean} SRT 파일 여부
 */
export const isSrtFile = (fileName) => {
  return isValidFileExtension(fileName, [".srt"]);
};

/**
 * 오디오 파일 유효성 검사
 * @param {string} fileName - 파일명
 * @returns {boolean} 오디오 파일 여부
 */
export const isAudioFile = (fileName) => {
  return isValidFileExtension(fileName, [".mp3", ".wav", ".m4a"]);
};

/**
 * 비디오 파일 유효성 검사
 * @param {string} fileName - 파일명
 * @returns {boolean} 비디오 파일 여부
 */
export const isVideoFile = (fileName) => {
  return isValidFileExtension(fileName, [".mp4", ".avi", ".mov", ".mkv", ".webm"]);
};

/**
 * 이미지 파일 유효성 검사
 * @param {string} fileName - 파일명
 * @returns {boolean} 이미지 파일 여부
 */
export const isImageFile = (fileName) => {
  return isValidFileExtension(fileName, [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]);
};

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 * @param {number} bytes - 바이트 크기
 * @returns {string} 포맷된 크기 문자열
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

/**
 * 시간(초)을 MM:SS 형태로 포맷
 * @param {number} seconds - 초 단위 시간
 * @returns {string} 포맷된 시간 문자열
 */
export const formatDuration = (seconds) => {
  if (!seconds || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

/**
 * 파일 드래그 앤 드롭 이벤트에서 파일 추출
 * @param {DragEvent} event - 드래그 이벤트
 * @param {string[]} acceptedExtensions - 허용된 확장자
 * @returns {File[]} 유효한 파일들의 배열
 */
export const extractFilesFromDrop = (event, acceptedExtensions) => {
  const files = Array.from(event.dataTransfer.files);

  if (acceptedExtensions && acceptedExtensions.length > 0) {
    return files.filter(file => isValidFileExtension(file.name, acceptedExtensions));
  }

  return files;
};

/**
 * 파일 경로가 절대 경로인지 확인
 * @param {string} path - 파일 경로
 * @returns {boolean} 절대 경로 여부
 */
export const isAbsolutePath = (path) => {
  if (!path) return false;

  // Windows 경로 (C:\\, D:\\, etc.)
  if (/^[A-Za-z]:[\\\/]/.test(path)) return true;

  // Unix/Linux 경로 (/)
  if (path.startsWith("/")) return true;

  return false;
};

/**
 * 경로를 정규화 (백슬래시를 슬래시로 변환)
 * @param {string} path - 파일 경로
 * @returns {string} 정규화된 경로
 */
export const normalizePath = (path) => {
  if (!path) return "";
  return path.replace(/\\\\/g, "/");
};

/**
 * 상대 경로를 절대 경로로 변환
 * @param {string} basePath - 기준 경로
 * @param {string} relativePath - 상대 경로
 * @returns {string} 절대 경로
 */
export const resolveRelativePath = (basePath, relativePath) => {
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
};