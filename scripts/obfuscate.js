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

// 파일이 난독화되어 있는지 확인
function isObfuscated(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  // 난독화된 파일은 특정 패턴을 가짐 (예: _0x, function _0x 등)
  return content.includes('_0x') && content.includes('function _0x');
}

// 체크 모드인지 확인 (개발 시작 전에 난독화 여부 확인)
const isCheck = process.argv.includes('--check');

// 복구 모드인지 확인
const isRestore = process.argv.includes('--restore');

if (isCheck) {
  console.log('🔍 난독화 상태 확인 중...\n');

  let obfuscatedFiles = [];

  filesToObfuscate.forEach((file) => {
    const filePath = path.join(__dirname, '..', file);
    if (isObfuscated(filePath)) {
      obfuscatedFiles.push(file);
    }
  });

  if (obfuscatedFiles.length > 0) {
    console.error('⚠️ 다음 파일들이 난독화되어 있습니다:\n');
    obfuscatedFiles.forEach((file) => {
      console.error(`  - ${file}`);
    });
    console.error('\n개발을 시작하려면 먼저 복구해야 합니다:');
    console.error('  npm run obfuscate:restore\n');
    console.error('또는 git에서 복구:');
    console.error('  git restore electron/\n');
    process.exit(1);
  } else {
    console.log('✅ 모든 파일이 정상 상태입니다.\n');
    process.exit(0);
  }
}

if (isRestore) {
  console.log('🔄 원본 파일 복구 중...\n');

  if (!fs.existsSync(backupDir)) {
    console.log('⚠️  백업 파일이 없습니다.');
    console.log('💡 Git에서 복구를 시도합니다...\n');

    // git에서 복구 시도
    const { execSync } = require('child_process');
    const filesToRestore = filesToObfuscate.filter((file) => file !== 'electron/config.js'); // config.js는 git에서 무시됨

    if (filesToRestore.length > 0) {
      try {
        execSync(`git restore ${filesToRestore.join(' ')}`, { stdio: 'inherit' });
        console.log('\n✅ Git에서 파일 복구 완료!');

        // config.js는 별도 처리 안내
        if (filesToObfuscate.includes('electron/config.js')) {
          const configPath = path.join(__dirname, '..', 'electron/config.js');
          if (isObfuscated(configPath)) {
            console.log('\n⚠️  electron/config.js는 .gitignore에 있어 자동 복구할 수 없습니다.');
            console.log('💡 electron/config.example.js를 참고하여 수동으로 복구하세요.');
          }
        }
      } catch (error) {
        console.error('❌ Git 복구 실패:', error.message);
        process.exit(1);
      }
    }
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
