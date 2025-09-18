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
  // fallback store 객체
  store = {
    get: (key, defaultValue) => defaultValue,
    set: () => {},
  };
}

// music-metadata를 안전하게 로드
let mm = null;
try {
  mm = require("music-metadata");
  console.log("✅ music-metadata 로드 성공");
} catch (error) {
  console.warn("⚠️ music-metadata 로드 실패:", error.message);
}

// 정적 바이너리 경로
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
  // 기존 핸들러 제거 (중복 등록 방지)
  try {
    ipcMain.removeHandler("ffmpeg:compose");
    ipcMain.removeHandler("ffmpeg:check");
    ipcMain.removeHandler("ffmpeg:duration");
  } catch (_) {}

  // 영상 합성
  ipcMain.handle(
    "ffmpeg:compose",
    async (
      event,
      {
        audioFiles,
        imageFiles,
        outputPath,
        subtitlePath = null,
        sceneDurationsMs = null, // ⬅️ 씬별 길이(밀리초) 배열(선택)
        options = {},
      }
    ) => {
      try {
        console.log("🎬 FFmpeg 영상 합성 시작...");
        console.log("- 오디오 파일:", audioFiles);
        console.log("- 이미지 파일:", imageFiles);
        console.log("- 출력 경로:", outputPath);
        console.log("- 자막 파일:", subtitlePath);
        console.log("- sceneDurationsMs:", Array.isArray(sceneDurationsMs) ? sceneDurationsMs.length : null);

        // 품질 옵션
        const videoQuality = store.get("videoQuality", "balanced");
        const videoPreset = store.get("videoPreset", "fast");
        const videoCrf = store.get("videoCrf", 23);
        const subtitleSettings = store.get("subtitleSettings", null);

        let qualitySettings = { crf: 23, preset: "veryfast" };
        if (videoQuality === "high") qualitySettings = { crf: 18, preset: "fast" };
        if (videoQuality === "medium") qualitySettings = { crf: 21, preset: "veryfast" };
        if (videoQuality === "low") qualitySettings = { crf: 28, preset: "ultrafast" };

        if (videoPreset) qualitySettings.preset = videoPreset;
        if (videoCrf !== undefined) qualitySettings.crf = videoCrf;

        const defaultOptions = {
          fps: 24,
          videoCodec: "libx264",
          audioCodec: "aac",
          format: "mp4",
          ...qualitySettings,
        };
        const finalOptions = { ...defaultOptions, ...options };

        console.log(`📊 사용 설정: CRF=${finalOptions.crf}, Preset=${finalOptions.preset}, FPS=${finalOptions.fps}`);

        // 명령 인자 구성
        const ffmpegArgs = await buildFFmpegCommand({
          audioFiles,
          imageFiles,
          outputPath,
          subtitlePath,
          sceneDurationsMs,
          options: finalOptions,
          onMakeClipProgress: (i, total) => {
            // 클립 생성 단계 대략 진행률(0~30%)
            const p = Math.round((i / total) * 30);
            event.sender.send("ffmpeg:progress", p);
          },
        });

        console.log("FFmpeg 명령어:", ffmpegArgs.join(" "));

        // 실행
        const result = await runFFmpeg(ffmpegArgs, (progress) => {
          // 30~100% 사이로 매핑
          const mapped = 30 + Math.round((progress / 100) * 70);
          event.sender.send("ffmpeg:progress", Math.min(99, mapped));
        });

        if (result.success) {
          console.log("✅ 영상 합성 완료:", outputPath);
          event.sender.send("ffmpeg:progress", 100);
          return {
            success: true,
            videoPath: outputPath,
            duration: result.duration,
            size: result.size || 0,
          };
        } else {
          throw new Error(result.error || "FFmpeg compose failed");
        }
      } catch (error) {
        console.error("❌ FFmpeg 영상 합성 실패:", error);
        return {
          success: false,
          message: error.message,
          error: error.toString(),
        };
      }
    }
  );

  // ffmpeg/ffprobe 버전 확인
  ipcMain.handle("ffmpeg:check", async () => {
    try {
      const result = await runFFmpeg(["-version"], null, true);
      return { success: true, installed: result.success, version: result.output };
    } catch (error) {
      return { success: false, installed: false, message: error.message };
    }
  });

  // 오디오 길이(초) 추출 IPC
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
// ffprobe/ffmpeg로 미디어 길이(초) 구하기
// ----------------------------------------------------------------------------
async function probeDurationSec(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`파일이 없습니다: ${filePath}`);
  }

  // 1) ffprobe 우선
  if (ffprobePath) {
    try {
      const args = [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filePath
      ];
      const out = await execCollect(ffprobePath, args);
      const sec = parseFloat(String(out).trim());
      if (!isNaN(sec) && sec > 0) return sec;
    } catch (_) {}
  }

  // 2) music-metadata (ffprobe가 없거나 실패했을 때 가장 신뢰도 높음)
  if (mm) {
    try {
      const { format } = await mm.parseFile(filePath, { duration: true });
      if (format?.duration && format.duration > 0) {
        return format.duration; // 초 단위 (float)
      }
    } catch (_) {}
  }

  // 3) ffmpeg -i stderr 파싱 (백업)
  try {
    const info = await execCollect(ffmpegPath, ["-i", filePath]);
    const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i.exec(info);
    if (m) {
      const h = parseInt(m[1], 10);
      const mi = parseInt(m[2], 10);
      const s = parseInt(m[3], 10);
      const cs = parseInt(m[4], 10);
      return h * 3600 + mi * 60 + s + cs / 100;
    }
  } catch (_) {}

  // 4) 완전 실패 시에는 "던져서" 상위에서 처리하게 (더 이상 5/10초로 고정하지 않음)
  throw new Error("오디오 길이를 판별할 수 없습니다.");
}

