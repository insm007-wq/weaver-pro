# Weaver Pro - 프로젝트 아키텍처 문서

## 📋 개요

Weaver Pro는 AI 기반 동영상 제작 도구로, Electron과 React를 사용하여 구축된 데스크톱 애플리케이션입니다.

## 🏗️ 아키텍처 다이어그램

```
Weaver Pro Application
├── Frontend (React + Fluent UI)
│   ├── 스크립트 생성 (ScriptGen)
│   ├── 영상 조립 (Assemble) 
│   ├── 초안 내보내기 (DraftExport)
│   ├── 정교화 (Refine)
│   ├── 마무리 (Finalize)
│   └── 설정 (Settings)
│
├── Backend (Electron Main Process)
│   ├── IPC 통신 핸들러
│   ├── 파일 시스템 관리
│   ├── 외부 API 통합
│   └── 브라우저 자동화
│
└── Utilities
    ├── 공통 훅 (Custom Hooks)
    ├── 유틸리티 함수
    └── 공통 스타일
```

## 📁 폴더 구조

### 루트 디렉토리
```
weaver-pro/
├── electron/              # Electron 메인 프로세스
├── src/                   # React 프론트엔드 소스
├── public/                # 정적 자산
├── package.json           # 프로젝트 의존성
├── vite.config.js         # Vite 빌드 설정  
└── README.md              # 프로젝트 설명서
```

### src/ 디렉토리 구조
```
src/
├── components/            # React 컴포넌트
│   ├── scriptgen/         # 스크립트 생성 모듈
│   ├── assemble/          # 영상 조립 모듈
│   ├── draftexport/       # 초안 내보내기 모듈
│   ├── refine/            # 정교화 모듈
│   ├── finalize/          # 마무리 모듈
│   ├── settings/          # 설정 모듈
│   ├── common/            # 공통 컴포넌트
│   ├── ui/                # UI 기본 컴포넌트
│   └── ThumbnailGenerator/ # 썸네일 생성기
├── hooks/                 # 커스텀 훅
├── styles/                # 공통 스타일
├── utils/                 # 유틸리티 함수
├── App.jsx               # 메인 앱 컴포넌트
└── main.jsx              # React 엔트리 포인트
```

### electron/ 디렉토리 구조  
```
electron/
├── main.js               # Electron 메인 프로세스
├── preload.js            # 프리로드 스크립트
├── ipc/                  # IPC 핸들러들
│   ├── settings.js       # 설정 관련
│   ├── prompts.js        # 프롬프트 관리
│   ├── canva.js          # Canva 통합
│   └── thumbnails.js     # 썸네일 생성
└── utils/                # 백엔드 유틸리티
    ├── browserManager.js # 브라우저 관리
    ├── fileManager.js    # 파일 관리
    └── apiManager.js     # 외부 API 관리
```

## 🧩 모듈별 상세 설명

### 1. ScriptGen (스크립트 생성)
**위치**: `src/components/scriptgen/`

AI를 활용한 동영상 스크립트 자동 생성 모듈
- **AutoTab**: 완전 자동 스크립트 생성
- **RefTab**: 참고자료 기반 스크립트 생성  
- **ScriptPromptTab**: 스크립트 생성 프롬프트 관리
- **ReferencePromptTab**: 참고자료 프롬프트 관리

### 2. Assemble (영상 조립)
**위치**: `src/components/assemble/`

스크립트를 바탕으로 영상 자산을 수집하고 조립하는 모듈
- **SetupTab**: 기본 설정 (SRT 파일, 출력 경로 등)
- **KeywordsTab**: 키워드 추출 및 관리
- **CanvaTab**: Canva 자동 다운로드
- **ArrangeTab**: 자산 배치 및 편집
- **ReviewTab**: 최종 검토

