// electron/ipc/videoService.js
// ============================================================================
// 비디오 서비스 IPC 핸들러
// - downloaded_canva 폴더와 사용자 비디오 통합 관리
// - 키워드별 검색, 통계, 파일 관리 기능
// ============================================================================

const { ipcMain } = require('electron');
const { getVideoService } = require('../services/videoService');

function register() {
  // 모든 비디오 목록 가져오기
  ipcMain.handle('video:getAll', async () => {
    try {
      const videoService = getVideoService();
      const videos = await videoService.getAllVideos();
      return { success: true, videos };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Canva 다운로드 비디오만 가져오기
  ipcMain.handle('video:getCanvaVideos', async () => {
    try {
      const videoService = getVideoService();
      const videos = await videoService.scanDownloadedCanvaVideos();
      return { success: true, videos };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 키워드별 비디오 검색
  ipcMain.handle('video:getByKeyword', async (event, keyword) => {
    try {
      const videoService = getVideoService();
      const videos = await videoService.getVideosByKeyword(keyword);
      return { success: true, videos };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 사용 가능한 키워드 목록
  ipcMain.handle('video:getKeywords', async () => {
    try {
      const videoService = getVideoService();
      const keywords = await videoService.getAvailableKeywords();
      return { success: true, keywords };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 비디오 검색 (제목, 키워드, 파일명)
  ipcMain.handle('video:search', async (event, query) => {
    try {
      const videoService = getVideoService();
      const videos = await videoService.searchVideos(query);
      return { success: true, videos };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 비디오 통계 정보
  ipcMain.handle('video:getStats', async () => {
    try {
      const videoService = getVideoService();
      const stats = await videoService.getVideoStats();
      return { success: true, stats };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 비디오 파일 삭제
  ipcMain.handle('video:delete', async (event, videoPath) => {
    try {
      const videoService = getVideoService();
      const result = await videoService.deleteVideo(videoPath);
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 비디오 파일 이동
  ipcMain.handle('video:move', async (event, { sourcePath, targetDir, newFileName }) => {
    try {
      const videoService = getVideoService();
      const result = await videoService.moveVideo(sourcePath, targetDir, newFileName);
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // Canva 비디오 폴더 강제 새로고침
  ipcMain.handle('video:refreshCanva', async () => {
    try {
      const videoService = getVideoService();
      const videos = await videoService.scanDownloadedCanvaVideos(true); // 강제 새로고침
      return { success: true, videos };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 비디오 캐시 초기화
  ipcMain.handle('video:clearCache', async () => {
    try {
      const videoService = getVideoService();
      videoService.clearCache();
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 빈 폴더 정리
  ipcMain.handle('video:cleanupDirs', async () => {
    try {
      const videoService = getVideoService();
      const result = await videoService.cleanupEmptyDirs();
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 다운로드 폴더 경로 정보
  ipcMain.handle('video:getPaths', async () => {
    try {
      const videoService = getVideoService();
      return {
        success: true,
        paths: {
          downloadedCanva: videoService.downloadedCanvaDir,
          userVideos: videoService.userVideosDir
        }
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  console.log('[ipc] video-service: registered');
}

module.exports = { register };