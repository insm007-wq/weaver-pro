// electron/ipc/ffmpeg.js
// ============================================================================
// FFmpeg 영상 합성 IPC 핸들러 (실제 오디오 길이 기반 씬 타이밍, SRT 동기화)
// ============================================================================

const { ipcMain, app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;

// store를 안전하게 로드
let store = null;
try {
  store = require("../services/store");
  console.log("✅ store 로드 성공");
} catch (error) {
  console.warn("⚠️ store 로드 실패:", error.message);
  store = { get: (key, def) => def, set: () => {} };
}

// music-metadata를 안전하게 로드
let mm = null;
try {
  mm = require("music-metadata");
  console.log("✅ music-metadata 로드 성공");
} catch (error) {
  console.warn("⚠️ music-metadata 로드 실패:", error.message);
}

const ffmpegPath = path.join(__dirname, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg.exe");

// ffprobe 사용 가능하면 최우선
let ffprobePath = null;
try {
  ffprobePath = require("ffprobe-static").path;
} catch {
  ffprobePath = null;
}

// ----------------------------------------------------------------------------
// 등록
// ----------------------------------------------------------------------------
function register() {
  try {
    ipcMain.removeHandler("ffmpeg:compose");
    ipcMain.removeHandler("ffmpeg:check");
    ipcMain.removeHandler("ffmpeg:duration");
  } catch {}

  ipcMain.handle(
    "ffmpeg:compose",
    async (event, { audioFiles, imageFiles, outputPath, subtitlePath = null, sceneDurationsMs = null, options = {} }) => {
      try {
        console.log("🎬 FFmpeg 영상 합성 시작...");
        const videoQuality = store.get("videoQuality", "balanced");
        const videoPreset = store.get("videoPreset", "fast");
        const videoCrf = store.get("videoCrf", 23);

        let qualitySettings = { crf: 23, preset: "veryfast" };
        if (videoQuality === "high") qualitySettings = { crf: 18, preset: "fast" };
        if (videoQuality === "medium") qualitySettings = { crf: 21, preset: "veryfast" };
        if (videoQuality === "low") qualitySettings = { crf: 28, preset: "ultrafast" };

        if (videoPreset) qualitySettings.preset = videoPreset;
        if (videoCrf !== undefined) qualitySettings.crf = videoCrf;

        const finalOptions = {
          fps: 24,
          videoCodec: "libx264",
          audioCodec: "aac",
          format: "mp4",
          ...qualitySettings,
          ...options,
        };

        const ffmpegArgs = await buildFFmpegCommand({
          audioFiles,
          imageFiles,
          outputPath,
          subtitlePath,
          sceneDurationsMs,
          options: finalOptions,
          onMakeClipProgress: (i, total) => {
            const p = Math.round((i / total) * 30);
            event.sender.send("ffmpeg:progress", p);
          },
        });

        console.log("FFmpeg 명령어:", ffmpegArgs.join(" "));

        const result = await runFFmpeg(ffmpegArgs, (progress) => {
          const mapped = 30 + Math.round((progress / 100) * 70);
          event.sender.send("ffmpeg:progress", Math.min(99, mapped));
        });

        if (result.success) {
          event.sender.send("ffmpeg:progress", 100);
          return { success: true, videoPath: outputPath, duration: result.duration, size: result.size || 0 };
        } else {
          throw new Error(result.error || "FFmpeg compose failed");
        }
      } catch (error) {
        console.error("❌ FFmpeg 영상 합성 실패:", error);
        return { success: false, message: error.message, error: error.toString() };
      }
    }
  );

  ipcMain.handle("ffmpeg:check", async () => {
    try {
      const result = await runFFmpeg(["-version"], null, true);
      return { success: true, installed: result.success, version: result.output };
    } catch (error) {
      return { success: false, installed: false, message: error.message };
    }
  });

  ipcMain.handle("ffmpeg:duration", async (_event, filePath) => {
    try {
      const sec = await probeDurationSec(filePath);
      return { success: true, seconds: sec };
    } catch (e) {
      return { success: false, message: e.message };
    }
  });

  console.log("[ipc] ffmpeg: registered");
}

// ----------------------------------------------------------------------------
// ffprobe/ffmpeg로 미디어 길이 구하기
// ----------------------------------------------------------------------------
async function probeDurationSec(filePath) {
  if (!filePath || !fs.existsSync(filePath)) throw new Error(`파일이 없습니다: ${filePath}`);

  if (ffprobePath) {
    try {
      const args = ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath];
      const out = await execCollect(ffprobePath, args);
      const sec = parseFloat(String(out).trim());
      if (!isNaN(sec) && sec > 0) return sec;
    } catch {}
  }

  if (mm) {
    try {
      const { format } = await mm.parseFile(filePath, { duration: true });
      if (format?.duration && format.duration > 0) return format.duration;
    } catch {}
  }

  try {
    const info = await execCollect(ffmpegPath, ["-i", filePath]);
    const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i.exec(info);
    if (m) {
      const h = parseInt(m[1], 10),
        mi = parseInt(m[2], 10),
        s = parseInt(m[3], 10),
        cs = parseInt(m[4], 10);
      return h * 3600 + mi * 60 + s + cs / 100;
    }
  } catch {}

  throw new Error("오디오 길이를 판별할 수 없습니다.");
}

function execCollect(bin, args) {
  return new Promise((resolve) => {
    const proc = spawn(bin, args);
    let out = "",
      err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", () => resolve(out + err));
    proc.on("error", () => resolve(""));
  });
}

// ----------------------------------------------------------------------------
// FFmpeg 명령어 구성
// ----------------------------------------------------------------------------
async function buildFFmpegCommand({ audioFiles, imageFiles, outputPath, subtitlePath, sceneDurationsMs, options, onMakeClipProgress }) {
  // ✅ 상수 먼저 정의 (hoisting 문제 해결)
  const EXTRA_TAIL_SEC = 1.5; // 안전 여유
  const MIN_PAD_SEC = 0.25; // 최소 패딩
  const MIN_CLIP_DURATION = 0.25; // 최소 클립 길이

  let tempDir;
  try {
    tempDir = path.join(app.getPath("userData"), "ffmpeg-temp");
  } catch {
    const os = require("os");
    tempDir = path.join(os.tmpdir(), "weaver-pro-ffmpeg-temp");
  }
  await fsp.mkdir(tempDir, { recursive: true });

  try {
    const olds = await fsp.readdir(tempDir);
    for (const f of olds) {
      if (f.startsWith("concat_") || f.startsWith("clip_")) {
        try {
          await fsp.unlink(path.join(tempDir, f));
        } catch {}
      }
    }
  } catch {}

  // ✅ 입력 검증
  if (!imageFiles || imageFiles.length === 0) {
    throw new Error("이미지 파일이 없습니다");
  }

  // 오디오 총 길이 안전하게 측정
  let totalAudioSec = 10; // 기본값
  if (audioFiles && audioFiles.length > 0 && audioFiles[0]) {
    try {
      const measuredDuration = await probeDurationSec(audioFiles[0]);
      if (measuredDuration > 0) {
        totalAudioSec = measuredDuration;
        console.log(`✅ 오디오 길이 측정 성공: ${totalAudioSec.toFixed(2)}초`);
      } else {
        console.warn(`⚠️ 측정된 오디오 길이가 0초, 기본값 사용: ${totalAudioSec}초`);
      }
    } catch (error) {
      console.warn(`⚠️ 오디오 길이 측정 실패: ${error.message}, 기본값 사용: ${totalAudioSec}초`);
    }
  }
  const totalAudioMs = Math.max(1000, Math.floor(totalAudioSec * 1000));

  const N = imageFiles.length;
  let perSceneMs = [];
  if (Array.isArray(sceneDurationsMs) && sceneDurationsMs.length === N) {
    perSceneMs = [...sceneDurationsMs];
  } else if (N > 0) {
    const base = Math.floor(totalAudioMs / N);
    perSceneMs = Array.from({ length: N }, () => base);
    let diff = totalAudioMs - perSceneMs.reduce((a, b) => a + b, 0);
    if (diff !== 0) perSceneMs[perSceneMs.length - 1] += diff;
  }

  const videoClips = [];
  let totalVideoSec = 0;

  for (let i = 0; i < N; i++) {
    const img = imageFiles[i];

    // ✅ 이미지 파일 존재 확인
    if (!img || typeof img !== 'string') {
      console.warn(`⚠️ 유효하지 않은 이미지 파일: 인덱스 ${i}`);
      continue;
    }

    const durSec = Math.max(MIN_CLIP_DURATION, (perSceneMs[i] || totalAudioMs / N) / 1000);
    const clipOut = path.join(tempDir, `clip_${String(i).padStart(3, "0")}_${Date.now()}.mp4`);

    totalVideoSec += durSec;
    console.log(`📹 클립 ${i + 1}/${N}: ${durSec.toFixed(2)}초 (누적: ${totalVideoSec.toFixed(2)}초)`);

    const vfChain = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

    const clipArgs = [
      "-y",
      "-hide_banner",
      "-loop",
      "1",
      "-i",
      img,
      "-t",
      durSec.toFixed(3),
      "-vf",
      vfChain,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      String(options.crf ?? 23),
      "-r",
      String(options.fps ?? 24),
      "-pix_fmt",
      "yuv420p",
      // ✅ 검은 화면 튀는 현상 방지
      "-avoid_negative_ts",
      "make_zero",
      "-fflags",
      "+genpts",
      clipOut,
    ];

    try {
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, clipArgs, { windowsHide: true });

        let stderr = '';
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`클립 ${i + 1} 생성 실패 (코드: ${code})\n${stderr}`));
          }
        });

        proc.on("error", (error) => {
          reject(new Error(`클립 ${i + 1} 프로세스 오류: ${error.message}`));
        });
      });

      console.log(`✅ 클립 ${i + 1} 생성 완료`);
    } catch (error) {
      console.error(`❌ 클립 ${i + 1} 생성 실패:`, error.message);
      throw new Error(`클립 생성 중단: ${error.message}`);
    }

    videoClips.push(clipOut);
    if (onMakeClipProgress) onMakeClipProgress(i + 1, N);
  }

  // 🔸 항상 오디오보다 영상이 길도록 마지막 클립 확장
  if (videoClips.length > 0) {
    const lastIdx = videoClips.length - 1;
    const lastImg = imageFiles[lastIdx];

    if (!lastImg) {
      console.warn(`⚠️ 마지막 이미지 파일이 없습니다: 인덱스 ${lastIdx}`);
    } else {
      const baseSec = Math.max(MIN_CLIP_DURATION, (perSceneMs[lastIdx] || totalAudioMs / N) / 1000);
      const neededSec = Math.max(totalAudioSec - totalVideoSec, 0);
      const newDurSec = baseSec + neededSec + EXTRA_TAIL_SEC;

      console.log(`🔧 마지막 클립 확장: ${baseSec.toFixed(2)}s → ${newDurSec.toFixed(2)}s (추가: +${(neededSec + EXTRA_TAIL_SEC).toFixed(2)}s)`);

    const newClipOut = path.join(tempDir, `clip_${String(lastIdx).padStart(3, "0")}_extended_${Date.now()}.mp4`);
    const vfChain = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

    const extendArgs = [
      "-y",
      "-hide_banner",
      "-loop",
      "1",
      "-i",
      lastImg,
      "-t",
      newDurSec.toFixed(3),
      "-vf",
      vfChain,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      String(options.crf ?? 23),
      "-r",
      String(options.fps ?? 24),
      "-pix_fmt",
      "yuv420p",
      // ✅ 검은 화면 튀는 현상 방지
      "-avoid_negative_ts",
      "make_zero",
      "-fflags",
      "+genpts",
      newClipOut,
    ];

      try {
        await new Promise((resolve, reject) => {
          const proc = spawn(ffmpegPath, extendArgs, { windowsHide: true });

          let stderr = '';
          proc.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          proc.on("close", (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`확장 클립 생성 실패 (코드: ${code})\n${stderr}`));
            }
          });

          proc.on("error", (error) => {
            reject(new Error(`확장 클립 프로세스 오류: ${error.message}`));
          });
        });

        videoClips[lastIdx] = newClipOut;
        console.log(`✅ 마지막 클립 ${newDurSec.toFixed(2)}초로 연장 완료`);
      } catch (error) {
        console.error(`❌ 마지막 클립 확장 실패:`, error.message);
        console.warn(`⚠️ 원본 클립 유지, 오디오 잘림 위험 있음`);
      }
    }
  }

  // ✅ 최종 검증
  if (videoClips.length === 0) {
    throw new Error("생성된 비디오 클립이 없습니다");
  }

  console.log(`📊 최종 통계: ${videoClips.length}개 클립 생성, 총 예상 길이: ${totalVideoSec.toFixed(2)}초`);

  const listFile = path.join(tempDir, `concat_${Date.now()}.txt`);
  const concatContent = videoClips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await fsp.writeFile(listFile, concatContent, "utf8");

  const args = ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", listFile];
  if (audioFiles && audioFiles.length > 0) args.push("-i", audioFiles[0]);

  if (audioFiles && audioFiles.length > 0) args.push("-map", "0:v", "-map", "1:a");
  else args.push("-map", "0:v");

  let vf = "format=yuv420p";
  if (subtitlePath && fs.existsSync(subtitlePath)) {
    let srt = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
    const style = "FontName=Malgun Gothic,Outline=2,BorderStyle=3,Shadow=0";
    vf = `subtitles='${srt}':charenc=UTF-8:force_style='${style}',` + vf;
  }

  args.push(
    "-vf",
    vf,
    "-c:v",
    options.videoCodec || "libx264",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    options.preset || "veryfast",
    "-movflags",
    "+faststart",
    // ✅ 타임스탬프 안정화로 검은 화면 튀는 현상 방지
    "-avoid_negative_ts",
    "make_zero",
    "-fflags",
    "+genpts"
  );

  if (audioFiles && audioFiles.length > 0) {
    args.push("-c:a", options.audioCodec || "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2");
    // ✅ -shortest 제거: 마지막 클립을 연장했으므로 오디오 끝까지 재생되도록 함
    // args.push("-shortest");
  }

  args.push(outputPath);
  return args;
}

