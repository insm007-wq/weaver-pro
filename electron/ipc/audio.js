// electron/ipc/audio.js
const { ipcMain, app } = require("electron");
const path = require("path");
const fs = require("fs");

// FFmpeg 경로 설정 (ASAR 패키징 대응)

let ffmpegPath;
try {
  ffmpegPath = require("ffmpeg-static");

  // ASAR 패키징된 경우, app.asar를 app.asar.unpacked로 변경
  if (ffmpegPath && ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    console.log("✅ FFmpeg ASAR unpacked 경로:", ffmpegPath);
  }

  console.log("✅ FFmpeg 바이너리 확인:", ffmpegPath);
} catch (err) {
  console.error("❌ FFmpeg 바이너리를 찾을 수 없습니다:", err);
  // 폴백 경로 (unpacked 사용)
  const appPath = app.getAppPath();
  if (appPath.includes('app.asar')) {
    ffmpegPath = path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  } else {
    ffmpegPath = path.join(__dirname, '..', '..', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  }
}

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
    console.log("🎵 audio/mergeFiles 호출됨:", { audioFiles, outputPath });

    if (!audioFiles || audioFiles.length === 0) {
      throw new Error("음성 파일 목록이 비어있습니다.");
    }

    // 입력 파일들이 실제로 존재하는지 확인
    for (const audioFile of audioFiles) {
      try {
        await fs.access(audioFile);
        console.log("✅ 입력 파일 확인:", audioFile);
      } catch (error) {
        console.error("❌ 입력 파일 없음:", audioFile);
        throw new Error(`입력 파일을 찾을 수 없습니다: ${audioFile}`);
      }
    }

    // 출력 디렉토리가 없으면 생성
    const outputDir = path.dirname(outputPath);
    console.log("📁 출력 디렉토리 생성:", outputDir);
    await fs.mkdir(outputDir, { recursive: true });

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

      console.log("🎬 FFmpeg 실행:", { ffmpegPath, ffmpegArgs });
      console.log("📝 concat 리스트 파일:", tempListFile);
      console.log("📄 리스트 내용:", listContent);

      const ffmpeg = spawn(ffmpegPath, ffmpegArgs, { stdio: 'pipe' });

      let stderr = '';
      let stdout = '';

      ffmpeg.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffmpeg.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.log("🎬 FFmpeg stderr:", chunk);
      });

      ffmpeg.on('close', async (code) => {
        try {
          console.log("🎬 FFmpeg 종료 코드:", code);
          console.log("🎬 FFmpeg stdout:", stdout);
          console.log("🎬 FFmpeg stderr:", stderr);

          // 출력 파일이 실제로 생성되었는지 확인
          try {
            await fs.access(outputPath);
            console.log("✅ 출력 파일 생성 확인:", outputPath);
          } catch (error) {
            console.error("❌ 출력 파일 생성 실패:", outputPath);
          }

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
        console.error("🎬 FFmpeg 실행 오류:", error);
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
