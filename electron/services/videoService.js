// electron/services/videoService.js
// ============================================================================
// 비디오 파일 관리 서비스
// - downloaded_canva 폴더 스캔
// - 키워드별 영상 리스트 구성
// - 사용자 보관 영상과 합쳐서 후속 작업에 활용
// ============================================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class VideoService {
  constructor() {
    this.downloadedCanvaDir = path.join(app.getPath('userData'), 'projects', 'downloaded_canva');
    this.userVideosDir = path.join(app.getPath('userData'), 'videos'); // 기존 사용자 비디오
    this.videoCache = new Map();
    this.lastScanTime = 0;
  }

  // downloaded_canva 폴더 스캔
  async scanDownloadedCanvaVideos(forceRefresh = false) {
    try {
      const stats = await fs.stat(this.downloadedCanvaDir).catch(() => null);
      if (!stats) {
        console.log('📁 downloaded_canva 폴더가 없습니다.');
        return [];
      }

      const currentTime = stats.mtimeMs;
      if (!forceRefresh && currentTime <= this.lastScanTime) {
        console.log('🔄 캐시된 Canva 비디오 목록 사용');
        return Array.from(this.videoCache.values()).filter(v => v.provider === 'canva');
      }

      console.log('🔍 downloaded_canva 폴더 스캔 중...');
      const files = await fs.readdir(this.downloadedCanvaDir);
      const videoFiles = files.filter(file => 
        file.toLowerCase().endsWith('.mp4') || 
        file.toLowerCase().endsWith('.mov') || 
        file.toLowerCase().endsWith('.avi')
      );

      const videos = [];
      for (const file of videoFiles) {
        const filePath = path.join(this.downloadedCanvaDir, file);
        const videoInfo = await this.analyzeCanvaVideoFile(filePath, file);
        if (videoInfo) {
          videos.push(videoInfo);
          this.videoCache.set(filePath, videoInfo);
        }
      }

      this.lastScanTime = currentTime;
      console.log(`✅ Canva 비디오 ${videos.length}개 스캔 완료`);
      return videos;

    } catch (error) {
      console.error('❌ Canva 비디오 스캔 실패:', error.message);
      return [];
    }
  }

  // Canva 비디오 파일 분석
  async analyzeCanvaVideoFile(filePath, fileName) {
    try {
      const stats = await fs.stat(filePath);
      
      // 파일명에서 키워드 추출 (canva_keyword_seq_title_timestamp.mp4 형식)
      const keyword = this.extractKeywordFromFilename(fileName);
      const title = this.extractTitleFromFilename(fileName);
      
      return {
        id: path.basename(fileName, path.extname(fileName)),
        path: filePath,
        fileName: fileName,
        title: title,
        keyword: keyword,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        provider: 'canva',
        format: path.extname(fileName).substring(1).toLowerCase(),
        // 메타데이터 (필요시 ffprobe로 확장 가능)
        duration: null, // TODO: ffprobe로 실제 길이 확인
        resolution: null, // TODO: ffprobe로 실제 해상도 확인
        thumbnailPath: null // TODO: 썸네일 생성
      };
    } catch (error) {
      console.warn(`⚠️ 파일 분석 실패: ${fileName} - ${error.message}`);
      return null;
    }
  }

  // 파일명에서 키워드 추출
  extractKeywordFromFilename(fileName) {
    // canva_keyword_seq_title_timestamp.mp4 형식에서 keyword 부분 추출
    const parts = fileName.split('_');
    if (parts.length >= 3 && parts[0] === 'canva') {
      return parts[1];
    }
    
    // 다른 패턴들 시도
    if (fileName.includes('canva')) {
      // keyword_seq_{w}x{h}.mp4 패턴
      const match = fileName.match(/canva[_-]([^_]+)/i);
      if (match) return match[1];
    }
    
    return 'unknown';
  }

  // 파일명에서 제목 추출
  extractTitleFromFilename(fileName) {
    const parts = fileName.split('_');
    if (parts.length >= 4 && parts[0] === 'canva') {
      // canva_keyword_seq_title_timestamp.mp4에서 title 부분
      const titleParts = parts.slice(3, -1); // timestamp 제외
      return titleParts.join('_') || parts[1]; // title이 없으면 keyword 사용
    }
    
    return path.basename(fileName, path.extname(fileName));
  }

  // 키워드별 비디오 목록 가져오기
  async getVideosByKeyword(keyword) {
    const allVideos = await this.scanDownloadedCanvaVideos();
    
    if (!keyword) return allVideos;
    
    return allVideos.filter(video => 
      video.keyword && video.keyword.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 키워드 목록 가져오기
  async getAvailableKeywords() {
    const allVideos = await this.scanDownloadedCanvaVideos();
    const keywords = new Set();
    
    allVideos.forEach(video => {
      if (video.keyword && video.keyword !== 'unknown') {
        keywords.add(video.keyword);
      }
    });
    
    return Array.from(keywords).sort();
  }

  // 사용자 비디오와 Canva 비디오 통합 목록
  async getAllVideos() {
    const canvaVideos = await this.scanDownloadedCanvaVideos();
    const userVideos = await this.scanUserVideos();
    
    return [...canvaVideos, ...userVideos];
  }

  // 사용자 비디오 폴더 스캔 (기존 비디오)
  async scanUserVideos() {
    try {
      const stats = await fs.stat(this.userVideosDir).catch(() => null);
      if (!stats) {
        console.log('📁 사용자 비디오 폴더가 없습니다.');
        return [];
      }

      const files = await fs.readdir(this.userVideosDir);
      const videoFiles = files.filter(file => 
        file.toLowerCase().endsWith('.mp4') || 
        file.toLowerCase().endsWith('.mov') || 
        file.toLowerCase().endsWith('.avi')
      );

      const videos = [];
      for (const file of videoFiles) {
        const filePath = path.join(this.userVideosDir, file);
        const stats = await fs.stat(filePath);
        
        videos.push({
          id: path.basename(file, path.extname(file)),
          path: filePath,
          fileName: file,
          title: path.basename(file, path.extname(file)),
          keyword: null,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          provider: 'user',
          format: path.extname(file).substring(1).toLowerCase()
        });
      }

      console.log(`✅ 사용자 비디오 ${videos.length}개 스캔 완료`);
      return videos;

    } catch (error) {
      console.error('❌ 사용자 비디오 스캔 실패:', error.message);
      return [];
    }
  }

  // 비디오 검색 (제목, 키워드, 파일명 기준)
  async searchVideos(query) {
    const allVideos = await this.getAllVideos();
    
    if (!query) return allVideos;
    
    const searchTerm = query.toLowerCase();
    return allVideos.filter(video => 
      video.title.toLowerCase().includes(searchTerm) ||
      (video.keyword && video.keyword.toLowerCase().includes(searchTerm)) ||
      video.fileName.toLowerCase().includes(searchTerm)
    );
  }

  // 비디오 통계 정보
  async getVideoStats() {
    const allVideos = await this.getAllVideos();
    const canvaVideos = allVideos.filter(v => v.provider === 'canva');
    const userVideos = allVideos.filter(v => v.provider === 'user');
    
    const totalSize = allVideos.reduce((sum, video) => sum + (video.size || 0), 0);
    const keywords = new Set();
    canvaVideos.forEach(v => v.keyword && keywords.add(v.keyword));
    
    return {
      total: allVideos.length,
      canva: canvaVideos.length,
      user: userVideos.length,
      totalSize: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024)),
      uniqueKeywords: keywords.size,
      keywords: Array.from(keywords).sort(),
      lastScanTime: new Date(this.lastScanTime).toISOString()
    };
  }

  // 비디오 파일 삭제
  async deleteVideo(videoPath) {
    try {
      await fs.unlink(videoPath);
      
      // 캐시에서도 제거
      this.videoCache.delete(videoPath);
      
      console.log(`🗑️ 비디오 삭제 완료: ${path.basename(videoPath)}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ 비디오 삭제 실패: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  // 비디오 파일 이동
  async moveVideo(sourcePath, targetDir, newFileName = null) {
    try {
      await fs.mkdir(targetDir, { recursive: true });
      
      const fileName = newFileName || path.basename(sourcePath);
      const targetPath = path.join(targetDir, fileName);
      
      await fs.rename(sourcePath, targetPath);
      
      // 캐시 업데이트
      const videoInfo = this.videoCache.get(sourcePath);
      if (videoInfo) {
        this.videoCache.delete(sourcePath);
        videoInfo.path = targetPath;
        videoInfo.fileName = fileName;
        this.videoCache.set(targetPath, videoInfo);
      }
      
      console.log(`📁 비디오 이동 완료: ${path.basename(sourcePath)} -> ${targetDir}`);
      return { success: true, newPath: targetPath };
    } catch (error) {
      console.error(`❌ 비디오 이동 실패: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  // 캐시 초기화
  clearCache() {
    this.videoCache.clear();
    this.lastScanTime = 0;
    console.log('🧹 비디오 캐시 초기화 완료');
  }

  // 폴더 정리 (빈 폴더 삭제)
  async cleanupEmptyDirs() {
    try {
      const dirs = [this.downloadedCanvaDir, this.userVideosDir];
      
      for (const dir of dirs) {
        try {
          const files = await fs.readdir(dir);
          if (files.length === 0) {
            await fs.rmdir(dir);
            console.log(`🗂️ 빈 폴더 삭제: ${dir}`);
          }
        } catch (error) {
          // 폴더가 없거나 접근 권한 없음 - 무시
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error(`❌ 폴더 정리 실패: ${error.message}`);
      return { success: false, message: error.message };
    }
  }
}

// 전역 인스턴스
let videoService = null;

// VideoService 인스턴스 반환
function getVideoService() {
  if (!videoService) {
    videoService = new VideoService();
  }
  return videoService;
}

module.exports = { 
  VideoService, 
  getVideoService 
};