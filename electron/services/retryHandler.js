// electron/services/retryHandler.js

class RetryHandler {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }

  async execute(operation, context = {}) {
    let lastError;
    let maxRetries = this.maxRetries;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[retry] Attempt ${attempt + 1}/${this.maxRetries + 1} for ${context.operationName || 'operation'}`);
        return await operation();
      } catch (error) {
        lastError = error;
        console.error(`[retry] Attempt ${attempt + 1} failed:`, error.message);
        
        // 503 오류의 경우 더 많은 재시도 허용
        if (error?.response?.status === 503 || 
            error?.message?.toLowerCase().includes('overloaded')) {
          maxRetries = Math.max(maxRetries, 5); // 503 오류는 최대 5회 재시도
        }
        
        if (attempt === maxRetries) {
          console.error(`[retry] Max retries (${maxRetries + 1}) reached for ${context.operationName || 'operation'}`);
          break;
        }
        
        // 재시도 가능한 에러인지 확인
        if (this.isRetryable(error)) {
          const delay = this.calculateDelay(attempt, error);
          console.log(`[retry] Retrying after ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        console.error(`[retry] Non-retryable error, throwing immediately`);
        throw error; // 재시도 불가능한 에러는 즉시 throw
      }
    }
    
    throw lastError;
  }

  isRetryable(error) {
    // 네트워크 관련 에러
    const retryableErrors = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'];
    if (retryableErrors.includes(error.code)) {
      return true;
    }
    
    // HTTP 5xx 에러 (서버 측 일시적 오류)
    if (error.response?.status >= 500) {
      return true;
    }
    
    // 503 Service Unavailable (과부하 상황)
    if (error.response?.status === 503) {
      return true;
    }
    
    // Rate limiting (429)
    if (error.response?.status === 429) {
      return true;
    }
    
    // API 특정 재시도 가능 에러
    const message = error.message?.toLowerCase() || '';
    if (message.includes('timeout') || 
        message.includes('temporarily unavailable') ||
        message.includes('service unavailable') ||
        message.includes('overloaded') ||
        message.includes('unavailable')) {
      return true;
    }
    
    return false;
  }

  calculateDelay(attempt, error = null) {
    // 503 Service Unavailable (과부하) 전용 대기 시간
    if (error?.response?.status === 503 || 
        error?.message?.toLowerCase().includes('overloaded')) {
      // 과부하 상황: 더 긴 대기 시간 적용 (5초 + 점진적 증가)
      const overloadDelay = 5000 + (attempt * 3000); // 5초, 8초, 11초, 14초...
      const jitter = Math.random() * 2000; // 0-2000ms 랜덤 지터
      console.log(`[retry] Using overload-specific delay: ${overloadDelay + jitter}ms`);
      return overloadDelay + jitter;
    }
    
    // 일반적인 지수 백오프 with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1000ms 랜덤 지터
    return exponentialDelay + jitter;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RetryHandler;