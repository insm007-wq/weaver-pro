/**
 * Electron API 호출을 위한 커스텀 훅
 * 
 * @description
 * Electron IPC 통신을 래핑하여 안전하고 일관된 API 호출을 제공하는 훅
 * 로딩 상태, 오류 처리, 재시도 로직 등을 포함합니다.
 * 
 * @features
 * - 🛡️ 안전한 IPC 통신 (window.api 존재 확인)
 * - 📊 자동 로딩 상태 관리
 * - 🔄 재시도 로직 및 오류 처리
 * - 🎯 타입별 API 호출 (invoke, send)
 * - 📝 자동 로그 기록
 * 
 * @example
 * ```jsx
 * import { useApi } from '../hooks/useApi';
 * 
 * function MyComponent() {
 *   const api = useApi();
 *   
 *   const handleSave = async () => {
 *     const result = await api.invoke('settings:save', { key: 'value' });
 *     if (result.success) {
 *       console.log('저장 완료');
 *     }
 *   };
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useCallback, useRef } from 'react';

/**
 * API 호출 결과 타입
 * 
 * @typedef {Object} ApiResult
 * @property {boolean} success - 성공 여부
 * @property {any} [data] - 응답 데이터
 * @property {string} [error] - 오류 메시지
 * @property {number} [code] - 오류 코드
 */

/**
 * Electron API 호출을 위한 커스텀 훅
 * 
 * @param {Object} [options] - 훅 옵션
 * @param {boolean} [options.enableLogging=true] - 로그 출력 여부
 * @param {number} [options.defaultTimeout=10000] - 기본 타임아웃 (ms)
 * @param {number} [options.maxRetries=3] - 최대 재시도 횟수
 * @returns {Object} API 호출 함수들과 상태를 포함한 객체
 */
