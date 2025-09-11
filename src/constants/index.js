/**
 * 상수 통합 관리 시스템
 * 
 * 이 파일은 프로젝트의 모든 상수들을 카테고리별로 정리하여
 * 편리한 import를 가능하게 합니다.
 * 
 * @example
 * import { LLM_OPTIONS, TTS_ENGINES } from '@constants'
 * import { MAX_UPLOAD_MB, QUALITY_PRESETS } from '@constants/thumbnail'
 */

// ===== 스크립트 생성 관련 상수들 =====
export {
  DUR_OPTIONS,
  MAX_SCENE_OPTIONS,
  LLM_OPTIONS,
  TTS_ENGINES,
  VOICES_BY_ENGINE,
  DEFAULT_GENERATE_PROMPT,
  DEFAULT_REFERENCE_PROMPT,
  DEFAULT_TEMPLATE
} from '../components/scriptgen/constants';

// ===== 썸네일 관련 상수들 =====
export {
  MAX_UPLOAD_MB,
  QUALITY_PRESETS,
  SUPPORTED_IMAGE_TYPES,
  SUPPORTED_IMAGE_EXTENSIONS,
  DEFAULT_PROMPT_KEYWORDS
} from './thumbnailConstants';

// ===== 공통 상수들 =====
export const APP_NAME = 'Weaver Pro';
export const APP_VERSION = '2.0.0';

// API 엔드포인트 관련
export const API_ENDPOINTS = {
  PROMPTS: {
    GET_ALL: 'prompts:getAll',
    GET_BY_ID: 'prompts:getById',
    GET_BY_CATEGORY: 'prompts:getByCategory',
    GET_DEFAULT: 'prompts:getDefault',
    CREATE: 'prompts:create',
    UPDATE: 'prompts:update',
    DELETE: 'prompts:delete',
    SAVE_PAIR: 'prompts:savePair',
    GET_PAIR_BY_NAME: 'prompts:getPairByName',
    DELETE_BY_NAME: 'prompts:deleteByName',
    RESET: 'prompts:reset'
  },
  SETTINGS: {
    GET: 'settings:get',
    SET: 'settings:set',
    GET_ALL: 'settings:getAll'
  },
  FILES: {
    SAVE_PROJECT: 'files:saveProject',
    LOAD_PROJECT: 'files:loadProject',
    EXPORT_DRAFT: 'files:exportDraft'
  }
};

// 파일 크기 제한
export const FILE_SIZE_LIMITS = {
  IMAGE: 10 * 1024 * 1024, // 10MB
  AUDIO: 50 * 1024 * 1024, // 50MB
  VIDEO: 100 * 1024 * 1024, // 100MB
};

// 지원하는 파일 형식
export const SUPPORTED_FORMATS = {
  IMAGE: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
  AUDIO: ['mp3', 'wav', 'aac', 'm4a'],
  VIDEO: ['mp4', 'avi', 'mov', 'wmv'],
  SUBTITLE: ['srt', 'vtt', 'ass']
};

// 기본 설정값들
export const DEFAULT_SETTINGS = {
  THEME: 'light',
  LANGUAGE: 'ko',
  AUTO_SAVE: true,
  AUTO_SAVE_INTERVAL: 30000, // 30초
  MAX_RECENT_PROJECTS: 10
};

// 프로젝트 상태
export const PROJECT_STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

// 에러 코드
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  SIZE_LIMIT_EXCEEDED: 'SIZE_LIMIT_EXCEEDED'
};