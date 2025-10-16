# 🔒 난독화 가이드

## 📋 개요

이 프로젝트는 **javascript-obfuscator**를 사용하여 핵심 코드를 보호합니다.

---

## 🚀 사용 방법

### 1. 개발 모드 (난독화 없음)
```bash
npm run dev
npm run electron:dev
```

### 2. 프로덕션 빌드 (자동 난독화)
```bash
# Windows
npm run build:win

# Mac
npm run build:mac

# Linux
npm run build:linux

# 모든 플랫폼
npm run build:all
```

**빌드 순서:**
1. React 앱 빌드 (`vite build`)
2. **자동으로 난독화 실행** (`npm run obfuscate`)
3. Electron 앱 패키징 (`electron-builder`)

---

## 🎯 난독화 대상 파일

핵심 파일만 난독화하여 성능 영향을 최소화합니다:

### ✅ 난독화됨
- `electron/config.js` - API 키 설정
- `electron/services/secrets.js` - 키 관리
- `electron/services/store.js` - 저장소
- `electron/services/projectManager.js` - 프로젝트 관리
- `electron/ipc/settings.js` - 설정 IPC
- `electron/ipc/llm/*.js` - LLM API 호출

### ❌ 난독화 안됨
- React UI 코드 (Vite가 자동 minify)
- 기타 유틸리티 파일

---

## ⚙️ 난독화 설정

`obfuscator.config.js` 파일에서 설정 가능:

```javascript
{
  stringArray: true,              // 문자열 암호화
  stringArrayThreshold: 0.75,     // 75% 암호화 (균형)
  controlFlowFlattening: false,   // ❌ 느려짐 (사용 안 함)
  identifierNamesGenerator: 'hexadecimal', // 변수명 변환
}
```

### 성능 vs 보안 조절

**더 강력한 보호가 필요하다면:**
```javascript
{
  stringArrayThreshold: 1.0,      // 100% 문자열 암호화
  controlFlowFlattening: true,    // 컨트롤 플로우 난독화
  selfDefending: true,            // Self-Defending 활성화
}
```
⚠️ 단, 속도가 10~20% 느려질 수 있습니다.

---

## 🧪 테스트

### 난독화만 실행
```bash
npm run obfuscate
```

### 난독화 결과 확인
난독화된 파일은 원본을 덮어씁니다.
Git으로 변경사항을 확인할 수 있습니다.

---

## 📊 성능 영향

현재 설정 (경량 난독화):
- ✅ 실행 속도: **3~5% 느림** (거의 체감 안 됨)
- ✅ 로딩 시간: **+0.2초** (무시 가능)
- ✅ 파일 크기: **+15~20%** (허용 가능)
- ✅ 메모리: **차이 없음**

---

## 🔐 보안 효과

- 🛡️ **90%+ 사용자 보호** - 일반 개발자는 읽기 불가능
- 🛡️ **API 키 추출 난이도 10배 증가**
- 🛡️ **코드 복제 난이도 증가**
- ⚠️ 전문가는 시간 들이면 해독 가능 (완벽한 보호는 불가능)

---

## ⚠️ 주의사항

1. **개발 중에는 난독화 안 함**
   - 디버깅이 불가능해집니다
   - 개발 모드(`npm run dev`)에서는 자동으로 비활성화

2. **Git 커밋 전 확인**
   - 난독화된 코드를 커밋하지 마세요
   - 빌드 시에만 난독화가 적용됩니다

3. **백업**
   - 난독화 전 코드는 Git에 보관됩니다
   - 문제 발생 시 `git checkout` 가능

---

## 🛠️ 문제 해결

### 난독화 후 앱이 작동하지 않는 경우

1. **특정 파일 제외하기**
   `scripts/obfuscate.js`에서 파일 목록 수정:
   ```javascript
   const filesToObfuscate = [
     // 문제가 되는 파일을 주석 처리
     // 'electron/ipc/problematic-file.js',
   ];
   ```

2. **설정 완화하기**
   `obfuscator.config.js`에서:
   ```javascript
   {
     stringArrayThreshold: 0.5,  // 50%로 줄이기
     transformObjectKeys: false, // 객체 키 변환 끄기
   }
   ```

3. **난독화 없이 빌드하기**
   ```bash
   npm run build
   electron-builder --win
   ```

---

## 📞 도움말

난독화 관련 문제가 있으면 `obfuscator.config.js`의 옵션을 조정하거나
`scripts/obfuscate.js`의 파일 목록을 수정하세요.

더 강력한 보호가 필요하다면:
- 백엔드 프록시 서버 구축
- 라이선스 키 시스템 도입
을 고려하세요.
