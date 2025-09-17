// electron/ipc/script.js
const { ipcMain } = require("electron");

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

/** 동적 자막 파일 경로 생성 */
ipcMain.handle("script:getSubtitlePath", async (_evt, { filename }) => {
  try {
    console.log("🔧 script:getSubtitlePath 호출됨:", { filename });

    const store = require('../services/store');
    const path = require('path');
    const fs = require('fs').promises;

    // 기본 프로젝트명과 오늘 날짜로 직접 경로 생성
    const defaultProjectName = store.get('defaultProjectName') || 'WeaverPro-Project';
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const projectRoot = store.get('projectRootFolder') || 'C:\\WeaverPro';

    console.log("📂 기본 프로젝트명:", defaultProjectName);
    console.log("📅 오늘 날짜:", today);
    console.log("📁 프로젝트 루트:", projectRoot);

    // 경로 구성: projectRoot/YYYY-MM-DD/projectName/scripts/
    const projectDir = path.join(projectRoot, today, defaultProjectName);
    const scriptsDir = path.join(projectDir, 'scripts');

    console.log("📂 스크립트 디렉토리:", scriptsDir);

    // 디렉토리가 없으면 생성
    try {
      await fs.mkdir(scriptsDir, { recursive: true });
      console.log("✅ 디렉토리 생성 완료:", scriptsDir);
    } catch (dirError) {
      console.warn("⚠️ 디렉토리 생성 시도 실패 (이미 존재할 수 있음):", dirError.message);
    }

    // 자막 파일 경로
    const filePath = path.join(scriptsDir, filename);
    console.log("📁 자막 파일 경로:", filePath);

    return { success: true, filePath };
  } catch (error) {
    console.error("❌ 동적 자막 경로 생성 실패:", error);
    return { success: false, message: error.message };
  }
});
