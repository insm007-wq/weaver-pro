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

// music-metadata를 안전하게 로드 (ES 모듈 처리)
let mm = null;
async function loadMusicMetadata() {
  try {
    if (!mm) {
      mm = await import("music-metadata");
      console.log("✅ music-metadata 로드 성공");
    }
    return mm;
  } catch (error) {
    console.warn("⚠️ music-metadata 로드 실패:", error.message);
    return null;
  }
}

// HEX 색상을 FFmpeg RGB 형식으로 변환하는 헬퍼 함수
// 예: #FF0000 (빨강) -> 0xFF0000
function hexToFFmpegColor(hex) {
  hex = hex.replace('#', '');
  return `0x${hex}`;
}

// HEX 색상을 투명도와 함께 FFmpeg RGBA 형식으로 변환
// 예: #000000, 0.8 -> 0x000000@0.8
function hexToFFmpegColorWithAlpha(hex, alpha) {
  hex = hex.replace('#', '');
  return `0x${hex}@${alpha}`;
}

// SRT 타임스탬프를 초 단위로 변환하는 함수
// 예: "00:00:01,500" -> 1.5
function srtTimestampToSeconds(timestamp) {
  const match = timestamp.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (!match) return 0;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4], 10);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

// SRT 파일 파싱 함수
function parseSRT(srtContent) {
  const subtitles = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // 첫 줄: 인덱스 (무시)
    // 둘째 줄: 타임스탬프
    const timingMatch = lines[1].match(/(\S+)\s+-->\s+(\S+)/);
    if (!timingMatch) continue;

    const startTime = srtTimestampToSeconds(timingMatch[1]);
    const endTime = srtTimestampToSeconds(timingMatch[2]);

    // 나머지 줄: 텍스트 (줄바꿈 유지)
    const text = lines.slice(2).join('\n');

    subtitles.push({ startTime, endTime, text });
  }

  return subtitles;
}

// drawtext 필터 생성 함수 (CSS 스타일을 FFmpeg drawtext로 변환)
function createDrawtextFilter(subtitle, subtitleSettings, videoWidth = 1920, videoHeight = 1080) {
  const {
    fontFamily = "malgun-gothic",
    fontSize = 24,
    fontWeight = 600,
    textColor = "#FFFFFF",
    backgroundColor = "#000000",
    backgroundOpacity = 80,
    outlineColor = "#000000",
    outlineWidth = 2,
    shadowColor = "#000000",
    shadowOffset = 2,
    shadowBlur = 4,
    position = "bottom",
    horizontalAlign = "center",
    verticalPadding = 40,
    horizontalPadding = 20,
    finePositionOffset = 0,
    useBackground = true,
    backgroundRadius = 8,
    useOutline = true,
    useShadow = true,
    letterSpacing = 0,
    maxLines = 2,
    maxWidth = 80,
  } = subtitleSettings;

  // 텍스트를 maxLines와 maxWidth에 맞게 분할
  let displayText = subtitle.text;

  // 줄바꿈이 없으면 자동으로 분할
  if (!displayText.includes('\n')) {
    // 간단한 줄바꿈 로직: 문자 수 기준으로 분할
    const maxCharsPerLine = Math.floor(maxWidth * 0.5); // maxWidth 80% ≈ 40자
    const words = displayText.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    displayText = lines.slice(0, maxLines).join('\n');
  } else {
    // 이미 줄바꿈이 있으면 maxLines만 적용
    const lines = displayText.split('\n');
    if (lines.length > maxLines) {
      displayText = lines.slice(0, maxLines).join('\n');
    }
  }

  // FFmpeg drawtext용 텍스트 이스케이프
  // 1. 작은따옴표는 \' 로 이스케이프
  // 2. 콜론은 \: 로 이스케이프
  // 3. 줄바꿈은 \n (백슬래시 하나 + n) 으로 변환
  displayText = displayText
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/\n/g, "\\n");

  // 폰트 파일 매핑 (시스템 폰트 사용)
  const fontMap = {
    "noto-sans": "NotoSansKR-Regular.otf",
    "malgun-gothic": "malgun.ttf",
    "apple-sd-gothic": "AppleSDGothicNeo.ttc",
    "nanumgothic": "NanumGothic.ttf",
    "arial": "arial.ttf",
    "helvetica": "Helvetica.ttf",
    "roboto": "Roboto-Regular.ttf",
  };
  const fontFile = fontMap[fontFamily] || "malgun.ttf";

  // 텍스트 색상
  const textColorHex = hexToFFmpegColor(textColor);

  // X 위치 계산
  let xPos;
  if (horizontalAlign === "center") {
    xPos = "(w-text_w)/2";
  } else if (horizontalAlign === "left") {
    xPos = `${horizontalPadding}`;
  } else { // right
    xPos = `w-text_w-${horizontalPadding}`;
  }

  // Y 위치 계산 (프리뷰 CSS와 동일한 로직)
  let yPos;
  if (position === "bottom") {
    yPos = `h-${verticalPadding}-text_h+${finePositionOffset}`;
  } else if (position === "top") {
    yPos = `${verticalPadding}-${finePositionOffset}`;
  } else { // center
    yPos = `(h-text_h)/2+${finePositionOffset}`;
  }

  // drawtext 옵션 배열
  const options = [
    `text='${displayText}'`,
    `fontfile='${fontFile}'`,
    `fontsize=${fontSize}`,
    `fontcolor=${textColorHex}`,
    `x=${xPos}`,
    `y=${yPos}`,
    `enable='between(t,${subtitle.startTime},${subtitle.endTime})'`,
  ];

  console.log(`[drawtext 설정] fontSize: ${fontSize}, maxLines: ${maxLines}, 텍스트 미리보기: "${displayText.substring(0, 50)}..."`);

  // 외곽선 (borderw, bordercolor)
  if (useOutline && outlineWidth > 0) {
    options.push(`borderw=${outlineWidth}`);
    options.push(`bordercolor=${hexToFFmpegColor(outlineColor)}`);
  }

  // 그림자 (shadowx, shadowy, shadowcolor)
  if (useShadow && shadowOffset > 0) {
    options.push(`shadowx=${shadowOffset}`);
    options.push(`shadowy=${shadowOffset}`);
    options.push(`shadowcolor=${hexToFFmpegColor(shadowColor)}`);
  }

  // 배경 (box, boxcolor, boxborderw)
  if (useBackground) {
    const bgAlpha = backgroundOpacity / 100;
    options.push(`box=1`);
    options.push(`boxcolor=${hexToFFmpegColorWithAlpha(backgroundColor, bgAlpha)}`);
    options.push(`boxborderw=${Math.round(fontSize * 0.2)}`); // 패딩: 폰트 크기의 20%
  }

  // 글자 간격은 FFmpeg drawtext에서 직접 지원하지 않음 (무시)

  return `drawtext=${options.join(':')}`;
}

