// electron/utils/pathHelper.js
// ============================================================================
// 크로스 플랫폼 경로 유틸리티
// - Windows, Mac, Linux에서 올바른 경로 생성
// - OS별 기본 디렉토리 제공
// ============================================================================

const { app } = require('electron');
const path = require('path');
const os = require('os');

/**
 * OS별 기본 WeaverPro 디렉토리 경로 반환
 * @returns {string} OS에 맞는 기본 경로
 */
function getDefaultWeaverProPath() {
  const platform = process.platform;
  const homeDir = os.homedir();

  switch (platform) {
    case 'win32':
      // Windows: C:\Users\[username]\Documents\WeaverPro
      return path.join(homeDir, 'Documents', 'WeaverPro');

    case 'darwin':
      // Mac: /Users/[username]/Documents/WeaverPro
      return path.join(homeDir, 'Documents', 'WeaverPro');

    case 'linux':
      // Linux: /home/[username]/WeaverPro
      return path.join(homeDir, 'WeaverPro');

    default:
      // 기타 OS: 홈 디렉토리/WeaverPro
      return path.join(homeDir, 'WeaverPro');
  }
}

/**
 * OS별 기본 프로젝트 루트 폴더 (레거시 호환)
 * @returns {string} OS에 맞는 기본 경로
 */
function getDefaultProjectRoot() {
  return getDefaultWeaverProPath();
}

/**
 * 경로를 OS에 맞게 정규화
 * @param {string} inputPath - 입력 경로
 * @returns {string} 정규화된 경로
 */
function normalizePath(inputPath) {
  if (!inputPath) return '';

  // path.normalize를 사용하여 OS에 맞는 경로 구분자로 변환
  return path.normalize(inputPath);
}

/**
 * 여러 경로 세그먼트를 OS에 맞게 결합
 * @param {...string} segments - 경로 세그먼트들
 * @returns {string} 결합된 경로
 */
function joinPaths(...segments) {
  return path.join(...segments);
}

/**
 * 경로가 절대 경로인지 확인
 * @param {string} inputPath - 확인할 경로
 * @returns {boolean} 절대 경로 여부
 */
function isAbsolutePath(inputPath) {
  if (!inputPath) return false;
  return path.isAbsolute(inputPath);
}

module.exports = {
  getDefaultWeaverProPath,
  getDefaultProjectRoot,
  normalizePath,
  joinPaths,
  isAbsolutePath,
};
