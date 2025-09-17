// electron/services/store.js
const Store = require("electron-store");
const { app } = require("electron");
const path = require("path");

// weaver-pro 폴더로 강제 설정
const store = new Store({
  name: "settings",
  cwd: path.join(app.getPath('appData'), 'weaver-pro')
});

// 실제 파일 저장 경로 로그 출력
console.log("📁 electron-store 설정 파일 경로:", store.path);

// 기본값 설정으로 파일 생성 강제
if (!store.has('projectRootFolder')) {
  store.set('projectRootFolder', 'C:\\WeaverPro\\');
  console.log("✅ 기본 projectRootFolder 설정됨");
}

if (!store.has('defaultProjectName')) {
  store.set('defaultProjectName', 'default');
  console.log("✅ 기본 defaultProjectName 설정됨");
}

// 프로젝트 관리 초기화
if (!store.has('projects')) {
  store.set('projects', []);
  console.log("✅ 기본 projects 배열 설정됨");
}

if (!store.has('currentProjectId')) {
  store.set('currentProjectId', null);
  console.log("✅ 기본 currentProjectId 설정됨");
}

// 프로젝트 관리 함수들
const projectStore = {
  // 모든 프로젝트 가져오기
  getProjects() {
    return store.get('projects', []);
  },

  // 프로젝트 추가
  addProject(project) {
    const projects = this.getProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);

    if (existingIndex >= 0) {
      // 기존 프로젝트 업데이트
      projects[existingIndex] = { ...projects[existingIndex], ...project, lastModified: new Date().toISOString() };
    } else {
      // 새 프로젝트 추가
      projects.push({
        ...project,
        createdAt: project.createdAt || new Date().toISOString(),
        lastModified: new Date().toISOString()
      });
    }

    store.set('projects', projects);
    store.set('lastSync', new Date().toISOString());
    console.log(`📁 프로젝트 저장: ${project.id}`);
    return project;
  },

  // 프로젝트 업데이트
  updateProject(projectId, updates) {
    const projects = this.getProjects();
    const index = projects.findIndex(p => p.id === projectId);

    if (index >= 0) {
      projects[index] = {
        ...projects[index],
        ...updates,
        lastModified: new Date().toISOString()
      };
      store.set('projects', projects);
      store.set('lastSync', new Date().toISOString());
      console.log(`📝 프로젝트 업데이트: ${projectId}`);
      return projects[index];
    }

    throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  },

  // 프로젝트 삭제
  deleteProject(projectId) {
    const projects = this.getProjects();
    const filteredProjects = projects.filter(p => p.id !== projectId);

    if (filteredProjects.length === projects.length) {
      throw new Error(`삭제할 프로젝트를 찾을 수 없습니다: ${projectId}`);
    }

    store.set('projects', filteredProjects);

    // 현재 프로젝트가 삭제된 프로젝트라면 초기화
    if (this.getCurrentProjectId() === projectId) {
      this.setCurrentProjectId(null);
    }

    store.set('lastSync', new Date().toISOString());
    console.log(`🗑️ 프로젝트 삭제: ${projectId}`);
    return true;
  },

  // 프로젝트 찾기
  findProject(projectId) {
    const projects = this.getProjects();
    return projects.find(p => p.id === projectId) || null;
  },

  // 현재 프로젝트 ID 가져오기
  getCurrentProjectId() {
    return store.get('currentProjectId', null);
  },

  // 현재 프로젝트 설정
  setCurrentProjectId(projectId) {
    store.set('currentProjectId', projectId);
    console.log(`🎯 현재 프로젝트 설정: ${projectId}`);
  },

  // 현재 프로젝트 가져오기
  getCurrentProject() {
    const currentId = this.getCurrentProjectId();
    return currentId ? this.findProject(currentId) : null;
  }
};

// store 객체에 프로젝트 관리 함수들 추가
Object.assign(store, projectStore);

module.exports = store;