function execCollect(bin, args) {
  return new Promise((resolve) => {
    const proc = spawn(bin, args);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", () => resolve(out + err));
    proc.on("error", () => resolve(""));
  });
}

// ----------------------------------------------------------------------------
// FFmpeg 명령어 구성
//  - 이미지들을 per-clip mp4로 만들고 concat demuxer로 이어붙임
//  - 자막은 subtitles 필터로 안전하게 적용(Win 경로 이스케이프)
//  - 씬별 길이가 주어지면 그대로 사용, 없으면 오디오 총 길이를 n등분
// ----------------------------------------------------------------------------
async function buildFFmpegCommand({ audioFiles, imageFiles, outputPath, subtitlePath, sceneDurationsMs, options, onMakeClipProgress }) {
  // Electron app이 준비되지 않은 경우를 위한 fallback
  let tempDir;
  try {
    tempDir = path.join(app.getPath("userData"), "ffmpeg-temp");
  } catch (error) {
    // app이 준비되지 않은 경우 임시 디렉토리 사용
    const os = require("os");
    tempDir = path.join(os.tmpdir(), "weaver-pro-ffmpeg-temp");
  }
  await fsp.mkdir(tempDir, { recursive: true });

  // 임시파일 정리
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

  // 오디오 총 길이
  let totalAudioSec = 10;
  if (audioFiles && audioFiles.length > 0) {
    totalAudioSec = await probeDurationSec(audioFiles[0]).catch(() => 10);
  }
  const totalAudioMs = Math.max(1000, Math.floor(totalAudioSec * 1000));

  // 씬별 길이 확정
  const N = (imageFiles && imageFiles.length) || 0;
  let perSceneMs = [];
  if (Array.isArray(sceneDurationsMs) && sceneDurationsMs.length === N) {
    perSceneMs = [...sceneDurationsMs];
  } else if (N > 0) {
    const base = Math.floor(totalAudioMs / N);
    perSceneMs = Array.from({ length: N }, () => base);
    // 합 보정
    let diff = totalAudioMs - perSceneMs.reduce((a, b) => a + b, 0);
    if (diff !== 0) perSceneMs[perSceneMs.length - 1] += diff;
  }

  // 개별 클립 생성
  const videoClips = [];
  let totalVideoSec = 0;

  console.log(`🎬 총 오디오 길이: ${totalAudioSec.toFixed(2)}초`);
  console.log(`📊 씬별 길이 (ms):`, perSceneMs);

  for (let i = 0; i < N; i++) {
    const img = imageFiles[i];
    const durSec = Math.max(0.2, (perSceneMs[i] || totalAudioMs / N) / 1000); // 최소 0.2초
    const clipOut = path.join(tempDir, `clip_${String(i).padStart(3, "0")}_${Date.now()}.mp4`);

    totalVideoSec += durSec;
    console.log(`📹 클립 ${i + 1}: ${durSec.toFixed(2)}초 (누적: ${totalVideoSec.toFixed(2)}초)`);
    console.log(`🎬 ${img} -> ${durSec.toFixed(2)}초`);

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
      clipOut,
    ];

    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, clipArgs, { windowsHide: true });
      proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`클립 생성 실패(code=${code})`))));
      proc.on("error", reject);
    });

    videoClips.push(clipOut);
    if (onMakeClipProgress) onMakeClipProgress(i + 1, N);
  }

  console.log(`🔍 총 비디오 길이 예상: ${totalVideoSec.toFixed(2)}초 vs 오디오: ${totalAudioSec.toFixed(2)}초`);

  // concat 리스트
  const listFile = path.join(tempDir, `concat_${Date.now()}.txt`);
  const concatContent = videoClips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await fsp.writeFile(listFile, concatContent, "utf8");

  // 메인 인자
  const args = ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", listFile];

  if (audioFiles && audioFiles.length > 0) {
    args.push("-i", audioFiles[0]); // 오디오
  }

  // 매핑
  if (audioFiles && audioFiles.length > 0) {
    args.push("-map", "0:v", "-map", "1:a");
  } else {
    args.push("-map", "0:v");
  }

  // 자막 필터 구성
  let vf = "format=yuv420p"; // (클립 단계에서 이미 scale/pad 완료)
  if (subtitlePath && fs.existsSync(subtitlePath)) {
    // 윈도우 경로 → 슬래시로, 드라이브 콜론 이스케이프
    let srt = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
    // 글꼴/인코딩 강제(필요시)
    const style = "FontName=Malgun Gothic,Outline=2,BorderStyle=3,Shadow=0";
    vf = `subtitles='${srt}':charenc=UTF-8:force_style='${style}',` + vf;
  }

  // 최종 비디오 인코딩
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
    "+faststart"
  );

  if (audioFiles && audioFiles.length > 0) {
    args.push("-c:a", options.audioCodec || "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2");
    // 🔒 오디오가 끝나면 비디오도 함께 종료 (마지막 화면 고정 방지)
    args.push("-shortest");
  }

  args.push(outputPath);
  return args;
}

