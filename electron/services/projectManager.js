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
const { getDefaultProjectRoot } = require('../utils/pathHelper');

class ProjectManager {
  constructor() {
    this.currentProject = null;
  }

  // 기본 디렉토리 가져오기 (루트 폴더만, 날짜 폴더 제거)
  getBaseDir() {
    return this.getProjectRootFolder();
  }

  // 프로젝트 루트 폴더 가져오기 (날짜 폴더 제외)
  getProjectRootFolder() {
    try {
      // 프로젝트 전용 설정 확인 (오직 projectRootFolder만 사용)
      const projectRootFolder = store.get('projectRootFolder');
      if (projectRootFolder && typeof projectRootFolder === 'string' && projectRootFolder.trim()) {
        return projectRootFolder.trim();
      }
    } catch (error) {
      console.warn('설정값 읽기 실패, 기본값 사용:', error.message);
    }

    // OS에 맞는 기본 경로 반환
    return getDefaultProjectRoot();
  }

  // 새 프로젝트 생성
  async createProject(topic, options = {}) {
    try {
      const projectId = this.generateProjectId(topic);

      // baseFolder 옵션이 있으면 우선 사용, 없으면 기본 디렉토리 사용
      const baseDir = options.baseFolder && options.baseFolder.trim()
        ? options.baseFolder.trim()
        : this.getBaseDir();

      console.log(`📁 프로젝트 생성 - 기본 폴더: ${baseDir}, 프로젝트 ID: ${projectId}`);

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
          video: path.join(projectDir, 'video'),
          temp: path.join(projectDir, 'temp')
        },
        options: options
      };

      // 설정 파일에 프로젝트 저장
      store.addProject(projectData);

      // 현재 프로젝트로 설정
      store.setCurrentProjectId(projectId);
      this.currentProject = projectData;

      // 프로젝트 생성과 동시에 설정 자동 업데이트
      store.set('defaultProjectName', topic);
      store.set('videoSaveFolder', projectDir);
      console.log(`💾 settings.json 자동 업데이트: defaultProjectName="${topic}", videoSaveFolder="${projectDir}"`);

