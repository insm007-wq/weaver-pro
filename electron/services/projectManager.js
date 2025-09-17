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

  // 기본 디렉토리 가져오기 (전역 설정 + 날짜) - 단순화된 구조
  getBaseDir(dateString = null) {
    const targetDate = dateString || new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식

    try {
      // 먼저 새로운 프로젝트 전용 설정 확인
      const projectRootFolder = store.get('projectRootFolder');
      console.log('📁 ProjectManager - 저장된 projectRootFolder:', projectRootFolder);
      if (projectRootFolder && typeof projectRootFolder === 'string' && projectRootFolder.trim()) {
        console.log('📁 ProjectManager - 사용할 폴더:', path.join(projectRootFolder.trim(), targetDate));
        return path.join(projectRootFolder.trim(), targetDate);
      }

      // 백워드 호환성: 기존 videoSaveFolder 설정 확인
      const userSetting = store.get('videoSaveFolder');
      console.log('📁 ProjectManager - 저장된 videoSaveFolder:', userSetting);
      if (userSetting && typeof userSetting === 'string' && userSetting.trim()) {
        return path.join(userSetting.trim(), targetDate);
      }
    } catch (error) {
      console.warn('설정값 읽기 실패, 기본값 사용:', error.message);
    }

    // 폴백: 기본 프로젝트 폴더 (단순화된 구조)
    return path.join('C:\\WeaverPro', targetDate);
  }

  // 프로젝트 루트 폴더 가져오기 (날짜 폴더 제외)
  getProjectRootFolder() {
    try {
      // 프로젝트 전용 설정 확인
      const projectRootFolder = store.get('projectRootFolder');
      if (projectRootFolder && typeof projectRootFolder === 'string' && projectRootFolder.trim()) {
        return projectRootFolder.trim();
      }

      // 백워드 호환성: 기존 videoSaveFolder 설정 확인
      const userSetting = store.get('videoSaveFolder');
      if (userSetting && typeof userSetting === 'string' && userSetting.trim()) {
        return userSetting.trim();
      }
    } catch (error) {
      console.warn('설정값 읽기 실패, 기본값 사용:', error.message);
    }

    return 'C:\\WeaverPro';
  }

  // 새 프로젝트 생성
  async createProject(topic, options = {}) {
    try {
      const projectId = this.generateProjectId(topic);
      const createdDate = new Date().toISOString().split('T')[0]; // 생성 날짜 저장
      const baseDir = this.getBaseDir(createdDate);
      const projectDir = path.join(baseDir, projectId);

      // 프로젝트 폴더 구조 생성
      await this.createProjectStructure(projectDir);

      const projectData = {
        id: projectId,
        topic: topic,
        createdAt: new Date().toISOString(),
        createdDate: createdDate, // 생성 날짜 추가
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

      // 프로젝트 메타데이터 저장 (덮어쓰기)
      const metaPath = path.join(projectDir, 'project.json');
      await fs.writeFile(metaPath, JSON.stringify(projectData, null, 2));
      console.log(`📄 project.json 저장 완료: ${metaPath}`);

      this.currentProject = projectData;
      console.log(`📁 새 프로젝트 생성: ${projectId} (${createdDate})`);
      console.log(`✅ currentProject 설정 완료:`, this.currentProject?.id);
      console.log(`📂 프로젝트 경로:`, projectData.paths.root);

      return projectData;
    } catch (error) {
      console.error('❌ 프로젝트 생성 실패:', error);
      throw error;
    }
  }

  // 프로젝트 ID 생성 (사용자 입력 이름 그대로 사용)
  generateProjectId(topic) {
    // 사용자가 입력한 주제를 그대로 사용 (특수문자만 제거)
    const sanitizedTopic = topic
      ? topic.replace(/[\\/:*?"<>|]/g, '').trim() // 파일/폴더명에 사용할 수 없는 문자만 제거
      : 'WeaverPro-Project';

    return sanitizedTopic;
  }

  // 프로젝트 폴더 구조 생성 (덮어쓰기 지원)
  async createProjectStructure(projectDir) {
    const folders = [
      'output',      // 최종 영상 파일
      'scripts',     // 대본 파일 (JSON, SRT 등)
      'audio',       // 음성 파일들
      'images',      // 생성된 이미지들
      'temp'         // 임시 파일들
    ];

    // 프로젝트 루트 폴더 생성
    await fs.mkdir(projectDir, { recursive: true });

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
      // 먼저 모든 날짜 폴더에서 프로젝트 찾기
      const project = await this.findProjectById(projectId);
      if (project) {
        this.currentProject = project;
        return project;
      }

      console.error(`❌ 프로젝트를 찾을 수 없음: ${projectId}`);
      return null;
    } catch (error) {
      console.error(`❌ 프로젝트 로드 실패: ${projectId}`, error);
      return null;
    }
  }

  // 프로젝트 목록 가져오기 (모든 날짜 폴더 검색)
  async listProjects() {
    try {
      const rootFolder = this.getProjectRootFolder();
      await fs.mkdir(rootFolder, { recursive: true });

      const projects = [];
      const dateEntries = await fs.readdir(rootFolder, { withFileTypes: true });

      // 모든 날짜 폴더를 순회
      for (const dateEntry of dateEntries) {
        if (dateEntry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dateEntry.name)) {
          const dateFolderPath = path.join(rootFolder, dateEntry.name);

          try {
            const projectEntries = await fs.readdir(dateFolderPath, { withFileTypes: true });

            // 각 날짜 폴더 내의 프로젝트들 확인
            for (const projectEntry of projectEntries) {
              if (projectEntry.isDirectory()) {
                const metaPath = path.join(dateFolderPath, projectEntry.name, 'project.json');

                try {
                  const data = await fs.readFile(metaPath, 'utf-8');
                  const projectData = JSON.parse(data);

                  projects.push({
                    id: projectData.id,
                    topic: projectData.topic,
                    createdAt: projectData.createdAt,
                    createdDate: projectData.createdDate || dateEntry.name
                  });
                } catch (projectError) {
                  console.warn(`⚠️ 프로젝트 메타데이터 읽기 실패: ${projectEntry.name}`, projectError.message);
                }
              }
            }
          } catch (folderError) {
            console.warn(`⚠️ 날짜 폴더 읽기 실패: ${dateEntry.name}`, folderError.message);
          }
        }
      }

      return projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (error) {
      console.error('❌ 프로젝트 목록 조회 실패:', error);
      return [];
    }
  }

  // ID로 프로젝트 찾기 (모든 날짜 폴더 검색)
  async findProjectById(projectId) {
    try {
      const rootFolder = this.getProjectRootFolder();
      const dateEntries = await fs.readdir(rootFolder, { withFileTypes: true });

      for (const dateEntry of dateEntries) {
        if (dateEntry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(dateEntry.name)) {
          const projectDir = path.join(rootFolder, dateEntry.name, projectId);
          const metaPath = path.join(projectDir, 'project.json');

          try {
            const data = await fs.readFile(metaPath, 'utf-8');
            const projectData = JSON.parse(data);

            // 경로 업데이트 (현재 위치 기준)
            projectData.paths = {
              root: projectDir,
              output: path.join(projectDir, 'output'),
              scripts: path.join(projectDir, 'scripts'),
              audio: path.join(projectDir, 'audio'),
              images: path.join(projectDir, 'images'),
              temp: path.join(projectDir, 'temp')
            };

            return projectData;
          } catch (error) {
            // 이 날짜 폴더에는 해당 프로젝트가 없음
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ 프로젝트 찾기 실패: ${projectId}`, error);
      return null;
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
      // 먼저 프로젝트 찾기
      const project = await this.findProjectById(projectId);
      if (!project) {
        return { success: false, error: '프로젝트를 찾을 수 없습니다.' };
      }

      const projectDir = project.paths.root;
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
    console.log('🔧 새로운 ProjectManager 인스턴스 생성됨');
  }
  return projectManager;
}

module.exports = { 
  ProjectManager, 
  getProjectManager 
};