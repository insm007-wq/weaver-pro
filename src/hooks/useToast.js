/**
 * 토스트 알림 관리를 위한 커스텀 훅
 * 
 * @description
 * Fluent UI 토스트 컴포넌트를 래핑하여 일관된 토스트 알림을 제공하는 훅
 * 성공, 경고, 오류, 정보 메시지를 쉽게 표시할 수 있습니다.
 * 
 * @features
 * - 🎯 타입별 토스트 메시지 (success, error, warning, info)
 * - 🎨 일관된 스타일과 애니메이션
 * - 🚀 간편한 API로 빠른 토스트 발송
 * - ⚡ 자동 사라짐 및 수동 닫기 지원
 * 
 * @example
 * ```jsx
 * import { useToast } from '../hooks/useToast';
 * 
 * function MyComponent() {
 *   const toast = useToast();
 *   
 *   const handleSuccess = () => {
 *     toast.success('작업이 완료되었습니다!');
 *   };
 *   
 *   const handleError = () => {
 *     toast.error('오류가 발생했습니다.', '네트워크 연결을 확인해주세요.');
 *   };
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from 'react';
import { useToastController, Toast, ToastTitle, ToastBody } from "@fluentui/react-components";

/**
 * 토스트 알림을 쉽게 관리할 수 있는 커스텀 훅
 * 
 * @param {string} [toasterId] - 토스터 ID (기본값: "global")
 * @returns {Object} 토스트 발송 함수들을 포함한 객체
 */
export function useToast(toasterId = "global") {
  const { dispatchToast } = useToastController(toasterId);

  /**
   * 성공 토스트 메시지 표시
   * 
   * @param {string} title - 토스트 제목
   * @param {string} [body] - 토스트 본문 (선택사항)
   * @param {Object} [options] - 추가 옵션
   */
  const success = (title, body = "", options = {}) => {
    const toastElement = React.createElement(Toast, null, [
      React.createElement(ToastTitle, { key: 'title' }, title),
      body && React.createElement(ToastBody, { key: 'body' }, body)
    ].filter(Boolean));

    dispatchToast(
      toastElement,
      { intent: "success", timeout: 4000, ...options }
    );
  };

  /**
   * 오류 토스트 메시지 표시
   * 
   * @param {string} title - 토스트 제목
   * @param {string} [body] - 토스트 본문 (선택사항)
   * @param {Object} [options] - 추가 옵션
   */
  const error = (title, body = "", options = {}) => {
    const toastElement = React.createElement(Toast, null, [
      React.createElement(ToastTitle, { key: 'title' }, title),
      body && React.createElement(ToastBody, { key: 'body' }, body)
    ].filter(Boolean));

    dispatchToast(
      toastElement,
      { intent: "error", timeout: 6000, ...options }
    );
  };

  /**
   * 경고 토스트 메시지 표시
   * 
   * @param {string} title - 토스트 제목
   * @param {string} [body] - 토스트 본문 (선택사항)
   * @param {Object} [options] - 추가 옵션
   */
  const warning = (title, body = "", options = {}) => {
    const toastElement = React.createElement(Toast, null, [
      React.createElement(ToastTitle, { key: 'title' }, title),
      body && React.createElement(ToastBody, { key: 'body' }, body)
    ].filter(Boolean));

    dispatchToast(
      toastElement,
      { intent: "warning", timeout: 5000, ...options }
    );
  };

  /**
   * 정보 토스트 메시지 표시
   * 
   * @param {string} title - 토스트 제목
   * @param {string} [body] - 토스트 본문 (선택사항)
   * @param {Object} [options] - 추가 옵션
   */
  const info = (title, body = "", options = {}) => {
    const toastElement = React.createElement(Toast, null, [
      React.createElement(ToastTitle, { key: 'title' }, title),
      body && React.createElement(ToastBody, { key: 'body' }, body)
    ].filter(Boolean));

    dispatchToast(
      toastElement,
      { intent: "info", timeout: 4000, ...options }
    );
  };

  /**
   * 커스텀 토스트 메시지 표시
   * 
   * @param {Object} toastConfig - 토스트 설정 객체
   * @param {string} toastConfig.title - 토스트 제목
   * @param {string} [toastConfig.body] - 토스트 본문
   * @param {"success"|"error"|"warning"|"info"} [toastConfig.intent] - 토스트 타입
   * @param {number} [toastConfig.timeout] - 자동 사라짐 시간 (ms)
   */
  const custom = (toastConfig) => {
    const { title, body, intent = "info", ...options } = toastConfig;
    
    const toastElement = React.createElement(Toast, null, [
      React.createElement(ToastTitle, { key: 'title' }, title),
      body && React.createElement(ToastBody, { key: 'body' }, body)
    ].filter(Boolean));

    dispatchToast(
      toastElement,
      { intent, timeout: 4000, ...options }
    );
  };

  return {
    success,
    error,
    warning,
    info,
    custom,
    // 원본 dispatchToast도 노출 (고급 사용자용)
    dispatchToast
  };
}

/**
 * 토스트 메시지 타입 상수
 */
export const TOAST_TYPES = {
  SUCCESS: "success",
  ERROR: "error", 
  WARNING: "warning",
  INFO: "info"
};

/**
 * 기본 토스트 설정
 */
export const DEFAULT_TOAST_CONFIG = {
  timeout: 4000,
  pauseOnHover: true,
  pauseOnWindowBlur: true
};