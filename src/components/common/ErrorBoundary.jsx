/**
 * 에러 경계 (Error Boundary) 공통 컴포넌트
 * 
 * @description
 * React 애플리케이션에서 발생하는 JavaScript 오류를 포착하고 처리하는 컴포넌트
 * 오류 발생 시 폴백 UI를 표시하고, 오류 정보를 로깅합니다.
 * 
 * @features
 * - 🛡️ JavaScript 오류 자동 포착 및 처리
 * - 🎨 사용자 친화적인 오류 UI 제공
 * - 📝 상세한 오류 로깅 및 리포팅
 * - 🔄 오류 상태에서 복구 기능
 * - 🎯 다양한 오류 타입별 커스터마이징
 * 
 * @example
 * ```jsx
 * import { ErrorBoundary } from '../components/common/ErrorBoundary';
 * 
 * // 기본 사용
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * 
 * // 커스텀 오류 UI
 * <ErrorBoundary
 *   fallback={<CustomErrorUI />}
 *   onError={(error, errorInfo) => console.log(error)}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from 'react';
import {
  makeStyles,
  tokens,
  Button,
  Text,
  Card,
  CardHeader,
  CardPreview,
  CardFooter
} from '@fluentui/react-components';
import { ErrorCircleRegular, ArrowClockwiseRegular, BugRegular } from '@fluentui/react-icons';

// =========================== 스타일 정의 ===========================

const useStyles = makeStyles({
  /** 오류 컨테이너 메인 스타일 */
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacingVerticalXXL,
    minHeight: '300px',
    textAlign: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
  },

  /** 오류 카드 스타일 */
  errorCard: {
    maxWidth: '500px',
    width: '100%',
    boxShadow: tokens.shadow16,
  },

  /** 오류 아이콘 컨테이너 */
  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: tokens.spacingVerticalL,
  },

  /** 오류 아이콘 */
  errorIcon: {
    fontSize: '48px',
    color: tokens.colorPaletteRedForeground1,
  },

  /** 오류 제목 */
  errorTitle: {
    fontSize: tokens.fontSizeBase600,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    marginBottom: tokens.spacingVerticalM,
  },

  /** 오류 메시지 */
  errorMessage: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    lineHeight: '1.5',
    marginBottom: tokens.spacingVerticalL,
    maxWidth: '400px',
  },

  /** 오류 상세 정보 토글 */
  detailsToggle: {
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalS,
  },

  /** 오류 상세 정보 */
  errorDetails: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    textAlign: 'left',
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
    maxHeight: '200px',
    overflowY: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },

  /** 액션 버튼 그룹 */
  actionButtons: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalL,
  },

  /** 컴팩트 오류 표시 (인라인용) */
  compactError: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorPaletteRedBackground1,
    border: `1px solid ${tokens.colorPaletteRedBorder1}`,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorPaletteRedForeground1,
  },

  /** 미니멀 오류 표시 */
  minimalError: {
    textAlign: 'center',
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
});

// =========================== 오류 경계 클래스 컴포넌트 ===========================

/**
 * 실제 에러 경계 기능을 담당하는 클래스 컴포넌트
 * (React의 Error Boundary는 클래스 컴포넌트로만 구현 가능)
 */
class ErrorBoundaryClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  /**
   * 오류 발생 시 상태 업데이트
   */
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: Date.now().toString()
    };
  }

  /**
   * 오류 정보 캐치 및 로깅
   */
  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // 오류 로깅
    this.logError(error, errorInfo);

    // 부모 컴포넌트의 오류 핸들러 호출
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * 오류 정보 로깅
   */
  logError = (error, errorInfo) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // 콘솔에 상세 로그 출력
    console.group('🚨 React Error Boundary');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Full Error Data:', errorData);
    console.groupEnd();

    // 외부 오류 리포팅 서비스에 전송 (필요시)
    if (this.props.onLogError) {
      this.props.onLogError(errorData);
    }
  };

  /**
   * 오류 상태 리셋 (재시도)
   */
  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      // 커스텀 폴백 UI가 제공된 경우
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error, this.state.errorInfo, this.handleRetry);
        }
        return this.props.fallback;
      }

      // 기본 오류 UI 렌더링
      return (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          variant={this.props.variant}
          showDetails={this.props.showDetails}
          showRetry={this.props.showRetry}
        />
      );
    }

    return this.props.children;
  }
}

// =========================== 오류 표시 컴포넌트 ===========================

/**
 * 오류 정보를 표시하는 UI 컴포넌트
 */