// ----------------------------------------------------------------------------
// FFmpeg 실행
// ----------------------------------------------------------------------------
function runFFmpeg(args, progressCallback = null, isCheck = false) {
  return new Promise((resolve) => {
    const timeoutMs = isCheck ? 10000 : 15 * 60 * 1000; // 체크 10초, 일반 15분
    const proc = spawn(ffmpegPath, args, { windowsHide: true });

    let out = "";
    let err = "";
    let completed = false;

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
      // 대략 진행률(출력의 time= 추정)
      if (progressCallback && !isCheck) {
        const m = /time=(\d{2}):(\d{2}):(\d{2})/i.exec(s);
        if (m) {
          const h = parseInt(m[1], 10);
          const mi = parseInt(m[2], 10);
          const se = parseInt(m[3], 10);
          const cur = h * 3600 + mi * 60 + se;
          // 절대값 모르면 대략 1000초 기준 스케일
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
        resolve({
          success: code === 0,
          output: out || err,
          duration: extractDuration(err),
          size: 0,
        });
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

// stderr에서 Duration 파싱
function extractDuration(output) {
  const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i.exec(output || "");
  if (!m) return 0;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  const s = parseInt(m[3], 10);
  const cs = parseInt(m[4], 10);
  return h * 3600 + mi * 60 + s + cs / 100;
}

module.exports = { register };
