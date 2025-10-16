/**
 * 보안 유틸리티 - XSS 방지 및 입력 검증
 */

// HTML 태그와 스크립트 제거를 위한 정규식
const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /<object[^>]*>.*?<\/object>/gi,
  /<embed[^>]*>.*?<\/embed>/gi,
  /on\w+\s*=\s*"[^"]*"/gi,
  /on\w+\s*=\s*'[^']*'/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /data:/gi
];

/**
 * HTML 콘텐츠를 안전하게 정제
 * @param {string} html - 정제할 HTML 문자열
 * @returns {string} 정제된 안전한 문자열
 */
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let sanitized = html;

  // 위험한 패턴들 제거
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // HTML 엔티티 인코딩
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');

  return sanitized;
}

/**
 * 텍스트 입력 검증 및 정제
 * @param {string} text - 검증할 텍스트
 * @param {Object} options - 검증 옵션
 * @returns {Object} {isValid: boolean, sanitized: string, errors: string[]}
 */
export function validateAndSanitizeText(text, options = {}) {
  const {
    maxLength = 50000,
    minLength = 0,
    allowEmpty = true,
    fieldName = 'input'
  } = options;

  const errors = [];

  // null/undefined 체크
  if (text == null) {
    if (!allowEmpty) {
      errors.push(`${fieldName}은(는) 필수 입력 항목입니다.`);
    }
    return { isValid: allowEmpty, sanitized: '', errors };
  }

  // 타입 체크
  if (typeof text !== 'string') {
    text = String(text);
  }

  // 길이 검증
  if (text.length < minLength) {
    errors.push(`${fieldName}은(는) ${minLength}자 이상이어야 합니다.`);
  }

  if (text.length > maxLength) {
    errors.push(`${fieldName}은(는) ${maxLength}자를 초과할 수 없습니다.`);
  }

  // HTML 정제
  const sanitized = sanitizeHtml(text);

  // 악성 스크립트 탐지
  if (text !== sanitized) {
    console.warn(`잠재적으로 위험한 콘텐츠가 감지되어 정제되었습니다: ${fieldName}`);
  }

  return {
    isValid: errors.length === 0,
    sanitized: sanitized.slice(0, maxLength), // 최대 길이로 자르기
    errors
  };
}

/**
 * 파일 경로 검증 및 정제 (Path Traversal 방지)
 * @param {string} path - 검증할 경로
 * @param {string} basePath - 허용된 기본 경로
 * @returns {Object} {isValid: boolean, sanitized: string, errors: string[]}
 */
export function validatePath(path, basePath) {
  const errors = [];

  if (!path || typeof path !== 'string') {
    errors.push('유효하지 않은 경로입니다.');
    return { isValid: false, sanitized: '', errors };
  }

  // 위험한 경로 패턴 제거
  const dangerousPatterns = [
    /\.\./g,        // 상위 디렉토리 접근
    /[<>:"|?*]/g,   // Windows 파일명 금지 문자
    /[\x00-\x1f]/g, // 제어 문자
  ];

  let sanitized = path;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  // 경로 정규화
  sanitized = sanitized
    .replace(/\\/g, '/')  // 백슬래시를 슬래시로 변환
    .replace(/\/+/g, '/') // 연속된 슬래시 제거
    .trim();

  // 기본 경로 검증
  if (basePath && !sanitized.startsWith(basePath.replace(/\\/g, '/'))) {
    errors.push('허용되지 않은 경로입니다.');
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}

/**
 * 폼 데이터 전체 검증
 * @param {Object} formData - 검증할 폼 데이터
 * @returns {Object} 검증 결과와 정제된 데이터
 */
export function validateFormData(formData) {
  const sanitizedData = {};
  const allErrors = {};
  let isValid = true;

  // 주제 검증
  if (formData.topic !== undefined) {
    const result = validateAndSanitizeText(formData.topic, {
      maxLength: 200,
      allowEmpty: true,
      fieldName: '영상 주제'
    });
    sanitizedData.topic = result.sanitized;
    if (!result.isValid) {
      allErrors.topic = result.errors;
      isValid = false;
    }
  }

  // 레퍼런스 대본 검증
  if (formData.referenceScript !== undefined) {
    const result = validateAndSanitizeText(formData.referenceScript, {
      maxLength: 100000,
      allowEmpty: true,
      fieldName: '레퍼런스 대본'
    });
    sanitizedData.referenceScript = result.sanitized;
    if (!result.isValid) {
      allErrors.referenceScript = result.errors;
      isValid = false;
    }
  }

  // 숫자 필드 검증
  const numericFields = ['durationMin', 'maxScenes'];
  numericFields.forEach(field => {
    if (formData[field] !== undefined) {
      const value = parseInt(formData[field]);
      if (isNaN(value) || value < 1 || value > 100) {
        allErrors[field] = [`${field}은(는) 1-100 사이의 숫자여야 합니다.`];
        isValid = false;
      } else {
        sanitizedData[field] = value;
      }
    }
  });

  // 문자열 필드 검증
  const stringFields = ['style', 'promptName', 'voiceId', 'aiEngine', 'ttsEngine'];
  stringFields.forEach(field => {
    if (formData[field] !== undefined) {
      const result = validateAndSanitizeText(formData[field], {
        maxLength: 100,
        allowEmpty: true,
        fieldName: field
      });
      sanitizedData[field] = result.sanitized;
      if (!result.isValid) {
        allErrors[field] = result.errors;
        isValid = false;
      }
    }
  });

  return {
    isValid,
    data: sanitizedData,
    errors: allErrors
  };
}