#### 주요 하위 컴포넌트
- **parts/**: 재사용 가능한 부품들
  - `AssetLibrary.jsx` - 자산 라이브러리
  - `SceneList.jsx` - 장면 목록
  - `TimelineView.jsx` - 타임라인 뷰
  - `SubtitlePreview.jsx` - 자막 미리보기

### 3. DraftExport (초안 내보내기)  
**위치**: `src/components/draftexport/`

조립된 영상을 초안으로 내보내는 모듈
- 렌더링 옵션 설정
- 진행 상황 모니터링
- 미리보기 플레이어

### 4. Refine (정교화)
**위치**: `src/components/refine/`

초안을 정교하게 다듬는 편집 모듈
- 자막 편집
- 타이밍 조정
- 시각적 효과

### 5. Finalize (마무리)
**위치**: `src/components/finalize/`

최종 영상 출력 및 배포 모듈
- 최종 렌더링
- 품질 체크리스트
- 배포 준비

### 6. Settings (설정)
**위치**: `src/components/settings/`

애플리케이션 전역 설정 관리
- **ApiTab**: API 키 관리
- **PromptTab**: 프롬프트 템플릿 관리
- **ThumbnailTab**: 썸네일 설정
- **AppearanceTab**: 외관 설정

## 🔧 기술 스택

### Frontend
- **React 18**: 사용자 인터페이스
- **Fluent UI v9**: Microsoft 디자인 시스템
- **Vite**: 빌드 도구 및 개발 서버
- **React Hooks**: 상태 관리

### Backend  
- **Electron**: 크로스 플랫폼 데스크톱 앱
- **Node.js**: 백엔드 런타임
- **Playwright/Puppeteer**: 브라우저 자동화
- **electron-store**: 데이터 저장

### External APIs
- **OpenAI GPT**: AI 텍스트 생성
- **Google Gemini**: AI 이미지 분석
- **Canva API**: 디자인 자산 다운로드
- **Replicate**: AI 이미지 생성

## 🔄 데이터 흐름

```
1. 사용자 입력 (주제, 스타일 등)
   ↓
2. AI 스크립트 생성 (OpenAI/Gemini)
   ↓
3. 키워드 추출 (TF-IDF + AI)
   ↓  
4. 자산 수집 (Canva 자동화)
   ↓
5. 영상 조립 (자막 + 영상 매핑)
   ↓
6. 초안 렌더링 (FFmpeg)
   ↓
7. 정교화 편집 (사용자 수정)
   ↓
8. 최종 출력 (완성된 영상)
```

## 📡 IPC 통신 구조

### 주요 IPC 채널
```javascript
// 설정 관리
'settings:get' / 'settings:set'

// 프롬프트 관리  
'prompts:getAll' / 'prompts:create' / 'prompts:update' / 'prompts:delete'

// Canva 자동화
'canva:login' / 'canva:download' / 'canva:progress'

// 썸네일 생성
'thumbnail:generate' / 'thumbnail:progress'

// 파일 관리
'file:read' / 'file:write' / 'file:select'
```

## 🎨 스타일링 아키텍처

### 스타일 계층 구조
1. **Fluent UI Tokens**: 기본 디자인 토큰
2. **Common Styles** (`src/styles/commonStyles.js`): 공통 스타일 패턴
3. **Component Styles**: 개별 컴포넌트 전용 스타일
4. **Utility Classes**: 헬퍼 클래스

### 디자인 시스템
- **색상**: Fluent UI 색상 팔레트 기준
- **타이포그래피**: Fluent UI 폰트 시스템
- **간격**: Fluent UI 스페이싱 토큰
- **그림자**: 계층적 그림자 시스템

## 🧪 커스텀 훅 아키텍처

### 훅 카테고리
- **UI 훅**: `useToast` - 알림 관리
- **데이터 훅**: `useApi`, `useLocalStorage` - 데이터 처리  
- **상태 훅**: `useProgress` - 진행 상황 관리
- **유틸리티 훅**: 범용 기능

## 🔒 보안 고려사항

### API 키 관리
- Electron의 안전한 저장소 사용 (`keytar`)
- 메인 프로세스에서만 접근 가능
- 렌더러 프로세스에서는 마스킹된 값만 표시

### IPC 보안
- `contextIsolation` 활성화
- `nodeIntegration` 비활성화  
- 프리로드 스크립트를 통한 제한적 API 노출

## 📈 성능 최적화

### React 최적화
- 컴포넌트 lazy loading
- 메모이제이션 (`useMemo`, `useCallback`)
- 적절한 key 사용

### Electron 최적화  
- 필요시에만 브라우저 인스턴스 생성
- 메모리 사용량 모니터링
- 백그라운드 작업 최적화

## 🚀 빌드 및 배포

### 개발 환경
```bash
npm run dev     # Vite 개발 서버 시작
npm start       # Electron 앱 시작  
```

### 프로덕션 빌드
```bash
npm run build   # React 앱 빌드
npm run dist    # Electron 패키징 (예정)
```

## 📚 추가 문서

- [컴포넌트 가이드](./docs/COMPONENTS.md)
- [API 참조서](./docs/API.md)  
- [스타일 가이드](./docs/STYLES.md)
- [개발 가이드](./docs/DEVELOPMENT.md)

---

**최종 업데이트**: 2024-01-01  
**작성자**: Weaver Pro Team  
**버전**: 1.0.0