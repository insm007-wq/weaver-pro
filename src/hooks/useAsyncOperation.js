/**
 * 비동기 작업 관리를 위한 커스텀 훅
 * 
 * @description
 * 비동기 작업의 로딩 상태, 오류 처리, 재시도 로직을 자동으로 관리하는 훅
 * API 호출, 파일 처리, 장시간 작업 등에 활용할 수 있습니다.
 * 
 * @features
 * - 🔄 로딩 상태 자동 관리
 * - ⚠️ 오류 처리 및 재시도 로직
 * - 🎯 성공/실패 콜백 지원
 * - 📊 실행 시간 측정
 * - 🚫 요청 취소 기능
 * 
 * @example
 * ```jsx
 * import { useAsyncOperation } from '../hooks/useAsyncOperation';
 * 
 * function MyComponent() {
 *   const asyncOp = useAsyncOperation({
 *     onSuccess: (data) => console.log('성공!', data),
 *     onError: (error) => console.error('실패:', error)
 *   });
 *   
 *   const handleSubmit = async () => {
 *     await asyncOp.execute(() => api.saveData(formData));
 *   };
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * 비동기 작업 상태
 * 
 * @typedef {Object} AsyncOperationState
 * @property {boolean} loading - 로딩 중 여부
 * @property {any} data - 성공 시 결과 데이터
 * @property {Error|string|null} error - 오류 정보
 * @property {number|null} executionTime - 실행 시간 (ms)
 * @property {number} retryCount - 재시도 횟수
 * @property {boolean} cancelled - 취소 여부
 */

/**
 * 비동기 작업 관리 커스텀 훅
 * 
 * @param {Object} [options] - 설정 옵션
 * @param {Function} [options.onSuccess] - 성공 시 콜백
 * @param {Function} [options.onError] - 실패 시 콜백
 * @param {Function} [options.onFinally] - 완료 시 콜백 (성공/실패 무관)
 * @param {number} [options.maxRetries=3] - 최대 재시도 횟수
 * @param {number} [options.retryDelay=1000] - 재시도 간격 (ms)
 * @param {Function} [options.retryCondition] - 재시도 조건 함수
 * @param {boolean} [options.resetOnExecute=true] - 실행 시 이전 결과 초기화
 * @returns {Object} 비동기 작업 상태와 제어 함수들
 */