      console.log(`📁 새 프로젝트 생성: ${projectId}`);
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
      'video',       // 다운로드된 영상 파일들
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
      // 설정에서 프로젝트 찾기
      const project = store.findProject(projectId);
      if (project) {
        store.setCurrentProjectId(projectId);
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

  // 프로젝트 목록 가져오기 (설정 파일 기반 + 기존 폴더 마이그레이션)
  async listProjects() {
    try {
      // 기존 폴더 기반 프로젝트 마이그레이션 실행
      await this.migrateExistingProjects();

      // 설정에서 프로젝트 목록 가져오기
      let projects = store.getProjects();

      // 기본(default) 프로젝트 필터링 (완전 제거)
      projects = projects.filter(p => p.id !== 'default' && p.topic !== 'default');
      store.set('projects', projects);

      // 생성일 기준 내림차순 정렬 (최신 프로젝트가 맨 위)
      return projects.sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } catch (error) {
      console.error('❌ 프로젝트 목록 조회 실패:', error);
      return [];
    }
  }

  // 날짜 폴더 내 프로젝트들을 루트로 마이그레이션하고 설정에 추가
  async migrateDateFolderProjects(dateFolderPath) {
    try {
      const rootFolder = this.getProjectRootFolder();
      const projectEntries = await fs.readdir(dateFolderPath, { withFileTypes: true });

      for (const projectEntry of projectEntries) {
        if (projectEntry.isDirectory()) {
          const oldProjectDir = path.join(dateFolderPath, projectEntry.name);
          const newProjectDir = path.join(rootFolder, projectEntry.name);
          const metaPath = path.join(oldProjectDir, 'project.json');

          try {
            // 프로젝트 메타데이터 확인
            const data = await fs.readFile(metaPath, 'utf-8');
            const projectData = JSON.parse(data);

            // 새 위치로 이동
            console.log(`📦 날짜 폴더 프로젝트 마이그레이션: ${projectEntry.name}`);
            await fs.rename(oldProjectDir, newProjectDir);

            // 프로젝트 메타데이터의 경로 업데이트
            projectData.paths = {
              root: newProjectDir,
              output: path.join(newProjectDir, 'output'),
              scripts: path.join(newProjectDir, 'scripts'),
              audio: path.join(newProjectDir, 'audio'),
              images: path.join(newProjectDir, 'images'),
              video: path.join(newProjectDir, 'video'),
              temp: path.join(newProjectDir, 'temp')
            };

            // 설정에 프로젝트 추가 (중복 체크는 addProject에서 처리)
            store.addProject(projectData);

            // project.json 파일 삭제
            try {
              const newMetaPath = path.join(newProjectDir, 'project.json');
              await fs.unlink(newMetaPath);
              console.log(`🗑️ project.json 파일 삭제: ${newMetaPath}`);
            } catch (unlinkError) {
              console.warn(`⚠️ project.json 삭제 실패: ${newMetaPath}`, unlinkError.message);
            }

            console.log(`✅ 날짜 폴더 프로젝트 마이그레이션 완료: ${projectEntry.name}`);
          } catch (error) {
            console.warn(`⚠️ 날짜 폴더 프로젝트 마이그레이션 실패: ${projectEntry.name}`, error.message);
          }
        }
      }

      // 날짜 폴더가 비어있으면 삭제
      try {
        const remainingEntries = await fs.readdir(dateFolderPath);
        if (remainingEntries.length === 0) {
          await fs.rmdir(dateFolderPath);
          console.log(`🗑️ 빈 날짜 폴더 삭제: ${dateFolderPath}`);
        }
      } catch (error) {
        console.warn(`⚠️ 날짜 폴더 삭제 실패: ${dateFolderPath}`, error.message);
      }
    } catch (error) {
      console.error(`❌ 날짜 폴더 마이그레이션 실패: ${dateFolderPath}`, error);
    }
  }

  // ID로 프로젝트 찾기 (설정 파일 기반)
  async findProjectById(projectId) {
    try {
      const project = store.findProject(projectId);
      if (project) {
        // 경로가 없다면 생성
        if (!project.paths) {
          const rootFolder = this.getProjectRootFolder();
          const projectDir = path.join(rootFolder, projectId);
          project.paths = {
            root: projectDir,
            output: path.join(projectDir, 'output'),
            scripts: path.join(projectDir, 'scripts'),
            audio: path.join(projectDir, 'audio'),
            images: path.join(projectDir, 'images'),
            video: path.join(projectDir, 'video'),
            temp: path.join(projectDir, 'temp')
          };

          // 업데이트된 경로를 설정에 저장
          store.updateProject(projectId, { paths: project.paths });
        }

        return project;
      }

      console.warn(`⚠️ 프로젝트를 찾을 수 없음: ${projectId}`);
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
      const project = store.findProject(projectId);
      if (!project) {
        return { success: false, error: '프로젝트를 찾을 수 없습니다.' };
      }

      // 프로젝트 폴더 삭제
      if (project.paths && project.paths.root) {
        try {
          await fs.rm(project.paths.root, { recursive: true, force: true });
          console.log(`📂 프로젝트 폴더 삭제: ${project.paths.root}`);
        } catch (folderError) {
          console.warn(`⚠️ 프로젝트 폴더 삭제 실패: ${folderError.message}`);
        }

        // 개별 project.json 파일도 삭제 (혹시 남아있다면)
        try {
          const metaPath = path.join(project.paths.root, 'project.json');
          await fs.unlink(metaPath);
          console.log(`🗑️ project.json 파일 삭제: ${metaPath}`);
        } catch (jsonError) {
          // project.json이 없어도 무시
        }
      }

      // 설정에서 프로젝트 삭제
      store.deleteProject(projectId);

      // 현재 프로젝트가 삭제된 프로젝트라면 초기화
      if (this.currentProject?.id === projectId) {
        this.currentProject = null;
      }

      // 프로젝트 삭제 후 다른 프로젝트가 있으면 그 프로젝트로 자동 전환 및 설정 업데이트
      const remainingProjects = store.getProjects();
      if (remainingProjects.length > 0) {
        // 가장 최신 프로젝트 (생성일 기준 내림차순)
        const nextProject = remainingProjects.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt);
        })[0];

        if (nextProject) {
          // 다음 프로젝트를 현재 프로젝트로 설정
          store.setCurrentProjectId(nextProject.id);
          this.currentProject = nextProject;

          // 설정 자동 업데이트
          store.set('defaultProjectName', nextProject.topic);
          store.set('videoSaveFolder', nextProject.paths.root);
          console.log(`💾 프로젝트 삭제 후 설정 자동 업데이트: defaultProjectName="${nextProject.topic}", videoSaveFolder="${nextProject.paths.root}"`);
        }
      } else {
        // 모든 프로젝트가 삭제되면 설정 초기화
        store.set('defaultProjectName', 'default');
        store.set('videoSaveFolder', '');
        console.log('💾 모든 프로젝트 삭제됨 - 설정 초기화');
      }

