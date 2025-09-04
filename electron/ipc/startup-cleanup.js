// electron/ipc/startup-cleanup.js
// 앱 시작 시 임시 파일들 초기화

const { ipcMain } = require("electron");
const fs = require("fs").promises;
const path = require("path");

/**
 * 앱 시작 시 SRT, MP3 파일 경로 초기화
 * 설정에서 파일 경로를 제거하고 임시 파일들도 정리
 */
async function initializeOnStartup() {
  try {
    console.log('[startup-cleanup] Initializing file paths...');
    
    // 설정에서 파일 경로들 초기화
    const Store = require('electron-store');
    const store = new Store();
    
    // 현재 설정값 확인
    const currentSrt = store.get('paths.srt');
    const currentMp3 = store.get('paths.mp3');
    console.log('[startup-cleanup] Current paths:', { srt: currentSrt, mp3: currentMp3 });
    
    // SRT, MP3 경로 초기화
    store.delete('paths.srt');
    store.delete('paths.mp3');
    
    // 삭제 확인
    const afterSrt = store.get('paths.srt');
    const afterMp3 = store.get('paths.mp3');
    console.log('[startup-cleanup] After deletion:', { srt: afterSrt, mp3: afterMp3 });
    
    // 프로젝트 폴더의 임시 파일들 정리
    const projectPaths = [
      store.get('projectPath.audio'),
      store.get('projectPath.subtitle'),
      store.get('projectPath.audio/parts')
    ].filter(Boolean);
    
    for (const projectPath of projectPaths) {
      try {
        const exists = await fs.access(projectPath).then(() => true).catch(() => false);
        if (exists) {
          const files = await fs.readdir(projectPath);
          for (const file of files) {
            if (file.endsWith('.mp3') || file.endsWith('.srt')) {
              const filePath = path.join(projectPath, file);
              await fs.unlink(filePath);
              console.log(`[startup-cleanup] Removed: ${filePath}`);
            }
          }
        }
      } catch (err) {
        console.warn(`[startup-cleanup] Failed to clean ${projectPath}:`, err.message);
      }
    }
    
    console.log('[startup-cleanup] Cleanup completed');
    return true;
  } catch (error) {
    console.error('[startup-cleanup] Error:', error);
    return false;
  }
}

/**
 * 수동 초기화 (사용자가 버튼 클릭 시)
 */
async function clearVideoSetup() {
  try {
    console.log('[startup-cleanup] Manual clear requested...');
    
    const Store = require('electron-store');
    const store = new Store();
    
    // 현재 설정값 확인
    const currentSrt = store.get('paths.srt');
    const currentMp3 = store.get('paths.mp3');
    console.log('[startup-cleanup] Manual clear - current paths:', { srt: currentSrt, mp3: currentMp3 });
    
    // 설정 초기화
    store.delete('paths.srt');
    store.delete('paths.mp3');
    store.delete('autoMatch.enabled');
    store.delete('autoMatch.options');
    
    // 삭제 확인
    const afterSrt = store.get('paths.srt');
    const afterMp3 = store.get('paths.mp3');
    console.log('[startup-cleanup] Manual clear - after deletion:', { srt: afterSrt, mp3: afterMp3 });
    
    console.log('[startup-cleanup] Video setup cleared');
    return { success: true };
  } catch (error) {
    console.error('[startup-cleanup] Clear error:', error);
    return { success: false, error: error.message };
  }
}

// IPC 핸들러 등록
function register() {
  // 앱 시작 시 자동 초기화
  ipcMain.handle('startup/initialize', async () => {
    return await initializeOnStartup();
  });
  
  // 수동 초기화
  ipcMain.handle('setup/clear', async () => {
    return await clearVideoSetup();
  });
  
  // 파일 존재 확인 (SetupTab에서 사용)
  ipcMain.handle('file/exists', async (event, filePath) => {
    if (!filePath) return false;
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });
}

// 앱 준비 완료 시 자동 실행
function initOnReady() {
  // 즉시 초기화 실행 (딜레이 제거)
  console.log('[startup-cleanup] initOnReady called, running immediately...');
  initializeOnStartup().then(() => {
    console.log('[startup-cleanup] Startup initialization completed');
  }).catch(error => {
    console.error('[startup-cleanup] Startup initialization failed:', error);
  });
}

module.exports = { register, initOnReady };