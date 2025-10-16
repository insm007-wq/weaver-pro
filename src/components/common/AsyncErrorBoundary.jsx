/**
 * 비동기 작업을 위한 향상된 에러 바운더리
 */
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

class AsyncErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      asyncErrors: new Set()
    };

    // 전역 Promise rejection 핸들러
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
  }

  componentDidMount() {
    // 처리되지 않은 Promise rejection 감지
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleUnhandledRejection(event) {
    // 이미 처리된 에러는 무시
    if (this.state.asyncErrors.has(event.reason)) {
      return;
    }

    console.error('Unhandled Promise Rejection:', event.reason);

    // 에러를 기록하고 상태 업데이트
    this.setState(prevState => ({
      hasError: true,
      error: event.reason,
      errorInfo: { componentStack: 'Async Operation' },
      asyncErrors: new Set([...prevState.asyncErrors, event.reason])
    }));

    // 기본 동작 방지 (콘솔에 에러 출력 방지)
    event.preventDefault();
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('AsyncErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // 에러 리포팅 서비스에 전송 (선택사항)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // 커스텀 에러 UI가 제공된 경우 사용
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo);
      }

      // 기본 에러 UI
      return (
        <div style={{
          padding: '20px',
          border: '2px solid #ff6b6b',
          borderRadius: '8px',
          backgroundColor: '#fff5f5',
          margin: '10px'
        }}>
          <h3 style={{ color: '#c92a2a', marginTop: 0 }}>
            🚨 애플리케이션 오류가 발생했습니다
          </h3>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              오류 세부정보 보기
            </summary>
            <pre style={{
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px'
            }}>
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button
            onClick={() => {
              this.setState({
                hasError: false,
                error: null,
                errorInfo: null,
                asyncErrors: new Set()
              });
            }}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AsyncErrorBoundary;