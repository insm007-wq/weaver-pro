// electron/ipc/ffmpeg.js
// ============================================================================
// FFmpeg 영상 합성 IPC 핸들러
// ============================================================================
//
// 주요 기능:
// 1. 여러 이미지/비디오 클립을 하나의 영상으로 합성
// 2. TTS 오디오와 동기화
// 3. drawtext 필터를 사용한 자막 렌더링 (배경 박스, 외곽선 지원)
// 4. 사용자 정의 자막 스타일 적용
//
// 자막 렌더링 방식:
// - drawtext 필터 사용 (ASS 대신)
// - 여러 줄 텍스트는 개별 drawtext 필터로 분리
// - 각 줄의 Y 좌표를 계산하여 정확한 위치 배치
// - 배경 박스(box), 외곽선(borderw), 그림자(shadow) 지원
//
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

// ============================================================================
// 자막 설정 기본값 (YouTube 표준 스타일)
// ============================================================================
const DEFAULT_SUBTITLE_SETTINGS = {
  // 기본 텍스트 설정
  fontFamily: "noto-sans",
  fontSize: 52, // YouTube 표준 (1920x1080 기준)
  fontWeight: 700,
  lineHeight: 1.3,
  letterSpacing: 0,

  // 색상 설정
  textColor: "#FFFFFF",
  backgroundColor: "#000000",
  backgroundOpacity: 75,
  outlineColor: "#000000",
  outlineWidth: 3,
  shadowColor: "#000000",
  shadowOffset: 0,
  shadowBlur: 0,

  // 위치 및 정렬
  position: "bottom",
  horizontalAlign: "center",
  verticalPadding: 60,
  horizontalPadding: 24,
  maxWidth: 90,
  finePositionOffset: 0,

  // 배경 및 테두리
  useBackground: true,
  backgroundRadius: 4,
  useOutline: true,
  useShadow: false,

  // 고급 설정
  autoWrap: true,
  maxLines: 2,
  wordBreak: "keep-all",
};

/**
 * 자막 설정 로드 (검증 및 fallback 포함)
 */
function getSubtitleSettings() {
  const userSettings = store.get("subtitleSettings", {});

  // 사용자 설정과 기본값 병합
  const settings = { ...DEFAULT_SUBTITLE_SETTINGS, ...userSettings };

  // 필수 값 검증 및 경고
  if (settings.fontSize < 20 || settings.fontSize > 200) {
    console.warn(`⚠️ fontSize(${settings.fontSize})가 비정상적입니다. 기본값(52) 사용`);
    settings.fontSize = DEFAULT_SUBTITLE_SETTINGS.fontSize;
  }

  if (settings.maxLines < 1 || settings.maxLines > 5) {
    console.warn(`⚠️ maxLines(${settings.maxLines})가 비정상적입니다. 기본값(2) 사용`);
    settings.maxLines = DEFAULT_SUBTITLE_SETTINGS.maxLines;
  }

  if (settings.lineHeight < 0.5 || settings.lineHeight > 3) {
    console.warn(`⚠️ lineHeight(${settings.lineHeight})가 비정상적입니다. 기본값(1.3) 사용`);
    settings.lineHeight = DEFAULT_SUBTITLE_SETTINGS.lineHeight;
  }

  return settings;
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
  hex = hex.replace("#", "");
  return `0x${hex}`;
}

