// electron/ipc/projectManager.js
// ============================================================================
// 프로젝트 관리 IPC 핸들러
// - 프로젝트 생성, 로드, 목록 조회
// - 출력 폴더 관리
// ============================================================================

const { ipcMain, shell } = require('electron');
const { getProjectManager } = require('../services/projectManager');

function register() {
  // 새 프로젝트 생성
  ipcMain.handle('project:create', async (event, { topic, options }) => {
    try {
      const projectManager = getProjectManager();
      const project = await projectManager.createProject(topic, options);
      return { success: true, project };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 프로젝트 목록 가져오기
  ipcMain.handle('project:list', async () => {
    try {
      const projectManager = getProjectManager();
      const projects = await projectManager.listProjects();
      return { success: true, projects };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 프로젝트 로드
  ipcMain.handle('project:load', async (event, projectId) => {
    try {
      const projectManager = getProjectManager();
      const project = await projectManager.loadProject(projectId);
      if (project) {
        return { success: true, project };
      } else {
        return { success: false, message: '프로젝트를 찾을 수 없습니다.' };
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 현재 프로젝트 가져오기
  ipcMain.handle('project:current', async () => {
    try {
      const projectManager = getProjectManager();
      const project = projectManager.getCurrentProject();
      return { success: true, project };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 프로젝트 삭제
  ipcMain.handle('project:delete', async (event, projectId) => {
    try {
      const projectManager = getProjectManager();
      const result = await projectManager.deleteProject(projectId);
      return result;
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 프로젝트 폴더 열기
  ipcMain.handle('project:openOutputFolder', async () => {
    try {
      const projectManager = getProjectManager();
      const project = projectManager.getCurrentProject();

      if (!project) {
        return { success: false, message: '현재 활성 프로젝트가 없습니다.' };
      }

      await shell.openPath(project.paths.root);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 파일 경로 생성
  ipcMain.handle('project:getFilePath', async (event, { category, filename }) => {
    try {
      const projectManager = getProjectManager();
      const filePath = projectManager.getFilePath(category, filename);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  // 프로젝트 정보 업데이트
  ipcMain.handle('project:update', async (event, updates) => {
    try {
      const projectManager = getProjectManager();
      const project = await projectManager.updateProject(updates);
      return { success: true, project };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  console.log('[ipc] project-manager: registered');
}

module.exports = { register };