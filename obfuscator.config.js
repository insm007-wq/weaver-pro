// 난독화 설정 (속도와 보안의 균형)
module.exports = {
  // 기본 설정
  compact: true, // 공백 제거 (속도 영향 없음)
  simplify: true, // 코드 단순화 (약간 빠름)

  // 식별자 난독화
  identifierNamesGenerator: 'hexadecimal', // 빠른 방식
  renameGlobals: false, // 전역 변수 이름 유지 (라이브러리 호환성)
  renameProperties: false, // 속성 이름 유지 (안정성)

  // 문자열 암호화 (중요!)
  stringArray: true, // 문자열을 배열로 이동
  rotateStringArray: true, // 배열 위치 섞기
  shuffleStringArray: true, // 배열 순서 섞기
  stringArrayThreshold: 0.75, // 75%의 문자열만 암호화 (균형)
  stringArrayIndexShift: true, // 인덱스 변환
  stringArrayWrappersCount: 2, // 래퍼 함수 2개
  stringArrayWrappersChainedCalls: true, // 체인 호출

  // 컨트롤 플로우 (성능 영향 최소화)
  controlFlowFlattening: false, // ❌ 매우 느려짐 (사용 안 함)
  deadCodeInjection: false, // ❌ 파일 크기 증가 (사용 안 함)

  // 변환 옵션
  transformObjectKeys: true, // 객체 키 변환
  splitStrings: true, // 문자열 분할
  splitStringsChunkLength: 10, // 10글자씩 분할

  // 디버그 보호 (선택적)
  debugProtection: false, // ❌ 개발 중 불편 (프로덕션만 true)
  debugProtectionInterval: 0,
  disableConsoleOutput: false, // ❌ console 유지 (디버깅용)

  // 도메인 락 (필요시)
  domainLock: [], // 특정 도메인에서만 실행 (빈 배열 = 제한 없음)

  // Self-Defending (선택적)
  selfDefending: false, // ❌ 성능 영향 있음 (필요시만 true)

  // 소스맵 제거
  sourceMap: false,
  sourceMapMode: 'separate',

  // 기타
  unicodeEscapeSequence: false, // 한글 유지 (가독성)
};
