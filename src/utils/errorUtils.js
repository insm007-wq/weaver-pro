// 전역 토스트 함수 import
import { showGlobalToast } from '../components/common/GlobalToast';

/**
 * 에러 코드별 상세 메시지 매핑
 */
const ERROR_MESSAGES = {
  // API 인증 관련
  'no_anthropic_key': '🔑 Anthropic API 키가 설정되지 않았습니다. 설정에서 API 키를 확인해주세요.',
  'no_gemini_key': '🔑 Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 확인해주세요.',
  'no_replicate_key': '🔑 Replicate API 키가 설정되지 않았습니다. 설정에서 API 키를 확인해주세요.',
  'invalid_api_key': '🔑 API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.',
  
  // 크레딧 관련
  'insufficient_credits': '💳 크레딧이 부족합니다. 크레딧을 충전하거나 다른 AI 엔진을 선택해주세요.',
  'credit_limit_exceeded': '💳 크레딧 한도를 초과했습니다. 크레딧을 충전해주세요.',
  
  // API 사용량 관련
  'rate_limit_exceeded': '⏱️ API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  'quota_exceeded': '📊 일일 사용량을 초과했습니다. 내일 다시 시도해주세요.',
  
  // 서비스 관련
  'service_unavailable': '🚧 서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
  'model_not_found': '🤖 AI 모델을 찾을 수 없습니다. 최신 모델로 업데이트가 필요할 수 있습니다.',
  'model_overloaded': '⚡ AI 모델이 과부하 상태입니다. 잠시 후 다시 시도해주세요.',
  
  // 네트워크 관련
  'network_error': '🌐 네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.',
  'timeout_error': '⏰ 요청 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.',
  'connection_refused': '🔌 서버에 연결할 수 없습니다. 네트워크 설정을 확인해주세요.',
  
  // 파일 관련
  'file_not_found': '📁 파일을 찾을 수 없습니다. 파일 경로를 확인해주세요.',
  'invalid_file_format': '📄 지원하지 않는 파일 형식입니다. 올바른 형식의 파일을 업로드해주세요.',
  'file_too_large': '📏 파일이 너무 큽니다. 파일 크기를 줄여주세요.',
  'file_corrupted': '💥 파일이 손상되었습니다. 다른 파일을 시도해보세요.',
  'invalid_image_file': '🖼️ 유효하지 않은 이미지 파일입니다. 다른 이미지를 시도해보세요.',
  
  // 입력 검증 관련
  'validation_failed': '✅ 입력 데이터를 확인해주세요. 필수 항목이 누락되었을 수 있습니다.',
  'invalid_input': '📝 입력값이 올바르지 않습니다. 다시 확인해주세요.',
  'missing_required_field': '❗ 필수 항목이 누락되었습니다. 모든 필드를 입력해주세요.',
  
  // 기능별 특수 오류
  'analysis_failed': '🔍 이미지 분석에 실패했습니다. 다른 이미지로 시도해보세요.',
  'generation_failed': '🎨 썸네일 생성에 실패했습니다. 설정을 확인하고 다시 시도해주세요.',
  'template_loading_error': '📋 템플릿을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.',
  'prompt_processing_error': '💭 프롬프트 처리 중 오류가 발생했습니다. 프롬프트를 수정해보세요.',
  
  // 권한 관련
  'permission_denied': '🚫 권한이 없습니다. 관리자에게 문의해주세요.',
  'access_denied': '🔒 접근이 거부되었습니다. 로그인 상태를 확인해주세요.',
  
  // 시스템 관련
  'internal_server_error': '🔧 서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  'database_error': '💾 데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  'configuration_error': '⚙️ 설정 오류가 발생했습니다. 설정을 확인해주세요.',
};

/**
 * HTTP 상태 코드별 메시지 매핑
 */