// 음성 파일의 duration을 가져오는 함수 (FFmpeg 사용)
async function getAudioDuration(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    // FFmpeg를 사용하여 duration 측정
    const duration = await probeDurationSec(filePath);

    if (typeof duration !== "number" || isNaN(duration) || duration <= 0) {
      throw new Error("유효하지 않은 음성 파일 길이입니다");
    }

    return duration;
  } catch (error) {
    console.error("음성 파일 길이 가져오기 실패:", error);
    throw error;
  }
}

// ffmpeg-static: ASAR 패키징 대응
let ffmpegPath;
try {
  ffmpegPath = require("ffmpeg-static");

  // ASAR 패키징된 경우, app.asar를 app.asar.unpacked로 변경
  if (ffmpegPath && ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    console.log("[ffmpeg] ASAR unpacked path:", ffmpegPath);
  }

  console.log("[ffmpeg] ffmpeg-static path:", ffmpegPath);
} catch (err) {
  console.error("[ffmpeg] Failed to load ffmpeg-static:", err);
  // 폴백: 하드코딩된 경로 (unpacked 사용)
  const appPath = app.getAppPath();
  if (appPath.includes('app.asar')) {
    ffmpegPath = path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  } else {
    ffmpegPath = path.join(__dirname, "..", "..", "node_modules", "ffmpeg-static", "ffmpeg.exe");
  }
}

// ffprobe 사용 가능하면 최우선
let ffprobePath = null;
try {
  ffprobePath = require("ffprobe-static").path;
} catch {
  ffprobePath = null;
}

// 현재 실행 중인 FFmpeg 프로세스 (취소용)
let currentFfmpegProcess = null;
let isExportCancelled = false;

