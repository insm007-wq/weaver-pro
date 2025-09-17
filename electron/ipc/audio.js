// electron/ipc/audio.js
const { ipcMain } = require("electron");

// ESM 패키지(music-metadata)를 CJS에서 안전하게 로드하기 위한 helper
let mmPromise = null;
async function getMusicMetadata() {
  if (!mmPromise) {
    // 동적 import → ESM/Exports 이슈 해결
    mmPromise = import("music-metadata").catch((e) => {
      mmPromise = null; // 다음 시도 가능하게
      throw e;
    });
  }
  return mmPromise;
}

/**
 * MP3 길이(초) 반환
 * invoke: "audio/getDuration", { path }
 * return: number (seconds, float)
 */
ipcMain.handle("audio/getDuration", async (_e, { path: filePath }) => {
  if (!filePath) throw new Error("path_required");
  const mm = await getMusicMetadata(); // ← 동적 import
  const { format } = await mm.parseFile(filePath);
  return Number(format?.duration || 0);
});

/**
 * 여러 음성 파일을 하나로 합치기
 * invoke: "audio/mergeFiles", { audioFiles, outputPath }
 * return: { success: boolean, outputPath?: string, message?: string }
 */
ipcMain.handle("audio/mergeFiles", async (_e, { audioFiles, outputPath }) => {
  const path = require("path");
  const fs = require("fs").promises;
  const { spawn } = require("child_process");

  try {
    if (!audioFiles || audioFiles.length === 0) {
      throw new Error("음성 파일 목록이 비어있습니다.");
    }

    if (audioFiles.length === 1) {
      // 파일이 하나뿐이면 복사만 하기
      const sourceFile = audioFiles[0];
      await fs.copyFile(sourceFile, outputPath);
      return { success: true, outputPath, message: "단일 파일 복사 완료" };
    }

    // 여러 파일을 FFmpeg로 합치기
    const tempListFile = path.join(path.dirname(outputPath), `concat_list_${Date.now()}.txt`);

    // FFmpeg concat demuxer용 파일 리스트 생성
    const listContent = audioFiles.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(tempListFile, listContent, 'utf8');

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', tempListFile,
        '-c', 'copy',
        '-y', // 덮어쓰기
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs, { stdio: 'pipe' });

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', async (code) => {
        try {
          // 임시 파일 정리
          await fs.unlink(tempListFile).catch(() => {});

          if (code === 0) {
            resolve({
              success: true,
              outputPath,
              message: `${audioFiles.length}개 파일이 성공적으로 합쳐졌습니다.`
            });
          } else {
            reject(new Error(`FFmpeg 오류 (코드 ${code}): ${stderr}`));
          }
        } catch (error) {
          reject(error);
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg 실행 오류: ${error.message}`));
      });
    });

  } catch (error) {
    return {
      success: false,
      message: `음성 파일 합치기 실패: ${error.message}`
    };
  }
});

/**
 * 씬 병합은 렌더러에서 처리 (stub)
 */
ipcMain.handle("audio/concatScenes", async () => {
  return { ok: true, note: "merge handled in renderer" };
});

module.exports = {}; // 명시적 export (안내용)
