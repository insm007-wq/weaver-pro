/**
 * 로딩 스피너 공통 컴포넌트
 * 
 * @description
 * 다양한 로딩 상태를 표시하는 재사용 가능한 스피너 컴포넌트
 * Fluent UI 스피너를 기반으로 하며, 크기와 메시지를 커스터마이징할 수 있습니다.
 * 
 * @features
 * - 🎯 다양한 크기 옵션 (tiny, small, medium, large, huge)
 * - 📝 로딩 메시지 표시 지원
 * - 🎨 Fluent UI 디자인 토큰 기반 스타일링
 * - 📱 반응형 디자인 지원
 * - ⚡ 경량화된 구현
 * 
 * @example
 * ```jsx
 * import { LoadingSpinner } from '../components/common/LoadingSpinner';
 * 
 * // 기본 사용
 * <LoadingSpinner />
 * 
 * // 메시지와 함께
 * <LoadingSpinner message="데이터를 불러오는 중..." />
 * 
 * // 큰 크기로
 * <LoadingSpinner size="large" message="처리 중..." />
 * 
 * // 중앙 정렬된 오버레이로
 * <LoadingSpinner overlay message="저장하는 중..." />
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from 'react';
import { 
  Spinner, 
  Text,
  makeStyles,
  tokens 
} from '@fluentui/react-components';

// =========================== 스타일 정의 ===========================

const useStyles = makeStyles({
  /** 기본 컨테이너 스타일 */
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
  },

  /** 인라인 컨테이너 (가로 배치) */
  inlineContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
  },

  /** 오버레이 스타일 */
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalL,
  },

  /** 페이지 중앙 스타일 */
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    gap: tokens.spacingVerticalM,
  },

  /** 로딩 메시지 스타일 */
  message: {
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
    maxWidth: '300px',
    lineHeight: '1.4',
  },

  /** 서브 메시지 스타일 */
  subMessage: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: 'center',
    maxWidth: '400px',
    lineHeight: '1.3',
    marginTop: tokens.spacingVerticalXS,
  },
});

// =========================== 메인 컴포넌트 ===========================

/**
 * 로딩 스피너 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {"tiny"|"small"|"medium"|"large"|"huge"} [props.size="medium"] - 스피너 크기
 * @param {string} [props.message] - 로딩 메시지
 * @param {string} [props.subMessage] - 보조 메시지
 * @param {boolean} [props.overlay=false] - 전체 화면 오버레이 표시 여부
 * @param {boolean} [props.centered=false] - 중앙 정렬 여부
 * @param {boolean} [props.inline=false] - 인라인 표시 여부 (가로 배치)
 * @param {string} [props.className] - 추가 CSS 클래스
 * @param {Object} [props.style] - 인라인 스타일
 * @returns {JSX.Element} 로딩 스피너 컴포넌트
 */
export function LoadingSpinner({
  size = "medium",
  message,
  subMessage,
  overlay = false,
  centered = false,
  inline = false,
  className,
  style,
  ...props
}) {
  const styles = useStyles();

  // 컨테이너 스타일 결정
  const getContainerStyle = () => {
    if (overlay) return styles.overlay;
    if (centered) return styles.centered;
    if (inline) return styles.inlineContainer;
    return styles.container;
  };

  const containerClass = [
    getContainerStyle(),
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass} style={style} {...props}>
      <Spinner size={size} />
      
      {message && (
        <Text className={styles.message}>
          {message}
        </Text>
      )}
      
      {subMessage && (
        <Text className={styles.subMessage}>
          {subMessage}
        </Text>
      )}
    </div>
  );
}

// =========================== 특화된 로딩 컴포넌트들 ===========================

/**
 * 페이지 로딩 컴포넌트 (큰 스피너 + 중앙 정렬)
 */
export function PageLoading({ message = "페이지를 불러오는 중...", ...props }) {
  return (
    <LoadingSpinner
      size="large"
      message={message}
      centered
      {...props}
    />
  );
}

/**
 * 인라인 로딩 컴포넌트 (작은 스피너 + 가로 배치)
 */
export function InlineLoading({ message, ...props }) {
  return (
    <LoadingSpinner
      size="small"
      message={message}
      inline
      {...props}
    />
  );
}

/**
 * 오버레이 로딩 컴포넌트 (전체 화면 덮음)
 */
export function OverlayLoading({ message = "처리 중...", subMessage, ...props }) {
  return (
    <LoadingSpinner
      size="large"
      message={message}
      subMessage={subMessage}
      overlay
      {...props}
    />
  );
}

/**
 * 버튼 로딩 컴포넌트 (버튼 내부용 작은 스피너)
 */
export function ButtonLoading({ message, ...props }) {
  return (
    <LoadingSpinner
      size="tiny"
      message={message}
      inline
      style={{ padding: '0', gap: tokens.spacingHorizontalS }}
      {...props}
    />
  );
}

/**
 * 카드 로딩 컴포넌트 (카드 내부용)
 */
export function CardLoading({ 
  message = "불러오는 중...", 
  minHeight = "150px",
  ...props 
}) {
  return (
    <LoadingSpinner
      size="medium"
      message={message}
      style={{ minHeight }}
      {...props}
    />
  );
}

// =========================== 로딩 상태 래퍼 컴포넌트 ===========================

/**
 * 로딩 상태를 관리하는 래퍼 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {boolean} props.loading - 로딩 상태
 * @param {React.ReactNode} props.children - 자식 컴포넌트들
 * @param {Object} [props.spinnerProps] - 스피너에 전달할 추가 속성들
 * @returns {JSX.Element} 로딩 상태가 적용된 컴포넌트
 * 
 * @example
 * ```jsx
 * <LoadingWrapper loading={isLoading} spinnerProps={{ message: "데이터 로딩 중..." }}>
 *   <DataTable data={data} />
 * </LoadingWrapper>
 * ```
 */
export function LoadingWrapper({ 
  loading, 
  children, 
  spinnerProps = {},
  ...props 
}) {
  if (loading) {
    return <LoadingSpinner {...spinnerProps} {...props} />;
  }

  return children;
}

/**
 * 조건부 오버레이 로딩 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {boolean} props.loading - 로딩 상태
 * @param {React.ReactNode} props.children - 자식 컴포넌트들
 * @param {Object} [props.spinnerProps] - 스피너에 전달할 추가 속성들
 * @returns {JSX.Element} 오버레이 로딩이 적용된 컴포넌트
 */
export function LoadingOverlay({ 
  loading, 
  children, 
  spinnerProps = {},
  ...props 
}) {
  const styles = useStyles();

  return (
    <div style={{ position: 'relative' }} {...props}>
      {children}
      {loading && (
        <div 
          className={styles.overlay} 
          style={{ position: 'absolute', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
        >
          <LoadingSpinner size="medium" {...spinnerProps} />
        </div>
      )}
    </div>
  );
}

// =========================== Export ===========================

export default LoadingSpinner;