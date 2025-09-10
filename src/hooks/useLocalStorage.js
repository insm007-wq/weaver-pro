/**
 * LocalStorage 상태 관리를 위한 커스텀 훅
 * 
 * @description
 * 로컬스토리지와 React 상태를 동기화하여 데이터 영속성을 제공하는 훅
 * JSON 직렬화/역직렬화, 타입 검증, 오류 처리 등을 자동으로 처리합니다.
 * 
 * @features
 * - 🔄 React 상태와 LocalStorage 자동 동기화
 * - 📦 JSON 직렬화/역직렬화 자동 처리
 * - 🛡️ 타입 안전성 및 오류 처리
 * - 🎯 초기값 설정 및 검증
 * - 🔧 커스텀 직렬화/역직렬화 함수 지원
 * - ⚡ 메모리 효율적인 구현
 * 
 * @example
 * ```jsx
 * import { useLocalStorage } from '../hooks/useLocalStorage';
 * 
 * function MyComponent() {
 *   const [user, setUser] = useLocalStorage('user', { name: '', email: '' });
 *   const [theme, setTheme] = useLocalStorage('theme', 'light');
 *   
 *   const updateUser = (newData) => {
 *     setUser(prevUser => ({ ...prevUser, ...newData }));
 *   };
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * LocalStorage에서 값을 안전하게 읽기
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {any} defaultValue - 기본값
 * @param {Function} [deserializer] - 커스텀 역직렬화 함수
 * @returns {any} 저장된 값 또는 기본값
 */
function getStorageValue(key, defaultValue, deserializer) {
  // 서버 사이드 렌더링 환경에서는 기본값 반환
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const item = window.localStorage.getItem(key);
    
    if (item === null) {
      return defaultValue;
    }

    // 커스텀 역직렬화 함수가 있으면 사용
    if (deserializer) {
      return deserializer(item);
    }

    // JSON 파싱 시도
    return JSON.parse(item);
  } catch (error) {
    console.warn(`LocalStorage 읽기 오류 [${key}]:`, error);
    return defaultValue;
  }
}

/**
 * LocalStorage에 값을 안전하게 저장
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {any} value - 저장할 값
 * @param {Function} [serializer] - 커스텀 직렬화 함수
 * @returns {boolean} 저장 성공 여부
 */
function setStorageValue(key, value, serializer) {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // 커스텀 직렬화 함수가 있으면 사용
    const serializedValue = serializer ? serializer(value) : JSON.stringify(value);
    window.localStorage.setItem(key, serializedValue);
    return true;
  } catch (error) {
    console.error(`LocalStorage 저장 오류 [${key}]:`, error);
    return false;
  }
}

/**
 * LocalStorage 상태 관리 커스텀 훅
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {any} defaultValue - 초기값/기본값
 * @param {Object} [options] - 추가 옵션
 * @param {Function} [options.serializer] - 커스텀 직렬화 함수
 * @param {Function} [options.deserializer] - 커스텀 역직렬화 함수
 * @param {Function} [options.validator] - 값 검증 함수
 * @param {boolean} [options.syncAcrossTabs=false] - 탭 간 동기화 여부
 * @returns {[any, Function, Function]} [값, 설정함수, 제거함수]
 */
