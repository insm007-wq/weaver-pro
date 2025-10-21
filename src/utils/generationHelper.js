/**
 * 대본 & 음성 생성 헬퍼 유틸 함수
 *
 * 생성 프로세스에서 반복되는 로직을 통합 관리합니다:
 * - 타임아웃 동적 계산
 * - 에러 처리
 * - 리소스 정리
 * - 상태 초기화
 */

/**
 * 영상 길이와 청크 수를 기반으로 최적 타임아웃 계산
 *
 * @param {number} durationMin - 영상 길이 (분)
 * @param {number} chunkCount - 청크 개수 (기본값: 1)
 * @returns {number} 타임아웃 시간 (밀리초)
 */
export function calculateOptimalTimeout(durationMin = 3, chunkCount = 1) {
  // 기본 계산: 1분 당 4초 + 청크당 5초
  const baseTime = Math.max(
    durationMin * 4000 + chunkCount * 5000,
    120000 // 최소 2분
  );

  // 단계별 최소/최대 시간 제한
  if (durationMin >= 90) {
    return Math.min(baseTime, 1200000); // 최대 20분
  } else if (durationMin >= 60) {
    return Math.min(baseTime, 900000); // 최대 15분
  } else if (durationMin >= 30) {
    return Math.min(baseTime, 600000); // 최대 10분
  } else if (durationMin >= 20) {
    return Math.min(baseTime, 480000); // 최대 8분
  } else if (durationMin >= 10) {
    return Math.min(baseTime, 360000); // 최대 6분
  }

  return baseTime;
}

/**
 * 생성 프로세스 에러 처리 및 분류
 *
 * @param {Error} error - 발생한 에러
 * @param {string} context - 에러 발생 컨텍스트 ('script', 'audio', 'subtitle', 등)
 * @returns {Object} { isRecoverable, message, code, context }
 */
export function classifyGenerationError(error, context = 'unknown') {
  if (!error) return null;

  const errorMessage = error?.message || String(error);

  // 취소 에러
  if (error.name === 'AbortError' || errorMessage.includes('취소')) {
    return {
      isRecoverable: false,
      message: '작업이 취소되었습니다.',
      code: 'ABORT_ERROR',
      context,
      shouldRetry: false,
    };
  }

  // 타임아웃 에러
  if (errorMessage.includes('timeout') || errorMessage.includes('시간')) {
    return {
      isRecoverable: true,
      message: `${context} 생성 시간 초과. 다시 시도해주세요.`,
      code: 'TIMEOUT_ERROR',
      context,
      shouldRetry: true,
      retryDelay: 5000,
    };
  }

  // API 키 에러
  if (errorMessage.includes('API') || errorMessage.includes('인증') || errorMessage.includes('키')) {
    return {
      isRecoverable: false,
      message: 'API 설정이 올바르지 않습니다. 설정을 확인해주세요.',
      code: 'API_ERROR',
      context,
      shouldRetry: false,
    };
  }

  // 네트워크 에러
  if (errorMessage.includes('network') || errorMessage.includes('연결') || errorMessage.includes('Network')) {
    return {
      isRecoverable: true,
      message: '네트워크 연결을 확인해주세요.',
      code: 'NETWORK_ERROR',
      context,
      shouldRetry: true,
      retryDelay: 3000,
    };
  }

  // 기타 에러
  return {
    isRecoverable: true,
    message: `${context} 생성 중 오류가 발생했습니다: ${errorMessage}`,
    code: 'UNKNOWN_ERROR',
    context,
    shouldRetry: true,
    retryDelay: 2000,
  };
}

/**
 * 리소스 정리 함수
 *
 * @param {Object} resources - 정리할 리소스 객체
 * @param {AbortController} resources.abortController - AbortController 인스턴스
 * @param {Audio} resources.audioElement - Audio 엘리먼트
 * @param {string} resources.audioUrl - 생성된 오디오 URL
 * @param {Function} resources.onCleanup - 정리 완료 콜백
 */
