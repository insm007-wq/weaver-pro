import { MAX_UPLOAD_MB, SUPPORTED_IMAGE_TYPES } from '../constants/thumbnailConstants';

/**
 * 파일 유효성 검사
 * @param {File} file - 검사할 파일
 * @returns {Object} { isValid: boolean, error: string }
 */
export const validateImageFile = (file) => {
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
};

/**
 * 파일 크기를 읽기 쉬운 형태로 변환
 * @param {number} bytes - 바이트 단위 크기
 * @returns {string} - "1.2MB" 형태의 문자열
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 안전하게 URL을 해제하는 함수
 * @param {Object} urlRef - URL을 담고 있는 ref 객체
 */
export const safeRevokeObjectURL = (urlRef) => {
  if (urlRef.current) {
    URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }
};

/**
 * 이미지 미리보기 URL 생성
 * @param {File} file - 이미지 파일
 * @param {Object} prevUrlRef - 이전 URL ref (정리용)
 * @returns {string} - 새로운 Object URL
 */
export const createImagePreview = (file, prevUrlRef) => {
  // 이전 URL 정리
  safeRevokeObjectURL(prevUrlRef);
  
  // 새 URL 생성
  const url = URL.createObjectURL(file);
  prevUrlRef.current = url;
  
  return url;
};