const HTTP_ERROR_MESSAGES = {
  400: '📝 요청이 올바르지 않습니다. 입력 내용을 확인해주세요.',
  401: '🔑 인증이 필요합니다. API 키를 확인해주세요.',
  402: '💳 결제가 필요합니다. 크레딧을 충전해주세요.',
  403: '🚫 접근 권한이 없습니다.',
  404: '🔍 요청한 리소스를 찾을 수 없습니다.',
  408: '⏰ 요청 시간이 초과되었습니다.',
  409: '⚠️ 요청이 충돌했습니다. 다시 시도해주세요.',
  413: '📏 요청 데이터가 너무 큽니다.',
  429: '⏱️ 너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
  500: '🔧 서버 내부 오류가 발생했습니다.',
  502: '🔌 서버 게이트웨이 오류입니다.',
  503: '🚧 서비스를 일시적으로 사용할 수 없습니다.',
  504: '⏰ 게이트웨이 시간 초과입니다.',
};

/**
 * 컨텍스트별 접두사
 */
const CONTEXT_PREFIXES = {
  'analysis': '🔍 분석',
  'generation': '🎨 생성',
  'upload': '📁 업로드',
  'download': '⬇️ 다운로드',
  'save': '💾 저장',
  'load': '📂 로드',
  'validation': '✅ 검증',
  'initialization': '🚀 초기화',
  'processing': '⚙️ 처리',
  'authentication': '🔐 인증',
  'service': '🔧 서비스',
};

/**
 * 에러 메시지를 사용자 친화적인 형태로 변환
 * @param {Error|string} error - 원본 에러 객체 또는 메시지
 * @param {string} context - 에러 발생 컨텍스트
 * @returns {string} - 사용자 친화적인 에러 메시지
 */
export const formatErrorMessage = (error, context = '') => {
  const errorMessage = error?.message || String(error) || "알 수 없는 오류가 발생했습니다.";
  
  // 직접 매핑된 에러 코드 확인
  if (ERROR_MESSAGES[errorMessage]) {
    return ERROR_MESSAGES[errorMessage];
  }
  
  // HTTP 상태 코드 확인
  const statusMatch = errorMessage.match(/(\d{3})/);
  if (statusMatch) {
    const statusCode = parseInt(statusMatch[1]);
    if (HTTP_ERROR_MESSAGES[statusCode]) {
      return HTTP_ERROR_MESSAGES[statusCode];
    }
  }
  
  // 키워드 기반 매칭 (기존 로직 유지 + 확장)
  const lowerMessage = errorMessage.toLowerCase();
  
  // API 관련 키워드
  if (lowerMessage.includes('api key') || lowerMessage.includes('api_key') || lowerMessage.includes('invalid key')) {
    return ERROR_MESSAGES.invalid_api_key;
  }
  
  if (lowerMessage.includes('credit') && (lowerMessage.includes('insufficient') || lowerMessage.includes('lack'))) {
    return ERROR_MESSAGES.insufficient_credits;
  }
  
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
    return ERROR_MESSAGES.rate_limit_exceeded;
  }
  
  if (lowerMessage.includes('quota') && lowerMessage.includes('exceeded')) {
    return ERROR_MESSAGES.quota_exceeded;
  }
  
  // 네트워크 관련 키워드
  if (lowerMessage.includes('network') || lowerMessage.includes('enotfound') || lowerMessage.includes('connection failed')) {
    return ERROR_MESSAGES.network_error;
  }
  
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return ERROR_MESSAGES.timeout_error;
  }
  
  // 파일 관련 키워드
  if (lowerMessage.includes('file not found') || lowerMessage.includes('enoent')) {
    return ERROR_MESSAGES.file_not_found;
  }
  
  if (lowerMessage.includes('invalid') && lowerMessage.includes('file')) {
    return ERROR_MESSAGES.invalid_file_format;
  }
  
  if (lowerMessage.includes('file too large') || lowerMessage.includes('payload too large')) {
    return ERROR_MESSAGES.file_too_large;
  }
  
  // 서비스 관련 키워드
  if (lowerMessage.includes('service unavailable') || lowerMessage.includes('temporarily unavailable')) {
    return ERROR_MESSAGES.service_unavailable;
  }
  
  if (lowerMessage.includes('model') && (lowerMessage.includes('not found') || lowerMessage.includes('unavailable'))) {
    return ERROR_MESSAGES.model_not_found;
  }
  
  // 기본 메시지에 컨텍스트 추가
  if (context && CONTEXT_PREFIXES[context]) {
    return `${CONTEXT_PREFIXES[context]} 중 오류: ${errorMessage}`;
  }
  
  const contextPrefix = context ? `${context} 중 ` : '';
  return `${contextPrefix}${errorMessage}`;
};