export function cleanupGenerationResources(resources = {}) {
  const {
    abortController,
    audioElement,
    audioUrl,
    onCleanup,
  } = resources;

  try {
    // AbortController 정리
    if (abortController) {
      try {
        abortController.abort();
      } catch (e) {
        console.warn('AbortController 정리 실패:', e);
      }
    }

    // Audio 엘리먼트 정리
    if (audioElement) {
      try {
        audioElement.pause();
        audioElement.currentTime = 0;
        audioElement.src = '';
        audioElement.srcObject = null;
      } catch (e) {
        console.warn('Audio 엘리먼트 정리 실패:', e);
      }
    }

    // 오디오 URL 정리
    if (audioUrl && typeof audioUrl === 'string') {
      try {
        URL.revokeObjectURL(audioUrl);
      } catch (e) {
        console.warn('오디오 URL 정리 실패:', e);
      }
    }

    // 콜백 실행
    if (typeof onCleanup === 'function') {
      onCleanup();
    }
  } catch (e) {
    console.error('리소스 정리 중 오류:', e);
  }
}

/**
 * 생성 상태 초기화 함수
 *
 * @param {string} mode - 초기화 모드 ('idle' | 'reset' | 'error')
 * @returns {Object} 초기화된 상태 객체
 */
export function createInitialGenerationState(mode = 'idle') {
  const baseState = {
    isGenerating: false,
    mode: 'idle',
    currentStep: 'idle',
    progress: {
      script: 0,
      audio: 0,
      images: 0,
      video: 0,
      subtitle: 0,
    },
    results: {
      script: null,
      audio: null,
      images: [],
      video: null,
    },
    error: null,
    startTime: null,
  };

  if (mode === 'reset') {
    return {
      ...baseState,
      streamingScript: '',
      logs: [],
    };
  }

  if (mode === 'error') {
    return {
      ...baseState,
      isGenerating: false,
      currentStep: 'error',
    };
  }

  return baseState;
}

/**
 * 생성 상태 업데이트 헬퍼
 *
 * @param {Object} prevState - 이전 상태
 * @param {Object} updates - 업데이트 객체
 * @param {boolean} shouldMergeLogs - 로그 병합 여부
 * @returns {Object} 병합된 새 상태
 */
export function mergeGenerationState(prevState, updates = {}, shouldMergeLogs = true) {
  const newLogs = shouldMergeLogs && updates.logs
    ? [...(prevState.logs || []), ...updates.logs]
    : updates.logs || prevState.logs;

  return {
    ...prevState,
    ...updates,
    logs: newLogs,
  };
}

/**
 * TTS 설정을 프로젝트에 저장
 *
 * @param {Object} ttsSettings - TTS 설정 객체
 * @param {Object} options - 옵션
 * @returns {Promise<Object>} 저장 결과
 */
