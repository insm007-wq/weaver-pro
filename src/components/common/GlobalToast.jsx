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
    transform: 'translateY(-100%)',
    opacity: 0,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
    pointerEvents: 'none', // 배경은 클릭 차단하지 않음
  },
  containerVisible: {
    transform: 'translateY(0)',
    opacity: 1,
  },
  messageBar: {
    width: '100%',
    margin: '0',
    ...shorthands.borderRadius('0'),
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: 'none',
    pointerEvents: 'auto', // MessageBar만 클릭 가능
    minHeight: '40px',
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalXL),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  infoBar: {
    backgroundColor: `#d0e7ff !important`,
    borderLeft: `4px solid ${tokens.colorPaletteLightBlueBorder2}`,
    color: `#004080 !important`,
    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.2)',
  },
  warningBar: {
    backgroundColor: `${tokens.colorPaletteYellowBackground2} !important`,
    borderLeft: `4px solid ${tokens.colorPaletteYellowBorder2}`,
    color: `${tokens.colorPaletteYellowForeground2} !important`,
    boxShadow: '0 4px 16px rgba(251, 191, 36, 0.1)',
  },
  messageContent: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    textAlign: 'center',
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

    // info 타입은 표시하지 않음
    if (toast.type === 'info') return;

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
export const showInfo = (text) => showGlobalToast({ type: 'info', text });
export const showWarning = (text) => showGlobalToast({ type: 'warning', text });

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

  // 수동 닫기 (useEffect보다 먼저 정의)
  const handleClose = useCallback(() => {
    clearTimers();
    setIsVisible(false);
    hideTimerRef.current = setTimeout(() => setToast(null), 300);
  }, [clearTimers]);

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

    // 타입에 관계없이 모두 3초
    const duration = 3000;

    autoHideTimerRef.current = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [toast, isVisible, handleClose]);

  // toast가 없으면 렌더링하지 않음
  if (!toast) return null;

  const getStyleClass = () => {
    switch (toast.type) {
      case 'success': return styles.successBar;
      case 'error': return styles.errorBar;
      case 'warning': return styles.warningBar;
      case 'info': return styles.infoBar;
      default: return styles.infoBar;
    }
  };

  const getIntent = () => {
    switch (toast.type) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  };

  return (
    <div className={mergeClasses(styles.container, isVisible && styles.containerVisible)}>
      <MessageBar
        intent={getIntent()}
        className={mergeClasses(styles.messageBar, getStyleClass())}
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