export function useAsyncOperation(options = {}) {
  const {
    onSuccess,
    onError,
    onFinally,
    maxRetries = 3,
    retryDelay = 1000,
    retryCondition = () => true,
    resetOnExecute = true
  } = options;

  // 상태 관리
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [executionTime, setExecutionTime] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [cancelled, setCancelled] = useState(false);

  // Ref로 관리할 값들
  const abortControllerRef = useRef(null);
  const startTimeRef = useRef(null);
  const retriesRef = useRef(0);

  /**
   * 상태 초기화
   */
  const reset = useCallback(() => {
    setLoading(false);
    setData(null);
    setError(null);
    setExecutionTime(null);
    setRetryCount(0);
    setCancelled(false);
    retriesRef.current = 0;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  /**
   * 작업 취소
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setCancelled(true);
      setLoading(false);
    }
  }, []);

  /**
   * 지연 실행 (재시도용)
   * 
   * @param {number} ms - 지연 시간
   * @returns {Promise<void>}
   */
  const delay = useCallback((ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  /**
   * 비동기 작업 실행
   * 
   * @param {Function} operation - 실행할 비동기 함수
   * @param {Object} [executeOptions] - 실행 옵션
   * @param {AbortSignal} [executeOptions.signal] - 외부 abort signal
   * @returns {Promise<any>} 작업 결과
   */
  const execute = useCallback(async (operation, executeOptions = {}) => {
    if (typeof operation !== 'function') {
      throw new Error('Operation must be a function');
    }

    // 이전 결과 초기화 (옵션에 따라)
    if (resetOnExecute) {
      setData(null);
      setError(null);
      setExecutionTime(null);
    }
    
    setCancelled(false);
    setLoading(true);
    retriesRef.current = 0;
    setRetryCount(0);
    startTimeRef.current = Date.now();

    // AbortController 설정
    abortControllerRef.current = new AbortController();
    const signal = executeOptions.signal || abortControllerRef.current.signal;

    try {
      let lastError = null;
      
      // 재시도 루프
      while (retriesRef.current <= maxRetries) {
        try {
          // 취소 확인
          if (signal.aborted) {
            setCancelled(true);
            return null;
          }

          // 재시도가 아닌 첫 시도가 아니면 지연
          if (retriesRef.current > 0) {
            await delay(retryDelay * Math.pow(2, retriesRef.current - 1)); // 지수 백오프
            
            // 지연 후에도 취소 확인
            if (signal.aborted) {
              setCancelled(true);
              return null;
            }
          }

          // 작업 실행
          const result = await operation(signal);

          // 성공 처리
          const endTime = Date.now();
          const totalTime = endTime - startTimeRef.current;
          
          setData(result);
          setExecutionTime(totalTime);
          setLoading(false);
          
          onSuccess?.(result, totalTime);
          onFinally?.(result, null, totalTime);
          
          return result;

        } catch (err) {
          lastError = err;
          
          // AbortError는 재시도하지 않음
          if (err.name === 'AbortError') {
            setCancelled(true);
            return null;
          }

          retriesRef.current++;
          setRetryCount(retriesRef.current);

          // 더 이상 재시도하지 않거나 재시도 조건을 만족하지 않으면 종료
          if (retriesRef.current > maxRetries || !retryCondition(err, retriesRef.current)) {
            break;
          }
        }
      }

      // 모든 재시도 실패
      throw lastError;

    } catch (err) {
      const endTime = Date.now();
      const totalTime = endTime - startTimeRef.current;
      
      if (err.name !== 'AbortError') {
        setError(err);
        setExecutionTime(totalTime);
        onError?.(err, totalTime);
        onFinally?.(null, err, totalTime);
      }
      
      setLoading(false);
      throw err;

    } finally {
      abortControllerRef.current = null;
    }
  }, [
    resetOnExecute,
    maxRetries,
    retryDelay,
    retryCondition,
    onSuccess,
    onError,
    onFinally,
    delay
  ]);

  /**
   * 마지막 작업 재실행
   */
  const retry = useCallback(() => {
    if (lastOperationRef.current) {
      return execute(lastOperationRef.current);
    }
  }, [execute]);

  // 마지막 작업 저장용 ref
  const lastOperationRef = useRef(null);

  // execute 호출 시 마지막 작업 저장
  const executeWithHistory = useCallback(async (operation, options) => {
    lastOperationRef.current = operation;
    return execute(operation, options);
  }, [execute]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // 상태
    loading,
    data,
    error,
    executionTime,
    retryCount,
    cancelled,
    
    // 계산된 상태
    hasData: data !== null,
    hasError: error !== null,
    isIdle: !loading && !data && !error,
    canRetry: !loading && error && retriesRef.current <= maxRetries,
    
    // 제어 함수
    execute: executeWithHistory,
    retry,
    cancel,
    reset,
    
    // 유틸리티
    formatExecutionTime: () => executionTime ? `${executionTime}ms` : null
  };
}

/**
 * 여러 비동기 작업을 병렬로 실행하는 훅
 * 
 * @param {Object} [options] - 설정 옵션
 * @returns {Object} 병렬 작업 관리 객체
 */
export function useAsyncBatch(options = {}) {
  const {
    onAllSuccess,
    onAnyError,
    onFinally,
    failFast = true // 하나라도 실패하면 전체 중단
  } = options;

  const [operations, setOperations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);

  /**
   * 여러 작업을 병렬로 실행
   * 
   * @param {Array<Function>} tasks - 실행할 작업 배열
   * @returns {Promise<Array>} 모든 작업의 결과
   */
  const executeAll = useCallback(async (tasks) => {
    if (!Array.isArray(tasks)) {
      throw new Error('Tasks must be an array');
    }

    setLoading(true);
    setResults([]);
    setErrors([]);

    const taskResults = [];
    const taskErrors = [];

    try {
      if (failFast) {
        // Promise.all 사용 (하나라도 실패하면 전체 실패)
        const results = await Promise.all(tasks.map((task, index) => 
          task().catch(err => {
            taskErrors[index] = err;
            throw err;
          })
        ));
        taskResults.push(...results);
      } else {
        // Promise.allSettled 사용 (모든 작업 완료까지 대기)
        const results = await Promise.allSettled(tasks.map(task => task()));
        
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            taskResults[index] = result.value;
          } else {
            taskErrors[index] = result.reason;
          }
        });
      }

      setResults(taskResults);
      setErrors(taskErrors);

      const hasErrors = taskErrors.some(err => err !== undefined);
      
      if (hasErrors) {
        onAnyError?.(taskErrors, taskResults);
      } else {
        onAllSuccess?.(taskResults);
      }

      onFinally?.(taskResults, taskErrors);

      return taskResults;

    } catch (error) {
      setErrors(taskErrors);
      onAnyError?.(taskErrors, taskResults);
      onFinally?.(taskResults, taskErrors);
      throw error;

    } finally {
      setLoading(false);
    }
  }, [failFast, onAllSuccess, onAnyError, onFinally]);

  return {
    loading,
    results,
    errors,
    executeAll,
    hasErrors: errors.some(err => err !== undefined),
    successCount: results.filter(r => r !== undefined).length,
    errorCount: errors.filter(e => e !== undefined).length
  };
}