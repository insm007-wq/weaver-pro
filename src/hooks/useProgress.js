/**
 * 진행 상황 추적을 위한 커스텀 훅
 * 
 * @description
 * 다양한 작업의 진행 상황을 추적하고 관리하는 커스텀 훅
 * 단계별 진행, 백분율 계산, 시간 추적, 상태 관리 등을 제공합니다.
 * 
 * @features
 * - 📊 백분율 기반 진행도 추적
 * - ⏱️ 시작/경과/예상 완료 시간 계산
 * - 🎯 단계별 진행 상황 관리
 * - 📈 진행 속도 및 ETA 계산
 * - 🔄 일시정지/재시작 기능
 * - 📝 상태 메시지 및 로그 관리
 * 
 * @example
 * ```jsx
 * import { useProgress } from '../hooks/useProgress';
 * 
 * function ProgressComponent() {
 *   const progress = useProgress({
 *     total: 100,
 *     onComplete: () => console.log('완료!')
 *   });
 *   
 *   const handleStep = () => {
 *     progress.increment(10);
 *   };
 *   
 *   return (
 *     <div>
 *       <div>진행도: {progress.percentage}%</div>
 *       <div>경과시간: {progress.elapsedTime}초</div>
 *       <div>예상완료: {progress.estimatedTimeRemaining}초</div>
 *     </div>
 *   );
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

/**
 * 진행 상황 상태 타입
 * 
 * @typedef {Object} ProgressState
 * @property {number} current - 현재 진행값
 * @property {number} total - 전체 목표값
 * @property {number} percentage - 진행 백분율 (0-100)
 * @property {'idle'|'running'|'paused'|'completed'|'error'} status - 진행 상태
 * @property {number|null} startTime - 시작 시간 (timestamp)
 * @property {number|null} endTime - 종료 시간 (timestamp)
 * @property {number} elapsedTime - 경과 시간 (초)
 * @property {number|null} estimatedTimeRemaining - 예상 남은 시간 (초)
 * @property {string} message - 현재 상태 메시지
 * @property {Array<string>} logs - 진행 로그
 */

