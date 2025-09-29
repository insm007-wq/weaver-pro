/**
 * 프롬프트 설정 관리를 위한 커스텀 훅
 * 
 * @description
 * 대본 생성을 위한 프롬프트 목록을 로드하고 관리하는 훅
 * API를 통해 사용자가 생성한 프롬프트 목록을 가져와 선택할 수 있도록 합니다.
 * 
 * @features
 * - 📋 프롬프트 목록 자동 로드
 * - 🔄 로딩 상태 관리
 * - 🎯 기본 프롬프트 필터링 (isDefault가 아닌 것만)
 * - 🔤 한국어 정렬 지원
 * - 🛡️ 안전한 오류 처리
 * 
 * @example
 * ```jsx
 * import { usePromptSettings } from './hooks/usePromptSettings';
 * 
 * function ScriptGenerator() {
 *   const { promptNames, promptLoading } = usePromptSettings();
 *   
 *   if (promptLoading) return <Spinner />;
 *   
 *   return (
 *     <Select>
 *       {promptNames.map(name => (
 *         <Option key={name} value={name}>{name}</Option>
 *       ))}
 *     </Select>
 *   );
 * }
 * ```
 * 
 * @usage
 * - ScriptVoiceGenerator.jsx: 대본 생성용 프롬프트 선택
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import { useState, useEffect } from "react";
import { useApi } from "./useApi";

/**
 * 프롬프트 설정 관리 훅
 * 
 * @returns {Object} 프롬프트 관련 상태와 데이터
 * @returns {Array<string>} returns.promptNames - 사용 가능한 프롬프트 이름 목록 (한국어 정렬)
 * @returns {boolean} returns.promptLoading - 프롬프트 로딩 중 여부
 */
export function usePromptSettings() {
  const api = useApi();

  const [promptNames, setPromptNames] = useState([]);
  const [promptLoading, setPromptLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let debounceTimer = null;
    let isLoading = false; // 로딩 중복 방지

    const loadPrompts = async () => {
      // 이미 로딩 중이면 중복 호출 방지
      if (isLoading || !isMounted) return;

      isLoading = true;
      try {
        const res = await api.invoke("prompts:getAll");
        if (isMounted && (res?.ok || res?.success) && Array.isArray(res.data)) {
          const list = res.data;
          const names = Array.from(
            new Set(
              list
                .filter((p) => p.name?.trim()) // 모든 프롬프트 포함 (기본 프롬프트도 포함)
                .map((p) => p.name.trim())
            )
          ).sort((a, b) => a.localeCompare(b, "ko"));
          setPromptNames(names);
        }
      } catch (error) {
        console.error("프롬프트 로딩 실패:", error);
      } finally {
        isLoading = false;
        if (isMounted) setPromptLoading(false);
      }
    };

    // 디바운스된 로드 함수 (중복 호출 방지 강화)
    const debouncedLoadPrompts = () => {
      if (!isMounted) return;

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        if (isMounted && !isLoading) {
          console.log("[usePromptSettings] 프롬프트 변경 감지, 다시 로드");
          loadPrompts();
        }
      }, 500); // 디바운스 시간을 500ms로 증가 (안정성 강화)
    };

    // 초기 로드
    loadPrompts();

    // 설정 변경 이벤트 리스너 추가 (실시간 업데이트)
    const handleSettingsChanged = (payload) => {
      if (payload?.key === "prompts" && isMounted && !isLoading) {
        debouncedLoadPrompts();
      }
    };

    // IPC 이벤트 리스너 등록 (중복 등록 방지)
    if (window.api?.on) {
      // 기존 리스너가 있다면 먼저 제거
      if (window.api?.off) {
        window.api.off("settings:changed", handleSettingsChanged);
      }
      window.api.on("settings:changed", handleSettingsChanged);
    }

    return () => {
      isMounted = false;
      isLoading = false;
      // 디바운스 타이머 정리
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      // 컴포넌트 언마운트 시 리스너 제거
      if (window.api?.off) {
        window.api.off("settings:changed", handleSettingsChanged);
      }
    };
  }, []);

  return {
    promptNames,
    promptLoading,
  };
}