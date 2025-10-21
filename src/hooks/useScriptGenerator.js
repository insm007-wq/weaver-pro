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

import { useState, useCallback } from 'react';
import { generateAudioAndSubtitles } from '../utils/audioSubtitleGenerator';
import { classifyGenerationError, cleanupGenerationResources, logGenerationActivity } from '../utils/generationHelper';

export function useScriptGenerator() {
  // 작업 취소를 위한 AbortController 관리
  const [currentOperation, setCurrentOperation] = useState(null);

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

      // 기존 작업이 진행 중이면 취소
      if (currentOperation) {
        currentOperation.abort();
      }

      const abortController = new AbortController();
      setCurrentOperation(abortController);

      setError('');
      setIsLoading(true);
      setDoc(null);

      setFullVideoState({
        isGenerating: true,
        mode: 'script_mode',
        currentStep: 'script',
        progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
        results: { script: null, audio: null, images: [], video: null },
        streamingScript: '',
        error: null,
        startTime: new Date(),
        logs: [],
      });

      try {
        // 전역 설정에서 영상 폴더 경로 가져오기
        let videoSaveFolder = null;
        if (!window.api?.getSetting) {
          throw new Error('API를 사용할 수 없습니다.');
        }

        try {
          const videoFolderSettingResult = await window.api.getSetting('videoSaveFolder');
          const videoFolderSetting = videoFolderSettingResult?.value || videoFolderSettingResult;
          if (videoFolderSetting) {
            videoSaveFolder = videoFolderSetting;
          }
        } catch (settingError) {
          // 전역 설정 읽기 실패시 무시
        }

        addLog('📝 AI 대본 생성 중...', 'info', setFullVideoState);
        const scriptResult = await runGenerate(formData);

        if (scriptResult && scriptResult.scenes && Array.isArray(scriptResult.scenes) && scriptResult.scenes.length > 0) {
          // ✅ 대본 생성 완료 시 미디어 관련 상태 초기화
          window.dispatchEvent(new CustomEvent('reset-keyword-extraction')); // 미디어 준비 초기화
          window.dispatchEvent(new CustomEvent('reset-media-download')); // 미디어 다운로드 초기화
          window.dispatchEvent(new CustomEvent('reset-media-edit')); // 편집 페이지 초기화

          setFullVideoState((prev) => ({
            ...prev,
            currentStep: 'audio',
            progress: { ...prev.progress, script: 100, audio: 0 },
          }));

          // 음성 및 자막 생성
          await generateAudioAndSubtitles(scriptResult, 'script_mode', {
            form,
            voices,
            setFullVideoState,
            api,
            addLog: (msg, type) => addLog(msg, type, setFullVideoState),
            abortSignal: abortController.signal,
          });

          // 대본 데이터 저장
          setDoc(scriptResult);

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
          console.log('⏹️ 작업 취소됨');
          // 취소 시에는 에러로 표시하지 않고 상태만 초기화
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
          setDoc(null);
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

      // 중지 로직: AbortController로 실제 작업 중단
      if (currentOperation) {
        console.log('🛑 작업 중단 요청');
        currentOperation.abort();
        setCurrentOperation(null);
      }

      // 상태 초기화
      if (setFullVideoState) {
        setFullVideoState((prev) => ({
          ...prev,
          isGenerating: false,
          currentStep: 'idle',
          progress: { script: 0, audio: 0, images: 0, video: 0, subtitle: 0 },
          error: null,
        }));
      }

      if (setIsLoading) {
        setIsLoading(false);
      }

      if (setDoc) {
        setDoc(null);
      }
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
  };
}

export default useScriptGenerator;