// HEX 색상을 투명도와 함께 FFmpeg RGBA 형식으로 변환
// 예: #000000, 0.8 -> 0x000000@0.8
function hexToFFmpegColorWithAlpha(hex, alpha) {
  hex = hex.replace("#", "");
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

/**
 * 텍스트를 균형있게 여러 줄로 분할 (프론트엔드와 동일한 로직)
 * @param {string} text - 분할할 텍스트
 * @param {number} maxLines - 최대 줄 수
 * @returns {string[]} 분할된 줄 배열
 */
function splitBalancedLines(text = "", maxLines = 2) {
  const clean = text.replace(/\s+/g, " ").trim();

  // 이미 줄바꿈이 있으면 그대로 사용
  if (text.includes("\n")) {
    const lines = text.split("\n").map(line => line.trim()).filter(line => line);
    return lines.slice(0, maxLines);
  }

  // maxLines가 1이면 분할하지 않음
  if (maxLines === 1) {
    return [clean];
  }

  // 텍스트가 너무 짧으면 1줄로 반환 (20자 이하)
  if (clean.length <= 20) {
    return [clean];
  }

  // ✅ 자동 줄 수 조정: 텍스트가 너무 길면 줄 수 증가
  let effectiveMaxLines = maxLines;
  const avgCharsPerLine = clean.length / maxLines;
  if (avgCharsPerLine > 40 && maxLines === 2) {
    effectiveMaxLines = 3;
    console.log(`✅ 긴 텍스트 감지 (${clean.length}자, 평균 ${Math.round(avgCharsPerLine)}자/줄) → 3줄로 자동 조정`);
  }

  // effectiveMaxLines만큼 균등 분할
  const lines = [];
  let remaining = clean;

  for (let lineIndex = 0; lineIndex < effectiveMaxLines && remaining.length > 0; lineIndex++) {
    const isLastLine = lineIndex === effectiveMaxLines - 1;

    if (isLastLine) {
      lines.push(remaining.trim());
      break;
    }

    const remainingLines = effectiveMaxLines - lineIndex;
    const targetLength = Math.ceil(remaining.length / remainingLines);

    let cut = Math.min(targetLength, remaining.length);
    let foundBreak = false;

    const searchRange = Math.floor(targetLength * 0.2);
    for (let offset = 0; offset <= searchRange && cut + offset < remaining.length; offset++) {
      if (offset > 0 && cut + offset < remaining.length && /[ \-–—·,.:;!?]/.test(remaining[cut + offset])) {
        cut = cut + offset + 1;
        foundBreak = true;
        break;
      }
      if (offset > 0 && cut - offset > 0 && /[ \-–—·,.:;!?]/.test(remaining[cut - offset])) {
        cut = cut - offset + 1;
        foundBreak = true;
        break;
      }
    }

    if (!foundBreak && cut < remaining.length) {
      cut = targetLength;
    }

    const line = remaining.slice(0, cut).trim();
    if (line) {
      lines.push(line);
    }
    remaining = remaining.slice(cut).trim();
  }

  return lines.filter(line => line);
}

// SRT 파일 파싱 함수
/**
 * SRT 자막 파일 파싱
 * @param {string} srtContent - SRT 파일 내용
 * @returns {Array<{startTime: number, endTime: number, text: string}>} 자막 배열
 */
function parseSRT(srtContent) {
  const subtitles = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    // 첫 줄: 인덱스 (무시)
    // 둘째 줄: 타임스탬프
    const timingMatch = lines[1].match(/(\S+)\s+-->\s+(\S+)/);
    if (!timingMatch) continue;

    const startTime = srtTimestampToSeconds(timingMatch[1]);
    const endTime = srtTimestampToSeconds(timingMatch[2]);

    // 나머지 줄: 텍스트 (줄바꿈 유지)
    const text = lines.slice(2).join("\n");

    subtitles.push({ startTime, endTime, text });
  }

  return subtitles;
}