export async function saveTtsSettingsToProject(ttsSettings = {}, options = {}) {
  const {
    api,
    projectResult,
    addLog,
  } = options;

  if (!api) {
    console.warn('API가 제공되지 않았습니다.');
    return { success: false, error: 'API not provided' };
  }

  try {
    if (!projectResult?.success || !projectResult?.project) {
      // 프로젝트가 없으면 전역 설정에 저장
      if (addLog) addLog('⚠️ 프로젝트가 설정되지 않았습니다', 'warning');

      const result = await api.invoke('settings:set', {
        key: 'lastUsedTtsSettings',
        value: {
          ...ttsSettings,
          createdAt: new Date().toISOString(),
        },
      });

      if (addLog) addLog('📝 TTS 설정 저장 완료 (전역)', 'info');
      return { success: true, type: 'global' };
    }

    // 프로젝트에 TTS 설정 저장
    const ttsSettingsWithTimestamp = {
      ...ttsSettings,
      createdAt: new Date().toISOString(),
    };

    const updateResult = await api.invoke('project:update', {
      ttsSettings: ttsSettingsWithTimestamp,
    });

    if (updateResult?.success) {
      if (addLog) addLog('📝 TTS 설정 저장 완료', 'info');
      return { success: true, type: 'project' };
    }

    throw new Error(updateResult?.message || '프로젝트 업데이트 실패');
  } catch (error) {
    console.error('❌ TTS 설정 저장 실패:', error);
    if (addLog) addLog('⚠️ TTS 설정 저장 실패', 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 대본 생성 활동 로깅
 *
 * @param {Object} activity - 활동 정보
 * @param {Object} options - 옵션
 */
export function logGenerationActivity(activity = {}, options = {}) {
  const { window: win } = options;
  const targetWindow = win || (typeof window !== 'undefined' ? window : null);

  if (!targetWindow?.api?.logActivity) return;

  try {
    targetWindow.api.logActivity({
      type: 'llm',
      title: activity.title || '대본 생성',
      detail: activity.detail || '',
      status: activity.status || 'info',
      metadata: activity.metadata || {},
    });
  } catch (error) {
    console.error('활동 로깅 실패:', error);
  }
}

/**
 * 생성 진행률 업데이트 헬퍼
 *
 * @param {Object} prevProgress - 이전 진행률
 * @param {string} step - 업데이트할 단계 (script, audio, images, video, subtitle)
 * @param {number} value - 진행률 (0-100)
 * @returns {Object} 업데이트된 진행률
 */
export function updateGenerationProgress(prevProgress = {}, step, value) {
  return {
    ...prevProgress,
    [step]: Math.max(0, Math.min(100, value)),
  };
}

/**
 * 메모리 효율적인 로그 관리 (최대 100개 유지)
 *
 * @param {Array} logs - 현재 로그 배열
 * @param {Object} newLog - 새 로그 객체
 * @param {number} maxLogs - 최대 로그 개수 (기본: 100)
 * @returns {Array} 업데이트된 로그 배열
 */
export function addLogWithLimit(logs = [], newLog = {}, maxLogs = 100) {
  const updatedLogs = [...logs, newLog];

  // 로그가 최대 개수를 초과하면 오래된 로그부터 제거
  if (updatedLogs.length > maxLogs) {
    return updatedLogs.slice(updatedLogs.length - maxLogs);
  }

  return updatedLogs;
}

/**
 * AbortController 안전 생성 및 정리
 *
 * @returns {Object} { controller, signal, abort, cleanup }
 */
export function createManagedAbortController() {
  const controller = new AbortController();
  let isAborted = false;

  return {
    controller,
    signal: controller.signal,
    abort: () => {
      if (!isAborted) {
        try {
          controller.abort();
          isAborted = true;
        } catch (e) {
          console.warn('AbortController abort 실패:', e);
        }
      }
    },
    isAborted: () => isAborted,
    cleanup: () => {
      if (!isAborted) {
        try {
          controller.abort();
        } catch (e) {
          console.warn('AbortController cleanup 실패:', e);
        }
      }
    },
  };
}

/**
 * 생성 완료 상태 확인
 *
 * @param {Object} state - 생성 상태
 * @returns {boolean} 완료 여부
 */
export function isGenerationComplete(state = {}) {
  return (
    state.currentStep === 'completed' ||
    state.currentStep === 'complete'
  );
}

/**
 * 생성 에러 상태 확인
 *
 * @param {Object} state - 생성 상태
 * @returns {boolean} 에러 여부
 */
export function hasGenerationError(state = {}) {
  return !!state.error || state.currentStep === 'error';
}

export default {
  calculateOptimalTimeout,
  classifyGenerationError,
  cleanupGenerationResources,
  createInitialGenerationState,
  mergeGenerationState,
  saveTtsSettingsToProject,
  logGenerationActivity,
  updateGenerationProgress,
  addLogWithLimit,
  createManagedAbortController,
  isGenerationComplete,
  hasGenerationError,
};