      console.log(`🗑️ 프로젝트 삭제 완료: ${projectId}`);
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

    // 설정에서 프로젝트 업데이트
    const updatedProject = store.updateProject(this.currentProject.id, updates);
    this.currentProject = updatedProject;

    return this.currentProject;
  }

  // 기존 폴더 기반 프로젝트들을 설정 파일로 마이그레이션
  async migrateExistingProjects() {
    try {
      const rootFolder = this.getProjectRootFolder();

      // 루트 폴더가 존재하지 않으면 생성
      try {
        await fs.mkdir(rootFolder, { recursive: true });
      } catch (error) {
        console.warn('루트 폴더 생성 실패:', error.message);
        return;
      }

      let entries;
      try {
        entries = await fs.readdir(rootFolder, { withFileTypes: true });
      } catch (error) {
        console.warn('루트 폴더 읽기 실패:', error.message);
        return;
      }

      let migratedCount = 0;

      // 루트 폴더의 모든 항목을 순회
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 날짜 폴더인 경우 (YYYY-MM-DD 형식)
          if (/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) {
            console.log(`🔄 날짜 폴더 발견, 마이그레이션 시도: ${entry.name}`);
            await this.migrateDateFolderProjects(path.join(rootFolder, entry.name));
            continue;
          }

          // 일반 프로젝트 폴더인 경우
          const projectDir = path.join(rootFolder, entry.name);
          const metaPath = path.join(projectDir, 'project.json');

          try {
            // project.json이 존재하는지 확인
            const data = await fs.readFile(metaPath, 'utf-8');
            const projectData = JSON.parse(data);

            // 이미 설정에 있는지 확인
            const existingProject = store.findProject(projectData.id);
            if (!existingProject) {
              // 설정에 추가
              store.addProject(projectData);
              migratedCount++;
              console.log(`📦 프로젝트 마이그레이션: ${projectData.id}`);
            }

            // project.json 파일 삭제
            try {
              await fs.unlink(metaPath);
              console.log(`🗑️ project.json 파일 삭제: ${metaPath}`);
            } catch (unlinkError) {
              console.warn(`⚠️ project.json 삭제 실패: ${metaPath}`, unlinkError.message);
            }

          } catch (projectError) {
            // project.json이 없거나 읽기 실패한 경우는 무시
          }
        }
      }

      if (migratedCount > 0) {
        console.log(`✅ ${migratedCount}개 프로젝트 마이그레이션 완료`);
      }

    } catch (error) {
      console.error('❌ 프로젝트 마이그레이션 실패:', error);
    }
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