/**
 * FFmpeg drawtext 필터 생성 (여러 줄 자막 지원)
 *
 * 동작 방식:
 * 1. textFilePath가 있으면 textfile 사용 (줄바꿈 자동 인식)
 * 2. 없으면 텍스트를 줄로 분리하여 각 줄마다 별도 drawtext 필터 생성
 * 3. 각 줄의 Y 좌표를 계산하여 정확한 위치에 배치
 *
 * @param {Object} subtitle - 자막 데이터 { startTime, endTime, text }
 * @param {Object} settings - 자막 스타일 설정 (getSubtitleSettings 반환값)
 * @param {string|null} textFilePath - 텍스트 파일 경로 (현재 미사용, null)
 * @param {number} videoWidth - 비디오 너비 (1920)
 * @param {number} videoHeight - 비디오 높이 (1080)
 * @returns {string} drawtext 필터 문자열 (여러 개는 쉼표로 연결)
 *
 * @example
 * // 2줄 자막의 경우 반환값:
 * // "drawtext=text='첫째줄':...:y=950,drawtext=text='둘째줄':...:y=1000"
 */
function createDrawtextFilterAdvanced(subtitle, settings, textFilePath, videoWidth, videoHeight) {
  const {
    fontFamily = "malgun-gothic",
    fontSize = 52,
    fontWeight = 700,
    lineHeight = 1.3,
    letterSpacing = 0,
    textColor = "#FFFFFF",
    backgroundColor = "#000000",
    backgroundOpacity = 75,
    outlineColor = "#000000",
    outlineWidth = 3,
    shadowColor = "#000000",
    shadowOffset = 2,
    shadowBlur = 4,
    position = "bottom",
    horizontalAlign = "center",
    verticalPadding = 60,
    horizontalPadding = 24,
    useBackground = true,
    useOutline = true,
    useShadow = false,
    finePositionOffset = 0,
  } = settings;

  // 폰트 파일 경로 매핑 (동적 경로 사용)
  const os = require("os");
  const windir = process.env.WINDIR || "C:\\Windows";
  const fontDir = path.join(windir, "Fonts");

  const fontMap = {
    "noto-sans": path.join(fontDir, "NotoSansKR-Regular.ttf"),
    "malgun-gothic": path.join(fontDir, "malgun.ttf"),
    "apple-sd-gothic": path.join(fontDir, "AppleSDGothicNeo.ttf"),
    nanumgothic: path.join(fontDir, "NanumGothic.ttf"),
    arial: path.join(fontDir, "arial.ttf"),
    helvetica: path.join(fontDir, "helvetica.ttf"),
    roboto: path.join(fontDir, "Roboto-Regular.ttf"),
  };

  let fontFile = fontMap[fontFamily] || fontMap["malgun-gothic"];

  // 폰트 파일 존재 확인 및 fallback
  if (!fs.existsSync(fontFile)) {
    console.warn(`⚠️ 폰트 파일을 찾을 수 없음: ${fontFile}`);

    // Fallback 1: malgun.ttf
    fontFile = fontMap["malgun-gothic"];
    if (!fs.existsSync(fontFile)) {
      console.warn(`⚠️ Malgun Gothic 폰트를 찾을 수 없음: ${fontFile}`);

      // Fallback 2: arial.ttf (대부분의 Windows 시스템에 존재)
      fontFile = fontMap["arial"];
      if (!fs.existsSync(fontFile)) {
        console.error(`❌ 사용 가능한 폰트를 찾을 수 없습니다`);
        throw new Error("시스템 폰트를 찾을 수 없습니다");
      } else {
        console.log(`✅ Fallback 폰트 사용: Arial`);
      }
    } else {
      console.log(`✅ Fallback 폰트 사용: Malgun Gothic`);
    }
  } else {
    console.log(`✅ 폰트 파일 확인: ${fontFile}`);
  }

  // FFmpeg용 경로 변환 (이스케이프 처리)
  fontFile = fontFile.replace(/\\/g, "/").replace(/:/g, "\\:");

  // textFilePath가 전달된 경우 textfile 사용 (줄바꿈 자동 지원)
  const useTextFile = textFilePath !== null && textFilePath !== undefined;

  // 색상 변환 (HEX -> 0xRRGGBB)
  const hexToFFmpeg = (hex) => {
    return `0x${hex.replace("#", "")}`;
  };

  const textColorFFmpeg = hexToFFmpeg(textColor);
  const bgColorFFmpeg = hexToFFmpeg(backgroundColor);
  const outlineColorFFmpeg = hexToFFmpeg(outlineColor);
  const shadowColorFFmpeg = hexToFFmpeg(shadowColor);

  // 투명도 변환 (0-100 -> 0.0-1.0)
  const bgAlpha = backgroundOpacity / 100;

  // 위치 계산
  let xExpr = "";
  if (horizontalAlign === "center") {
    xExpr = "(w-text_w)/2";
  } else if (horizontalAlign === "left") {
    xExpr = `${horizontalPadding}`;
  } else if (horizontalAlign === "right") {
    xExpr = `w-text_w-${horizontalPadding}`;
  }

  let yExpr = "";
  // finePositionOffset: 양수(+) = 아래로, 음수(-) = 위로
  // bottom의 경우: h - (verticalPadding - finePositionOffset) - text_h
  // → finePositionOffset가 음수면 더 위로 올라감
  const adjustedVerticalPadding = verticalPadding - finePositionOffset;
  if (position === "bottom") {
    yExpr = `h-${adjustedVerticalPadding}-text_h`;
  } else if (position === "top") {
    yExpr = `${adjustedVerticalPadding}`;
  } else {
    yExpr = "(h-text_h)/2";
  }

  // 외곽선 스타일 구성
  let borderw = 0;
  let bordercolor = "black";
  if (useOutline && outlineWidth > 0) {
    borderw = outlineWidth;
    bordercolor = outlineColorFFmpeg;
  }

  // 그림자 스타일 구성
  let shadowx = 0;
  let shadowy = 0;
  if (useShadow && shadowOffset > 0) {
    shadowx = shadowOffset;
    shadowy = shadowOffset;
  }

  // 배경 박스 구성
  let boxExpr = "0";
  let boxcolor = "black@0";
  let boxborderw = "0";
  if (useBackground) {
    boxExpr = "1";
    boxcolor = `${bgColorFFmpeg}@${bgAlpha}`;
    boxborderw = String(horizontalPadding / 2); // 박스 패딩
  }

  // enable 표현식 (시간 기반 표시)
  const enableExpr = `between(t,${subtitle.startTime.toFixed(3)},${subtitle.endTime.toFixed(3)})`;

  // 줄 간격 설정
  const lineSpacing = Math.round((lineHeight - 1) * fontSize);

  // textfile 사용 시 (줄바꿈 자동 지원)
  if (useTextFile) {
    const escapedTextFile = textFilePath.replace(/\\/g, "/").replace(/:/g, "\\:");

    const filter =
      `drawtext=textfile='${escapedTextFile}'` +
      `:fontfile='${fontFile}'` +
      `:fontsize=${fontSize}` +
      `:fontcolor=${textColorFFmpeg}` +
      `:x=${xExpr}` +
      `:y=${yExpr}` +
      `:box=${boxExpr}` +
      `:boxcolor=${boxcolor}` +
      `:boxborderw=${boxborderw}` +
      `:borderw=${borderw}` +
      `:bordercolor=${bordercolor}` +
      `:shadowx=${shadowx}` +
      `:shadowy=${shadowy}` +
      `:shadowcolor=${shadowColorFFmpeg}` +
      `:line_spacing=${lineSpacing}` +
      `:enable='${enableExpr}'`;

    return filter;
  }

  // text 사용 시 (여러 줄을 개별 필터로 분리)
  const lines = subtitle.text.split("\n");
  const escapeDrawtext = (text) => {
    return text
      .replace(/\\/g, "\\\\\\\\")
      .replace(/:/g, "\\:")
      .replace(/'/g, "'\\\\\\''")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  };

  const totalTextHeight = lines.length * Math.round(fontSize * lineHeight);
  const filters = [];

  for (let i = 0; i < lines.length; i++) {
    const escapedLine = escapeDrawtext(lines[i]);

    let lineYExpr = "";
    if (position === "bottom") {
      lineYExpr = `h-${adjustedVerticalPadding}-${totalTextHeight}+${i * Math.round(fontSize * lineHeight)}`;
    } else if (position === "top") {
      lineYExpr = `${adjustedVerticalPadding}+${i * Math.round(fontSize * lineHeight)}`;
    } else {
      lineYExpr = `(h-${totalTextHeight})/2+${i * Math.round(fontSize * lineHeight)}`;
    }

    const filter =
      `drawtext=text='${escapedLine}'` +
      `:fontfile='${fontFile}'` +
      `:fontsize=${fontSize}` +
      `:fontcolor=${textColorFFmpeg}` +
      `:x=${xExpr}` +
      `:y=${lineYExpr}` +
      `:box=${boxExpr}` +
      `:boxcolor=${boxcolor}` +
      `:boxborderw=${boxborderw}` +
      `:borderw=${borderw}` +
      `:bordercolor=${bordercolor}` +
      `:shadowx=${shadowx}` +
      `:shadowy=${shadowy}` +
      `:shadowcolor=${shadowColorFFmpeg}` +
      `:enable='${enableExpr}'`;

    filters.push(filter);
  }

  return filters.join(",");
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
  if (ffmpegPath && ffmpegPath.includes("app.asar")) {
    ffmpegPath = ffmpegPath.replace("app.asar", "app.asar.unpacked");
    console.log("[ffmpeg] ASAR unpacked path:", ffmpegPath);
  }

  console.log("[ffmpeg] ffmpeg-static path:", ffmpegPath);
} catch (err) {
  console.error("[ffmpeg] Failed to load ffmpeg-static:", err);
  // 폴백: 하드코딩된 경로 (unpacked 사용)
  const appPath = app.getAppPath();
  if (appPath.includes("app.asar")) {
    ffmpegPath = path.join(appPath.replace("app.asar", "app.asar.unpacked"), "node_modules", "ffmpeg-static", "ffmpeg.exe");
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

  ipcMain.handle(
    "ffmpeg:compose",
    async (event, { audioFiles, imageFiles, outputPath, subtitlePath = null, sceneDurationsMs = null, options = {} }) => {
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

        console.log(
          `📊 씬 duration 조정: ${(sumOfIndividualDurationsMs / 1000).toFixed(1)}s → ${(targetDurationMs / 1000).toFixed(
            1
          )}s (비율: ${ratio.toFixed(3)})`
        );
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

  // ✅ ASS 자막 필터 (단순하고 안정적)
  let finalVideoLabel = "[outv]";
  if (subtitlePath && fs.existsSync(subtitlePath)) {
    console.log(`✅ 자막 파일 확인: ${subtitlePath}`);

    // ✅ 전역 자막 설정 로드 (검증 및 fallback 포함)
    const subtitleSettings = getSubtitleSettings();
    console.log(`[자막 설정] 로드 완료:`, subtitleSettings);

    // ✅ drawtext 필터로 자막 구현 (배경 박스 지원)
    const srtContent = fs.readFileSync(subtitlePath, "utf-8");
    const subtitles = parseSRT(srtContent);

    console.log(`📝 drawtext로 ${subtitles.length}개 자막 렌더링`);

    let currentLabel = "[outv]";
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];
      const nextLabel = i === subtitles.length - 1 ? "[v]" : `[st${i}]`;

      // 여러 drawtext 필터로 나누기 (각 줄마다 별도 렌더링)
      const drawtextFilter = createDrawtextFilterAdvanced(subtitle, subtitleSettings, null, 1920, 1080);
      filterComplex += `;${currentLabel}${drawtextFilter}${nextLabel}`;
      currentLabel = nextLabel;
    }

    finalVideoLabel = "[v]";
  } else {
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
    // ✅ 자막 설정 로드 (줄 수 제한 적용)
    const subtitleSettings = store.get("subtitleSettings", {
      maxLines: 2,
      maxWidth: 80,
      autoWrap: true,
    });

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
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(
          milliseconds
        ).padStart(3, "0")}`;
      };

      // ✅ 텍스트를 maxLines에 맞게 처리 (프론트엔드와 동일한 로직 사용)
      let text = scene.text || "";
      const lines = splitBalancedLines(text, subtitleSettings.maxLines);
      text = lines.join("\n");

      console.log(`📝 씬 ${i + 1}: ${lines.length}줄로 분할 (maxLines: ${subtitleSettings.maxLines})`);

      srtContent += `${i + 1}\n`;
      srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
      srtContent += `${text}\n\n`;

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

      const videoArgs = ["-y", "-hide_banner"];

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

  // ✅ 오디오는 concat demuxer로 안정적으로 합치기 (filter_complex는 비디오만)
  const finalArgs = ["-y", "-hide_banner"];

  // 1. 오디오 concat 파일 생성 (demuxer 방식)
  let audioConcatPath = null;
  if (audioFiles && audioFiles.length > 0) {
    audioConcatPath = path.join(tempDir, `audio_concat_${Date.now()}.txt`);
    const audioConcatContent = audioFiles
      .map((filePath) => {
        // Windows 경로를 슬래시로 변환하고 이스케이프
        const escapedPath = filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
        return `file '${escapedPath}'`;
      })
      .join("\n");
    await fsp.writeFile(audioConcatPath, audioConcatContent, "utf8");
    console.log(`📝 오디오 concat 파일 생성: ${audioFiles.length}개 파일`);
  }

  // 2. 비디오 클립들을 입력으로 추가
  videoClips.forEach((clip) => {
    finalArgs.push("-i", clip);
  });

  // 3. 오디오는 concat demuxer로 추가
  const audioInputIndex = videoClips.length;
  if (audioConcatPath) {
    finalArgs.push("-f", "concat", "-safe", "0", "-i", audioConcatPath);
  }

  // 4. filter_complex로 비디오만 concat
  let filterInputs = videoClips.map((_, i) => `[${i}:v]`).join("");
  let filterComplex = `${filterInputs}concat=n=${videoClips.length}:v=1:a=0[outv]`;

  // ✅ ASS 자막 필터 (단순하고 안정적)
  let finalVideoLabel = "[outv]";
  if (srtPath && fs.existsSync(srtPath)) {
    console.log(`✅ 자막 파일 확인: ${srtPath}`);

    // ✅ 전역 자막 설정 로드 (검증 및 fallback 포함)
    const subtitleSettings = getSubtitleSettings();
    console.log(`[자막 설정] 로드 완료:`, subtitleSettings);

    // ✅ drawtext 필터로 자막 구현 (배경 박스 지원)
    const srtContent = fs.readFileSync(srtPath, "utf-8");
    const subtitles = parseSRT(srtContent);

    console.log(`📝 drawtext로 ${subtitles.length}개 자막 렌더링`);

    let currentLabel = "[outv]";
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];
      const nextLabel = i === subtitles.length - 1 ? "[v]" : `[st${i}]`;

      // 여러 drawtext 필터로 나누기 (각 줄마다 별도 렌더링)
      const drawtextFilter = createDrawtextFilterAdvanced(subtitle, subtitleSettings, null, 1920, 1080);
      filterComplex += `;${currentLabel}${drawtextFilter}${nextLabel}`;
      currentLabel = nextLabel;
    }

    finalVideoLabel = "[v]";
  } else {
    filterComplex += `;[outv]format=yuv420p[v]`;
    finalVideoLabel = "[v]";
  }

  finalArgs.push("-filter_complex", filterComplex);

  // 맵핑
  finalArgs.push("-map", finalVideoLabel);
  if (audioConcatPath) {
    // concat demuxer로 합쳐진 오디오 사용
    finalArgs.push("-map", `${audioInputIndex}:a`);
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

  if (audioConcatPath) {
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
