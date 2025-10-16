// 난독화 스크립트 (백업 및 복구 기능 포함)
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// 난독화 설정 로드
const config = require('../obfuscator.config.js');

// 난독화할 파일 목록 (핵심 파일만)
const filesToObfuscate = [
  // API 키 설정 (최우선)
  'electron/config.js',

  // 서비스 레이어
  'electron/services/secrets.js',
  'electron/services/store.js',
  'electron/services/projectManager.js',

  // IPC 핸들러 (API 호출)
  'electron/ipc/settings.js',
  'electron/ipc/llm/index.js',
  'electron/ipc/llm/anthropic.js',
  'electron/ipc/llm/replicate.js',
];

// 백업 디렉토리
const backupDir = path.join(__dirname, '..', '.obfuscate-backup');

// 복구 모드인지 확인
const isRestore = process.argv.includes('--restore');

if (isRestore) {
  console.log('🔄 원본 파일 복구 중...\n');

  if (!fs.existsSync(backupDir)) {
    console.log('⚠️  백업 파일이 없습니다.');
    process.exit(0);
  }

  let restoredCount = 0;

  filesToObfuscate.forEach((file) => {
    const filePath = path.join(__dirname, '..', file);
    const backupPath = path.join(backupDir, file);

    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      console.log(`✅ 복구: ${file}`);
      restoredCount++;
    }
  });

  // 백업 디렉토리 삭제
  fs.rmSync(backupDir, { recursive: true, force: true });

  console.log(`\n🎉 ${restoredCount}개 파일 복구 완료!`);
  process.exit(0);
}

// 난독화 모드
console.log('🔒 난독화 시작...\n');

// 백업 디렉토리 생성
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

let successCount = 0;
let failCount = 0;

filesToObfuscate.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);
  const backupPath = path.join(backupDir, file);

  // 파일 존재 확인
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  파일 없음 (건너뜀): ${file}`);
    failCount++;
    return;
  }

  try {
    // 백업 디렉토리 생성
    const backupFileDir = path.dirname(backupPath);
    if (!fs.existsSync(backupFileDir)) {
      fs.mkdirSync(backupFileDir, { recursive: true });
    }

    // 원본 파일 백업
    fs.copyFileSync(filePath, backupPath);

    // 원본 파일 읽기
    const sourceCode = fs.readFileSync(filePath, 'utf8');

    // 난독화 실행
    const obfuscationResult = JavaScriptObfuscator.obfuscate(sourceCode, config);

    // 결과 저장
    fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf8');

    console.log(`✅ ${file}`);
    successCount++;
  } catch (error) {
    console.error(`❌ ${file}`);
    console.error(`   오류: ${error.message}`);
    failCount++;
  }
});

console.log(`\n📊 결과: 성공 ${successCount}개, 실패 ${failCount}개`);

if (successCount > 0) {
  console.log('🎉 난독화 완료!');
  console.log('💡 원본 복구: npm run obfuscate -- --restore');
} else {
  console.error('❌ 난독화 실패');
  process.exit(1);
}
