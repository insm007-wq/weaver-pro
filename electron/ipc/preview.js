// electron/ipc/preview.js
// -----------------------------------------------------------------------------
// Preview (Draft Export) IPC
// - 저해상도 프리뷰 합성, 취소, 진행률 이벤트 송신
// - ffmpeg 바이너리는 PATH 에 있거나, settings.get("ffmpegPath") 로 지정 가능
// -----------------------------------------------------------------------------
// 채널:
//   invoke:  preview:compose(payload)  -> { url, path, duration }
//            preview:cancel({ jobId })
//   send:    preview:progress           -> { jobId, phase, percent, time, etaSec, message }
// -----------------------------------------------------------------------------

const { ipcMain, app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// 프로젝트 내 다른 ipc 모듈과의 일관성을 위해 settings 모듈을 선택 로드
let settingsApi = null;
try {
  settingsApi = require("./settings");
} catch (_) {
  /* optional */
}

// ============================
// 내부 상태 & 유틸
// ============================
const JOBS = new Map(); // jobId -> { proc, webContentsId, output, listFile, srtFile, durationSec }

function getFfmpegPath() {
  // 1) 앱 설정에 지정되어 있으면 최우선
  const ff = settingsApi?.get?.("ffmpegPath");
  if (ff && fs.existsSync(ff)) return ff;

  // 2) 프로젝트에 번들된 ffmpeg-static 우선 사용
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  } catch (_) {}

  // 3) 마지막으로 PATH 의 ffmpeg 시도
  return os.platform() === "win32" ? "ffmpeg.exe" : "ffmpeg";
}

