// electron/services/projectManager.js
// ============================================================================
// 프로젝트 관리 서비스
// - 프로젝트별 고유 ID 생성
// - 출력 폴더 관리
// - 파일 경로 체계화
// ============================================================================

const { app } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const store = require('./store');

class ProjectManager {
  constructor() {
    this.currentProject = null;
  }

  // 기본 디렉토리 가져오기 (전역 설정 + 오늘날짜) - 단순화된 구조
  getBaseDir() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
    
    try {
      // 먼저 새로운 프로젝트 전용 설정 확인
      const projectRootFolder = store.get('projectRootFolder');
      console.log('📁 ProjectManager - 저장된 projectRootFolder:', projectRootFolder);
      if (projectRootFolder && typeof projectRootFolder === 'string' && projectRootFolder.trim()) {
        console.log('📁 ProjectManager - 사용할 폴더:', path.join(projectRootFolder.trim(), today));
        return path.join(projectRootFolder.trim(), today);
      }
      
      // 백워드 호환성: 기존 videoSaveFolder 설정 확인
      const userSetting = store.get('videoSaveFolder');
      console.log('📁 ProjectManager - 저장된 videoSaveFolder:', userSetting);
      if (userSetting && typeof userSetting === 'string' && userSetting.trim()) {
        return path.join(userSetting.trim(), today);
      }
    } catch (error) {
      console.warn('설정값 읽기 실패, 기본값 사용:', error.message);
    }
    
    // 폴백: 기본 프로젝트 폴더 (단순화된 구조)
    return path.join('C:\\WeaverPro', today);
  }

  // 새 프로젝트 생성
  async createProject(topic, options = {}) {
    try {
      const projectId = this.generateProjectId(topic);
      const baseDir = this.getBaseDir();
      const projectDir = path.join(baseDir, projectId);
      
      // 프로젝트 폴더 구조 생성
      await this.createProjectStructure(projectDir);
      
      const projectData = {
        id: projectId,
        topic: topic,
        createdAt: new Date().toISOString(),
        paths: {
          root: projectDir,
          output: path.join(projectDir, 'output'),
          scripts: path.join(projectDir, 'scripts'),
          audio: path.join(projectDir, 'audio'),
          images: path.join(projectDir, 'images'),
          temp: path.join(projectDir, 'temp')
        },
        options: options
      };

      // 프로젝트 메타데이터 저장
      const metaPath = path.join(projectDir, 'project.json');
      await fs.writeFile(metaPath, JSON.stringify(projectData, null, 2));
      
      this.currentProject = projectData;
      console.log(`📁 새 프로젝트 생성: ${projectId}`);
      console.log(`✅ currentProject 설정 완료:`, this.currentProject?.id);
      
      return projectData;
    } catch (error) {
      console.error('❌ 프로젝트 생성 실패:', error);
      throw error;
    }
  }

  // 프로젝트 ID 생성 (주제 기반 + 전역 설정)
  generateProjectId(topic) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 전역 설정에서 기본 프로젝트 이름 가져오기
    let defaultName = 'WeaverPro-Project';
    try {
      const globalDefaultName = store.get('defaultProjectName');
      console.log('📝 ProjectManager - 저장된 defaultProjectName:', globalDefaultName);
      if (globalDefaultName && typeof globalDefaultName === 'string' && globalDefaultName.trim()) {
        defaultName = globalDefaultName.trim();
        console.log('📝 ProjectManager - 사용할 기본 이름:', defaultName);
      }
    } catch (error) {
      console.warn('기본 프로젝트 이름 설정 읽기 실패:', error.message);
    }
    
    const sanitizedTopic = topic
      ? topic.replace(/[^가-힣a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 20)
      : defaultName;
    
    return `${sanitizedTopic}-${timestamp}`.toLowerCase();
  }

  // 프로젝트 폴더 구조 생성
  async createProjectStructure(projectDir) {
    const folders = [
      'output',      // 최종 영상 파일
      'scripts',     // 대본 파일 (JSON, SRT 등)
      'audio',       // 음성 파일들
      'images',      // 생성된 이미지들
      'temp'         // 임시 파일들
    ];

    for (const folder of folders) {
      const folderPath = path.join(projectDir, folder);
      await fs.mkdir(folderPath, { recursive: true });
    }
  }

  // 현재 프로젝트 설정
  setCurrentProject(projectData) {
    this.currentProject = projectData;
  }

  // 현재 프로젝트 가져오기
  getCurrentProject() {
    return this.currentProject;
  }

  // 프로젝트 로드
  async loadProject(projectId) {
    try {
      const baseDir = this.getBaseDir();
      const projectDir = path.join(baseDir, projectId);
      const metaPath = path.join(projectDir, 'project.json');
      
      const data = await fs.readFile(metaPath, 'utf-8');
      const projectData = JSON.parse(data);
      
      this.currentProject = projectData;
      return projectData;
    } catch (error) {
      console.error(`❌ 프로젝트 로드 실패: ${projectId}`, error);
      return null;
    }
  }

  // 프로젝트 목록 가져오기
  async listProjects() {
    try {
      const baseDir = this.getBaseDir();
      await fs.mkdir(baseDir, { recursive: true });
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      
      const projects = [];
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const project = await this.loadProject(entry.name);
          if (project) {
            projects.push({
              id: project.id,
              topic: project.topic,
              createdAt: project.createdAt
            });
          }
        }
      }
      
      return projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('❌ 프로젝트 목록 조회 실패:', error);
      return [];
    }
  }

  // 파일 경로 생성 헬퍼
  getFilePath(category, filename) {
    if (!this.currentProject) {
      throw new Error('현재 활성 프로젝트가 없습니다.');
    }
    
    const basePath = this.currentProject.paths[category];
    if (!basePath) {
      throw new Error(`알 수 없는 카테고리: ${category}`);
    }
    
    return path.join(basePath, filename);
  }

  // 프로젝트 삭제
  async deleteProject(projectId) {
    try {
      const baseDir = this.getBaseDir();
      const projectDir = path.join(baseDir, projectId);
      await fs.rm(projectDir, { recursive: true, force: true });
      
      if (this.currentProject?.id === projectId) {
        this.currentProject = null;
      }
      
      console.log(`🗑️ 프로젝트 삭제: ${projectId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ 프로젝트 삭제 실패: ${projectId}`, error);
      return { success: false, error: error.message };
    }
  }

  // 프로젝트 정보 업데이트
  async updateProject(updates) {
    if (!this.currentProject) {
      throw new Error('현재 활성 프로젝트가 없습니다.');
    }
    
    this.currentProject = { ...this.currentProject, ...updates };
    
    const metaPath = path.join(this.currentProject.paths.root, 'project.json');
    await fs.writeFile(metaPath, JSON.stringify(this.currentProject, null, 2));
    
    return this.currentProject;
  }
}

// 전역 인스턴스
let projectManager = null;

// ProjectManager 인스턴스 반환
function getProjectManager() {
  if (!projectManager) {
    projectManager = new ProjectManager();
  }
  return projectManager;
}

module.exports = { 
  ProjectManager, 
  getProjectManager 
};