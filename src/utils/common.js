/**
 * 공통 유틸리티 함수 모음
 * 
 * @description
 * 프로젝트 전반에서 자주 사용되는 공통 유틸리티 함수들을 모아놓은 모듈
 * 시간 포맷팅, 파일 크기 계산, 문자열 처리, 배열 조작 등을 제공합니다.
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

// =========================== 시간 관련 유틸리티 ===========================

/**
 * 밀리초를 사람이 읽기 쉬운 형태로 포맷팅
 * 
 * @param {number} ms - 밀리초 단위 시간
 * @returns {string} 포맷된 시간 문자열 (예: "1.5s", "2m 30s")
 * 
 * @example
 * formatMs(1500) // "1.5s"
 * formatMs(90000) // "1m 30s"
 * formatMs(500) // "500ms"
 */
export function formatMs(ms) {
  if (!ms || ms < 0) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  
  const m = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${m}m ${ss}s`;
}

/**
 * 초를 시:분:초 형태로 포맷팅
 * 
 * @param {number} seconds - 초 단위 시간
 * @param {boolean} [includeHours=false] - 시간 포함 여부
 * @returns {string} 포맷된 시간 문자열
 * 
 * @example
 * formatSeconds(125) // "2:05"
 * formatSeconds(3725, true) // "1:02:05"
 */
export function formatSeconds(seconds, includeHours = false) {
  if (!seconds || seconds < 0) return includeHours ? "0:00:00" : "0:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (includeHours || hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 현재 시간을 로그 형태로 포맷팅
 * 
 * @returns {string} 현재 시간 (예: "14:30:25")
 */
export function getCurrentTimeString() {
  return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}

// =========================== 파일 크기 관련 유틸리티 ===========================

/**
 * 바이트를 읽기 쉬운 형태로 포맷팅
 * 
 * @param {number} bytes - 바이트 크기
 * @param {number} [decimals=2] - 소수점 자릿수
 * @returns {string} 포맷된 크기 문자열
 * 
 * @example
 * formatBytes(1024) // "1.00 KB"
 * formatBytes(1048576) // "1.00 MB"
 * formatBytes(1073741824, 1) // "1.0 GB"
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * 메가바이트를 바이트로 변환
 * 
 * @param {number} mb - 메가바이트 크기
 * @returns {number} 바이트 크기
 */
export function mbToBytes(mb) {
  return mb * 1024 * 1024;
}

/**
 * 바이트를 메가바이트로 변환
 * 
 * @param {number} bytes - 바이트 크기
 * @returns {number} 메가바이트 크기 (소수점 2자리)
 */
export function bytesToMB(bytes) {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

// =========================== 문자열 처리 유틸리티 ===========================

/**
 * 문자열을 지정된 길이로 잘라내기
 * 
 * @param {string} text - 원본 문자열
 * @param {number} maxLength - 최대 길이
 * @param {string} [suffix="..."] - 말줄임표 문자
 * @returns {string} 잘린 문자열
 * 
 * @example
 * truncateText("Hello World", 5) // "Hello..."
 * truncateText("Short", 10) // "Short"
 */
export function truncateText(text, maxLength, suffix = "...") {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * 문자열에서 키워드 하이라이트
 * 
 * @param {string} text - 원본 텍스트
 * @param {string} keyword - 하이라이트할 키워드
 * @param {string} [className="highlight"] - CSS 클래스명
 * @returns {string} 하이라이트된 HTML 문자열
 */
export function highlightKeyword(text, keyword, className = "highlight") {
  if (!text || !keyword) return text;
  
  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, `<span class="${className}">$1</span>`);
}

/**
 * 파일 확장자 추출
 * 
 * @param {string} filename - 파일명
 * @returns {string} 확장자 (점 제외)
 * 
 * @example
 * getFileExtension("document.pdf") // "pdf"
 * getFileExtension("image.jpg") // "jpg"
 */
export function getFileExtension(filename) {
  if (!filename || typeof filename !== 'string') return '';
  
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
}

/**
 * 안전한 파일명 생성 (특수문자 제거)
 * 
 * @param {string} filename - 원본 파일명
 * @returns {string} 안전한 파일명
 */
export function sanitizeFilename(filename) {
  if (!filename) return '';
  
  return filename
    .replace(/[<>:"/\\|?*]/g, '') // 금지된 문자 제거
    .replace(/\s+/g, '_') // 공백을 언더스코어로
    .replace(/_{2,}/g, '_') // 연속 언더스코어 제거
    .trim();
}

// =========================== 배열/객체 처리 유틸리티 ===========================

/**
 * 배열을 지정된 크기로 청킹
 * 
 * @param {Array} array - 원본 배열
 * @param {number} size - 청크 크기
 * @returns {Array<Array>} 청킹된 2차원 배열
 * 
 * @example
 * chunkArray([1,2,3,4,5], 2) // [[1,2], [3,4], [5]]
 */
export function chunkArray(array, size) {
  if (!Array.isArray(array) || size <= 0) return [];
  
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 배열에서 중복 제거
 * 
 * @param {Array} array - 원본 배열
 * @param {string} [key] - 객체 배열인 경우 비교할 키
 * @returns {Array} 중복이 제거된 배열
 */
export function removeDuplicates(array, key = null) {
  if (!Array.isArray(array)) return [];
  
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const val = item[key];
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  }
  
  return [...new Set(array)];
}

/**
 * 배열을 키로 그룹화
 * 
 * @param {Array} array - 원본 배열
 * @param {string|Function} key - 그룹화 키 또는 함수
 * @returns {Object} 그룹화된 객체
 * 
 * @example
 * groupBy([{type:'a',val:1},{type:'b',val:2}], 'type')
 * // {a: [{type:'a',val:1}], b: [{type:'b',val:2}]}
 */
export function groupBy(array, key) {
  if (!Array.isArray(array)) return {};
  
  return array.reduce((groups, item) => {
    const groupKey = typeof key === 'function' ? key(item) : item[key];
    const group = groups[groupKey] || [];
    group.push(item);
    groups[groupKey] = group;
    return groups;
  }, {});
}

/**
 * 객체 깊은 복사
 * 
 * @param {any} obj - 복사할 객체
 * @returns {any} 깊은 복사된 객체
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

// =========================== 숫자 처리 유틸리티 ===========================

/**
 * 숫자를 지정된 범위로 제한
 * 
 * @param {number} num - 원본 숫자
 * @param {number} min - 최솟값
 * @param {number} max - 최댓값
 * @returns {number} 범위 내 숫자
 */
export function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/**
 * 숫자를 백분율로 변환
 * 
 * @param {number} value - 현재값
 * @param {number} total - 전체값
 * @param {number} [decimals=2] - 소수점 자릿수
 * @returns {number} 백분율 (0-100)
 */
export function toPercentage(value, total, decimals = 2) {
  if (!total || total === 0) return 0;
  return Math.round((value / total) * 100 * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * 랜덤 정수 생성
 * 
 * @param {number} min - 최솟값 (포함)
 * @param {number} max - 최댓값 (포함)
 * @returns {number} 랜덤 정수
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =========================== URL/경로 처리 유틸리티 ===========================

/**
 * 쿼리 파라미터를 객체로 파싱
 * 
 * @param {string} queryString - 쿼리 문자열 (? 제외)
 * @returns {Object} 파싱된 객체
 * 
 * @example
 * parseQueryParams("name=john&age=25") // {name: "john", age: "25"}
 */
export function parseQueryParams(queryString) {
  if (!queryString) return {};
  
  const params = {};
  const pairs = queryString.split('&');
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }
  
  return params;
}

/**
 * 객체를 쿼리 문자열로 변환
 * 
 * @param {Object} params - 파라미터 객체
 * @returns {string} 쿼리 문자열
 */
export function objectToQueryString(params) {
  if (!params || typeof params !== 'object') return '';
  
  const pairs = Object.entries(params)
    .filter(([key, value]) => key && value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  
  return pairs.join('&');
}

// =========================== 디바운스/스로틀 유틸리티 ===========================

/**
 * 디바운스 함수 생성
 * 
 * @param {Function} func - 디바운스할 함수
 * @param {number} wait - 대기 시간 (ms)
 * @returns {Function} 디바운스된 함수
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 스로틀 함수 생성
 * 
 * @param {Function} func - 스로틀할 함수
 * @param {number} limit - 제한 시간 (ms)
 * @returns {Function} 스로틀된 함수
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}