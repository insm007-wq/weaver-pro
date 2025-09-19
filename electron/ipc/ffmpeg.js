// electron/ipc/ffmpeg.js
// ============================================================================
// FFmpeg 영상 합성 IPC 핸들러 (오디오 길이 정확 매칭, 시크 품질 개선)
// ============================================================================

const { ipcMain, app } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;

let store = null;
try {
  store = require("../services/store");
} catch {
  store = { get: (_k, v) => v, set: () => {} };
}

let mm = null;
try {
  mm = require("music-metadata");
} catch {}

const ffmpegPath = path.join(__dirname, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg.exe");

let ffprobePath = null;
try {
  ffprobePath = require("ffprobe-static").path;
} catch {
  ffprobePath = null;
}

// ----------------------------------------------------------------------------
function register() {
  try {
    ipcMain.removeHandler("ffmpeg:compose");
    ipcMain.removeHandler("ffmpeg:check");
    ipcMain.removeHandler("ffmpeg:duration");
  } catch {}

  ipcMain.handle("ffmpeg:compose", async (event, payload) => {
    try {
      const ffmpegArgs = await buildFFmpegCommand({
        ...payload,
        onMakeClipProgress: (i, total) => {
          event.sender.send("ffmpeg:progress", Math.round((i / total) * 30));
        },
      });
      const result = await runFFmpeg(ffmpegArgs, (p) => {
        const mapped = 30 + Math.round((p / 100) * 70);
        event.sender.send("ffmpeg:progress", Math.min(99, mapped));
      });
      if (!result.success) throw new Error(result.error || "FFmpeg compose failed");
      event.sender.send("ffmpeg:progress", 100);
      return { success: true, videoPath: payload.outputPath, duration: result.duration, size: result.size || 0 };
    } catch (e) {
      return { success: false, message: e.message, error: String(e) };
    }
  });

  ipcMain.handle("ffmpeg:check", async () => {
    try {
      const r = await runFFmpeg(["-version"], null, true);
      return { success: true, installed: r.success, version: r.output };
    } catch (e) {
      return { success: false, installed: false, message: e.message };
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
      if (format?.duration > 0) return format.duration;
    } catch {}
  }
  const info = await execCollect(ffmpegPath, ["-i", filePath]);
  const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/i.exec(info);
  if (m) {
    const h = +m[1],
      mi = +m[2],
      s = +m[3],
      cs = +m[4];
    return h * 3600 + mi * 60 + s + cs / 100;
  }
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
async function buildFFmpegCommand({ audioFiles, imageFiles, outputPath, subtitlePath, sceneDurationsMs, options, onMakeClipProgress }) {
  const fps = Number(options?.fps ?? 24);
  const gop = Number(options?.gop ?? fps * 2); // 2초 GOP
  const forceKFExpr = "expr:gte(t,n_forced*1)"; // 1초마다 키프레임

  let tempDir;
  try {
    tempDir = path.join(app.getPath("userData"), "ffmpeg-temp");
  } catch {
    tempDir = path.join(require("os").tmpdir(), "weaver-pro-ffmpeg-temp");
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

  // 오디오 길이(초)
  const audioSec = audioFiles?.length ? await probeDurationSec(audioFiles[0]).catch(() => 10) : 10;
  const audioMs = Math.max(1000, Math.floor(audioSec * 1000));

  // 씬별 길이
  const N = imageFiles?.length || 0;
  let perSceneMs = [];
  if (Array.isArray(sceneDurationsMs) && sceneDurationsMs.length === N) {
    perSceneMs = [...sceneDurationsMs];
  } else if (N > 0) {
    const base = Math.floor(audioMs / N);
    perSceneMs = Array.from({ length: N }, () => base);
    let diff = audioMs - perSceneMs.reduce((a, b) => a + b, 0);
    if (diff !== 0) perSceneMs[perSceneMs.length - 1] += diff;
  }

  // 개별 클립 생성
  const videoClips = [];
  let totalVideoSec = 0;

  for (let i = 0; i < N; i++) {
    const img = imageFiles[i];
    const durSec = Math.max(0.2, (perSceneMs[i] || audioMs / N) / 1000);
    const clipOut = path.join(tempDir, `clip_${String(i).padStart(3, "0")}_${Date.now()}.mp4`);

    totalVideoSec += durSec;

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
      String(options.preset ?? "veryfast"),
      "-crf",
      String(options.crf ?? 23),
      "-r",
      String(fps),
      // 🔑 시크 품질 개선을 위한 키프레임 설정
      "-g",
      String(gop),
      "-keyint_min",
      String(gop),
      "-sc_threshold",
      "0",
      "-force_key_frames",
      forceKFExpr,
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      clipOut,
    ];

    await new Promise((resolve, reject) => {
      const p = spawn(ffmpegPath, clipArgs, { windowsHide: true });
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`클립 생성 실패(code=${c})`))));
      p.on("error", reject);
    });

    videoClips.push(clipOut);
    onMakeClipProgress && onMakeClipProgress(i + 1, N);
  }

  // 총 길이 보정: 비디오가 오디오보다 짧으면 마지막 클립 연장
  if (totalVideoSec < audioSec && videoClips.length > 0) {
    const lastIdx = videoClips.length - 1;
    const need = audioSec - totalVideoSec + 1.0; // 여유 1초
    const newDurSec = Math.max(0.2, (perSceneMs[lastIdx] || audioMs / N) / 1000 + need);
    const newClipOut = path.join(tempDir, `clip_${String(lastIdx).padStart(3, "0")}_extended_${Date.now()}.mp4`);

    const vfChain = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
    const extendArgs = [
      "-y",
      "-hide_banner",
      "-loop",
      "1",
      "-i",
      imageFiles[lastIdx],
      "-t",
      newDurSec.toFixed(3),
      "-vf",
      vfChain,
      "-c:v",
      "libx264",
      "-preset",
      String(options.preset ?? "veryfast"),
      "-crf",
      String(options.crf ?? 23),
      "-r",
      String(fps),
      "-g",
      String(gop),
      "-keyint_min",
      String(gop),
      "-sc_threshold",
      "0",
      "-force_key_frames",
      forceKFExpr,
      "-movflags",
      "+faststart",
      "-avoid_negative_ts",
      "make_zero",
      newClipOut,
    ];
    await new Promise((resolve, reject) => {
      const p = spawn(ffmpegPath, extendArgs, { windowsHide: true });
      p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`확장 클립 생성 실패(code=${c})`))));
      p.on("error", reject);
    });
    videoClips[lastIdx] = newClipOut;
  }

  // concat 리스트
  const listFile = path.join(tempDir, `concat_${Date.now()}.txt`);
  await fsp.writeFile(listFile, videoClips.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"), "utf8");

  // 메인 인자
  const args = ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", listFile];

  if (audioFiles?.length) args.push("-i", audioFiles[0]);

  // 매핑
  if (audioFiles?.length) args.push("-map", "0:v", "-map", "1:a");
  else args.push("-map", "0:v");

  // 자막 필터
  let vf = "format=yuv420p";
  if (subtitlePath && fs.existsSync(subtitlePath)) {
    const srt = subtitlePath.replace(/\\/g, "/").replace(/:/g, "\\:");
    const style = "FontName=Malgun Gothic,Outline=2,BorderStyle=3,Shadow=0";
    vf = `subtitles='${srt}':charenc=UTF-8:force_style='${style}',` + vf;
  }

  // 최종 인코딩 (출력 길이를 오디오 길이로 '정확히' 고정)
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
    String(options.preset ?? "veryfast"),
    "-r",
    String(fps),
    "-g",
    String(gop),
    "-keyint_min",
    String(gop),
    "-sc_threshold",
    "0",
    "-force_key_frames",
    forceKFExpr,
    "-movflags",
    "+faststart",
    "-avoid_negative_ts",
    "make_zero"
  );

  if (audioFiles?.length) {
    args.push("-c:a", options.audioCodec || "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2");
    // ❌ -shortest 제거
    // ✅ 출력 자체 길이를 오디오로 고정
    args.push("-t", audioSec.toFixed(3));
  }

  args.push(outputPath);
  return args;
}

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
          const h = +m[1],
            mi = +m[2],
            se = +m[3];
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
      resolve({ success: code === 0 || isCheck, output: out || err, duration: extractDuration(err), size: 0 });
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
  const h = +m[1],
    mi = +m[2],
    s = +m[3],
    cs = +m[4];
  return h * 3600 + mi * 60 + s + cs / 100;
}

module.exports = { register };