/**
 * 토스트 메시지 생성 헬퍼
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {string} message - 메시지 내용
 * @returns {Object} - 토스트 객체
 */
export const createToast = (type, message) => ({
  type,
  text: message,
});

/**
 * 성공 토스트 생성
 */
export const createSuccessToast = (message) => createToast('success', message);

/**
 * 에러 토스트 생성
 */
export const createErrorToast = (error, context) => 
  createToast('error', formatErrorMessage(error, context));

/**
 * 경고 토스트 생성  
 */
export const createWarningToast = (message) => createToast('warning', message);

/**
 * 정보 토스트 생성
 */
export const createInfoToast = (message) => createToast('info', message);

/**
 * 에러 로깅 및 보고 시스템
 */
class ErrorManager {
  constructor() {
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.errorCallbacks = [];
  }

  /**
   * 에러 로깅
   */
  logError(error, context = '', metadata = {}) {
    const errorEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      context,
      metadata,
      stack: error?.stack,
      userAgent: navigator?.userAgent,
      url: window?.location?.href,
    };

    this.errorHistory.unshift(errorEntry);
    
    // 히스토리 크기 제한
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }

    // 콜백 실행
    this.errorCallbacks.forEach(callback => {
      try {
        callback(errorEntry);
      } catch (e) {
        console.warn('Error callback failed:', e);
      }
    });

    // 개발 모드에서만 콘솔 로깅
    if (process.env.NODE_ENV === 'development') {
      console.error(`[ERROR] ${context}:`, error);
    }

    return errorEntry;
  }

  /**
   * 에러 콜백 등록
   */
  onError(callback) {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * 에러 히스토리 조회
   */
  getErrorHistory(limit = 10) {
    return this.errorHistory.slice(0, limit);
  }

  /**
   * 특정 컨텍스트의 에러만 조회
   */
  getErrorsByContext(context) {
    return this.errorHistory.filter(error => error.context === context);
  }

  /**
   * 에러 통계
   */
  getErrorStats() {
    const stats = {
      total: this.errorHistory.length,
      byContext: {},
      recent: 0, // 최근 1시간
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    this.errorHistory.forEach(error => {
      // 컨텍스트별 통계
      if (!stats.byContext[error.context]) {
        stats.byContext[error.context] = 0;
      }
      stats.byContext[error.context]++;

      // 최근 에러 카운트
      if (new Date(error.timestamp) > oneHourAgo) {
        stats.recent++;
      }
    });

    return stats;
  }

  /**
   * 에러 히스토리 초기화
   */
  clearHistory() {
    this.errorHistory = [];
  }
}

// 전역 에러 매니저 인스턴스
const errorManager = new ErrorManager();

/**
 * 에러 처리 및 토스트 생성을 한 번에 처리하는 헬퍼
 * @param {Error|string} error - 에러 객체 또는 메시지
 * @param {string} context - 에러 발생 컨텍스트
 * @param {Object} options - 추가 옵션
 * @returns {Object} - 토스트 객체
 */
export const handleError = (error, context = '', options = {}) => {
  const {
    showToast = true,
    logError = true,
    metadata = {},
    customMessage = null
  } = options;

  // 에러 로깅
  if (logError) {
    errorManager.logError(error, context, metadata);
  }

  // 사용자 친화적 메시지 생성
  const friendlyMessage = customMessage || formatErrorMessage(error, context);
  
  // 토스트 객체 생성
  const toast = createErrorToast(friendlyMessage);
  
  // 전역 토스트 표시
  if (showToast && toast) {
    showGlobalToast(toast);
  }
  
  return {
    toast: showToast ? toast : null,
    message: friendlyMessage,
    originalError: error,
    errorId: errorManager.errorHistory[0]?.id
  };
};

/**
 * 비동기 함수를 래핑하여 에러 처리를 자동화
 * @param {Function} fn - 래핑할 비동기 함수
 * @param {string} context - 에러 컨텍스트
 * @param {Object} options - 에러 처리 옵션
 * @returns {Function} - 래핑된 함수
 */
export const withErrorHandling = (fn, context = '', options = {}) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const result = handleError(error, context, options);
      
      if (options.rethrow !== false) {
        throw error;
      }
      
      return { error: result, success: false };
    }
  };
};

