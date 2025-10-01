import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  MessageBar,
  MessageBarBody,
  Button,
  makeStyles,
  mergeClasses,
  shorthands,
  tokens
} from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';

// 스타일 정의
const useStyles = makeStyles({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    transform: 'translateY(-100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: 'none', // 배경은 클릭 차단하지 않음
  },
  containerVisible: {
    transform: 'translateY(0)',
  },
  messageBar: {
    maxWidth: '1200px',
    margin: '0 auto',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: 'none',
    pointerEvents: 'auto', // MessageBar만 클릭 가능
  },
  successBar: {
    backgroundColor: `${tokens.colorPaletteLightGreenBackground2} !important`,
    borderLeft: `4px solid ${tokens.colorPaletteLightGreenBorder2}`,
    color: `${tokens.colorPaletteLightGreenForeground2} !important`,
    boxShadow: '0 4px 16px rgba(21, 128, 61, 0.1)',
  },
  errorBar: {
    backgroundColor: `${tokens.colorPaletteRedBackground2} !important`,
    borderLeft: `4px solid ${tokens.colorPaletteRedBorder2}`,
    color: `${tokens.colorPaletteRedForeground2} !important`,
    boxShadow: '0 4px 16px rgba(220, 38, 38, 0.1)',
  },
  messageContent: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
  },
  closeButton: {
    minWidth: 'auto',
    width: '32px',
    height: '32px',
    ...shorthands.borderRadius('50%'),
    color: 'white !important',
    ':hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    }
  }
});

// 전역 토스트 관리자
class ToastManager {
  constructor() {
    this.setter = null;
    this.queue = [];
    this.isProcessing = false;
  }

  setSetter(setter) {
    this.setter = setter;
    // 대기 중인 토스트가 있으면 처리
    if (this.queue.length > 0 && !this.isProcessing) {
      this.processQueue();
    }
  }

  show(toast) {
    // 유효성 검사
    if (!toast || typeof toast !== 'object') return;
    if (!toast.text || typeof toast.text !== 'string') return;
    if (!['success', 'error', 'info', 'warning'].includes(toast.type)) {
      toast.type = 'info';
    }

    if (this.setter && !this.isProcessing) {
      this.isProcessing = true;
      this.setter(toast);
    } else {
      // setter가 없거나 처리 중이면 큐에 추가
      this.queue.push(toast);
    }
  }

  hide() {
    if (this.setter) {
      this.setter(null);
      this.isProcessing = false;
    }
  }

  processQueue() {
    if (this.queue.length > 0 && this.setter && !this.isProcessing) {
      const toast = this.queue.shift();
      this.show(toast);
    }
  }

  markComplete() {
    this.isProcessing = false;
    // 큐에 다른 토스트가 있으면 처리
    setTimeout(() => this.processQueue(), 100);
  }
}

// 싱글톤 인스턴스
const toastManager = new ToastManager();

// 공개 API
export const showGlobalToast = (toast) => toastManager.show(toast);
export const hideGlobalToast = () => toastManager.hide();

// 편의 함수들
export const showSuccess = (text) => showGlobalToast({ type: 'success', text });
export const showError = (text) => showGlobalToast({ type: 'error', text });

export default function GlobalToast() {
  const [toast, setToast] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const styles = useStyles();

  // 타이머 참조들
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const autoHideTimerRef = useRef(null);

  // 전역 setter 등록
  useEffect(() => {
    toastManager.setSetter(setToast);
    return () => toastManager.setSetter(null);
  }, []);

  // 타이머 정리
  const clearTimers = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
  }, []);

  // 토스트 표시/숨김 애니메이션
  useEffect(() => {
    clearTimers();

    if (toast) {
      showTimerRef.current = setTimeout(() => setIsVisible(true), 50);
    } else {
      setIsVisible(false);
      toastManager.markComplete();
    }

    return clearTimers;
  }, [toast, clearTimers]);

  // 자동 숨김
  useEffect(() => {
    if (!toast || !isVisible) return;

    const duration = toast.type === 'error' ? 5000 : 3000;
    autoHideTimerRef.current = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [toast, isVisible]);

  // 수동 닫기
  const handleClose = useCallback(() => {
    clearTimers();
    setIsVisible(false);
    hideTimerRef.current = setTimeout(() => setToast(null), 300);
  }, [clearTimers]);

  // toast가 없거나 visible이 아니면 아예 렌더링하지 않음
  if (!toast || !isVisible) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div className={mergeClasses(styles.container, styles.containerVisible)}>
      <MessageBar
        intent={isSuccess ? 'success' : 'error'}
        className={mergeClasses(styles.messageBar, isSuccess ? styles.successBar : styles.errorBar)}
      >
        <MessageBarBody>
          <span className={styles.messageContent}>{toast.text}</span>
        </MessageBarBody>
        <Button
          appearance="transparent"
          size="small"
          className={styles.closeButton}
          icon={<DismissRegular />}
          onClick={handleClose}
          aria-label="닫기"
        />
      </MessageBar>
    </div>
  );
}