export function useLocalStorage(key, defaultValue, options = {}) {
  const {
    serializer,
    deserializer,
    validator,
    syncAcrossTabs = false
  } = options;

  // 키가 변경될 때를 감지하기 위한 ref
  const keyRef = useRef(key);
  
  // 초기 상태 설정
  const [storedValue, setStoredValue] = useState(() => {
    const value = getStorageValue(key, defaultValue, deserializer);
    
    // 검증 함수가 있으면 검증 수행
    if (validator && !validator(value)) {
      console.warn(`LocalStorage 값 검증 실패 [${key}]:`, value);
      return defaultValue;
    }
    
    return value;
  });

  /**
   * 값 업데이트 함수
   * 
   * @param {any|Function} value - 새 값 또는 업데이트 함수
   */
  const setValue = useCallback((value) => {
    try {
      // 함수인 경우 현재 값을 인자로 호출
      const valueToStore = value instanceof Function ? value(storedValue) : value;

      // 검증 함수가 있으면 검증 수행
      if (validator && !validator(valueToStore)) {
        console.warn(`LocalStorage 값 검증 실패 [${key}]:`, valueToStore);
        return;
      }

      // 상태 업데이트
      setStoredValue(valueToStore);

      // LocalStorage에 저장
      setStorageValue(key, valueToStore, serializer);

    } catch (error) {
      console.error(`LocalStorage 값 설정 오류 [${key}]:`, error);
    }
  }, [key, storedValue, validator, serializer]);

  /**
   * 저장된 값 제거 함수
   */
  const removeValue = useCallback(() => {
    try {
      setStoredValue(defaultValue);
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(`LocalStorage 값 제거 오류 [${key}]:`, error);
    }
  }, [key, defaultValue]);

  /**
   * 다른 탭에서의 변경사항을 감지하는 이벤트 리스너
   */
  useEffect(() => {
    // 키가 변경되었으면 새 값으로 상태 업데이트
    if (keyRef.current !== key) {
      keyRef.current = key;
      const newValue = getStorageValue(key, defaultValue, deserializer);
      setStoredValue(newValue);
    }

    // 탭 간 동기화가 비활성화되어 있으면 리스너 등록 안함
    if (!syncAcrossTabs) {
      return;
    }

    /**
     * Storage 이벤트 핸들러 (다른 탭에서의 변경사항 감지)
     * 
     * @param {StorageEvent} e - Storage 이벤트
     */
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = deserializer ? deserializer(e.newValue) : JSON.parse(e.newValue);
          
          // 검증 함수가 있으면 검증 수행
          if (validator && !validator(newValue)) {
            console.warn(`다른 탭에서 받은 값 검증 실패 [${key}]:`, newValue);
            return;
          }
          
          setStoredValue(newValue);
        } catch (error) {
          console.error(`Storage 이벤트 처리 오류 [${key}]:`, error);
        }
      } else if (e.key === key && e.newValue === null) {
        // 값이 삭제된 경우
        setStoredValue(defaultValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, defaultValue, deserializer, validator, syncAcrossTabs]);

  return [storedValue, setValue, removeValue];
}

/**
 * 특정 타입에 최적화된 LocalStorage 훅들
 */

/**
 * 문자열 전용 LocalStorage 훅
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {string} [defaultValue=""] - 기본값
 * @param {Object} [options] - 추가 옵션
 * @returns {[string, Function, Function]} [문자열, 설정함수, 제거함수]
 */
export function useLocalStorageString(key, defaultValue = "", options = {}) {
  return useLocalStorage(key, defaultValue, {
    ...options,
    validator: (value) => typeof value === 'string',
    serializer: (value) => value, // 문자열은 직렬화 불필요
    deserializer: (value) => value // 문자열은 역직렬화 불필요
  });
}

/**
 * 숫자 전용 LocalStorage 훅
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {number} [defaultValue=0] - 기본값
 * @param {Object} [options] - 추가 옵션
 * @returns {[number, Function, Function]} [숫자, 설정함수, 제거함수]
 */
export function useLocalStorageNumber(key, defaultValue = 0, options = {}) {
  return useLocalStorage(key, defaultValue, {
    ...options,
    validator: (value) => typeof value === 'number' && !isNaN(value),
    serializer: (value) => String(value),
    deserializer: (value) => {
      const num = Number(value);
      return isNaN(num) ? defaultValue : num;
    }
  });
}

/**
 * 불린 전용 LocalStorage 훅
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {boolean} [defaultValue=false] - 기본값
 * @param {Object} [options] - 추가 옵션
 * @returns {[boolean, Function, Function]} [불린값, 설정함수, 제거함수]
 */
export function useLocalStorageBoolean(key, defaultValue = false, options = {}) {
  return useLocalStorage(key, defaultValue, {
    ...options,
    validator: (value) => typeof value === 'boolean',
    serializer: (value) => String(value),
    deserializer: (value) => value === 'true'
  });
}

/**
 * 배열 전용 LocalStorage 훅
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {Array} [defaultValue=[]] - 기본값
 * @param {Object} [options] - 추가 옵션
 * @returns {[Array, Function, Function]} [배열, 설정함수, 제거함수]
 */
export function useLocalStorageArray(key, defaultValue = [], options = {}) {
  return useLocalStorage(key, defaultValue, {
    ...options,
    validator: (value) => Array.isArray(value)
  });
}

/**
 * 객체 전용 LocalStorage 훅
 * 
 * @param {string} key - 로컬스토리지 키
 * @param {Object} [defaultValue={}] - 기본값
 * @param {Object} [options] - 추가 옵션
 * @returns {[Object, Function, Function]} [객체, 설정함수, 제거함수]
 */
export function useLocalStorageObject(key, defaultValue = {}, options = {}) {
  return useLocalStorage(key, defaultValue, {
    ...options,
    validator: (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  });
}