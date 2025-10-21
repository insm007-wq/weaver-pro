/**
 * 대본 생성 훅
 *
 * ActionCard에서 분리된 대본 생성 로직을 관리합니다:
 * - 생성 프로세스 실행 (runScriptMode)
 * - AbortController 관리
 * - 상태 초기화 및 업데이트
 * - 에러 처리 및 복구
 * - 활동 로깅
 */

import { useState, useCallback, useRef } from 'react';
import { generateAudioAndSubtitles } from '../utils/audioSubtitleGenerator';
import { classifyGenerationError, cleanupGenerationResources, logGenerationActivity } from '../utils/generationHelper';

export function useScriptGenerator() {
  // 작업 취소를 위한 AbortController 관리
  const [currentOperation, setCurrentOperation] = useState(null);

  // 취소 진행 중 상태 (UI에서 사용자에게 표시)
  const [isCancelling, setIsCancelling] = useState(false);

  // 전역 abort 플래그 (어디서든 접근 가능)
  const abortFlagRef = useRef({ shouldAbort: false });

  // 로그 추가 헬퍼 함수
  const addLog = useCallback(
    (message, type = 'info', setFullVideoState) => {
      const timestamp = new Date().toLocaleTimeString();
      setFullVideoState((prev) => ({
        ...prev,
        logs: [...(prev.logs || []), { timestamp, message, type }],
      }));
    },
    []
  );

  // 상태 업데이트 헬퍼 함수
  const updateFullVideoState = useCallback(
    (updates, setFullVideoState) => {
      setFullVideoState((prev) => ({
        ...prev,
        ...updates,
        logs: updates.logs ? [...(prev.logs || []), ...updates.logs] : prev.logs,
      }));
    },
    []
  );

  // 대본 생성 모드 실행 함수
  const runScriptMode = useCallback(
    async (formData, options = {}) => {
      const {
        form,
        voices,
        api,
        runGenerate,
        setError,
        setIsLoading,
        setDoc,
        setFullVideoState,
      } = options;

      // 🛑 abort 플래그 명확하게 리셋 (새 생성 시작 시)
      abortFlagRef.current = { shouldAbort: false };
      console.log("✅ [runScriptMode] abort 플래그 리셋:", abortFlagRef.current);

      // 기존 작업이 진행 중이면 안전하게 취소
      if (currentOperation) {
        try {
          currentOperation.abort();
        } catch (e) {
          console.warn('기존 AbortController abort 실패:', e);
        }
      }

      // 새로운 AbortController 생성
      const abortController = new AbortController();
      setCurrentOperation(abortController);

      // 상태 초기화
      setError('');
      setIsLoading(true);
      setDoc(null);

      // 모든 상태를 한 번에 초기화 (로그만 초기화)
      const startTime = new Date();

      // 🛑 한 번의 setState 호출로 상태 배치 방지
      setFullVideoState({
        isGenerating: true,
        mode: 'script_mode',
        currentStep: 'script',
        progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
        results: { script: null, audio: null, images: [], video: null },
        streamingScript: '',
        error: null,
        startTime: startTime,
        logs: [{
          timestamp: startTime.toLocaleTimeString(),
          message: '📝 AI 대본 생성 중...',
          type: 'info'
        }],
      });

      try {
        // AbortController 신호 확인 (취소된 경우)
        if (abortController.signal.aborted) {
          throw new Error('작업이 취소되었습니다.');
        }

        // 🛑 runGenerate 호출 전 abort 확인
        if (abortFlagRef.current.shouldAbort) {
          throw new Error('작업이 취소되었습니다.');
        }

        const scriptResult = await runGenerate(formData);

        // 🛑 대본 생성 완료 후 abort 확인 (취소되었으면 진행 중단)
        if (abortFlagRef.current.shouldAbort) {
          throw new Error('작업이 취소되었습니다.');
        }

        if (scriptResult && scriptResult.scenes && Array.isArray(scriptResult.scenes) && scriptResult.scenes.length > 0) {
          // ✅ 대본 생성 완료 시 미디어 관련 상태 초기화
          window.dispatchEvent(new CustomEvent('reset-keyword-extraction')); // 미디어 준비 초기화
          window.dispatchEvent(new CustomEvent('reset-media-download')); // 미디어 다운로드 초기화
          window.dispatchEvent(new CustomEvent('reset-media-edit')); // 편집 페이지 초기화

          // 🛑 음성 생성 단계 진입 전 abort 확인
          if (abortController.signal.aborted) {
            throw new Error('작업이 취소되었습니다.');
          }

          // 🛑 상태 설정 전 abort 플래그 확인 (취소되었으면 여기서 중단)
          if (abortFlagRef.current.shouldAbort) {
            throw new Error('작업이 취소되었습니다.');
          }

          // 🎤 음성 생성 단계로 전환
          const audioStartTime = new Date();
          setFullVideoState((prev) => ({
            ...prev,
            currentStep: 'audio',
            logs: [
              ...(prev.logs || []),
              {
                timestamp: audioStartTime.toLocaleTimeString(),
                message: '🎤 음성 합성 중...',
                type: 'info'
              }
            ],
          }));

          // 음성 및 자막 생성용 새로운 AbortController 생성
          const audioAbortController = new AbortController();
          // 음성 생성 단계의 AbortController를 currentOperation에 저장 (취소 시 접근 가능하도록)
          setCurrentOperation(audioAbortController);

          // 🛑 음성 생성 시작 전 abort 확인
          if (abortController.signal.aborted) {
            throw new Error('작업이 취소되었습니다.');
          }

          // 음성 및 자막 생성 (이 함수 내에서 상태를 업데이트할 것)
          await generateAudioAndSubtitles(scriptResult, 'script_mode', {
            form,
            voices,
            setFullVideoState,
            api,
            addLog: (msg, type) => addLog(msg, type, setFullVideoState),
            abortSignal: audioAbortController.signal,
            abortFlagRef, // 글로벌 abort 플래그 전달
          });

          // 🛑 abort 확인 (generateAudioAndSubtitles 완료 후)
          if (abortFlagRef.current.shouldAbort) {
            throw new Error('작업이 취소되었습니다.');
          }

          // 대본 데이터 저장
          setDoc(scriptResult);

          // ✅ 모든 작업 완료 - isGenerating: false 설정
          setFullVideoState((prev) => ({
            ...prev,
            isGenerating: false,
          }));

          // 📋 관리자 페이지에 작업 로그 기록
          logGenerationActivity(
            {
              title: '대본 생성',
              detail: `"${formData.topic || '(제목 없음)'}" - ${formData.durationMin}분 (${scriptResult.scenes?.length || 0}개 장면)`,
              status: 'success',
              metadata: {
                sceneCount: scriptResult.scenes?.length || 0,
                duration: formData.durationMin,
                totalChars: scriptResult.scenes?.reduce((sum, s) => sum + (s.text?.length || 0), 0) || 0,
              },
            },
            { window }
          );
        } else {
          throw new Error('대본이 생성되지 않았습니다. 먼저 대본을 생성해주세요.');
        }
      } catch (error) {
        if (error.name === 'AbortError' || error.message === '작업이 취소되었습니다.') {
          // 취소된 경우: 상태 초기화는 cancelGeneration에서 이미 처리됨
          // 추가 상태 업데이트 불필요
        } else {
          const errorInfo = classifyGenerationError(error, 'script');
          console.error('대본 생성 오류:', error);
          setError(error.message);
          setFullVideoState((prev) => ({
            ...prev,
            error: error.message,
            isGenerating: false,
          }));

          // 📋 관리자 페이지에 에러 로그 기록
          logGenerationActivity(
            {
              title: '대본 생성',
              detail: `"${formData.topic || '(제목 없음)'}" - 생성 실패: ${error.message}`,
              status: 'error',
              metadata: {
                error: error.message,
                duration: formData.durationMin,
              },
            },
            { window }
          );
        }
      } finally {
        setIsLoading(false);
        setCurrentOperation(null);
      }
    },
    [currentOperation, addLog]
  );

  // 생성 취소 함수
  const cancelGeneration = useCallback(
    (options = {}) => {
      const { setFullVideoState, setIsLoading, setDoc } = options;

      // 취소 진행 중 상태 표시 (UI에서 버튼 비활성화)
      setIsCancelling(true);

      // 글로벌 abort 플래그 설정 (모든 백그라운드 작업 차단)
      abortFlagRef.current.shouldAbort = true;

      // AbortController abort
      if (currentOperation) {
        try {
          currentOperation.abort();
        } catch (e) {
          console.warn('AbortController abort 실패:', e);
        }
      }

      // 상태 초기화
      if (setFullVideoState) {
        setFullVideoState({
          isGenerating: false,
          mode: 'idle',
          currentStep: 'idle',
          progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
          results: { script: null, audio: null, images: [], video: null },
          streamingScript: '',
          error: null,
          startTime: null,
          logs: [],
        });
      }

      if (setIsLoading) {
        setIsLoading(false);
      }

      if (setDoc) {
        setDoc(null);
      }

      // AbortController 정리
      setCurrentOperation(null);

      // 1500ms 후 취소 진행 중 상태 해제 (재생성 허용)
      // abort flag와 백그라운드 작업이 완전히 정리될 시간 제공
      setTimeout(() => {
        setIsCancelling(false);
      }, 1500);
    },
    [currentOperation]
  );

  return {
    runScriptMode,
    cancelGeneration,
    currentOperation,
    setCurrentOperation,
    addLog,
    updateFullVideoState,
    isCancelling,
  };
}

export default useScriptGenerator;