/**
 * API 호출 전용 에러 핸들러
 * @param {Error} error - API 에러
 * @param {string} endpoint - API 엔드포인트
 * @returns {Object} - 처리된 에러 정보
 */
export const handleApiError = (error, endpoint = '') => {
  const context = endpoint ? `API:${endpoint}` : 'API';
  
  return handleError(error, context, {
    metadata: {
      endpoint,
      timestamp: Date.now(),
      userAgent: navigator?.userAgent
    }
  });
};

/**
 * 파일 작업 전용 에러 핸들러
 * @param {Error} error - 파일 에러
 * @param {string} operation - 파일 작업 유형
 * @param {string} fileName - 파일명
 * @returns {Object} - 처리된 에러 정보
 */
export const handleFileError = (error, operation = '', fileName = '') => {
  const context = operation ? `File:${operation}` : 'File';
  
  return handleError(error, context, {
    metadata: {
      operation,
      fileName,
      fileSize: error?.fileSize || null
    }
  });
};

/**
 * 검증 에러 핸들러
 * @param {string|Array} validationErrors - 검증 에러 메시지들
 * @param {string} formName - 폼 이름
 * @returns {Object} - 처리된 에러 정보
 */
export const handleValidationError = (validationErrors, formName = '') => {
  const errors = Array.isArray(validationErrors) ? validationErrors : [validationErrors];
  const message = errors.join(', ');
  const context = formName ? `Validation:${formName}` : 'Validation';
  
  return handleError(message, context, {
    metadata: {
      validationErrors: errors,
      formName
    }
  });
};

/**
 * 네트워크 에러 핸들러
 * @param {Error} error - 네트워크 에러
 * @param {string} url - 요청 URL
 * @param {string} method - HTTP 메서드
 * @returns {Object} - 처리된 에러 정보
 */
export const handleNetworkError = (error, url = '', method = 'GET') => {
  return handleError(error, 'Network', {
    metadata: {
      url,
      method,
      isOnline: navigator?.onLine,
      connectionType: navigator?.connection?.effectiveType
    }
  });
};

/**
 * 에러 복구 제안 시스템
 */
export const getRecoveryActions = (error, context = '') => {
  const errorMessage = error?.message || String(error);
  const lowerMessage = errorMessage.toLowerCase();
  
  const actions = [];
  
  // API 키 관련
  if (lowerMessage.includes('api key') || lowerMessage.includes('unauthorized')) {
    actions.push({
      label: '설정에서 API 키 확인',
      action: 'navigate',
      target: '/settings/api'
    });
  }
  
  // 네트워크 관련
  if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
    actions.push({
      label: '네트워크 연결 확인',
      action: 'check',
      target: 'network'
    });
    actions.push({
      label: '다시 시도',
      action: 'retry',
      target: 'current_operation'
    });
  }
  
  // 크레딧 관련
  if (lowerMessage.includes('credit') || lowerMessage.includes('billing')) {
    actions.push({
      label: '크레딧 충전',
      action: 'external',
      target: 'billing_page'
    });
    actions.push({
      label: '다른 AI 엔진 선택',
      action: 'navigate',
      target: '/settings/engines'
    });
  }
  
  // 파일 관련
  if (lowerMessage.includes('file') && context.includes('upload')) {
    actions.push({
      label: '다른 파일 선택',
      action: 'retry',
      target: 'file_selection'
    });
    actions.push({
      label: '파일 크기 확인',
      action: 'check',
      target: 'file_size'
    });
  }
  
  // 공통 액션
  actions.push({
    label: '새로고침',
    action: 'refresh',
    target: 'page'
  });
  
  return actions;
};

// 에러 매니저 인스턴스 내보내기
export { errorManager };

// 에러 매니저의 주요 메서드들을 직접 내보내기
export const logError = (error, context, metadata) => errorManager.logError(error, context, metadata);
export const onError = (callback) => errorManager.onError(callback);
export const getErrorHistory = (limit) => errorManager.getErrorHistory(limit);
export const getErrorStats = () => errorManager.getErrorStats();
export const clearErrorHistory = () => errorManager.clearHistory();