/**
 * 시간을 읽기 쉬운 형태로 포매팅
 * 
 * @param {number} seconds - 초 단위 시간
 * @returns {string} 포매팅된 시간 문자열
 */
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0초';
  
  if (seconds < 60) {
    return `${Math.round(seconds)}초`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (minutes < 60) {
    return remainingSeconds > 0 
      ? `${minutes}분 ${remainingSeconds}초`
      : `${minutes}분`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes > 0
    ? `${hours}시간 ${remainingMinutes}분`
    : `${hours}시간`;
}

/**
 * 진행 상황 추적 커스텀 훅
 * 
 * @param {Object} [options] - 진행 상황 설정
 * @param {number} [options.total=100] - 전체 목표값
 * @param {number} [options.initial=0] - 초기 진행값
 * @param {Function} [options.onStart] - 시작 시 콜백
 * @param {Function} [options.onProgress] - 진행 시 콜백 (current, percentage) => void
 * @param {Function} [options.onComplete] - 완료 시 콜백
 * @param {Function} [options.onError] - 오류 시 콜백
 * @param {boolean} [options.autoStart=false] - 자동 시작 여부
 * @param {number} [options.updateInterval=1000] - 시간 업데이트 간격 (ms)
 * @returns {Object} 진행 상황 상태와 제어 함수들
 */
export function useProgress(options = {}) {
  const {
    total = 100,
    initial = 0,
    onStart,
    onProgress,
    onComplete,
    onError,
    autoStart = false,
    updateInterval = 1000
  } = options;

  // 기본 상태
  const [current, setCurrent] = useState(initial);
  const [status, setStatus] = useState(autoStart ? 'running' : 'idle');
  const [message, setMessage] = useState('준비 중...');
  const [logs, setLogs] = useState([]);
  
  // 시간 관련 상태
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [pausedDuration, setPausedDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Ref로 관리할 값들
  const pauseStartRef = useRef(null);
  const intervalRef = useRef(null);
  const totalRef = useRef(total);
  
  // total이 변경되면 ref 업데이트
  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  // 계산된 값들
  const percentage = useMemo(() => {
    return Math.min(Math.max((current / totalRef.current) * 100, 0), 100);
  }, [current, totalRef.current]);

  const elapsedTime = useMemo(() => {
    if (!startTime) return 0;
    
    const endTimeToUse = endTime || currentTime;
    const totalElapsed = (endTimeToUse - startTime) / 1000;
    return Math.max(totalElapsed - pausedDuration, 0);
  }, [startTime, endTime, currentTime, pausedDuration]);

  const estimatedTimeRemaining = useMemo(() => {
    if (!startTime || elapsedTime === 0 || current === 0) return null;
    
    const rate = current / elapsedTime; // 초당 진행량
    const remaining = totalRef.current - current;
    
    return remaining / rate;
  }, [startTime, elapsedTime, current, totalRef.current]);

  const isCompleted = useMemo(() => {
    return current >= totalRef.current;
  }, [current, totalRef.current]);

  // 로그 추가 함수
  const addLog = useCallback((logMessage) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${logMessage}`]);
  }, []);

  // 시간 업데이트 타이머
  useEffect(() => {
    if (status === 'running') {
      intervalRef.current = setInterval(() => {
        setCurrentTime(Date.now());
      }, updateInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [status, updateInterval]);

  // 진행 시작
  const start = useCallback(() => {
    if (status === 'completed') return;
    
    const now = Date.now();
    
    if (!startTime) {
      setStartTime(now);
      addLog('진행 시작');
      onStart?.();
    } else if (status === 'paused') {
      // 일시정지에서 재시작
      const pauseDuration = (now - pauseStartRef.current) / 1000;
      setPausedDuration(prev => prev + pauseDuration);
      pauseStartRef.current = null;
      addLog('진행 재시작');
    }
    
    setStatus('running');
    setMessage('진행 중...');
  }, [status, startTime, onStart, addLog]);

  // 진행 일시정지
  const pause = useCallback(() => {
    if (status !== 'running') return;
    
    setStatus('paused');
    setMessage('일시정지됨');
    pauseStartRef.current = Date.now();
    addLog('진행 일시정지');
  }, [status, addLog]);

  // 진행 재시작 (pause에서 resume)
  const resume = useCallback(() => {
    if (status !== 'paused') return;
    start();
  }, [status, start]);

  // 진행 중지 및 초기화
  const reset = useCallback(() => {
    setCurrent(initial);
    setStatus('idle');
    setMessage('준비 중...');
    setStartTime(null);
    setEndTime(null);
    setPausedDuration(0);
    setLogs([]);
    pauseStartRef.current = null;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    addLog('진행 상황 초기화');
  }, [initial, addLog]);

  // 값 설정
  const setValue = useCallback((newValue, statusMessage) => {
    const clampedValue = Math.max(0, Math.min(newValue, totalRef.current));
    setCurrent(clampedValue);
    
    if (statusMessage) {
      setMessage(statusMessage);
      addLog(statusMessage);
    }
    
    // 완료 체크
    if (clampedValue >= totalRef.current && status !== 'completed') {
      setStatus('completed');
      setMessage('완료됨');
      setEndTime(Date.now());
      addLog('진행 완료');
      onComplete?.();
    }
    
    // 진행 콜백 호출
    onProgress?.(clampedValue, (clampedValue / totalRef.current) * 100);
  }, [status, onProgress, onComplete, addLog]);

  // 값 증가
  const increment = useCallback((amount = 1, statusMessage) => {
    setValue(current + amount, statusMessage);
  }, [current, setValue]);

  // 값 감소
  const decrement = useCallback((amount = 1, statusMessage) => {
    setValue(current - amount, statusMessage);
  }, [current, setValue]);

  // 백분율로 설정
  const setPercentage = useCallback((percent, statusMessage) => {
    const newValue = (percent / 100) * totalRef.current;
    setValue(newValue, statusMessage);
  }, [setValue]);

  // 오류 처리
  const setError = useCallback((errorMessage) => {
    setStatus('error');
    setMessage(errorMessage);
    setEndTime(Date.now());
    addLog(`오류 발생: ${errorMessage}`);
    onError?.(errorMessage);
  }, [onError, addLog]);

  // 자동 시작
  useEffect(() => {
    if (autoStart && status === 'idle') {
      start();
    }
  }, [autoStart, status, start]);

  return {
    // 상태 값들
    current,
    total: totalRef.current,
    percentage: Math.round(percentage * 100) / 100, // 소수점 2자리까지
    status,
    message,
    logs,
    
    // 시간 관련
    startTime,
    endTime,
    elapsedTime,
    estimatedTimeRemaining,
    elapsedTimeFormatted: formatTime(elapsedTime),
    estimatedTimeRemainingFormatted: estimatedTimeRemaining ? formatTime(estimatedTimeRemaining) : null,
    
    // 상태 확인
    isIdle: status === 'idle',
    isRunning: status === 'running',
    isPaused: status === 'paused',
    isCompleted: status === 'completed',
    hasError: status === 'error',
    
    // 제어 함수들
    start,
    pause,
    resume,
    reset,
    setValue,
    increment,
    decrement,
    setPercentage,
    setError,
    setMessage: (msg) => {
      setMessage(msg);
      addLog(msg);
    }
  };
}

/**
 * 단계별 진행을 위한 특화된 훅
 * 
 * @param {Array<string>} steps - 진행 단계 이름 목록
 * @param {Object} [options] - 추가 옵션
 * @returns {Object} 단계별 진행 상태와 제어 함수들
 */
export function useStepProgress(steps = [], options = {}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  const progress = useProgress({
    ...options,
    total: steps.length,
    initial: 0
  });

  // 다음 단계로 진행
  const nextStep = useCallback((message) => {
    if (currentStepIndex < steps.length - 1) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      progress.increment(1, message || `단계 ${newIndex + 1}: ${steps[newIndex]}`);
    }
  }, [currentStepIndex, steps, progress]);

  // 이전 단계로 돌아가기
  const prevStep = useCallback((message) => {
    if (currentStepIndex > 0) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      progress.decrement(1, message || `단계 ${newIndex + 1}: ${steps[newIndex]}`);
    }
  }, [currentStepIndex, steps, progress]);

  // 특정 단계로 이동
  const goToStep = useCallback((stepIndex, message) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStepIndex(stepIndex);
      progress.setValue(stepIndex, message || `단계 ${stepIndex + 1}: ${steps[stepIndex]}`);
    }
  }, [steps, progress]);

  // 단계 초기화
  const resetSteps = useCallback(() => {
    setCurrentStepIndex(0);
    progress.reset();
  }, [progress]);

  return {
    ...progress,
    
    // 단계 관련 상태
    steps,
    currentStepIndex,
    currentStep: steps[currentStepIndex],
    totalSteps: steps.length,
    
    // 단계 제어 함수들
    nextStep,
    prevStep,
    goToStep,
    resetSteps,
    
    // 단계 상태 확인
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === steps.length - 1,
    canGoNext: currentStepIndex < steps.length - 1,
    canGoPrev: currentStepIndex > 0
  };
}