function appCacheDir() {
  const dir = path.join(app.getPath("userData"), "preview-cache");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function randomId(prefix = "job") {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function toFileUrl(p) {
  let rp = path.resolve(p);
  // Windows 경로 file:// 처리
  if (os.platform() === "win32") {
    rp = rp.replace(/\\/g, "/");
    return `file:///${rp}`;
  }
  return `file://${rp}`;
}

function secToTimecode(secFloat) {
  const sec = Math.max(0, Math.floor(secFloat || 0));
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function parseFfmpegTime(line) {
  // stderr 의 time=00:00:12.34 포맷 파싱
  const m = /time=(\d+):(\d+):(\d+(\.\d+)?)/.exec(line);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mi = parseInt(m[2], 10);
  const s = parseFloat(m[3]);
  return h * 3600 + mi * 60 + s;
}

async function writeConcatListFile(scenes, filepath) {
  // concat demuxer용 입력 리스트 생성 (video 파일 전용)
  // 파일명에 따옴표 포함 가능 → 안전하게 단일따옴표 감싸기
  const lines = scenes
    .map((sc) => sc?.asset?.path || sc?.path)
    .filter(Boolean)
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await fsp.writeFile(filepath, lines, "utf8");
}

function buildScalePadFilter(width, height) {
  // 원본 비율 유지 + 패딩, 최종 yuv420p
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
}

async function writeSrtFileFromCues(cues, filepath) {
  // cues = [{start(ms), end(ms), text}]
  const msToSrt = (ms) => {
    const total = Math.max(0, Math.floor(ms));
    const h = String(Math.floor(total / 3600000)).padStart(2, "0");
    const m = String(Math.floor((total % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
    const ms3 = String(total % 1000).padStart(3, "0");
    return `${h}:${m}:${s},${ms3}`;
  };
  let idx = 1;
  const parts = [];
  for (const cue of cues || []) {
    parts.push(String(idx++));
    parts.push(`${msToSrt(cue.start)} --> ${msToSrt(cue.end)}`);
    parts.push((cue.text || "").replace(/\r?\n/g, "\n"));
    parts.push(""); // 빈 줄
  }
  await fsp.writeFile(filepath, parts.join("\n"), "utf8");
}

function sendProgress(webContentsId, payload) {
  const wc = BrowserWindow.getAllWindows()
    .map((w) => w.webContents)
    .find((c) => c.id === webContentsId);
  if (wc && !wc.isDestroyed()) {
    wc.send("preview:progress", payload);
  }
}

// ============================
// 핵심: 프리뷰 합성
// ============================
async function composePreview(event, payload) {
  const {
    scenes = [], // [{asset:{path}, start, end}]
    cues = [], // [{start, end, text}] (ms)
    width = 1280,
    height = 720,
    bitrateK = 1200, // kbps
    burnSubtitles = false, // true면 하드섭
    durationSec, // 전체 길이를 알고 있으면 진행률 계산 정확도 ↑
    jobId = randomId("preview"),
    outputName, // 선택: 파일명 지정
  } = payload || {};

  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error(
      "scenes 배열이 비어 있습니다. 최소 1개 이상의 비디오가 필요합니다."
    );
  }

  // 입력이 모두 비디오라고 가정 (이미지 → 클립 변환은 별도 고도화 영역)
  const outDir = appCacheDir();
  const outPath = path.join(
    outDir,
    outputName || `preview_${Date.now()}_${Math.floor(Math.random() * 1e4)}.mp4`
  );
  const listFile = path.join(outDir, `${jobId}.concat.txt`);

  await writeConcatListFile(scenes, listFile);

  const ffmpegPath = getFfmpegPath();
  const vf = buildScalePadFilter(width, height);
  const baseArgs = [
    "-y",
    "-hide_banner",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-b:v",
    `${bitrateK}k`,
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart",
  ];

  let srtFile = null;
  if (burnSubtitles && cues?.length) {
    srtFile = path.join(outDir, `${jobId}.subs.srt`);
    await writeSrtFileFromCues(cues, srtFile);
    // Windows ffmpeg subtitles 필터 경로는 슬래시로
    const srtForFfmpeg =
      os.platform() === "win32" ? srtFile.replace(/\\/g, "/") : srtFile;
    baseArgs.splice(
      baseArgs.indexOf("-vf") + 1,
      0,
      `subtitles='${srtForFfmpeg.replace(/'/g, "'\\''")}'`
    ); // subtitles 필터를 scale/pad 앞에 넣고 싶다면 위치 조정
  }

  baseArgs.push(outPath);

  const proc = spawn(ffmpegPath, baseArgs, { windowsHide: true });
  const webContentsId = event?.sender?.id;

  JOBS.set(jobId, {
    proc,
    webContentsId,
    output: outPath,
    listFile,
    srtFile,
    durationSec: durationSec || null,
  });

  sendProgress(webContentsId, {
    jobId,
    phase: "start",
    percent: 0,
    message: "프리뷰 렌더링 시작",
  });

  let lastTime = 0;

  proc.stderr.on("data", (buf) => {
    const line = String(buf);
    const t = parseFfmpegTime(line);
    if (t != null) {
      lastTime = t;
      const job = JOBS.get(jobId);
      const total = job?.durationSec || payload?.durationSec || 0;
      const percent =
        total > 0
          ? Math.max(0, Math.min(100, Math.floor((t / total) * 100)))
          : 0;
      const eta = total > 0 ? Math.max(0, Math.floor(total - t)) : undefined;
      sendProgress(webContentsId, {
        jobId,
        phase: "encoding",
        time: t,
        percent,
        etaSec: eta,
      });
    }
  });

  const onClose = async (code, signal) => {
    const job = JOBS.get(jobId);
    // 중간 파일 정리(목록, srt)
    try {
      if (job?.listFile && fs.existsSync(job.listFile))
        await fsp.unlink(job.listFile);
      if (job?.srtFile && fs.existsSync(job.srtFile))
        await fsp.unlink(job.srtFile);
    } catch (_) {}

    if (code === 0) {
      sendProgress(webContentsId, {
        jobId,
        phase: "done",
        percent: 100,
        time: lastTime,
        message: "프리뷰 렌더링 완료",
      });
      JOBS.delete(jobId);
      return {
        url: toFileUrl(outPath),
        path: outPath,
        duration: lastTime || null,
      };
    } else {
      const msg =
        signal === "SIGTERM"
          ? "사용자에 의해 취소됨"
          : `ffmpeg 종료 코드 ${code}`;
      sendProgress(webContentsId, {
        jobId,
        phase: "error",
        percent: 0,
        message: msg,
      });
      JOBS.delete(jobId);
      throw new Error(msg);
    }
  };

  return await new Promise((resolve, reject) => {
    proc.on("close", (code, signal) => {
      onClose(code, signal).then(resolve).catch(reject);
    });
    proc.on("error", (err) => {
      sendProgress(webContentsId, {
        jobId,
        phase: "error",
        percent: 0,
        message: err?.message || String(err),
      });
      JOBS.delete(jobId);
      reject(err);
    });
  });
}

async function cancelPreview(_event, { jobId }) {
  const job = JOBS.get(jobId);
  if (!job) return { ok: false, message: "해당 jobId를 찾을 수 없습니다." };
  try {
    job.proc.kill("SIGTERM");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
}

// ============================
// Public API: register
// ============================
function register() {
  // 중복 등록 방지
  try {
    ipcMain.removeHandler("preview:compose");
    ipcMain.removeHandler("preview:cancel");
  } catch (_) {}

  ipcMain.handle("preview:compose", async (event, payload) => {
    return await composePreview(event, payload || {});
  });

  ipcMain.handle("preview:cancel", async (event, payload) => {
    return await cancelPreview(event, payload || {});
  });

  // 앱 종료 시 작업 정리
  app.on("before-quit", () => {
    for (const [jobId, job] of JOBS.entries()) {
      try {
        job.proc.kill("SIGTERM");
      } catch (_) {}
      JOBS.delete(jobId);
      try {
        if (job.listFile && fs.existsSync(job.listFile))
          fs.unlinkSync(job.listFile);
        if (job.srtFile && fs.existsSync(job.srtFile))
          fs.unlinkSync(job.srtFile);
      } catch (_) {}
    }
  });

  console.log("[ipc] preview: registered");
}

module.exports = {
  register,
};