// ----------------------------------------------------------------------------
// FFmpeg 실행
// ----------------------------------------------------------------------------
function runFFmpeg(args, progressCallback = null, isCheck = false) {
  return new Promise((resolve) => {
    const timeoutMs = isCheck ? 10000 : 15 * 60 * 1000;
    const proc = spawn(ffmpegPath, args, { windowsHide: true });

    let out = "",
      err = "",
      completed = false;
    const timer = setTimeout(() => {
      if (!completed) {
        try {
          proc.kill("SIGKILL");
        } catch {}
        resolve({ success: false, error: `FFmpeg 타임아웃(${timeoutMs}ms)` });
      }
    }, timeoutMs);

    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      err += s;
      if (progressCallback && !isCheck) {
        const m = /time=(\d{2}):(\d{2}):(\d{2})/i.exec(s);
        if (m) {
          const h = parseInt(m[1], 10),
            mi = parseInt(m[2], 10),
            se = parseInt(m[3], 10);
          const cur = h * 3600 + mi * 60 + se;
          const est = Math.max(0, Math.min(100, Math.round((cur / 1000) * 100)));
          progressCallback(est);
        }
      }
    });

    proc.on("close", (code) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      if (code === 0 || isCheck) {
        resolve({ success: code === 0, output: out || err, duration: extractDuration(err), size: 0 });
      } else {
        resolve({ success: false, error: err || `FFmpeg exited with code ${code}` });
      }
    });

    proc.on("error", (e) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      resolve({ success: false, error: e.message });
    });
  });
}

function extractDuration(output) {
  const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i.exec(output || "");
  if (!m) return 0;
  const h = parseInt(m[1], 10),
    mi = parseInt(m[2], 10),
    s = parseInt(m[3], 10),
    cs = parseInt(m[4], 10);
  return h * 3600 + mi * 60 + s + cs / 100;
}

module.exports = { register };
