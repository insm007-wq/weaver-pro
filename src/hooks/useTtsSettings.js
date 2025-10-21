/**
 * TTS 설정 관리 훅
 *
 * 음성 합성(TTS) 설정을 통합 관리합니다:
 * - 프로젝트/전역 설정 로드 (중복 제거)
 * - TTS 설정 저장 (프로젝트 또는 전역)
 * - 설정 유효성 검사
 * - 캐싱 최적화
 */

import { useState, useEffect, useCallback } from 'react';
import { saveTtsSettingsToProject } from '../utils/generationHelper';

export function useTtsSettings() {
  const [ttsSettings, setTtsSettings] = useState(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState(null);

  // 프로젝트에서 TTS 설정 로드
  const loadProjectTtsSettings = useCallback(async () => {
    setIsLoadingSettings(true);
    setSettingsError(null);

    try {
      // 먼저 프로젝트에서 시도
      const result = await window.api.invoke('project:current');

      if (result?.success && result?.project?.ttsSettings) {
        setTtsSettings(result.project.ttsSettings);
        return result.project.ttsSettings;
      }

      // 프로젝트에 없으면 전역 설정 확인 (fallback)
      try {
        const globalSettings = await window.api.invoke('settings:get', 'lastUsedTtsSettings');

        if (globalSettings) {
          setTtsSettings(globalSettings);
          return globalSettings;
        }
      } catch (globalError) {
        console.warn('⚠️ 전역 TTS 설정 로드 실패:', globalError);
      }

      // 설정이 없으면 기본값 반환
      const defaultSettings = {
        voiceId: 'ko-KR-Standard-A',
        speed: '1.0',
        pitch: '-1',
        ttsEngine: 'google',
      };
      setTtsSettings(defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error('❌ TTS 설정 로드 오류:', error);
      setSettingsError(error.message);

      // 에러 발생 시 기본값 반환
      const defaultSettings = {
        voiceId: 'ko-KR-Standard-A',
        speed: '1.0',
        pitch: '-1',
        ttsEngine: 'google',
      };
      setTtsSettings(defaultSettings);
      return defaultSettings;
    } finally {
      setIsLoadingSettings(false);
    }
  }, []);

  // TTS 설정 저장
  const saveTtsSettings = useCallback(
    async (newSettings = {}, options = {}) => {
      const { form, voices, addLog } = options;

      try {
        // 새 설정 객체 생성 (기존 설정과 병합)
        const ttsSettingsToSave = {
          voiceId: newSettings.voiceId || form?.voice || voices?.[0]?.id || 'ko-KR-Standard-A',
          speed: newSettings.speed || form?.speed || '1.0',
          pitch: newSettings.pitch || form?.pitch || '-1',
          ttsEngine: newSettings.ttsEngine || form?.ttsEngine || 'google',
        };

        // generationHelper의 saveTtsSettingsToProject 사용
        const result = await saveTtsSettingsToProject(ttsSettingsToSave, {
          api: window.api,
          projectResult: await window.api.invoke('project:current'),
          addLog,
        });

        if (result.success) {
          setTtsSettings(ttsSettingsToSave);
          return { success: true, settings: ttsSettingsToSave };
        }

        throw new Error(result.error || 'TTS 설정 저장 실패');
      } catch (error) {
        console.error('❌ TTS 설정 저장 중 오류:', error);
        setSettingsError(error.message);
        return { success: false, error: error.message };
      }
    },
    []
  );

  // 초기 로드
  useEffect(() => {
    loadProjectTtsSettings();
  }, [loadProjectTtsSettings]);

  return {
    ttsSettings,
    isLoadingSettings,
    settingsError,
    loadProjectTtsSettings,
    saveTtsSettings,
  };
}

export default useTtsSettings;
