# 📚 Import 가이드 - Weaver Pro

이 가이드는 새로운 중앙 관리 시스템을 사용하여 효율적으로 import하는 방법을 설명합니다.

## 🎯 경로 별칭 시스템

Vite 설정을 통해 다음 별칭들을 사용할 수 있습니다:

```javascript
'@'          → 'src/'
'@hooks'     → 'src/hooks/'
'@utils'     → 'src/utils/'
'@components'→ 'src/components/'
'@constants' → 'src/constants/'
'@styles'    → 'src/styles/'
```

## 🔧 훅 (Hooks) 사용법

### 1. 전체 훅에서 Import
```javascript
// ✅ 권장: 자주 사용하는 훅들
import { useApi, useToast, useLocalStorage } from '@hooks';

// ✅ 새로운 프롬프트 전용 훅
import { usePrompts } from '@hooks';
```

### 2. 카테고리별 Import
```javascript
// API 관련 훅들만
import { useApi, useAsyncOperation } from '@hooks/api';

// UI 관련 훅들만  
import { useToast, useProgress, useFullscreen } from '@hooks/ui';

// 스토리지 관련 훅들만
import { useLocalStorage, usePersistentState } from '@hooks/storage';

// 폼 관련 훅들만
import { useFormState, useAutoMatch } from '@hooks/form';
```

### 3. 프롬프트 훅 사용 예시
```javascript
import { usePrompts } from '@hooks';

function MyComponent() {
  const {
    prompts,           // 현재 카테고리의 프롬프트 목록
    loading,           // 로딩 상태
    currentPrompt,     // 현재 선택된 프롬프트
    currentContent,    // 현재 프롬프트 내용
    createPrompt,      // 새 프롬프트 생성
    updatePrompt,      // 프롬프트 업데이트
    deletePrompt,      // 프롬프트 삭제
    selectPrompt,      // 프롬프트 선택
    setContent,        // 내용 변경
    resetToDefault     // 기본값으로 초기화
  } = usePrompts('script');

  return (
    // 컴포넌트 구현...
  );
}
```

## 🛠 유틸리티 (Utils) 사용법

### 1. 전체 유틸에서 Import
```javascript
// ✅ 권장: 자주 사용하는 유틸들
import { formatTime, validateEmail, debounce } from '@utils';
```

### 2. 카테고리별 Import  
```javascript
// 시간 관련
import { formatTime, parseTime } from '@utils/time';

// 파일 관련
import { readFile, writeFile } from '@utils/file';

// 텍스트 처리
import { extractKeywords, sanitizeInput } from '@utils/text';

// 플랫폼 관련
import { isWindows, isMac } from '@utils/platform';
```

### 3. 네임스페이스 Import
```javascript
// 모든 시간 유틸을 time 네임스페이스로
import { time } from '@utils';
time.formatTime(Date.now());

// 모든 파일 유틸을 file 네임스페이스로
import { file } from '@utils';
file.readFile('path/to/file');
```

## 📋 상수 (Constants) 사용법

### 1. 전체 상수에서 Import
```javascript
// ✅ 권장: 자주 사용하는 상수들
import { 
  LLM_OPTIONS, 
  TTS_ENGINES, 
  API_ENDPOINTS,
  DEFAULT_SETTINGS 
} from '@constants';
```

### 2. 카테고리별 Import
```javascript
// 썸네일 관련 상수만
import { 
  MAX_UPLOAD_MB, 
  QUALITY_PRESETS 
} from '@constants/thumbnail';

// 스크립트 생성 관련 상수만
import { 
  DEFAULT_GENERATE_PROMPT, 
  DEFAULT_REFERENCE_PROMPT 
} from '@constants/script';
```

### 3. API 엔드포인트 사용
```javascript
import { API_ENDPOINTS } from '@constants';

// 프롬프트 API 호출
api.invoke(API_ENDPOINTS.PROMPTS.GET_ALL);
api.invoke(API_ENDPOINTS.PROMPTS.CREATE, data);
api.invoke(API_ENDPOINTS.SETTINGS.GET, key);
```

## 🎨 스타일 (Styles) 사용법

```javascript
// 공통 스타일 시스템
import { 
  useContainerStyles, 
  useCardStyles, 
  useSettingsStyles 
} from '@styles/commonStyles';

function MyComponent() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  
  return (
    <div className={containerStyles.container}>
      <div className={cardStyles.baseCard}>
        {/* 내용 */}
      </div>
    </div>
  );
}
```

## 🚀 마이그레이션 가이드

### Before (기존 방식)
```javascript
// ❌ 상대 경로 사용
import { useApi } from '../../../hooks/useApi';
import { useToast } from '../../../hooks/useToast';
import { formatTime } from '../../../utils/time';
import { LLM_OPTIONS } from '../../../components/scriptgen/constants';

// ❌ 개별 프롬프트 관리 로직
const [prompts, setPrompts] = useState([]);
const [loading, setLoading] = useState(true);
const handleCreate = async () => { /* 중복 로직 */ };
const handleDelete = async () => { /* 중복 로직 */ };
```

### After (새로운 방식)
```javascript
// ✅ 별칭과 중앙 관리 사용
import { usePrompts } from '@hooks';
import { formatTime } from '@utils';
import { LLM_OPTIONS } from '@constants';

// ✅ 통합된 프롬프트 훅 사용
const {
  prompts,
  loading,
  createPrompt,
  deletePrompt
} = usePrompts('script');
```

## 📖 추가 팁

### 1. Tree Shaking 최적화
```javascript
// ✅ 좋음: 필요한 것만 import
import { useApi, useToast } from '@hooks';

// ❌ 피할 것: 전체 모듈 import
import * as hooks from '@hooks';
```

### 2. IDE 자동완성 활용
- VSCode에서 `@`를 입력하면 자동완성 제안
- `Ctrl/Cmd + 클릭`으로 정의로 이동 가능

### 3. 일관성 유지
```javascript
// ✅ 프로젝트 전체에서 일관된 패턴 사용
import { useApi } from '@hooks';
import { formatTime } from '@utils';
import { LLM_OPTIONS } from '@constants';
```

## 🔍 문제 해결

### 1. 모듈을 찾을 수 없는 경우
- `npm run dev` 재시작
- VSCode 재시작
- `vite.config.js` 설정 확인

### 2. 자동완성이 작동하지 않는 경우
- TypeScript를 사용 중이라면 `tsconfig.json`에 paths 설정 추가
- JSDoc 주석이 있는 모듈들 우선 사용

이 가이드를 따라 하시면 더 깔끔하고 유지보수하기 쉬운 코드를 작성할 수 있습니다! 🎉