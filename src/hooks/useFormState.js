/**
 * 폼 상태 관리를 위한 커스텀 훅
 * 
 * @description
 * 복잡한 폼의 상태, 검증, 제출을 통합적으로 관리하는 훅
 * 실시간 검증, 오류 처리, 초기화 등의 기능을 제공합니다.
 * 
 * @features
 * - 📝 폼 필드 상태 자동 관리
 * - ✅ 실시간 검증 및 오류 표시
 * - 🔄 폼 초기화 및 리셋
 * - 💾 더티 상태 추적
 * - 🚀 제출 상태 관리
 * 
 * @example
 * ```jsx
 * import { useFormState } from '../hooks/useFormState';
 * 
 * function MyForm() {
 *   const form = useFormState({
 *     initialValues: { name: '', email: '' },
 *     validation: {
 *       name: (value) => value ? null : '이름을 입력하세요',
 *       email: (value) => /\S+@\S+\.\S+/.test(value) ? null : '유효한 이메일을 입력하세요'
 *     }
 *   });
 *   
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     if (form.validate()) {
 *       await form.submit(() => api.saveData(form.values));
 *     }
 *   };
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { deepClone } from '../utils/common';

/**
 * 폼 상태 타입
 * 
 * @typedef {Object} FormState
 * @property {Object} values - 현재 폼 값들
 * @property {Object} errors - 검증 오류들
 * @property {Object} touched - 터치된 필드들
 * @property {boolean} submitting - 제출 중 여부
 * @property {boolean} validating - 검증 중 여부
 * @property {boolean} dirty - 변경 사항 있음 여부
 * @property {boolean} valid - 전체 폼 유효성
 */

/**
 * 폼 상태 관리 커스텀 훅
 * 
 * @param {Object} options - 폼 설정
 * @param {Object} options.initialValues - 초기값
 * @param {Object} [options.validation] - 검증 규칙 객체
 * @param {Function} [options.onSubmit] - 제출 핸들러
 * @param {Function} [options.onValidate] - 검증 완료 콜백
 * @param {Function} [options.onChange] - 값 변경 콜백
 * @param {boolean} [options.validateOnChange=true] - 변경 시 검증 여부
 * @param {boolean} [options.validateOnBlur=true] - 포커스 아웃 시 검증 여부
 * @param {number} [options.validationDelay=300] - 검증 지연 시간 (ms)
 * @returns {Object} 폼 상태와 제어 함수들
 */
