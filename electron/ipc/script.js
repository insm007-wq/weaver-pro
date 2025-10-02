// electron/ipc/script.js
const { ipcMain } = require("electron");
const { getDefaultProjectRoot } = require("../utils/pathHelper");

/** 초(실수 가능) -> "HH:MM:SS,mmm" */
function toSrtTime(sec) {
  const totalMs = Math.max(0, Math.round((Number(sec) || 0) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss},${String(ms).padStart(3, "0")}`;
}

/** 텍스트 정리(여러 줄 -> 한 줄, 공백 정돈) */
function normalizeText(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** SRT 파서: 텍스트 -> { title, scenes[] } */
function parseSrt(srtText = "") {
  const text = String(srtText || "")
    .replace(/\r/g, "")
    .trim();
  if (!text) return { title: "Imported SRT", scenes: [] };

  // 블록 분리 (빈 줄 1개 이상)
  const blocks = text.split(/\n{2,}/);
  const scenes = [];
  let idx = 0;

  // 00:00:00,000 --> 00:00:03,000
  const timeRe =
    /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;

  const toSec = (h, m, s, ms) =>
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) continue;

    // 보통 1행: 인덱스, 2행: 타임라인
    let timeLine =
      lines[0].match(timeRe) || (lines[1] && lines[1].match(timeRe));
    let textStartLine = timeLine ? (lines[0].match(timeRe) ? 1 : 2) : -1;

    if (!timeLine) continue;

    const start = toSec(timeLine[1], timeLine[2], timeLine[3], timeLine[4]);
    const end = toSec(timeLine[5], timeLine[6], timeLine[7], timeLine[8]);

    const body = normalizeText(lines.slice(textStartLine).join("\n"));
    if (!body) continue;

    scenes.push({
      id: String(++idx),
      start,
      end: Math.max(end, start + 0.5), // 최소 0.5초 보장
      text: body,
      charCount: body.length,
    });
  }

  return { title: "Imported SRT", scenes };
}

// script/toSrt 핸들러 등록
const registerToSrt = require('./script/toSrt');
registerToSrt();

/** SRT 텍스트 -> { title, scenes[] } */
ipcMain.handle("script/importSrt", async (_evt, { srtText }) => {
  const doc = parseSrt(srtText || "");
  return doc;
});

/** 동적 자막 파일 경로 생성 (현재 프로젝트 기반) */
ipcMain.handle("script:getSubtitlePath", async (_evt, { filename }) => {
  try {
    console.log("🔧 script:getSubtitlePath 호출됨:", { filename });

    const store = require('../services/store');
    const { getProjectManager } = require('../services/projectManager');
    const path = require('path');
    const fs = require('fs').promises;

    // 현재 프로젝트 ID 가져오기
    const currentProjectId = store.getCurrentProjectId();
    console.log("🎯 현재 프로젝트 ID:", currentProjectId);

    if (!currentProjectId) {
      console.warn("⚠️ 현재 프로젝트가 설정되지 않았습니다. 기본 경로를 사용합니다.");

      // 폴백: 기본 경로 사용
      const projectRoot = store.get('projectRootFolder') || getDefaultProjectRoot();
      const defaultProjectName = store.get('defaultProjectName') || 'default';
      const scriptsDir = path.join(projectRoot, defaultProjectName, 'scripts');

      await fs.mkdir(scriptsDir, { recursive: true });
      const filePath = path.join(scriptsDir, filename);

      console.log("📁 폴백 자막 파일 경로:", filePath);
      return { success: true, data: { filePath } };
    }

    // 프로젝트 매니저를 통해 현재 프로젝트 정보 가져오기
    const projectManager = getProjectManager();
    const currentProject = store.getCurrentProject();

    if (!currentProject) {
      console.error("❌ 현재 프로젝트 데이터를 찾을 수 없습니다:", currentProjectId);

      // ID로 프로젝트 다시 찾기 시도
      const foundProject = await projectManager.findProjectById(currentProjectId);
      if (!foundProject) {
        throw new Error(`프로젝트를 찾을 수 없습니다: ${currentProjectId}`);
      }

      // 프로젝트 매니저에 현재 프로젝트 설정
      projectManager.setCurrentProject(foundProject);
    }

    // 현재 프로젝트의 scripts 경로 사용
    const project = currentProject || projectManager.getCurrentProject();
    const scriptsDir = project.paths.scripts;

    console.log("📂 현재 프로젝트 기반 scripts 디렉토리:", scriptsDir);

    // 디렉토리가 없으면 생성
    try {
      await fs.mkdir(scriptsDir, { recursive: true });
      console.log("✅ 디렉토리 생성 완료:", scriptsDir);
    } catch (dirError) {
      console.warn("⚠️ 디렉토리 생성 시도 실패 (이미 존재할 수 있음):", dirError.message);
    }

    // 자막 파일 경로
    const filePath = path.join(scriptsDir, filename);
    console.log("📁 현재 프로젝트 자막 파일 경로:", filePath);

    return { success: true, data: { filePath } };
  } catch (error) {
    console.error("❌ 동적 자막 경로 생성 실패:", error);
    return { success: false, message: error.message };
  }
});

/** 동적 오디오 파일 경로 생성 (현재 프로젝트 기반) */
ipcMain.handle("script:getAudioPath", async (_evt, { filename }) => {
  try {
    console.log("🔧 script:getAudioPath 호출됨:", { filename });

    const store = require('../services/store');
    const { getProjectManager } = require('../services/projectManager');
    const path = require('path');
    const fs = require('fs').promises;

    // 현재 프로젝트 ID 가져오기
    const currentProjectId = store.getCurrentProjectId();
    console.log("🎯 현재 프로젝트 ID:", currentProjectId);

    if (!currentProjectId) {
      console.warn("⚠️ 현재 프로젝트가 설정되지 않았습니다. 기본 경로를 사용합니다.");

      // 폴백: 기본 경로 사용
      const projectRoot = store.get('projectRootFolder') || getDefaultProjectRoot();
      const defaultProjectName = store.get('defaultProjectName') || 'default';
      const audioDir = path.join(projectRoot, defaultProjectName, 'audio');

      await fs.mkdir(audioDir, { recursive: true });
      const filePath = path.join(audioDir, filename);

      console.log("📁 폴백 오디오 파일 경로:", filePath);
      return { success: true, data: { filePath } };
    }

    // 프로젝트 매니저를 통해 현재 프로젝트 정보 가져오기
    const projectManager = getProjectManager();
    const currentProject = store.getCurrentProject();

    if (!currentProject) {
      console.error("❌ 현재 프로젝트 데이터를 찾을 수 없습니다:", currentProjectId);

      // ID로 프로젝트 다시 찾기 시도
      const foundProject = await projectManager.findProjectById(currentProjectId);
      if (!foundProject) {
        throw new Error(`프로젝트를 찾을 수 없습니다: ${currentProjectId}`);
      }

      // 프로젝트 매니저에 현재 프로젝트 설정
      projectManager.setCurrentProject(foundProject);
    }

    // 현재 프로젝트의 audio 경로 사용
    const project = currentProject || projectManager.getCurrentProject();
    const audioDir = project.paths.audio;

    console.log("📂 현재 프로젝트 기반 audio 디렉토리:", audioDir);

    // 디렉토리가 없으면 생성
    try {
      await fs.mkdir(audioDir, { recursive: true });
      console.log("✅ 디렉토리 생성 완료:", audioDir);
    } catch (dirError) {
      console.warn("⚠️ 디렉토리 생성 시도 실패 (이미 존재할 수 있음):", dirError.message);
    }

    // 오디오 파일 경로
    const filePath = path.join(audioDir, filename);
    console.log("📁 현재 프로젝트 오디오 파일 경로:", filePath);

    return { success: true, data: { filePath } };
  } catch (error) {
    console.error("❌ 동적 오디오 경로 생성 실패:", error);
    return { success: false, message: error.message };
  }
});

