/**
 * 훅 중앙 관리 시스템
 * 
 * 이 파일은 프로젝트의 모든 커스텀 훅들을 카테고리별로 정리하여
 * 편리한 import를 가능하게 합니다.
 * 
 * @example
 * // 개별 카테고리에서 import
 * import { useApi, useAsyncOperation } from '@hooks/api'
 * import { useProgress } from '@hooks/ui'
 * 
 * // 전체에서 한번에 import
 * import { useApi, useLocalStorage } from '@hooks'
 */

// ===== API 관련 훅들 =====
export { useApi } from './useApi';

// ===== 스토리지 관련 훅들 =====
export { useLocalStorage } from './useLocalStorage';
export { usePersistProject } from './usePersistProject';

// ===== UI 상태 관련 훅들 =====
export { useProgress } from './useProgress';
export { default as useFullscreen } from './useFullscreen';

// ===== 폼 상태 관련 훅들 =====
export { useFormState } from './useFormState';
export { useAutoMatch } from './useAutoMatch';

// ===== 비즈니스 로직 훅들 =====
export { default as usePrompts } from './usePrompts';

// ===== 스크립트 생성 관련 훅들 =====
export { useScriptGeneration } from './useScriptGeneration';
export { useVoiceSettings } from './useVoiceSettings';
export { usePromptSettings } from './usePromptSettings';

// ===== AssembleEditor 관련 훅들 =====
export { useFileManagement } from './useFileManagement';
export { useKeywordExtraction } from './useKeywordExtraction';

// ===== 카테고리별 네임스페이스 export =====
export * as api from './api';
export * as storage from './storage';
export * as ui from './ui';
export * as form from './form';