/**
 * 유틸리티 중앙 관리 시스템
 * 
 * 이 파일은 프로젝트의 모든 유틸리티 함수들을 카테고리별로 정리하여
 * 편리한 import를 가능하게 합니다.
 * 
 * @example
 * // 개별 카테고리에서 import
 * import { formatTime, parseTime } from '@utils/time'
 * import { validateEmail, sanitizeInput } from '@utils/validation'
 * 
 * // 전체에서 한번에 import
 * import { formatTime, validateEmail, debounce } from '@utils'
 */

// ===== 시간 관련 유틸리티 =====
export * from './time';
export * from './eta';

// ===== 파일 관련 유틸리티 =====
export * from './fileManager';
export * from './buffer';
export * from './parseSrt';
export * from './media';

// ===== 텍스트 처리 유틸리티 =====
export * from './extract';
export * from './extractKeywords';
export * from './naming';
export * from './safeChars';
export * from './charBudget';

// ===== 데이터 처리 유틸리티 =====
export * from './scenes';
export * from './sceneIndex';
export * from './subtitle';
export * from './autoMatchEngine';
export * from './assetAutoMatch';

// ===== 플랫폼 관련 유틸리티 =====
export * from './platform';
export * from './ipc';
export * from './ipcSafe';

// ===== 공통 유틸리티 =====
export * from './common';
export * from './errorUtils';
export * from './pLimit';
export * from './prompts';

// ===== 카테고리별 네임스페이스 export =====
export * as time from './time';
export * as file from './fileManager';
export * as text from './extract';
export * as validation from './common';
export * as platform from './platform';
export * as ipc from './ipc';