export function useFormState(options = {}) {
  const {
    initialValues = {},
    validation = {},
    onSubmit,
    onValidate,
    onChange,
    validateOnChange = true,
    validateOnBlur = true,
    validationDelay = 300
  } = options;

  // 상태 관리
  const [values, setValues] = useState(() => deepClone(initialValues));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);

  // Refs
  const validationTimeoutRef = useRef({});
  const initialValuesRef = useRef(deepClone(initialValues));

  // 계산된 상태
  const dirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValuesRef.current);
  }, [values]);

  const valid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  const hasErrors = useMemo(() => {
    return Object.values(errors).some(error => error !== null && error !== undefined);
  }, [errors]);

  /**
   * 단일 필드 검증
   * 
   * @param {string} field - 필드명
   * @param {any} value - 검증할 값
   * @returns {string|null} 오류 메시지 (없으면 null)
   */
  const validateField = useCallback(async (field, value) => {
    const validator = validation[field];
    if (!validator) return null;

    try {
      if (typeof validator === 'function') {
        const result = await validator(value, values);
        return result || null;
      }
      
      // 객체 형태의 검증 규칙
      if (typeof validator === 'object') {
        const { required, pattern, minLength, maxLength, custom } = validator;
        
        // 필수값 검증
        if (required && (!value || (typeof value === 'string' && !value.trim()))) {
          return validator.message || `${field}는 필수입니다.`;
        }
        
        // 값이 없으면 나머지 검증 스킵
        if (!value) return null;
        
        // 패턴 검증
        if (pattern && !pattern.test(value)) {
          return validator.patternMessage || `${field} 형식이 올바르지 않습니다.`;
        }
        
        // 길이 검증
        if (minLength && value.length < minLength) {
          return validator.minLengthMessage || `${field}는 최소 ${minLength}자 이상이어야 합니다.`;
        }
        
        if (maxLength && value.length > maxLength) {
          return validator.maxLengthMessage || `${field}는 최대 ${maxLength}자까지 가능합니다.`;
        }
        
        // 커스텀 검증
        if (custom) {
          const result = await custom(value, values);
          return result || null;
        }
      }
      
      return null;
    } catch (error) {
      return error.message || '검증 중 오류가 발생했습니다.';
    }
  }, [validation, values]);

  /**
   * 지연된 필드 검증
   * 
   * @param {string} field - 필드명
   * @param {any} value - 검증할 값
   */
  const validateFieldDelayed = useCallback((field, value) => {
    if (validationTimeoutRef.current[field]) {
      clearTimeout(validationTimeoutRef.current[field]);
    }

    validationTimeoutRef.current[field] = setTimeout(async () => {
      setValidating(true);
      try {
        const error = await validateField(field, value);
        setErrors(prev => ({ ...prev, [field]: error }));
      } finally {
        setValidating(false);
      }
    }, validationDelay);
  }, [validateField, validationDelay]);

  /**
   * 전체 폼 검증
   * 
   * @returns {Promise<boolean>} 검증 통과 여부
   */
  const validate = useCallback(async () => {
    setValidating(true);
    const newErrors = {};

    try {
      const fieldNames = Object.keys({ ...initialValues, ...values });
      
      await Promise.all(
        fieldNames.map(async (field) => {
          const error = await validateField(field, values[field]);
          if (error) {
            newErrors[field] = error;
          }
        })
      );

      setErrors(newErrors);
      const isValid = Object.keys(newErrors).length === 0;
      
      onValidate?.(isValid, newErrors, values);
      return isValid;

    } finally {
      setValidating(false);
    }
  }, [validateField, values, initialValues, onValidate]);

  /**
   * 필드 값 설정
   * 
   * @param {string} field - 필드명
   * @param {any} value - 설정할 값
   */
  const setFieldValue = useCallback((field, value) => {
    setValues(prev => {
      const newValues = { ...prev, [field]: value };
      onChange?.(newValues, field, value);
      return newValues;
    });

    // 실시간 검증
    if (validateOnChange && touched[field]) {
      validateFieldDelayed(field, value);
    }
  }, [validateOnChange, touched, validateFieldDelayed, onChange]);

  /**
   * 여러 필드 값 동시 설정
   * 
   * @param {Object} newValues - 설정할 값들
   */
  const setFieldValues = useCallback((newValues) => {
    setValues(prev => {
      const updated = { ...prev, ...newValues };
      onChange?.(updated);
      return updated;
    });

    // 변경된 필드들에 대해 검증
    if (validateOnChange) {
      Object.keys(newValues).forEach(field => {
        if (touched[field]) {
          validateFieldDelayed(field, newValues[field]);
        }
      });
    }
  }, [validateOnChange, touched, validateFieldDelayed, onChange]);

  /**
   * 필드 오류 설정
   * 
   * @param {string} field - 필드명
   * @param {string|null} error - 오류 메시지
   */
  const setFieldError = useCallback((field, error) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  /**
   * 필드 터치 상태 설정
   * 
   * @param {string} field - 필드명
   * @param {boolean} isTouched - 터치 상태
   */
  const setFieldTouched = useCallback((field, isTouched = true) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  /**
   * 필드 포커스 아웃 핸들러
   * 
   * @param {string} field - 필드명
   */
  const handleFieldBlur = useCallback(async (field) => {
    setFieldTouched(field, true);

    if (validateOnBlur) {
      setValidating(true);
      try {
        const error = await validateField(field, values[field]);
        setFieldError(field, error);
      } finally {
        setValidating(false);
      }
    }
  }, [validateOnBlur, validateField, values, setFieldTouched, setFieldError]);

  /**
   * 폼 제출
   * 
   * @param {Function} [submitHandler] - 제출 핸들러 (옵션 우선)
   * @returns {Promise<any>} 제출 결과
   */
  const submit = useCallback(async (submitHandler) => {
    const handler = submitHandler || onSubmit;
    
    if (!handler) {
      throw new Error('Submit handler is required');
    }

    setSubmitting(true);

    try {
      // 전체 검증
      const isValid = await validate();
      
      if (!isValid) {
        throw new Error('Form validation failed');
      }

      // 제출 실행
      const result = await handler(values, { reset, setFieldError });
      return result;

    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, validate, values]);

  /**
   * 폼 초기화
   * 
   * @param {Object} [newInitialValues] - 새로운 초기값
   */
  const reset = useCallback((newInitialValues) => {
    const resetValues = newInitialValues || initialValuesRef.current;
    
    setValues(deepClone(resetValues));
    setErrors({});
    setTouched({});
    setSubmitting(false);
    setValidating(false);
    
    if (newInitialValues) {
      initialValuesRef.current = deepClone(newInitialValues);
    }

    // 타이머 정리
    Object.values(validationTimeoutRef.current).forEach(clearTimeout);
    validationTimeoutRef.current = {};
  }, []);

  /**
   * 특정 필드만 초기화
   * 
   * @param {string|Array<string>} fields - 초기화할 필드(들)
   */
  const resetFields = useCallback((fields) => {
    const fieldsArray = Array.isArray(fields) ? fields : [fields];
    
    setValues(prev => {
      const newValues = { ...prev };
      fieldsArray.forEach(field => {
        newValues[field] = initialValuesRef.current[field];
      });
      return newValues;
    });

    setErrors(prev => {
      const newErrors = { ...prev };
      fieldsArray.forEach(field => {
        delete newErrors[field];
      });
      return newErrors;
    });

    setTouched(prev => {
      const newTouched = { ...prev };
      fieldsArray.forEach(field => {
        delete newTouched[field];
      });
      return newTouched;
    });
  }, []);

  /**
   * 필드 헬퍼 함수 생성
   * 
   * @param {string} field - 필드명
   * @returns {Object} 필드 헬퍼 객체
   */
  const getFieldHelpers = useCallback((field) => {
    return {
      value: values[field],
      error: errors[field],
      touched: touched[field],
      onChange: (value) => setFieldValue(field, value),
      onBlur: () => handleFieldBlur(field),
      setError: (error) => setFieldError(field, error),
      setTouched: (isTouched) => setFieldTouched(field, isTouched),
      reset: () => resetFields(field)
    };
  }, [values, errors, touched, setFieldValue, handleFieldBlur, setFieldError, setFieldTouched, resetFields]);

  return {
    // 상태
    values,
    errors,
    touched,
    submitting,
    validating,
    
    // 계산된 상태
    dirty,
    valid,
    hasErrors,
    
    // 제어 함수
    setFieldValue,
    setFieldValues,
    setFieldError,
    setFieldTouched,
    handleFieldBlur,
    validate,
    submit,
    reset,
    resetFields,
    getFieldHelpers,
    
    // 유틸리티
    getFieldError: (field) => errors[field],
    isFieldTouched: (field) => touched[field],
    isFieldDirty: (field) => values[field] !== initialValuesRef.current[field]
  };
}