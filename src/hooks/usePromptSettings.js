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
    
    const loadPrompts = async () => {
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
        if (isMounted) setPromptLoading(false);
      }
    };

    loadPrompts();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    promptNames,
    promptLoading,
  };
}