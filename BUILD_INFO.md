# Weaver Pro - 빌드 및 개발 가이드

## 📦 프로젝트 정보

- **프로젝트명**: Weaver Pro
- **버전**: 1.0.0
- **기술 스택**: Electron + React + Vite
- **지원 OS**: Windows, macOS

---

## 🚀 개발 환경 설정

### 1. 필수 요구사항

- **Node.js**: 18.x 이상
- **npm**: 9.x 이상
- **Git**: 최신 버전

### 2. 저장소 클론

```bash
git clone https://github.com/insm007-wq/weaver-pro.git
cd weaver-pro
```

### 3. 브랜치 확인

```bash
# 현재 작업 브랜치: test5
git checkout test5

# 브랜치 확인
git branch
```

### 4. 의존성 설치

```bash
npm install
```

### 5. 개발 모드 실행

**방법 1: 두 개의 터미널 사용 (추천)**

```bash
# 터미널 1: Vite 개발 서버 실행
npm run dev

# 터미널 2: Electron 실행
npm run electron:dev
```

**방법 2: 포트 변경이 필요한 경우**

```bash
# Vite 서버를 5174 포트로 실행
npm run dev:5174

# Electron을 5174 포트로 연결
npm run electron:dev:5174
```

---

## 🔨 빌드 방법

### 로컬 빌드

**Windows 빌드 (Windows에서만 가능)**

```bash
npm run build:win
```

- 출력 위치: `dist_electron/Weaver Pro Setup 1.0.0.exe`

**macOS 빌드 (macOS에서만 가능)**

```bash
npm run build:mac
```

- 출력 위치: `dist_electron/Weaver Pro-1.0.0.dmg`

---

## ☁️ GitHub Actions 자동 빌드

### 자동 빌드 트리거

다음 브랜치에 `git push`하면 자동으로 Windows와 macOS 빌드가 시작됩니다:

- `main` 브랜치
- `test5` 브랜치

### 빌드 결과 확인

1. **GitHub Actions 페이지 이동**
   ```
   https://github.com/insm007-wq/weaver-pro/actions
   ```

2. **빌드 진행 상황**
   - 🟡 노란색: 빌드 진행 중
   - ✅ 초록색: 빌드 완료
   - ❌ 빨간색: 빌드 실패

3. **빌드 시간**
   - Windows: 약 5분
   - macOS: 약 7분
   - 총 소요 시간: 약 10분

### 빌드 파일 다운로드

1. GitHub Actions 페이지에서 완료된 워크플로우 클릭
2. 페이지 하단 **"Artifacts"** 섹션에서 다운로드
   - `windows-installer`: Windows 인스톨러 (.exe)
   - `macos-installer`: macOS 인스톨러 (.dmg)
3. zip 파일 다운로드 후 압축 해제

---

## 📝 최근 주요 변경사항 (2025-01-XX)

### 프로덕션 빌드 최적화

- ✅ **FFmpeg ASAR 패키징 문제 수정**
  - 프로덕션 빌드에서 FFmpeg가 실행되지 않던 문제 해결
  - `app.asar` → `app.asar.unpacked` 경로 자동 변환 추가
  - 파일: `electron/ipc/ffmpeg.js`, `electron/ipc/audio.js`

- ✅ **음성 파일 합치기 로직 제거**
  - `default.mp3` 대신 개별 씬 오디오 파일 사용 (scene-001.mp3, scene-002.mp3, ...)
  - `audio/mergeFiles` IPC 핸들러 제거
  - 파일: `src/utils/audioSubtitleGenerator.js`

- ✅ **영상 자동 할당 개선**
  - 키워드 매칭 실패 시 랜덤으로 영상 할당
  - "미디어 없음" 버튼 동작 개선
  - 파일: `src/services/videoAssignment.js`

- ✅ **DevTools 설정 개선**
  - 개발 모드에서만 DevTools 자동 오픈
  - 프로덕션 빌드에서는 F12로만 열기
  - 파일: `electron/utils/window.js`

- ✅ **Vite 빌드 설정**
  - Electron 호환을 위한 상대 경로 설정 (`base: './'`)
  - 파일: `vite.config.js`

- ✅ **GitHub Actions 자동 빌드**
  - Windows와 macOS 자동 빌드 설정
  - 파일: `.github/workflows/build.yml`

### 커밋 정보

- **최신 커밋**: `3059865`
- **이전 커밋**: `95ee39e`
- **브랜치**: `test5`

---

## 🔧 개발 시 유용한 명령어

```bash
# 브랜치 최신 상태로 업데이트
git pull origin test5

# 변경사항 확인
git status

# 커밋 히스토리 확인
git log --oneline -10

# 개발 서버 실행 (다른 포트)
npm run dev:5174
npm run dev:5175

# Vite 빌드만 실행
npm run build

# Electron 단독 실행
npm start
```

---

## 🐛 트러블슈팅

### 1. 포트 충돌 에러

**증상**: `Error: listen EADDRINUSE: address already in use :::5173`

**해결**:
```bash
# 다른 포트로 실행
npm run dev:5174
npm run electron:dev:5174
```

### 2. FFmpeg 실행 오류 (프로덕션)

**증상**: `spawn ffmpeg.exe ENOENT`

**해결**: 이미 수정됨 (ASAR unpacked 경로 사용)

### 3. 빌드 후 화면이 안 보임

**증상**: 인스톨 후 실행하면 빈 화면

**해결**: 이미 수정됨 (Vite `base: './'` 설정)

### 4. 음성 파일을 찾을 수 없음

**증상**: "파일을 찾을 수 없습니다" 토스트 메시지

**해결**: 이미 수정됨 (음성 파일 합치기 로직 제거)

---

## 🔑 API 키 설정

앱 실행 후 **설정 > API** 탭에서 다음 키를 입력하세요:

- OpenAI API 키
- Google Cloud API 키
- Anthropic API 키
- Replicate API 토큰

---

## 📂 주요 파일 구조

```
weaver-pro/
├── electron/                    # Electron 메인 프로세스
│   ├── main.js                 # 엔트리 포인트
│   ├── preload.js              # Preload 스크립트
│   ├── ipc/                    # IPC 핸들러
│   │   ├── ffmpeg.js          # 영상 합성
│   │   ├── audio.js           # 오디오 처리
│   │   └── tts.js             # TTS 생성
│   └── utils/
│       └── window.js          # 윈도우 관리
├── src/                        # React 앱
│   ├── components/            # 컴포넌트
│   ├── services/              # 서비스 레이어
│   │   └── videoAssignment.js # 영상 자동 할당
│   └── utils/
│       └── audioSubtitleGenerator.js  # 음성/자막 생성
├── dist/                       # Vite 빌드 결과
├── dist_electron/              # Electron 빌드 결과
├── .github/
│   └── workflows/
│       └── build.yml          # GitHub Actions 설정
├── package.json               # 프로젝트 설정
└── vite.config.js             # Vite 설정
```

---

## 📞 도움이 필요하면

### GitHub 저장소
```
https://github.com/insm007-wq/weaver-pro
```

### Claude Code 사용 시
```bash
# 이 파일을 Claude Code가 읽도록 요청
"BUILD_INFO.md 읽어줘"
"빌드 방법 알려줘"
"개발 환경 설정 어떻게 해?"
```

---

## 📅 마지막 업데이트

- **날짜**: 2025-01-07
- **브랜치**: test5
- **커밋**: 3059865
- **작성자**: Claude Code

---

**이 파일은 회사와 집에서 동일한 개발 환경을 유지하기 위한 참고 문서입니다.**