export function useApi(options = {}) {
  const {
    enableLogging = true,
    defaultTimeout = 10000,
    maxRetries = 3
  } = options;

  // 상태 관리
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  /**
   * API 가용성 확인
   * 
   * @returns {boolean} API 사용 가능 여부
   */
  const isApiAvailable = useCallback(() => {
    return typeof window !== 'undefined' && window.api && typeof window.api.invoke === 'function';
  }, []);

  /**
   * 로그 출력 헬퍼
   * 
   * @param {string} level - 로그 레벨 (info, warn, error)
   * @param {string} message - 로그 메시지
   * @param {any} [data] - 추가 데이터
   */
  const log = useCallback((level, message, data) => {
    if (!enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [useApi] ${message}`;
    
    switch (level) {
      case 'info':
        console.log(logMessage, data);
        break;
      case 'warn':
        console.warn(logMessage, data);
        break;
      case 'error':
        console.error(logMessage, data);
        break;
      default:
        console.log(logMessage, data);
    }
  }, [enableLogging]);

  /**
   * 지연 실행 헬퍼
   * 
   * @param {number} ms - 지연 시간 (밀리초)
   * @returns {Promise<void>}
   */
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * IPC invoke 호출 (응답 대기)
   * 
   * @param {string} channel - IPC 채널명
   * @param {any} [payload] - 전송할 데이터
   * @param {Object} [callOptions] - 호출 옵션
   * @param {number} [callOptions.timeout] - 타임아웃 (ms)
   * @param {number} [callOptions.retries] - 재시도 횟수
   * @param {boolean} [callOptions.suppressErrors] - 오류 억제 여부
   * @returns {Promise<ApiResult>} API 호출 결과
   */
  const invoke = useCallback(async (channel, payload, callOptions = {}) => {
    const {
      timeout = defaultTimeout,
      retries = maxRetries,
      suppressErrors = false
    } = callOptions;

    // API 가용성 확인
    if (!isApiAvailable()) {
      const errorMsg = 'Electron API가 사용 불가능합니다.';
      log('error', errorMsg);
      return {
        success: false,
        error: errorMsg,
        code: 'API_NOT_AVAILABLE'
      };
    }

    setLoading(true);
    setError(null);

    let lastError = null;
    
    // 재시도 루프
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        log('info', `API 호출 시작: ${channel}`, { payload, attempt: attempt + 1 });

        // AbortController 설정 (타임아웃용)
        abortControllerRef.current = new AbortController();
        
        // 타임아웃 설정
        const timeoutPromise = new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`API 호출 타임아웃: ${channel} (${timeout}ms)`));
          }, timeout);
          
          // AbortController로 타임아웃 취소 가능
          abortControllerRef.current.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
          });
        });

        // API 호출과 타임아웃 경쟁
        const result = await Promise.race([
          window.api.invoke(channel, payload),
          timeoutPromise
        ]);

        log('info', `API 호출 성공: ${channel}`, result);
        
        setLoading(false);
        
        // 응답 구조 정규화
        if (result && typeof result === 'object') {
          return {
            success: result.ok !== false,
            data: result.data || result,
            error: result.error || result.message,
            code: result.code
          };
        }
        
        return {
          success: true,
          data: result
        };

      } catch (error) {
        lastError = error;
        log('warn', `API 호출 실패 (시도 ${attempt + 1}/${retries + 1}): ${channel}`, {
          error: error.message,
          payload
        });

        // 마지막 시도가 아니면 재시도 대기
        if (attempt < retries) {
          const delayMs = Math.pow(2, attempt) * 1000; // 지수 백오프
          log('info', `${delayMs}ms 후 재시도...`);
          await delay(delayMs);
        }
      }
    }

    // 모든 재시도 실패
    const errorMsg = lastError?.message || '알 수 없는 오류';
    
    if (!suppressErrors) {
      setError(errorMsg);
    }
    
    log('error', `API 호출 완전 실패: ${channel}`, {
      error: errorMsg,
      attempts: retries + 1
    });

    setLoading(false);

    return {
      success: false,
      error: errorMsg,
      code: 'INVOKE_FAILED'
    };
  }, [isApiAvailable, defaultTimeout, maxRetries, log]);

  /**
   * IPC send 호출 (응답 없음)
   * 
   * @param {string} channel - IPC 채널명
   * @param {any} [payload] - 전송할 데이터
   * @returns {Promise<ApiResult>} 전송 결과
   */
  const send = useCallback(async (channel, payload) => {
    if (!isApiAvailable()) {
      const errorMsg = 'Electron API가 사용 불가능합니다.';
      log('error', errorMsg);
      return {
        success: false,
        error: errorMsg,
        code: 'API_NOT_AVAILABLE'
      };
    }

    try {
      log('info', `API 전송: ${channel}`, payload);
      window.api.send(channel, payload);
      
      return {
        success: true
      };
    } catch (error) {
      const errorMsg = error?.message || '알 수 없는 오류';
      log('error', `API 전송 실패: ${channel}`, { error: errorMsg, payload });
      
      setError(errorMsg);
      
      return {
        success: false,
        error: errorMsg,
        code: 'SEND_FAILED'
      };
    }
  }, [isApiAvailable, log]);

  /**
   * 진행 중인 API 호출 취소
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      log('info', 'API 호출이 취소되었습니다.');
    }
    setLoading(false);
  }, [log]);

  /**
   * 오류 상태 초기화
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // API 호출 함수들
    invoke,
    send,
    
    // 유틸리티 함수들
    cancel,
    clearError,
    isApiAvailable,
    
    // 상태
    loading,
    error,
    
    // 설정
    options: {
      enableLogging,
      defaultTimeout,
      maxRetries
    }
  };
}

/**
 * 특정 채널에 최적화된 API 훅 생성기
 * 
 * @param {string} baseChannel - 기본 채널 접두사
 * @param {Object} [options] - 기본 옵션
 * @returns {Function} 특화된 API 훅
 * 
 * @example
 * ```jsx
 * const usePromptApi = createApiHook('prompts');
 * 
 * function MyComponent() {
 *   const promptApi = usePromptApi();
 *   
 *   const loadPrompts = () => promptApi.invoke('getAll');
 *   const savePrompt = (data) => promptApi.invoke('save', data);
 * }
 * ```
 */
export function createApiHook(baseChannel, options = {}) {
  return function useSpecializedApi(hookOptions = {}) {
    const api = useApi({ ...options, ...hookOptions });
    
    // 채널 접두사가 자동으로 붙는 래핑된 함수들
    const invoke = useCallback((subChannel, payload, callOptions) => {
      const fullChannel = `${baseChannel}:${subChannel}`;
      return api.invoke(fullChannel, payload, callOptions);
    }, [api]);

    const send = useCallback((subChannel, payload) => {
      const fullChannel = `${baseChannel}:${subChannel}`;
      return api.send(fullChannel, payload);
    }, [api]);

    return {
      ...api,
      invoke,
      send
    };
  };
}