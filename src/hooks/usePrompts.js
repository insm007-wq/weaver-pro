/**
 * 프롬프트 관리 전용 훅
 * 
 * PromptTab.jsx와 ScriptPromptTab.jsx에서 중복된 프롬프트 관리 로직을
 * 하나의 재사용 가능한 훅으로 통합합니다.
 * 
 * @example
 * const {
 *   prompts,
 *   loading,
 *   currentPrompt,
 *   createPrompt,
 *   updatePrompt,
 *   deletePrompt,
 *   selectPrompt
 * } = usePrompts('script');
 */

import { useState, useEffect, useRef } from 'react';
import { useApi } from './useApi';
import { API_ENDPOINTS } from '@constants';

const usePrompts = (category = 'script', options = {}) => {
  const api = useApi();
  
  // 옵션 기본값
  const {
    autoLoadDefault = true,
    showToasts = true,
    onSuccess = null,
    onError = null
  } = options;

  // 상태 관리
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPromptId, setCurrentPromptId] = useState('');
  const [currentContent, setCurrentContent] = useState('');
  const didInitRef = useRef(false);

  // 현재 선택된 프롬프트 객체
  const currentPrompt = prompts.find(p => p.id === currentPromptId);

  // 카테고리별 프롬프트 목록
  const categoryPrompts = prompts.filter(p => p.category === category);

  // 초기 로드
  useEffect(() => {
    loadPrompts();
  }, [category]);

  // 기본 프롬프트 자동 선택 (최초 1회)
  useEffect(() => {
    if (!didInitRef.current && categoryPrompts.length > 0 && autoLoadDefault) {
      const defaultPrompt = categoryPrompts.find(p => p.isDefault);
      if (defaultPrompt) {
        selectPrompt(defaultPrompt.id);
      } else if (categoryPrompts.length > 0) {
        selectPrompt(categoryPrompts[0].id);
      }
      didInitRef.current = true;
      setLoading(false);
    }
  }, [categoryPrompts, autoLoadDefault]);

  /**
   * 프롬프트 목록 로드
   */
  const loadPrompts = async () => {
    try {
      setLoading(true);
      const result = await api.invoke(API_ENDPOINTS.PROMPTS.GET_BY_CATEGORY, category);
      
      if (result?.ok && Array.isArray(result.data)) {
        setPrompts(result.data);
      } else {
        throw new Error(result?.message || 'Failed to load prompts');
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
      if (showToasts) {
        toast.error('프롬프트 로드에 실패했습니다.');
      }
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 프롬프트 선택 및 내용 로드
   */
  const selectPrompt = async (id) => {
    try {
      setCurrentPromptId(id);
      
      const result = await api.invoke(API_ENDPOINTS.PROMPTS.GET_BY_ID, id);
      if (result?.ok && result.data) {
        setCurrentContent(result.data.content || '');
      } else {
        // 기본값으로 폴백
        const defaultResult = await api.invoke(API_ENDPOINTS.PROMPTS.GET_DEFAULT, category);
        if (defaultResult?.ok && defaultResult.data) {
          setCurrentContent(defaultResult.data.content || '');
        }
      }
    } catch (error) {
      console.error('Failed to select prompt:', error);
      if (showToasts) {
        toast.error('프롬프트 로드에 실패했습니다.');
      }
      if (onError) onError(error);
    }
  };

  /**
   * 새 프롬프트 생성
   */
  const createPrompt = async (name, content = '') => {
    try {
      const result = await api.invoke(API_ENDPOINTS.PROMPTS.CREATE, {
        name: name.trim(),
        category,
        content: content || currentContent
      });

      if (result?.ok && result.data) {
        await loadPrompts(); // 목록 새로고침
        setCurrentPromptId(result.data.id);
        setCurrentContent(result.data.content || '');
        
        if (showToasts) {
          toast.success('프롬프트가 생성되었습니다.');
        }
        if (onSuccess) onSuccess('create', result.data);
        
        return result.data;
      } else {
        throw new Error(result?.message || 'Failed to create prompt');
      }
    } catch (error) {
      console.error('Failed to create prompt:', error);
      if (showToasts) {
        toast.error('프롬프트 생성에 실패했습니다.');
      }
      if (onError) onError(error);
      throw error;
    }
  };

  /**
   * 프롬프트 업데이트
   */
  const updatePrompt = async (id = currentPromptId, updates = {}) => {
    try {
      const result = await api.invoke(API_ENDPOINTS.PROMPTS.UPDATE, id, {
        content: currentContent,
        ...updates
      });

      if (result?.ok) {
        await loadPrompts(); // 목록 새로고침
        
        if (showToasts) {
          toast.success('프롬프트가 저장되었습니다.');
        }
        if (onSuccess) onSuccess('update', result.data);
        
        return result.data;
      } else {
        throw new Error(result?.message || 'Failed to update prompt');
      }
    } catch (error) {
      console.error('Failed to update prompt:', error);
      if (showToasts) {
        toast.error('프롬프트 저장에 실패했습니다.');
      }
      if (onError) onError(error);
      throw error;
    }
  };

  /**
   * 프롬프트 삭제
   */
  const deletePrompt = async (id = currentPromptId) => {
    try {
      const prompt = prompts.find(p => p.id === id);
      if (prompt?.isDefault) {
        if (showToasts) {
          toast.warning('기본 프롬프트는 삭제할 수 없습니다.');
        }
        return false;
      }

      const result = await api.invoke(API_ENDPOINTS.PROMPTS.DELETE, id);
      
      if (result?.ok) {
        await loadPrompts(); // 목록 새로고침
        
        // 삭제된 프롬프트가 현재 선택된 프롬프트라면 기본값으로 전환
        if (id === currentPromptId) {
          const defaultPrompt = categoryPrompts.find(p => p.isDefault);
          if (defaultPrompt) {
            selectPrompt(defaultPrompt.id);
          } else if (categoryPrompts.length > 0) {
            selectPrompt(categoryPrompts[0].id);
          }
        }
        
        if (showToasts) {
          toast.success('프롬프트가 삭제되었습니다.');
        }
        if (onSuccess) onSuccess('delete', { id });
        
        return true;
      } else {
        throw new Error(result?.message || 'Failed to delete prompt');
      }
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      if (showToasts) {
        toast.error('프롬프트 삭제에 실패했습니다.');
      }
      if (onError) onError(error);
      throw error;
    }
  };

  /**
   * 기본값으로 초기화
   */
  const resetToDefault = async () => {
    try {
      const result = await api.invoke(API_ENDPOINTS.PROMPTS.GET_DEFAULT, category);
      
      if (result?.ok && result.data) {
        setCurrentContent(result.data.content || '');
        setCurrentPromptId(result.data.id);
        
        if (showToasts) {
          toast.success('기본값으로 초기화되었습니다.');
        }
        if (onSuccess) onSuccess('reset', result.data);
      }
    } catch (error) {
      console.error('Failed to reset to default:', error);
      if (showToasts) {
        toast.error('초기화에 실패했습니다.');
      }
      if (onError) onError(error);
    }
  };

  /**
   * 프롬프트 내용 변경
   */
  const setContent = (content) => {
    setCurrentContent(content);
  };

  /**
   * 프롬프트 페어 관리 (script + reference 동시 관리)
   */
  const savePair = async (name, scriptContent, referenceContent) => {
    try {
      const result = await api.invoke(API_ENDPOINTS.PROMPTS.SAVE_PAIR, {
        name: name.trim(),
        scriptContent,
        referenceContent
      });

      if (result?.ok) {
        await loadPrompts(); // 목록 새로고침
        
        if (showToasts) {
          toast.success('프롬프트 페어가 저장되었습니다.');
        }
        if (onSuccess) onSuccess('savePair', result.data);
        
        return result.data;
      } else {
        throw new Error(result?.message || 'Failed to save prompt pair');
      }
    } catch (error) {
      console.error('Failed to save prompt pair:', error);
      if (showToasts) {
        toast.error('프롬프트 페어 저장에 실패했습니다.');
      }
      if (onError) onError(error);
      throw error;
    }
  };

  /**
   * 프롬프트 페어 로드
   */
  const loadPair = async (name) => {
    try {
      const result = await api.invoke(API_ENDPOINTS.PROMPTS.GET_PAIR_BY_NAME, name);
      
      if (result?.ok) {
        return result.data;
      } else {
        throw new Error(result?.message || 'Failed to load prompt pair');
      }
    } catch (error) {
      console.error('Failed to load prompt pair:', error);
      if (onError) onError(error);
      throw error;
    }
  };

  // 반환값
  return {
    // 상태
    prompts: categoryPrompts,
    allPrompts: prompts,
    loading,
    currentPrompt,
    currentPromptId,
    currentContent,
    
    // 액션
    loadPrompts,
    selectPrompt,
    createPrompt,
    updatePrompt,
    deletePrompt,
    resetToDefault,
    setContent,
    
    // 페어 관리
    savePair,
    loadPair,
    
    // 유틸리티
    isDefault: currentPrompt?.isDefault || false,
    hasChanges: currentPrompt?.content !== currentContent,
    isEmpty: !currentContent?.trim(),
    
    // 통계
    stats: {
      total: categoryPrompts.length,
      custom: categoryPrompts.filter(p => !p.isDefault).length,
      default: categoryPrompts.filter(p => p.isDefault).length
    }
  };
};

export default usePrompts;