function ErrorDisplay({
  error,
  errorInfo,
  errorId,
  onRetry,
  variant = 'default',
  showDetails = true,
  showRetry = true
}) {
  const styles = useStyles();
  const [showDetailedInfo, setShowDetailedInfo] = React.useState(false);

  // 오류 메시지 포맷팅
  const errorMessage = error?.message || '알 수 없는 오류가 발생했습니다.';
  const errorStack = error?.stack || '';
  const componentStack = errorInfo?.componentStack || '';

  // 컴팩트 버전
  if (variant === 'compact') {
    return (
      <div className={styles.compactError}>
        <ErrorCircleRegular />
        <Text>{errorMessage}</Text>
        {showRetry && (
          <Button
            size="small"
            appearance="subtle"
            icon={<ArrowClockwiseRegular />}
            onClick={onRetry}
          >
            재시도
          </Button>
        )}
      </div>
    );
  }

  // 미니멀 버전
  if (variant === 'minimal') {
    return (
      <div className={styles.minimalError}>
        <Text>문제가 발생했습니다.</Text>
        {showRetry && (
          <Button
            size="small"
            appearance="subtle"
            onClick={onRetry}
            style={{ marginTop: tokens.spacingVerticalS }}
          >
            다시 시도
          </Button>
        )}
      </div>
    );
  }

  // 기본 버전 (카드 형태)
  return (
    <div className={styles.errorContainer}>
      <Card className={styles.errorCard}>
        <CardHeader
          header={
            <div>
              <div className={styles.iconContainer}>
                <ErrorCircleRegular className={styles.errorIcon} />
              </div>
              <Text className={styles.errorTitle}>
                문제가 발생했습니다
              </Text>
            </div>
          }
        />

        <CardPreview>
          <div style={{ padding: tokens.spacingVerticalM }}>
            <Text className={styles.errorMessage}>
              죄송합니다. 예상치 못한 오류가 발생했습니다. 
              페이지를 새로고침하거나 다시 시도해 주세요.
            </Text>

            {showDetails && (
              <div>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<BugRegular />}
                  className={styles.detailsToggle}
                  onClick={() => setShowDetailedInfo(!showDetailedInfo)}
                >
                  {showDetailedInfo ? '상세 정보 숨기기' : '상세 정보 보기'}
                </Button>

                {showDetailedInfo && (
                  <div className={styles.errorDetails}>
                    <strong>오류 ID:</strong> {errorId}
                    <br />
                    <strong>오류 메시지:</strong> {errorMessage}
                    <br />
                    <strong>시간:</strong> {new Date().toLocaleString()}
                    <br />
                    <br />
                    <strong>스택 추적:</strong>
                    <br />
                    {errorStack}
                    <br />
                    <strong>컴포넌트 스택:</strong>
                    <br />
                    {componentStack}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardPreview>

        <CardFooter>
          <div className={styles.actionButtons}>
            {showRetry && (
              <Button
                appearance="primary"
                icon={<ArrowClockwiseRegular />}
                onClick={onRetry}
              >
                다시 시도
              </Button>
            )}
            <Button
              appearance="secondary"
              onClick={() => window.location.reload()}
            >
              페이지 새로고침
            </Button>
            <Button
              appearance="subtle"
              onClick={() => window.history.back()}
            >
              이전 페이지
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

// =========================== 메인 Error Boundary 컴포넌트 ===========================

/**
 * Error Boundary 래퍼 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {React.ReactNode} props.children - 보호할 자식 컴포넌트들
 * @param {React.ComponentType|Function} [props.fallback] - 커스텀 폴백 UI
 * @param {"default"|"compact"|"minimal"} [props.variant="default"] - 오류 UI 스타일
 * @param {Function} [props.onError] - 오류 발생 시 콜백
 * @param {Function} [props.onRetry] - 재시도 시 콜백
 * @param {Function} [props.onLogError] - 오류 로깅 콜백
 * @param {boolean} [props.showDetails=true] - 상세 정보 표시 여부
 * @param {boolean} [props.showRetry=true] - 재시도 버튼 표시 여부
 * @returns {JSX.Element} Error Boundary로 감싸진 컴포넌트
 */
export function ErrorBoundary({
  children,
  fallback,
  variant = 'default',
  onError,
  onRetry,
  onLogError,
  showDetails = true,
  showRetry = true,
  ...props
}) {
  return (
    <ErrorBoundaryClass
      fallback={fallback}
      variant={variant}
      onError={onError}
      onRetry={onRetry}
      onLogError={onLogError}
      showDetails={showDetails}
      showRetry={showRetry}
      {...props}
    >
      {children}
    </ErrorBoundaryClass>
  );
}

// =========================== 특화된 Error Boundary들 ===========================

/**
 * 페이지 레벨 Error Boundary
 */
export function PageErrorBoundary({ children, ...props }) {
  return (
    <ErrorBoundary
      variant="default"
      showDetails={true}
      showRetry={true}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 컴포넌트 레벨 Error Boundary (컴팩트)
 */
export function ComponentErrorBoundary({ children, ...props }) {
  return (
    <ErrorBoundary
      variant="compact"
      showDetails={false}
      showRetry={true}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * 인라인 Error Boundary (미니멀)
 */
export function InlineErrorBoundary({ children, ...props }) {
  return (
    <ErrorBoundary
      variant="minimal"
      showDetails={false}
      showRetry={true}
      {...props}
    >
      {children}
    </ErrorBoundary>
  );
}

// =========================== Error Boundary 훅 ===========================

/**
 * 에러 처리를 위한 커스텀 훅
 * 
 * @returns {Object} 에러 처리 함수들
 */
export function useErrorHandler() {
  const handleError = React.useCallback((error, errorInfo) => {
    // 전역 에러 핸들링 로직
    console.error('Handled error:', error, errorInfo);
    
    // 외부 오류 리포팅 서비스에 전송 등
    // reportError(error, errorInfo);
  }, []);

  const handleRetry = React.useCallback(() => {
    // 재시도 로직 (필요시 상태 초기화 등)
    console.log('Retrying after error...');
  }, []);

  return {
    handleError,
    handleRetry
  };
}

export default ErrorBoundary;