// ----------------------------------------------------------------------------
// 등록
// ----------------------------------------------------------------------------
function register() {
  try {
    ipcMain.removeHandler("ffmpeg:compose");
    ipcMain.removeHandler("ffmpeg:check");
    ipcMain.removeHandler("ffmpeg:duration");
    ipcMain.removeHandler("audio:getDuration");
    ipcMain.removeHandler("audio:getDurations");
    ipcMain.removeHandler("video:export");
    ipcMain.removeHandler("video:cancelExport");
  } catch {}

  ipcMain.handle("ffmpeg:compose", async (event, { audioFiles, imageFiles, outputPath, subtitlePath = null, sceneDurationsMs = null, options = {} }) => {
    try {
      console.log(`\n🎬 영상 합성 시작: ${imageFiles?.length || 0}개 씬`);
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
  });

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

  // 음성 파일 duration 가져오기 IPC 핸들러
  ipcMain.handle("audio:getDuration", async (event, { filePath }) => {
    try {
      if (!filePath) {
        return { success: false, error: "파일 경로가 필요합니다" };
      }

      const duration = await getAudioDuration(filePath);
      return { success: true, duration };
    } catch (error) {
      console.error("음성 파일 길이 가져오기 실패:", error);
      return { success: false, error: error.message };
    }
  });

  // 여러 음성 파일의 duration을 한번에 가져오기
  ipcMain.handle("audio:getDurations", async (event, { filePaths }) => {
    try {
      if (!Array.isArray(filePaths)) {
        return { success: false, error: "파일 경로 배열이 필요합니다" };
      }

      const results = [];
      for (const filePath of filePaths) {
        try {
          const duration = await getAudioDuration(filePath);
          results.push({ filePath, duration, success: true });
        } catch (error) {
          results.push({ filePath, duration: 0, success: false, error: error.message });
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error("여러 음성 파일 길이 가져오기 실패:", error);
      return { success: false, error: error.message };
    }
  });

  // 씬 기반 전체 프로젝트 내보내기
  ipcMain.handle("video:export", async (event, scenes) => {
    try {
      // 취소 플래그 초기화
      isExportCancelled = false;
      currentFfmpegProcess = null;

      console.log(`\n🎬 비디오 내보내기 시작: ${scenes.length}개 씬`);

      // videoSaveFolder 가져오기
      const videoSaveFolder = store.get("videoSaveFolder");
      if (!videoSaveFolder) {
        throw new Error("비디오 저장 폴더가 설정되지 않았습니다.");
      }

      // output 폴더 생성
      const outputFolder = path.join(videoSaveFolder, "output");
      await fsp.mkdir(outputFolder, { recursive: true });

      // 출력 파일명 (타임스탬프 포함)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const outputPath = path.join(outputFolder, `video_${timestamp}.mp4`);

      // SRT 자막 파일 생성
      const srtPath = path.join(outputFolder, `subtitle_${timestamp}.srt`);
      await generateSrtFromScenes(scenes, srtPath);

      // 개별 TTS 오디오 파일 경로 구성
      const audioFolder = path.join(videoSaveFolder, "audio", "parts");
      const audioFiles = [];
      let totalAudioDurationMs = 0;

      // ✅ 1. 개별 오디오 파일 수집 및 길이 측정
      for (let i = 0; i < scenes.length; i++) {
        const sceneNum = i + 1;
        const fileName = `scene-${String(sceneNum).padStart(3, "0")}.mp3`;
        const filePath = path.join(audioFolder, fileName);

        if (fs.existsSync(filePath)) {
          audioFiles.push(filePath);
          try {
            const duration = await probeDurationSec(filePath);
            totalAudioDurationMs += Math.floor(duration * 1000);
            console.log(`✅ ${sceneNum}번 오디오: ${duration.toFixed(2)}초`);
          } catch (error) {
            console.error(`씬 ${sceneNum} 오디오 길이 측정 실패:`, error);
            totalAudioDurationMs += 3000; // 기본값 3초
          }
        } else {
          console.warn(`⚠️ 씬 ${sceneNum} 오디오 파일 없음: ${filePath}`);
          totalAudioDurationMs += 3000; // 기본값 3초
        }
      }

      if (audioFiles.length === 0) {
        throw new Error("사용 가능한 오디오 파일이 없습니다.");
      }

      console.log(`📊 총 오디오 길이: ${(totalAudioDurationMs / 1000).toFixed(2)}초 (${audioFiles.length}개 파일 합산)`);

      // ✅ 2. 씬별 미디어 파일 추출 및 개별 오디오 duration 계산
      const mediaFiles = [];
      const individualSceneDurationsMs = [];

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];

        // 미디어 파일 경로
        if (!scene.asset?.path) {
          throw new Error(`씬 ${i + 1}에 미디어가 없습니다.`);
        }
        mediaFiles.push(scene.asset.path);

        // 오디오 duration으로 씬 길이 결정
        if (scene.audioPath && fs.existsSync(scene.audioPath)) {
          try {
            const duration = await probeDurationSec(scene.audioPath);
            individualSceneDurationsMs.push(Math.floor(duration * 1000));
          } catch (error) {
            console.error(`씬 ${i + 1} 오디오 duration 측정 실패:`, error);
            individualSceneDurationsMs.push(3000); // 기본 3초
          }
        } else {
          console.warn(`씬 ${i + 1}에 오디오 파일이 없습니다.`);
          individualSceneDurationsMs.push(3000); // 기본 3초
        }
      }

      // ✅ 3. 개별 씬 오디오 합계와 전체 오디오 길이 비교하여 조정
      const sumOfIndividualDurationsMs = individualSceneDurationsMs.reduce((sum, dur) => sum + dur, 0);

      // ✅ 안전 여유 추가 (약간의 오차 보정용)
      const SAFETY_MARGIN_MS = 500; // 0.5초 여유
      const targetDurationMs = totalAudioDurationMs + SAFETY_MARGIN_MS;

      let sceneDurationsMs = [];
      if (sumOfIndividualDurationsMs > 0) {
        // 항상 목표 길이(오디오 + 여유)에 맞춰 조정
        const ratio = targetDurationMs / sumOfIndividualDurationsMs;

        sceneDurationsMs = individualSceneDurationsMs.map((dur) => Math.floor(dur * ratio));

        // 반올림 오차 보정 (마지막 씬에 추가/차감)
        const adjustedSum = sceneDurationsMs.reduce((sum, dur) => sum + dur, 0);
        const diff = targetDurationMs - adjustedSum;
        if (diff !== 0) {
          sceneDurationsMs[sceneDurationsMs.length - 1] += diff;
        }

        console.log(`📊 씬 duration 조정: ${(sumOfIndividualDurationsMs / 1000).toFixed(1)}s → ${(targetDurationMs / 1000).toFixed(1)}s (비율: ${ratio.toFixed(3)})`);
      } else {
        sceneDurationsMs = individualSceneDurationsMs;
      }


      // FFmpeg로 영상 합성
      const result = await composeVideoFromScenes({
        event,
        scenes,
        mediaFiles,
        audioFiles,
        outputPath,
        srtPath,
        sceneDurationsMs,
      });

      if (result.success) {
        console.log("✅ 비디오 내보내기 성공:", outputPath);
        return { success: true, outputPath };
      } else {
        throw new Error(result.error || "비디오 합성 실패");
      }
    } catch (error) {
      console.error("❌ 비디오 내보내기 실패:", error);
      return { success: false, error: error.message };
    } finally {
      // 완료 또는 실패 시 취소 플래그 리셋
      isExportCancelled = false;
      currentFfmpegProcess = null;
    }
  });

  // 영상 내보내기 취소
  ipcMain.handle("video:cancelExport", async () => {
    try {
      console.log("🚫 영상 내보내기 취소 요청");
      isExportCancelled = true;

      if (currentFfmpegProcess) {
        try {
          currentFfmpegProcess.kill("SIGKILL");
          console.log("✅ FFmpeg 프로세스 종료");
        } catch (error) {
          console.error("FFmpeg 프로세스 종료 실패:", error);
        }
      }

      return { success: true };
    } catch (error) {
      console.error("영상 내보내기 취소 실패:", error);
      return { success: false, error: error.message };
    }
  });

  console.log("[ipc] ffmpeg: registered");
}

// ----------------------------------------------------------------------------
// 임시 파일 정리 함수
// ----------------------------------------------------------------------------
async function cleanupTempFiles(tempDir) {
  try {
    const files = await fsp.readdir(tempDir);
    let deletedCount = 0;

    for (const file of files) {
      if (file.startsWith("concat_") || file.startsWith("clip_") || file.startsWith("scene_")) {
        try {
          await fsp.unlink(path.join(tempDir, file));
          deletedCount++;
        } catch (error) {
          console.warn(`임시 파일 삭제 실패: ${file}`);
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ 임시 파일 ${deletedCount}개 정리 완료`);
    }
  } catch (error) {
    console.warn(`임시 파일 정리 중 오류:`, error.message);
  }
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
  const MIN_CLIP_DURATION = 0.25; // 최소 클립 길이

  let tempDir;
  try {
    tempDir = path.join(app.getPath("userData"), "ffmpeg-temp");
  } catch {
    const os = require("os");
    tempDir = path.join(os.tmpdir(), "weaver-pro-ffmpeg-temp");
  }
  await fsp.mkdir(tempDir, { recursive: true });
  await cleanupTempFiles(tempDir);

  // ✅ 입력 검증
  if (!imageFiles || imageFiles.length === 0) {
    throw new Error("이미지 파일이 없습니다");
  }

  console.log(`\n🎬 FFmpeg 영상 생성 시작:`);
  console.log(`   - 씬 개수: ${imageFiles.length}개`);
  console.log(`   - 자막: ${subtitlePath ? "있음" : "없음"}`);

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
    if (!img || typeof img !== "string") {
      console.warn(`⚠️ 유효하지 않은 이미지 파일: 인덱스 ${i}`);
      continue;
    }

    const durSec = Math.max(MIN_CLIP_DURATION, (perSceneMs[i] || totalAudioMs / N) / 1000);
    const clipOut = path.join(tempDir, `clip_${String(i).padStart(3, "0")}_${Date.now()}.mp4`);

    // 로그는 10개씩 묶어서 출력
    if (i === 0 || (i + 1) % 10 === 0 || i === N - 1) {
      console.log(`📹 클립 생성 중: ${i + 1}/${N}`);
    }

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
      "+genpts+discardcorrupt",
      clipOut,
    ];

    try {
      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, clipArgs, { windowsHide: true });
        let stderr = "";
        let completed = false;

        // 타임아웃 설정 (30초)
        const timeout = setTimeout(() => {
          if (!completed) {
            completed = true;
            try {
              proc.kill();
            } catch {}
            reject(new Error(`클립 ${i + 1} 생성 타임아웃 (30초 초과)`));
          }
        }, 30000);

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
          // 메모리 최적화: 버퍼가 너무 커지면 앞부분 제거
          if (stderr.length > 10000) {
            stderr = stderr.slice(-5000);
          }
        });

        proc.on("close", (code) => {
          if (completed) return;
          completed = true;
          clearTimeout(timeout);

          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`클립 ${i + 1} 생성 실패 (코드: ${code})\n${stderr.slice(-500)}`));
          }
        });

        proc.on("error", (error) => {
          if (completed) return;
          completed = true;
          clearTimeout(timeout);
          reject(new Error(`클립 ${i + 1} 프로세스 오류: ${error.message}`));
        });
      });

      // ✅ 실제 길이 확인
      const realSec = await probeDurationSec(clipOut);
      totalVideoSec += realSec;

      // 진행 상황 로그 (10개씩 또는 마지막)
      if ((i + 1) % 10 === 0 || i === N - 1) {
        console.log(`   ✅ ${i + 1}개 완료 (누적: ${totalVideoSec.toFixed(1)}s)`);
      }
    } catch (error) {
      console.error(`❌ 클립 ${i + 1} 생성 실패:`, error.message);
      throw new Error(`클립 생성 중단: ${error.message}`);
    }

    videoClips.push(clipOut);
    if (onMakeClipProgress) onMakeClipProgress(i + 1, N);
  }

  // ✅ tpad 제거: 각 씬이 정확한 길이로 생성되므로 불필요
  console.log(`\n📊 비디오 길이 확인:`);
  console.log(`   - 비디오 총 길이: ${totalVideoSec.toFixed(2)}초`);
  console.log(`   - 오디오 총 길이: ${totalAudioSec.toFixed(2)}초`);
  console.log(`   - 차이: ${(totalVideoSec - totalAudioSec).toFixed(2)}초`);

  if (totalVideoSec < totalAudioSec - 0.5) {
    console.warn(`⚠️ 경고: 비디오가 오디오보다 ${(totalAudioSec - totalVideoSec).toFixed(2)}초 짧습니다.`);
    console.warn(`   마지막 영상이 반복 재생되지 않을 수 있습니다.`);
  }

  // ✅ 최종 검증
  if (videoClips.length === 0) {
    throw new Error("생성된 비디오 클립이 없습니다");
  }

  console.log(`\n📊 최종 통계:`);
  console.log(`   - 클립 개수: ${videoClips.length}개`);
  console.log(`   - 오디오 길이: ${totalAudioSec.toFixed(2)}초`);
  console.log(`   - 비디오 길이: ${totalVideoSec.toFixed(2)}초`);
  console.log(`   - 차이: ${(totalVideoSec - totalAudioSec).toFixed(2)}초`);

  if (totalVideoSec < totalAudioSec - 0.5) {
    console.error(`\n⚠️⚠️⚠️ 경고: 비디오가 오디오보다 ${(totalAudioSec - totalVideoSec).toFixed(2)}초 짧습니다!`);
    console.error(`   이 상태로 인코딩하면 끝부분에서 영상이 멈추고 음성만 나옵니다.`);
    throw new Error(`비디오(${totalVideoSec.toFixed(2)}초)가 오디오(${totalAudioSec.toFixed(2)}초)보다 짧습니다.`);
  } else if (totalVideoSec >= totalAudioSec) {
    console.log(`   ✅ 비디오가 오디오를 완전히 커버합니다.`);
  }

  // ✅ filter_complex 기반 concat으로 PTS 불일치 방지
  const args = ["-y", "-hide_banner"];

  // 모든 클립을 입력으로 추가
  videoClips.forEach((clip) => {
    args.push("-i", clip);
  });

  // 오디오 파일 추가
  const audioInputIndex = videoClips.length;
  if (audioFiles && audioFiles.length > 0) {
    args.push("-i", audioFiles[0]);
  }

  // filter_complex로 concat (PTS 안정화)
  let filterInputs = videoClips.map((_, i) => `[${i}:v]`).join("");
  let filterComplex = `${filterInputs}concat=n=${videoClips.length}:v=1:a=0[outv]`;

  // 자막 필터 통합 (drawtext 사용)
  let finalVideoLabel = "[outv]";
  if (subtitlePath && fs.existsSync(subtitlePath)) {
    console.log(`✅ 자막 파일 확인: ${subtitlePath}`);

    // 전역 자막 설정 로드
    const subtitleSettings = store.get("subtitleSettings", {
      fontFamily: "malgun-gothic",
      fontSize: 24,
      position: "bottom",
      horizontalAlign: "center",
      useOutline: true,
      outlineWidth: 2,
      useShadow: false,
      verticalPadding: 40,
      maxLines: 2,
    });

    console.log(`[자막 설정 전체] ${JSON.stringify(subtitleSettings, null, 2)}`);

    // SRT 파일 읽기 및 파싱
    const srtContent = fs.readFileSync(subtitlePath, 'utf-8');
    const subtitles = parseSRT(srtContent);

    console.log(`📝 파싱된 자막 수: ${subtitles.length}개`);

    if (subtitles.length > 0) {
      // drawtext 필터 체인 생성
      let currentLabel = "[outv]";
      const videoWidth = 1920;
      const videoHeight = 1080;

      subtitles.forEach((subtitle, index) => {
        const drawtextFilter = createDrawtextFilter(subtitle, subtitleSettings, videoWidth, videoHeight);
        const nextLabel = index === subtitles.length - 1 ? "[v]" : `[dt${index}]`;

        filterComplex += `;${currentLabel}${drawtextFilter}${nextLabel}`;
        currentLabel = nextLabel;

        if (index === 0) {
          console.log(`[첫 자막 필터] ${drawtextFilter}`);
        }
      });

      filterComplex += `;[v]format=yuv420p[vf]`;
      finalVideoLabel = "[vf]";
    } else {
      console.warn("⚠️ 자막이 비어있습니다");
      filterComplex += `;[outv]format=yuv420p[v]`;
      finalVideoLabel = "[v]";
    }
  } else {
    // 자막 없으면 포맷만 적용
    filterComplex += `;[outv]format=yuv420p[v]`;
    finalVideoLabel = "[v]";
  }

  args.push("-filter_complex", filterComplex);

  // 맵핑
  args.push("-map", finalVideoLabel);
  if (audioFiles && audioFiles.length > 0) {
    args.push("-map", `${audioInputIndex}:a`);
  }

  args.push(
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
    // ✅ 타임스탬프 안정화 + corrupt 프레임 폐기
    "-avoid_negative_ts",
    "make_zero",
    "-fflags",
    "+genpts+discardcorrupt"
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
    // 취소 확인
    if (isExportCancelled) {
      console.log("✋ FFmpeg 실행 취소됨");
      return resolve({ success: false, error: "사용자에 의해 취소되었습니다" });
    }

    const timeoutMs = isCheck ? 10000 : 15 * 60 * 1000;
    const proc = spawn(ffmpegPath, args, { windowsHide: true });

    // 현재 프로세스 저장 (취소용)
    if (!isCheck) {
      currentFfmpegProcess = proc;
    }

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

    proc.stdout.on("data", (d) => {
      out += d.toString();
      // 메모리 최적화
      if (out.length > 10000) out = out.slice(-5000);
    });
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      err += s;
      // 메모리 최적화
      if (err.length > 10000) err = err.slice(-5000);
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

      // 현재 프로세스 초기화
      if (currentFfmpegProcess === proc) {
        currentFfmpegProcess = null;
      }

      if (code === 0 || isCheck) {
        resolve({ success: code === 0, output: out || err, duration: extractDuration(err), size: 0 });
      } else {
        // 취소로 인한 종료인지 확인
        if (isExportCancelled) {
          resolve({ success: false, error: "사용자에 의해 취소되었습니다" });
        } else {
          // ✅ stderr 로그 출력 (마지막 1000자)
          console.error(`❌ FFmpeg 실행 실패 (코드: ${code})`);
          console.error(`stderr:\n${err.slice(-1000)}`);
          resolve({ success: false, error: err || `FFmpeg exited with code ${code}` });
        }
      }
    });

    proc.on("error", (e) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      // 현재 프로세스 초기화
      if (currentFfmpegProcess === proc) {
        currentFfmpegProcess = null;
      }

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

// ----------------------------------------------------------------------------
// 씬에서 SRT 자막 파일 생성
// ----------------------------------------------------------------------------
async function generateSrtFromScenes(scenes, srtPath) {
  try {
    // ✅ 전체 오디오 길이 계산 (자막 sync 보정용)
    let totalAudioDuration = 0;
    for (const scene of scenes) {
      if (scene.audioPath && fs.existsSync(scene.audioPath)) {
        try {
          const duration = await probeDurationSec(scene.audioPath);
          totalAudioDuration += Math.floor(duration * 1000);
        } catch (error) {
          console.warn(`오디오 길이 측정 실패 (${scene.audioPath}):`, error.message);
          totalAudioDuration += 3000; // 기본값
        }
      } else {
        totalAudioDuration += 3000; // 기본값
      }
    }


    let srtContent = "";
    let accumulatedTime = 0; // ms

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      // 오디오 파일에서 duration 가져오기
      let durationMs = 3000; // 기본값
      if (scene.audioPath && fs.existsSync(scene.audioPath)) {
        try {
          const duration = await probeDurationSec(scene.audioPath);
          durationMs = Math.floor(duration * 1000);
        } catch (error) {
          console.error(`씬 ${i + 1} duration 측정 실패:`, error);
        }
      }

      // ✅ 자막 sync 보정: 오디오 길이를 초과하지 않도록 체크
      if (accumulatedTime + durationMs > totalAudioDuration) {
        console.warn(`⚠️ 씬 ${i + 1}: 자막이 오디오 길이를 초과하여 잘립니다.`);
        durationMs = Math.max(0, totalAudioDuration - accumulatedTime);
        if (durationMs <= 0) {
          console.warn(`⚠️ 씬 ${i + 1}: 자막 생성 중단 (오디오 길이 초과)`);
          break;
        }
      }

      const startTime = accumulatedTime;
      const endTime = accumulatedTime + durationMs;

      // SRT 형식: 시:분:초,밀리초
      const formatTime = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const hours = Math.floor(totalSec / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        const milliseconds = ms % 1000;
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(milliseconds).padStart(
          3,
          "0"
        )}`;
      };

      srtContent += `${i + 1}\n`;
      srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
      srtContent += `${scene.text || ""}\n\n`;

      accumulatedTime = endTime;
    }

    await fsp.writeFile(srtPath, srtContent, "utf8");
    console.log("✅ SRT 자막 파일 생성 완료:", srtPath);
    console.log(`   최종 자막 길이: ${(accumulatedTime / 1000).toFixed(2)}초`);
    return srtPath;
  } catch (error) {
    console.error("❌ SRT 자막 파일 생성 실패:", error);
    throw error;
  }
}

// ----------------------------------------------------------------------------
// 씬 기반 비디오 합성 (비디오/이미지 혼합 지원)
// ----------------------------------------------------------------------------
async function composeVideoFromScenes({ event, scenes, mediaFiles, audioFiles, outputPath, srtPath, sceneDurationsMs }) {
  let tempDir;
  try {
    tempDir = path.join(app.getPath("userData"), "ffmpeg-temp");
  } catch {
    const os = require("os");
    tempDir = path.join(os.tmpdir(), "weaver-pro-ffmpeg-temp");
  }
  await fsp.mkdir(tempDir, { recursive: true });
  await cleanupTempFiles(tempDir);

  const videoClips = [];
  const MIN_CLIP_DURATION = 0.25;

  // ✅ 전체 오디오 길이 계산 (모든 오디오 파일 합산)
  let totalAudioSec = 0;
  if (audioFiles && audioFiles.length > 0) {
    try {
      for (const audioFile of audioFiles) {
        const duration = await probeDurationSec(audioFile);
        totalAudioSec += duration;
      }
      console.log(`📊 전체 오디오 길이: ${totalAudioSec.toFixed(2)}초 (${audioFiles.length}개 파일)`);
    } catch (error) {
      console.warn(`오디오 길이 측정 실패: ${error.message}`);
      totalAudioSec = sceneDurationsMs.reduce((sum, dur) => sum + dur, 0) / 1000;
    }
  } else {
    totalAudioSec = sceneDurationsMs.reduce((sum, dur) => sum + dur, 0) / 1000;
  }

  let totalVideoSec = 0;

  // 각 씬별로 클립 생성 (비디오는 그대로, 이미지는 duration 적용)
  for (let i = 0; i < scenes.length; i++) {
    // 취소 확인
    if (isExportCancelled) {
      console.log("✋ 영상 내보내기가 취소되었습니다");
      throw new Error("사용자에 의해 취소되었습니다");
    }

    const scene = scenes[i];
    const mediaPath = mediaFiles[i];
    const durSec = Math.max(MIN_CLIP_DURATION, (sceneDurationsMs[i] || 3000) / 1000);

    // 로그는 10개씩 묶어서 출력
    if (i === 0 || (i + 1) % 10 === 0 || i === scenes.length - 1) {
      console.log(`📹 씬 처리 중: ${i + 1}/${scenes.length}`);
    }

    if (scene.asset.type === "video") {
      // 비디오: stream_loop로 반복 재생하여 오디오 길이 맞춤
      const videoClipOut = path.join(tempDir, `scene_${String(i).padStart(3, "0")}_${Date.now()}.mp4`);

      // 원본 비디오 길이 측정
      let originalDuration = durSec;
      try {
        originalDuration = await probeDurationSec(mediaPath);
      } catch (error) {
        console.warn(`비디오 ${i + 1} 길이 측정 실패, 기본값 사용`);
      }

      // ✅ stream_loop 사용: 비디오가 짧으면 반복 재생
      // loop 횟수 계산 (0-based, -1은 무한 반복)
      let loopCount = -1; // 무한 반복 후 -t로 자르기
      if (originalDuration > durSec) {
        loopCount = 0; // 반복 불필요
      }

      // 디버그 로그는 필요시에만
      // console.log(`   비디오 ${i + 1}: 원본 ${originalDuration.toFixed(2)}s, 목표 ${durSec.toFixed(2)}s, loop=${loopCount}`);

      const vfChain = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

      const videoArgs = [
        "-y",
        "-hide_banner",
      ];

      // stream_loop 추가 (반복 필요한 경우만)
      if (loopCount === -1) {
        videoArgs.push("-stream_loop", "-1");
      }

      videoArgs.push(
        "-i",
        mediaPath,
        "-t",
        durSec.toFixed(3),
        "-vf",
        vfChain,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-r",
        "24",
        "-pix_fmt",
        "yuv420p",
        "-an", // 오디오 제거 (나중에 TTS 추가)
        "-avoid_negative_ts",
        "make_zero",
        "-fflags",
        "+genpts+discardcorrupt",
        videoClipOut
      );

      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, videoArgs, { windowsHide: true });
        let stderr = "";
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
          if (stderr.length > 10000) stderr = stderr.slice(-5000);
        });
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`비디오 클립 ${i + 1} 생성 실패\n${stderr.slice(-1000)}`));
        });
        proc.on("error", (err) => reject(err));
      });

      videoClips.push(videoClipOut);

      // ✅ 실제 길이 확인
      const realSec = await probeDurationSec(videoClipOut);
      totalVideoSec += realSec;
    } else if (scene.asset.type === "image") {
      // 이미지: duration 동안 정지 화면
      const imageClipOut = path.join(tempDir, `scene_${String(i).padStart(3, "0")}_${Date.now()}.mp4`);
      const vfChain = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;

      const imageArgs = [
        "-y",
        "-hide_banner",
        "-loop",
        "1",
        "-i",
        mediaPath,
        "-t",
        durSec.toFixed(3),
        "-vf",
        vfChain,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-r",
        "24",
        "-pix_fmt",
        "yuv420p",
        "-avoid_negative_ts",
        "make_zero",
        "-fflags",
        "+genpts+discardcorrupt",
        imageClipOut,
      ];

      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, imageArgs, { windowsHide: true });
        let stderr = "";
        proc.stderr.on("data", (d) => {
          stderr += d.toString();
          if (stderr.length > 10000) stderr = stderr.slice(-5000);
        });
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`이미지 클립 ${i + 1} 생성 실패\n${stderr.slice(-1000)}`));
        });
        proc.on("error", (err) => reject(err));
      });

      videoClips.push(imageClipOut);

      // ✅ 실제 길이 확인
      const realSec = await probeDurationSec(imageClipOut);
      totalVideoSec += realSec;
    }

    // 진행률 전송
    if (event?.sender) {
      const progress = Math.round(((i + 1) / scenes.length) * 50); // 0-50%
      event.sender.send("ffmpeg:progress", progress);
    }
  }

  if (videoClips.length === 0) {
    throw new Error("생성된 비디오 클립이 없습니다");
  }

  // ✅ 최종 통계
  console.log(`\n📊 합성 준비 완료: ${videoClips.length}개 클립 (${totalVideoSec.toFixed(1)}s / ${totalAudioSec.toFixed(1)}s)`);

  // ✅ filter_complex 기반 concat으로 PTS 불일치 방지
  const finalArgs = ["-y", "-hide_banner"];

  // 모든 클립을 입력으로 추가
  videoClips.forEach((clip) => {
    finalArgs.push("-i", clip);
  });

  // 모든 오디오 파일 추가
  const audioInputIndexStart = videoClips.length;
  if (audioFiles && audioFiles.length > 0) {
    audioFiles.forEach((audioFile) => {
      finalArgs.push("-i", audioFile);
    });
  }

  // filter_complex로 concat (PTS 안정화)
  let filterInputs = videoClips.map((_, i) => `[${i}:v]`).join("");
  let filterComplex = `${filterInputs}concat=n=${videoClips.length}:v=1:a=0[outv]`;

  // 오디오도 concat (여러 개인 경우)
  let hasAudioFilter = false;
  if (audioFiles && audioFiles.length > 1) {
    const audioFilterInputs = audioFiles.map((_, i) => `[${audioInputIndexStart + i}:a]`).join("");
    filterComplex += `;${audioFilterInputs}concat=n=${audioFiles.length}:v=0:a=1[outa]`;
    hasAudioFilter = true;
  } else if (audioFiles && audioFiles.length === 1) {
    // 오디오 파일이 1개면 그냥 레이블만 붙임 (anull 필터 사용)
    filterComplex += `;[${audioInputIndexStart}:a]anull[outa]`;
    hasAudioFilter = true;
  }

  // 자막 필터 통합 (drawtext 사용)
  let finalVideoLabel = "[outv]";
  if (srtPath && fs.existsSync(srtPath)) {
    console.log(`✅ 자막 파일 확인: ${srtPath}`);

    // 전역 자막 설정 로드
    const subtitleSettings = store.get("subtitleSettings", {
      fontFamily: "malgun-gothic",
      fontSize: 24,
      position: "bottom",
      horizontalAlign: "center",
      useOutline: true,
      outlineWidth: 2,
      useShadow: false,
      verticalPadding: 40,
      maxLines: 2,
    });

    console.log(`[자막 설정 전체] ${JSON.stringify(subtitleSettings, null, 2)}`);

    // SRT 파일 읽기 및 파싱
    const srtContent = fs.readFileSync(srtPath, 'utf-8');
    const subtitles = parseSRT(srtContent);

    console.log(`📝 파싱된 자막 수: ${subtitles.length}개`);

    if (subtitles.length > 0) {
      // drawtext 필터 체인 생성
      let currentLabel = "[outv]";
      const videoWidth = 1920;
      const videoHeight = 1080;

      subtitles.forEach((subtitle, index) => {
        const drawtextFilter = createDrawtextFilter(subtitle, subtitleSettings, videoWidth, videoHeight);
        const nextLabel = index === subtitles.length - 1 ? "[v]" : `[dt${index}]`;

        filterComplex += `;${currentLabel}${drawtextFilter}${nextLabel}`;
        currentLabel = nextLabel;

        if (index === 0) {
          console.log(`[첫 자막 필터] ${drawtextFilter}`);
        }
      });

      filterComplex += `;[v]format=yuv420p[vf]`;
      finalVideoLabel = "[vf]";
    } else {
      console.warn("⚠️ 자막이 비어있습니다");
      filterComplex += `;[outv]format=yuv420p[v]`;
      finalVideoLabel = "[v]";
    }
  } else {
    // 자막 없으면 포맷만 적용
    filterComplex += `;[outv]format=yuv420p[v]`;
    finalVideoLabel = "[v]";
  }

  finalArgs.push("-filter_complex", filterComplex);

  // 맵핑
  finalArgs.push("-map", finalVideoLabel);
  if (audioFiles && audioFiles.length > 0) {
    finalArgs.push("-map", "[outa]");
  }

  finalArgs.push(
    "-c:v",
    "libx264",
    "-profile:v",
    "main",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    // ✅ 타임스탬프 안정화 + corrupt 프레임 폐기
    "-avoid_negative_ts",
    "make_zero",
    "-fflags",
    "+genpts+discardcorrupt"
  );

  if (audioFiles && audioFiles.length > 0) {
    finalArgs.push("-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2");
  }

  finalArgs.push(outputPath);

  console.log("🎬 최종 합성 시작...");
  const result = await runFFmpeg(finalArgs, (progress) => {
    if (event?.sender) {
      const mapped = 50 + Math.round((progress / 100) * 50); // 50-100%
      event.sender.send("ffmpeg:progress", Math.min(99, mapped));
    }
  });

  if (result.success && event?.sender) {
    event.sender.send("ffmpeg:progress", 100);
  }

  return result;
}

module.exports = { register };
