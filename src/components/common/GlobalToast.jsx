import React, { useEffect, useState } from 'react';
import { 
  MessageBar, 
  MessageBarBody,
  Button,
  makeStyles,
  shorthands
} from '@fluentui/react-components';
import { 
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  DismissRegular
} from '@fluentui/react-icons';
import { tokens } from '@fluentui/react-components';

// 스타일 정의
const useStyles = makeStyles({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(20px)',
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
    transform: 'translateY(-100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  containerVisible: {
    transform: 'translateY(0)',
  },
  messageBar: {
    maxWidth: '1200px',
    margin: '0 auto',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
    border: 'none',
    backdropFilter: 'blur(10px)',
  },
  successBar: {
    background: 'linear-gradient(135deg, rgba(16, 124, 16, 0.95) 0%, rgba(16, 124, 16, 0.9) 100%) !important',
    borderLeft: `4px solid ${tokens.colorPaletteGreenForeground1}`,
    color: 'white !important',
  },
  errorBar: {
    background: 'linear-gradient(135deg, rgba(160, 20, 15, 0.98) 0%, rgba(140, 15, 10, 0.95) 100%) !important',
    borderLeft: `4px solid ${tokens.colorPaletteRedForeground1}`,
    color: 'white !important',
  },
  messageContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontWeight: tokens.fontWeightSemibold,
  },
  icon: {
    fontSize: '18px',
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

// 전역 토스트 상태
let globalToastState = null;
let globalToastSetter = null;

// 전역 토스트 표시 함수
export const showGlobalToast = (toast) => {
  if (globalToastSetter) {
    globalToastSetter(toast);
  }
};

// 전역 토스트 숨김 함수
export const hideGlobalToast = () => {
  if (globalToastSetter) {
    globalToastSetter(null);
  }
};

export default function GlobalToast() {
  const [toast, setToast] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const styles = useStyles();

  // 전역 setter 등록
  useEffect(() => {
    globalToastSetter = setToast;
    return () => {
      globalToastSetter = null;
    };
  }, []);

  // 토스트 표시/숨김 애니메이션
  useEffect(() => {
    if (toast) {
      // 약간의 지연 후 애니메이션 시작
      const showTimer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(showTimer);
    } else {
      setIsVisible(false);
    }
  }, [toast]);

  // 자동 숨김 (에러는 5초, 성공은 3초)
  useEffect(() => {
    if (!toast) return;
    
    const duration = toast.type === 'error' ? 5000 : 3000;
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => setToast(null), 300); // 애니메이션 완료 후 제거
    }, duration);
    
    return () => clearTimeout(timer);
  }, [toast]);

  // 수동 닫기
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setToast(null), 300);
  };

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return (
    <div className={`${styles.container} ${isVisible ? styles.containerVisible : ''}`}>
      <MessageBar 
        intent={isSuccess ? 'success' : 'error'}
        className={`${styles.messageBar} ${isSuccess ? styles.successBar : styles.errorBar}`}
      >
        <MessageBarBody>
          <div className={styles.messageContent}>
            {isSuccess ? (
              <CheckmarkCircleRegular className={styles.icon} style={{ color: 'white' }} />
            ) : (
              <ErrorCircleRegular className={styles.icon} style={{ color: 'white' }} />
            )}
            <span>{toast.text}</span>
          </div>
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