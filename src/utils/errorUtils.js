/**
 * 에러 메시지를 사용자 친화적인 형태로 변환
 * @param {Error|string} error - 원본 에러 객체 또는 메시지
 * @param {string} context - 에러 발생 컨텍스트 (생성, 분석 등)
 * @returns {string} - 사용자 친화적인 에러 메시지
 */
export const formatErrorMessage = (error, context = '') => {
  const errorMessage = error?.message || String(error) || "알 수 없는 오류가 발생했습니다.";
  
  // API 관련 오류
  if (errorMessage.includes("402") && errorMessage.includes("credit")) {
    return "💳 크레딧이 부족합니다. 크레딧을 충전하거나 설정에서 다른 AI 엔진을 선택해주세요.";
  }
  
  if (errorMessage.includes("404") && errorMessage.includes("gemini")) {
    return "🤖 Gemini 모델을 찾을 수 없습니다. 최신 모델로 업데이트가 필요할 수 있습니다.";
  }
  
  if (errorMessage.includes("API_KEY") || errorMessage.includes("401") || errorMessage.includes("403")) {
    return "🔑 API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.";
  }
  
  if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
    return "⏱️ API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
  }
  
  if (errorMessage.includes("network") || errorMessage.includes("ENOTFOUND")) {
    return "🌐 네트워크 연결을 확인해주세요. 인터넷 연결이 불안정할 수 있습니다.";
  }

  // 파일 관련 오류
  if (errorMessage.includes("file") || errorMessage.includes("upload")) {
    return "📁 파일 업로드 중 오류가 발생했습니다. 파일을 다시 확인해주세요.";
  }

  // 분석 관련 오류
  if (context === "analysis" || errorMessage.includes("analysis")) {
    return "🔍 이미지 분석 중 오류가 발생했습니다. 다른 이미지로 시도해보세요.";
  }

  // 생성 관련 오류
  if (context === "generation" || errorMessage.includes("generation")) {
    return "🎨 썸네일 생성 중 오류가 발생했습니다. 설정을 확인하고 다시 시도해주세요.";
  }

  // 기본 메시지에 컨텍스트 추가
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