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

// ============================================================================
// 🔧 전역 상수 (마법의 숫자 추출)
// ============================================================================

// 타임아웃 설정 (밀리초)
const TIMEOUTS = {
  FFMPEG_CHECK: 10000,              // FFmpeg 설치 확인
  VIDEO_ENCODE: 15 * 60 * 1000,     // 비디오 인코딩 (15분)
  CLIP_GENERATION: 30000,           // 단일 클립 생성 (30초)
  DEFAULT_SCENE_DURATION: 3000,     // 기본 씬 지속시간 (3초)
};

// 비디오 사양
const VIDEO_SPECS = {
  WIDTH: 1920,
  HEIGHT: 1080,
  DEFAULT_FPS: 24,
  DEFAULT_CRF: 23,                  // 기본 품질 설정
  MIN_CLIP_DURATION: 0.25,          // 최소 클립 지속시간
};

// 이미지 팬 효과 설정
const IMAGE_PAN = {
  SCALE_FACTOR: 1.3,
  BASE_WIDTH: 2496,
  BASE_HEIGHT: 1404,
  CROP_WIDTH: 1920,
  CROP_HEIGHT: 1080,
  CROP_X_OFFSET: 288,
  PAN_HEIGHT: 324,
};

// 자막 텍스트 분할 설정
const TEXT_SPLIT_SETTINGS = {
  CHAR_WIDTH_RATIO: 0.72,           // fontSize * 0.72 = 픽셀 너비
  MAX_WIDTH_PERCENT: 0.85,          // 1920 * 0.85 = 1632px
  MAX_WIDTH_PX: 1632,
  MIN_SHORT_TEXT: 20,               // 이 이상이면 분할 고려
  MAX_SEARCH_RANGE_RATIO: 0.2,      // 목표 길이의 ±20% 범위 검색
};

// 오디오 인코딩 설정
const AUDIO_ENCODE = {
  CODEC: 'aac',
  BITRATE: '128k',
  SAMPLE_RATE: '48000',
  CHANNELS: 2,
};

// 비디오 품질 프리셋
const QUALITY_PRESETS = {
  high: { crf: 18, preset: "fast" },
  balanced: { crf: 23, preset: "veryfast" },
  medium: { crf: 21, preset: "veryfast" },
  low: { crf: 28, preset: "ultrafast" },
};

// 버퍼 및 메모리 설정
const BUFFER_LIMITS = {
  STDERR_MAX: 10000,                // 최대 stderr 버퍼 크기
  STDERR_TRIM: 5000,                // 트림 이후 유지할 크기
  FILTER_COMPLEX_MAX: 3000,         // 필터 복잡도 최대값
  COMMAND_LENGTH_THRESHOLD: 6000,   // 셸 스크립트 사용 임계값
};

// 임시 파일 접두사
const TEMP_FILE_PREFIXES = ["concat_", "clip_", "scene_"];

// FFmpeg 공통 플래그
const FFMPEG_FLAGS = {
  HIDE_BANNER: "-hide_banner",
  OVERWRITE: "-y",
  TIMESTAMP_FIX: "make_zero",
  PTS_DISCARD: "+genpts+discardcorrupt",
  PIXEL_FORMAT: "yuv420p",
  PROFILE: "main",
  FASTSTART: "+faststart",
};

// 스크립트 실행 설정
const SCRIPT_SETTINGS = {
  WINDOWS_EXT: "bat",
  UNIX_EXT: "sh",
  UNIX_PERMISSION: 0o755,
  WINDOWS_CHARSET: 65001,           // UTF-8
};

// 진행률 보고 범위
const PROGRESS_RANGES = {
  CLIP_GENERATION: 30,
  COMPOSE: 30,
  FINAL_ENCODE: 70,
};

// 로그 레벨
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

// ============================================================================
// 📝 구조화된 로깅 유틸리티
// ============================================================================

/**
 * 구조화된 로그 출력 (프로덕션/개발 환경 구분)
 * @param {string} level - 로그 레벨 ('error', 'warn', 'info', 'debug')
 * @param {string} message - 로그 메시지
 * @param {object} data - 추가 데이터 (선택사항)
 */
function log(level, message, data = {}) {
  if (LOG_LEVELS[level] > LOG_LEVELS[LOG_LEVEL]) return;

  const timestamp = new Date().toISOString();
  const context = {
    timestamp,
    level,
    module: 'ffmpeg',
    message,
    ...data
  };

  // 프로덕션 환경에서는 구조화된 JSON 로그만 출력
  if (process.env.NODE_ENV === 'production') {
    console.log(JSON.stringify(context));
  } else {
    // 개발 환경에서는 읽기 좋은 형식으로 출력
    const prefix = { error: '❌', warn: '⚠️', info: 'ℹ️', debug: '🔍' }[level];
    console.log(`${prefix} [${level.toUpperCase()}] ${message}`, Object.keys(data).length > 0 ? data : '');
  }
}

// ============================================================================
// 여러 줄 균형 분할 (한국어 기준 간단 규칙)
// ============================================================================
function splitBalancedLines(text = "", maxLines = 2, fontSize = 52) {
  const clean = text.replace(/\s+/g, " ").trim();

  if (text.includes("\n")) {
    const lines = text.split("\n").map(line => line.trim()).filter(line => line);
    return lines.slice(0, maxLines);
  }

  if (maxLines === 1) {
    return [clean];
  }

  if (clean.length <= TEXT_SPLIT_SETTINGS.MIN_SHORT_TEXT) {
    return [clean];
  }

  const charWidthPx = fontSize * TEXT_SPLIT_SETTINGS.CHAR_WIDTH_RATIO;
  const maxCharsPerLine = Math.floor(TEXT_SPLIT_SETTINGS.MAX_WIDTH_PX / charWidthPx);

  let effectiveMaxLines = maxLines;
  const avgCharsPerLine = clean.length / maxLines;
  if (avgCharsPerLine > maxCharsPerLine && maxLines === 2) {
    effectiveMaxLines = 3;
  }

  if (avgCharsPerLine / effectiveMaxLines > maxCharsPerLine && effectiveMaxLines === 3) {
    effectiveMaxLines = 4;
  }

  if (avgCharsPerLine / effectiveMaxLines > maxCharsPerLine && effectiveMaxLines === 4) {
    effectiveMaxLines = 5;
  }

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

    const searchRange = Math.floor(targetLength * TEXT_SPLIT_SETTINGS.MAX_SEARCH_RANGE_RATIO);
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

// store를 안전하게 로드
let store = null;
try {
  store = require("../services/store");
} catch (error) {
  log('warn', 'store 로드 실패', { error: error.message });
  store = { get: (key, def) => def, set: () => {} };
}

// ============================================================================
// 자막 설정 기본값 (YouTube 표준 스타일)
// ============================================================================
const DEFAULT_SUBTITLE_SETTINGS = {
  // 자막 사용 여부
  enableSubtitles: true, // ✅ 자막 사용 (기본값)

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
  maxWidth: 85,
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
    maxWidth = 85,
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
        console.warn(`⚠️ Arial 폰트를 찾을 수 없음: ${fontFile}`);
        // 경고만 하고 진행 (FFmpeg 기본 폰트 사용)
        fontFile = "Arial"; // FFmpeg 내장 폰트 이름 사용
      }
    }
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
    log('error', '음성 파일 길이 가져오기 실패', { filePath, error: error.message });
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
  }
} catch (err) {
  log('error', 'ffmpeg-static 로드 실패, 폴백 사용', { error: err.message });
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

// ✅ Process Context Map 기반 관리 (Race Condition 해결)
// 프로세스 ID별 독립적인 context 관리로 동시 export 지원
const runningProcesses = new Map(); // processId -> { process, isCancelled, createdAt }

/**
 * 프로세스 context 생성
 * @param {string} processId - 프로세스 ID
 * @returns {Object} context
 */
function createProcessContext(processId) {
  return {
    process: null,
    isCancelled: false,
    createdAt: Date.now()
  };
}

/**
 * 프로세스 context 획득 (없으면 생성)
 * @param {string} processId - 프로세스 ID
 * @returns {Object} context
 */
function getProcessContext(processId) {
  if (!runningProcesses.has(processId)) {
    runningProcesses.set(processId, createProcessContext(processId));
  }
  return runningProcesses.get(processId);
}

/**
 * 프로세스 context 정리
 * @param {string} processId - 프로세스 ID
 */
function cleanupProcessContext(processId) {
  runningProcesses.delete(processId);
}

/**
 * ✅ 안전한 프로세스 종료
 * - SIGTERM으로 정상 종료 시도
 * - 타임아웃 후 SIGKILL로 강제 종료
 * - Orphan 프로세스 방지
 * @param {ChildProcess} proc - 자식 프로세스
 * @param {number} timeout - SIGKILL 대기 시간 (ms)
 * @returns {Promise<boolean>} - 종료 성공 여부
 */
async function killProcessSafely(proc, timeout = 5000) {
  if (!proc || proc.killed) {
    return true;
  }

  return new Promise((resolve) => {
    let killed = false;

    // 종료 이벤트 리스너
    const onExit = () => {
      killed = true;
      resolve(true);
    };

    proc.once('exit', onExit);
    proc.once('close', onExit);

    // SIGTERM으로 정상 종료 시도
    try {
      proc.kill('SIGTERM');
    } catch (error) {
      console.warn('SIGTERM 전송 실패:', error.message);
      resolve(false);
      return;
    }

    // 타임아웃 후 SIGKILL로 강제 종료
    setTimeout(() => {
      if (!killed) {
        try {
          proc.kill('SIGKILL');
          console.warn('SIGKILL 강제 종료 실행');
        } catch (error) {
          console.warn('SIGKILL 전송 실패:', error.message);
        }

        // SIGKILL 후 1초 더 대기
        setTimeout(() => {
          resolve(killed);
        }, 1000);
      }
    }, timeout);
  });
}

/**
 * ✅ FFmpeg 프로세스를 spawn하고 진행률을 모니터링
 * - 3개 중복 spawn 패턴을 통합한 유틸리티
 * - 자동 context 관리 및 취소 처리
 * - 메모리 효율적인 버퍼링
 * @param {string[]} args - FFmpeg 명령 인자
 * @param {Object} options - 옵션
 * @param {number} options.timeout - 타임아웃 (ms, 기본 30000)
 * @param {Function} options.onProgress - 진행률 콜백 (현재 시간)
 * @param {string} options.processId - 프로세스 ID (취소용)
 * @returns {Promise<{stdout, stderr, exitCode}>}
 */
async function spawnFFmpegWithMonitoring(args, options = {}) {
  const {
    timeout = 30000,
    onProgress = null,
    processId = null
  } = options;

  const ffmpegPath = getFfmpegPath();
  const proc = spawn(ffmpegPath, args, { windowsHide: true });

  // Process context 관리
  if (processId) {
    const context = getProcessContext(processId);
    context.process = proc;
  }

  // ✅ 메모리 효율적인 버퍼링
  const stdoutChunks = [];
  const stderrChunks = [];
  let stdoutLength = 0;
  let stderrLength = 0;
  const MAX_BUFFER_LENGTH = 50000;

  // stdout 수집
  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    stdoutChunks.push(chunk);
    stdoutLength += chunk.length;

    while (stdoutLength > MAX_BUFFER_LENGTH && stdoutChunks.length > 0) {
      const removed = stdoutChunks.shift();
      stdoutLength -= removed.length;
    }
  });

  // stderr 수집 및 진행률 파싱
  proc.stderr.on('data', (data) => {
    const chunk = data.toString();
    stderrChunks.push(chunk);
    stderrLength += chunk.length;

    while (stderrLength > MAX_BUFFER_LENGTH && stderrChunks.length > 0) {
      const removed = stderrChunks.shift();
      stderrLength -= removed.length;
    }

    // ✅ 진행률 콜백 (time=HH:MM:SS.ms 파싱)
    if (onProgress) {
      const timeMatch = /time=(\d+):(\d+):(\d+\.\d+)/.exec(chunk);
      if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseFloat(timeMatch[3]);
        const currentTimeSec = hours * 3600 + minutes * 60 + seconds;
        onProgress(currentTimeSec);
      }
    }
  });

  return new Promise((resolve, reject) => {
    // ✅ 타임아웃 설정
    const timer = setTimeout(async () => {
      await killProcessSafely(proc);
      reject(new Error(`FFmpeg 타임아웃 (${timeout}ms)`));
    }, timeout);

    // ✅ 주기적 취소 체크 (processId 사용 시)
    let cancelCheckInterval = null;
    if (processId) {
      cancelCheckInterval = setInterval(() => {
        const context = getProcessContext(processId);
        if (context.isCancelled) {
          clearInterval(cancelCheckInterval);
          killProcessSafely(proc).then(() => {
            reject(new Error('사용자에 의해 취소됨'));
          });
        }
      }, 500);
    }

    // ✅ 프로세스 종료 처리
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (cancelCheckInterval) clearInterval(cancelCheckInterval);

      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');

      if (processId) {
        cleanupProcessContext(processId);
      }

      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code });
      } else {
        reject(new Error(`FFmpeg 종료 코드 ${code}\n${stderr.slice(-1000)}`));
      }
    });

    proc.on('error', (error) => {
      clearTimeout(timer);
      if (cancelCheckInterval) clearInterval(cancelCheckInterval);
      if (processId) cleanupProcessContext(processId);
      reject(error);
    });
  });
}

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
        log('error', 'FFmpeg 영상 합성 실패', { error: error.message, stack: error.stack });
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

      // ✅ Race condition 해결: Project 설정이 완전히 저장되었는지 확인
      const store = require('../services/store');
      const { getProjectManager } = require('../services/projectManager');
      const currentProjectId = store.getCurrentProjectId();

      if (!currentProjectId) {
        throw new Error('❌ 현재 프로젝트가 설정되지 않았습니다. 프로젝트를 먼저 선택해주세요.');
      }

      const projectManager = getProjectManager();
      const ensured = await projectManager.ensureProjectSettingsSaved(currentProjectId, 3000);
      if (!ensured) {
        console.warn(`⚠️ video:export - 프로젝트 설정 로드 대기 실패: ${currentProjectId}`);
      }

      // ✅ projectManager를 통한 중앙화된 경로 관리
      let audioFolder = null;
      let outputFolder = null;

      try {
        // output 폴더 경로 가져오기 (projectManager 사용)
        outputFolder = await projectManager.getProjectPath('output', {
          autoCreate: true,
          ensureSync: false,  // 이미 ensureProjectSettingsSaved 했으므로
          timeout: 3000
        });
        console.log(`📁 Output 폴더: ${outputFolder}`);
      } catch (error) {
        console.error(`❌ output 폴더 경로 조회 실패: ${error.message}`);
        throw error;
      }

      try {
        // audio 폴더 경로 가져오기 (projectManager 사용)
        const audioBasePath = await projectManager.getProjectPath('audio', {
          autoCreate: true,
          ensureSync: false,
          timeout: 3000
        });
        // TTS 오디오는 audio/parts 하위폴더에 있음
        audioFolder = path.join(audioBasePath, 'parts');
        // audio/parts 폴더 자동 생성
        await fsp.mkdir(audioFolder, { recursive: true });
        console.log(`📁 Audio 폴더: ${audioFolder}`);
      } catch (error) {
        console.error(`❌ audio 폴더 경로 조회 실패: ${error.message}`);
        throw error;
      }

      // ✅ output 폴더의 기존 파일 삭제 (새 내보내기 시 깔끔하게)
      try {
        const existingFiles = await fsp.readdir(outputFolder);
        for (const file of existingFiles) {
          const filePath = path.join(outputFolder, file);
          const stat = await fsp.stat(filePath);
          if (stat.isFile()) {
            await fsp.unlink(filePath);
            console.log(`🗑️ 삭제됨: ${filePath}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ output 폴더 정리 중 오류: ${error.message}`);
      }

      // 출력 파일명 (타임스탬프 포함)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const outputPath = path.join(outputFolder, `video_${timestamp}.mp4`);

      // SRT 자막 파일 생성
      const srtPath = path.join(outputFolder, `subtitle_${timestamp}.srt`);
      await generateSrtFromScenes(scenes, srtPath);

      const audioFiles = [];
      let totalAudioDurationMs = 0;

      // ✅ 1. 개별 오디오 파일 수집 및 길이 측정
      const missingAudioFiles = [];

      for (let i = 0; i < scenes.length; i++) {
        const sceneNum = i + 1;
        const fileName = `scene-${String(sceneNum).padStart(3, "0")}.mp3`;
        const filePath = path.join(audioFolder, fileName);

        if (fs.existsSync(filePath)) {
          audioFiles.push(filePath);
          try {
            const duration = await probeDurationSec(filePath);
            totalAudioDurationMs += Math.floor(duration * 1000);
          } catch (error) {
            console.error(`씬 ${sceneNum} 오디오 길이 측정 실패:`, error);
            totalAudioDurationMs += 3000; // 기본값 3초
          }
        } else {
          const errorMsg = `씬 ${sceneNum} 오디오 파일 누락: ${filePath}`;
          console.error(`❌ ${errorMsg}`);
          missingAudioFiles.push({ sceneNum, fileName, expectedPath: filePath });
          totalAudioDurationMs += 3000; // 기본값 3초
        }
      }

      // 오디오 파일 누락 시 명확한 오류 메시지
      if (missingAudioFiles.length > 0) {
        const errorDetails = missingAudioFiles
          .map(f => `- 씬 ${f.sceneNum}: ${f.fileName}`)
          .join('\n');
        throw new Error(
          `TTS 오디오 파일이 완전히 생성되지 않았습니다.\n\n` +
          `누락된 파일 (${missingAudioFiles.length}개):\n${errorDetails}\n\n` +
          `대본 생성이 중단되었을 수 있습니다. 대본을 다시 생성해주세요.`
        );
      }

      if (audioFiles.length === 0) {
        throw new Error("사용 가능한 오디오 파일이 없습니다.");
      }

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
        // ✅ composeVideoFromScenes에서 반환한 최종 경로 사용 (한글 경로 처리 완료됨)
        return { success: true, outputPath: result.outputPath || outputPath };
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
      isExportCancelled = true;

      if (currentFfmpegProcess) {
        try {
          currentFfmpegProcess.kill("SIGKILL");
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
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[FFmpeg] Building command`);
  console.log(`   Images: ${imageFiles?.length || 0}`);
  console.log(`   Audio files: ${audioFiles?.length || 0}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Subtitle: ${subtitlePath || 'none'}`);
  console.log(`${'='.repeat(80)}\n`);

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

  // 오디오 총 길이 안전하게 측정
  let totalAudioSec = 10; // 기본값
  if (audioFiles && audioFiles.length > 0 && audioFiles[0]) {
    try {
      const measuredDuration = await probeDurationSec(audioFiles[0]);
      if (measuredDuration > 0) {
        totalAudioSec = measuredDuration;
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

    // ✅ 이미지 패닝 효과: crop 필터로 아래에서 위로 부드럽게 이동
    // 1. 이미지를 30% 크게 스케일 (1920*1.3=2496, 1080*1.3=1404) - 더 부드러운 패닝을 위해
    // 2. crop 필터로 1920x1080 영역을 선택하되, y 위치를 프레임에 따라 변경
    // n: 현재 프레임 번호 (0부터 시작)
    // 아래(y=324)에서 시작하여 위(y=0)로 이동 - 이동 거리 3배 증가로 매우 부드럽고 역동적
    const totalFrames = Math.floor(durSec * 24);
    const panHeight = 324; // 1404 - 1080 (30% 오버스캔)
    const panPerFrame = (panHeight / totalFrames).toFixed(6);
    // crop의 y 파라미터를 표현식으로: max(0, 324 - (324/254)*n)
    // max() 함수로 끝에서 멈추도록 (0 이하로 내려가지 않음)
    const vfChain = `scale=2496:1404:force_original_aspect_ratio=decrease,pad=2496:1404:(ow-iw)/2:(oh-ih)/2,crop=1920:1080:288:'max(0,${panHeight}-${panPerFrame}*n)',setsar=1,format=yuv420p`;

    const clipArgs = [
      "-y",
      "-hide_banner",
      "-framerate",
      "24",
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

    // ✅ Clip generation command logging
    console.log(`\n--- Creating clip ${i + 1}/${N} ---`);
    console.log(`Image: ${path.basename(img)}`);
    console.log(`Duration: ${durSec.toFixed(2)}s`);
    console.log(`Command:\n  ffmpeg ${clipArgs.join(' \\\n    ')}`);
    console.log(`---\n`);

    try {
      // ✅ spawnFFmpegWithMonitoring 사용 (중복 코드 제거)
      await spawnFFmpegWithMonitoring(clipArgs, {
        timeout: 30000,
        processId: `clip-${i}`
      });

      // ✅ 실제 길이 확인
      const realSec = await probeDurationSec(clipOut);
      totalVideoSec += realSec;
    } catch (error) {
      console.error(`❌ 클립 ${i + 1} 생성 실패:`, error.message);
      throw new Error(`클립 생성 중단: ${error.message}`);
    }

    videoClips.push(clipOut);
    if (onMakeClipProgress) onMakeClipProgress(i + 1, N);
  }

  // ✅ tpad 제거: 각 씬이 정확한 길이로 생성되므로 불필요
  if (totalVideoSec < totalAudioSec - 0.5) {
    console.warn(`⚠️ 경고: 비디오가 오디오보다 ${(totalAudioSec - totalVideoSec).toFixed(2)}초 짧습니다.`);
    console.warn(`   마지막 영상이 반복 재생되지 않을 수 있습니다.`);
  }

  // ✅ 최종 검증
  if (videoClips.length === 0) {
    throw new Error("생성된 비디오 클립이 없습니다");
  }

  if (totalVideoSec < totalAudioSec - 0.5) {
    console.error(`\n⚠️⚠️⚠️ 경고: 비디오가 오디오보다 ${(totalAudioSec - totalVideoSec).toFixed(2)}초 짧습니다!`);
    console.error(`   이 상태로 인코딩하면 끝부분에서 영상이 멈추고 음성만 나옵니다.`);
    throw new Error(`비디오(${totalVideoSec.toFixed(2)}초)가 오디오(${totalAudioSec.toFixed(2)}초)보다 짧습니다.`);
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

  // ✅ 전역 자막 설정 로드 (검증 및 fallback 포함)
  const subtitleSettings = getSubtitleSettings();

  // ✅ enableSubtitles가 true이고 자막 파일이 존재할 때만 자막 렌더링
  if (subtitleSettings.enableSubtitles && subtitlePath && fs.existsSync(subtitlePath)) {
    // ✅ drawtext 필터로 자막 구현 (배경 박스 지원)
    const srtContent = fs.readFileSync(subtitlePath, "utf-8");
    const subtitles = parseSRT(srtContent);

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

  // ✅ Final concat command logging
  console.log(`\n${'='.repeat(80)}`);
  console.log(`[FFmpeg] Final concat command`);
  console.log(`   Input clips: ${videoClips.length}`);
  console.log(`   Filter_complex length: ${filterComplex.length} chars`);
  console.log(`\n[Filter_complex]:\n${filterComplex}\n`);
  console.log(`${'='.repeat(80)}\n`);

  // ✅ filter_complex가 길면 파일로 저장
  if (filterComplex.length > 3000) {
    const filterScriptPath = path.join(tempDir, `filter_${Date.now()}.txt`);
    await fsp.writeFile(filterScriptPath, filterComplex, "utf8");
    args.push("-filter_complex_script", filterScriptPath);
  } else {
    args.push("-filter_complex", filterComplex);
  }

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
// FFmpeg 실행 (쉘 스크립트 사용 - 긴 명령줄 처리, 크로스 플랫폼)
// ----------------------------------------------------------------------------
function runFFmpegViaShellScript(args, progressCallback = null) {
  return new Promise(async (resolve) => {
    // 취소 확인
    if (isExportCancelled) {
      return resolve({ success: false, error: "cancelled" });
    }

    const os = require("os");
    const isWindows = process.platform === "win32";

    let tempDir;
    try {
      tempDir = path.join(app.getPath("userData"), "ffmpeg-temp");
    } catch {
      tempDir = path.join(os.tmpdir(), "weaver-pro-ffmpeg-temp");
    }
    await fsp.mkdir(tempDir, { recursive: true });

    // 플랫폼별 스크립트 파일 생성
    const scriptExt = isWindows ? "bat" : "sh";
    const scriptPath = path.join(tempDir, `ffmpeg_${Date.now()}.${scriptExt}`);

    let scriptContent;
    let shellCommand;
    let shellArgs;

    if (isWindows) {
      // Windows: .bat 파일
      // 배치 파일에서 안전한 이스케이프
      const escapedArgs = args.map(arg => {
        // %를 %%로 변환 (배치 파일에서 변수로 해석되지 않도록)
        let escaped = arg.replace(/%/g, "%%");
        // 큰따옴표를 이스케이프
        escaped = escaped.replace(/"/g, '""');

        // ✅ 모든 인자를 기본적으로 큰따옴표로 감싸기 (경로 안전성)
        // 특히 공백이나 특수문자가 있을 때 필수
        return `"${escaped}"`;
      });

      // setlocal DisableDelayedExpansion으로 !도 안전하게 처리
      // 각 인자를 별도 줄로 분리 (^ 사용하여 줄바꿈)
      // 마지막 인자만 ^ 없이 종료
      const argsLines = escapedArgs.map((arg, i) => {
        if (i === escapedArgs.length - 1) {
          return `  ${arg}`;
        }
        return `  ${arg} ^`;
      }).join("\n");

      scriptContent = `@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul 2>&1 ^
"${ffmpegPath}" ^
${argsLines}
endlocal
exit /b %ERRORLEVEL%`;

      shellCommand = "cmd.exe";
      shellArgs = ["/c", scriptPath];
    } else {
      // Mac/Linux: .sh 파일
      // 인자를 쉘 이스케이프
      const escapeForShell = (arg) => {
        return arg
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\$/g, "\\$")
          .replace(/`/g, "\\`");
      };

      const escapedArgs = args.map(arg => {
        const escaped = escapeForShell(arg);
        return `"${escaped}"`;
      });

      // 각 인자를 별도 줄로 분리 (\ 사용하여 줄바꿈)
      // 마지막 인자만 \ 없이 종료
      const argsLines = escapedArgs.map((arg, i) => {
        if (i === escapedArgs.length - 1) {
          return `  ${arg}`;
        }
        return `  ${arg} \\`;
      }).join("\n");

      scriptContent = `#!/bin/sh
"${ffmpegPath}" \\
${argsLines}
exit $?`;

      shellCommand = "/bin/sh";
      shellArgs = [scriptPath];
    }

    try {
      // 스크립트 파일 작성
      // Windows: UTF-16LE (배치 파일 기본 인코딩), Mac/Linux: UTF-8
      const encoding = isWindows ? "utf16le" : "utf8";
      await fsp.writeFile(scriptPath, scriptContent, encoding);

      // Mac/Linux는 실행 권한 부여
      if (!isWindows) {
        await fsp.chmod(scriptPath, 0o755);
      }

      // ✅ FFmpeg script execution logging (English only)
      console.log(`\n${'='.repeat(80)}`);
      console.log(`[FFmpeg] Running script: ${scriptPath}`);
      console.log(`\n[Script Content]:\n${scriptContent}\n`);
      console.log(`${'='.repeat(80)}\n`);
    } catch (error) {
      console.error("❌ 스크립트 파일 생성 실패:", error);
      return resolve({ success: false, error: `스크립트 파일 생성 실패: ${error.message}` });
    }

    const timeoutMs = 15 * 60 * 1000;
    const proc = spawn(shellCommand, shellArgs, { windowsHide: isWindows });

    // 현재 프로세스 저장 (취소용)
    currentFfmpegProcess = proc;

    let out = "",
      err = "",
      completed = false;
    let totalDurationSec = null; // 전체 비디오 지속시간 (진행률 계산용)
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
      if (out.length > 10000) out = out.slice(-5000);
    });

    proc.stderr.on("data", (d) => {
      const s = d.toString();
      err += s;
      if (err.length > 10000) err = err.slice(-5000);
      if (progressCallback) {
        // Duration 추출 (한 번만)
        if (!totalDurationSec) {
          const durationMatch = /Duration: (\d{2}):(\d{2}):(\d{2})/i.exec(s);
          if (durationMatch) {
            const h = parseInt(durationMatch[1], 10);
            const mi = parseInt(durationMatch[2], 10);
            const se = parseInt(durationMatch[3], 10);
            totalDurationSec = h * 3600 + mi * 60 + se;
          }
        }

        // Progress 추출
        const m = /time=(\d{2}):(\d{2}):(\d{2})/i.exec(s);
        if (m) {
          const h = parseInt(m[1], 10),
            mi = parseInt(m[2], 10),
            se = parseInt(m[3], 10);
          const cur = h * 3600 + mi * 60 + se;

          // 총 지속시간이 있으면 정확한 진행률 계산, 없으면 추정값 사용
          let est;
          if (totalDurationSec && totalDurationSec > 0) {
            est = Math.max(0, Math.min(100, Math.round((cur / totalDurationSec) * 100)));
          } else {
            // Fallback: 기본값 1000초 가정
            est = Math.max(0, Math.min(100, Math.round((cur / 1000) * 100)));
          }

          progressCallback(est);
        }
      }
    });

    proc.on("close", async (code) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      // 현재 프로세스 초기화
      if (currentFfmpegProcess === proc) {
        currentFfmpegProcess = null;
      }

      // ✅ FFmpeg 종료 코드 로깅 (스크립트 실행)
      console.log(`[FFmpeg Exit Code (script): ${code}]`);
      if (code === 0 || err.length > 100) {
        console.log(`\n=== FFmpeg stderr (${err.length} chars) ===`);
        console.log(err);
        console.log(`=== stderr end ===\n`);
      }

      // 스크립트 파일 삭제
      try {
        await fsp.unlink(scriptPath);
      } catch (error) {
        console.warn(`⚠️ 스크립트 파일 삭제 실패:`, error.message);
      }

      if (code === 0) {
        resolve({ success: true, output: out || err, duration: extractDuration(err), size: 0 });
      } else {
        if (isExportCancelled) {
          resolve({ success: false, error: "cancelled" });
        } else {
          console.error(`[ERROR] FFmpeg failed (code: ${code})`);
          console.error(`\n=== FFmpeg stderr (${err.length} chars) ===`);
          console.error(err);  // Full output
          console.error(`=== stderr end ===\n`);
          resolve({ success: false, error: err || `FFmpeg exited with code ${code}` });
        }
      }
    });

    proc.on("error", async (e) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      // 현재 프로세스 초기화
      if (currentFfmpegProcess === proc) {
        currentFfmpegProcess = null;
      }

      // 스크립트 파일 삭제
      try {
        await fsp.unlink(scriptPath);
      } catch {}

      resolve({ success: false, error: e.message });
    });
  });
}

// FFmpeg 직접 실행 (기존 로직 분리)
function runFFmpegDirect(args, progressCallback, isCheck) {
  return new Promise((resolve) => {
    if (isExportCancelled) {
      return resolve({ success: false, error: "cancelled" });
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
    let totalDurationSec = null; // 전체 비디오 지속시간 (진행률 계산용)
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
      if (out.length > 10000) out = out.slice(-5000);
    });
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      err += s;
      if (err.length > 10000) err = err.slice(-5000);
      if (progressCallback && !isCheck) {
        // Duration 추출 (한 번만)
        if (!totalDurationSec) {
          const durationMatch = /Duration: (\d{2}):(\d{2}):(\d{2})/i.exec(s);
          if (durationMatch) {
            const h = parseInt(durationMatch[1], 10);
            const mi = parseInt(durationMatch[2], 10);
            const se = parseInt(durationMatch[3], 10);
            totalDurationSec = h * 3600 + mi * 60 + se;
          }
        }

        // Progress 추출
        const m = /time=(\d{2}):(\d{2}):(\d{2})/i.exec(s);
        if (m) {
          const h = parseInt(m[1], 10),
            mi = parseInt(m[2], 10),
            se = parseInt(m[3], 10);
          const cur = h * 3600 + mi * 60 + se;

          // 총 지속시간이 있으면 정확한 진행률 계산, 없으면 추정값 사용
          let est;
          if (totalDurationSec && totalDurationSec > 0) {
            est = Math.max(0, Math.min(100, Math.round((cur / totalDurationSec) * 100)));
          } else {
            // Fallback: 기본값 1000초 가정하되, 더 정확한 추정 제공
            est = Math.max(0, Math.min(100, Math.round((cur / 1000) * 100)));
          }

          progressCallback(est);
        }
      }
    });

    proc.on("close", (code) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      if (currentFfmpegProcess === proc) {
        currentFfmpegProcess = null;
      }

      // ✅ FFmpeg 종료 코드와 stderr 로깅 (모든 경우)
      console.log(`[FFmpeg Exit Code: ${code}]`);
      if (!isCheck && (code === 0 || err.length > 100)) {
        console.log(`\n=== FFmpeg stderr (${err.length} chars) ===`);
        console.log(err);
        console.log(`=== stderr end ===\n`);
      }

      if (code === 0 || isCheck) {
        resolve({ success: code === 0, output: out || err, duration: extractDuration(err), size: 0 });
      } else {
        if (isExportCancelled) {
          resolve({ success: false, error: "cancelled" });
        } else {
          console.error(`[ERROR] FFmpeg failed (code: ${code})`);
          console.error(`\n=== FFmpeg stderr (${err.length} chars) ===`);
          console.error(err);  // Full output
          console.error(`=== stderr end ===\n`);
          resolve({ success: false, error: err || `FFmpeg exited with code ${code}` });
        }
      }
    });

    proc.on("error", (e) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);

      if (currentFfmpegProcess === proc) {
        currentFfmpegProcess = null;
      }

      resolve({ success: false, error: e.message });
    });
  });
}

// ----------------------------------------------------------------------------
// FFmpeg 실행
// ----------------------------------------------------------------------------
function runFFmpeg(args, progressCallback = null, isCheck = false) {
  // 명령줄 길이 계산
  const argsString = args.join(" ");
  const commandLength = ffmpegPath.length + argsString.length + args.length; // 공백 포함

  // 긴 명령줄은 쉘 스크립트 사용 (크로스 플랫폼 지원)
  // Windows: cmd.exe (8191자 제한) → .bat 파일 (제한 없음)
  // Mac/Linux: /bin/sh (ARG_MAX 제한, 보통 256KB~2MB) → .sh 파일 (제한 없음)
  if (commandLength > 6000 && !isCheck) {
    return runFFmpegViaShellScript(args, progressCallback);
  }

  // 짧은 명령줄은 직접 실행
  return runFFmpegDirect(args, progressCallback, isCheck);
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
      // fontSize를 포함해서 전달 (폰트 크기에 따른 픽셀 기반 줄바꿈)
      let text = scene.text || "";
      const lines = splitBalancedLines(text, subtitleSettings.maxLines, subtitleSettings.fontSize);
      console.log(`[SRT 생성] 원본 텍스트: "${text}" (${text.length}글자)`);
      console.log(`[SRT 생성] fontSize: ${subtitleSettings.fontSize}, maxLines: ${subtitleSettings.maxLines}`);
      console.log(`[SRT 생성] 분할 결과: ${lines.length}줄`, lines);
      text = lines.join("\n");

      srtContent += `${i + 1}\n`;
      srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
      srtContent += `${text}\n\n`;

      accumulatedTime = endTime;
    }

    await fsp.writeFile(srtPath, srtContent, "utf8");
    return srtPath;
  } catch (error) {
    console.error("❌ SRT 자막 파일 생성 실패:", error);
    throw error;
  }
}

// ✅ 각 씬별 비디오/이미지 클립 생성
async function generateClips(scenes, mediaFiles, sceneDurationsMs, tempDir, event) {
  const videoClips = [];
  const MIN_CLIP_DURATION = 0.25;
  let totalVideoSec = 0;

  for (let i = 0; i < scenes.length; i++) {
    // 취소 확인
    if (isExportCancelled) {
      throw new Error("cancelled");
    }

    const scene = scenes[i];
    const mediaPath = mediaFiles[i];
    const durSec = Math.max(MIN_CLIP_DURATION, (sceneDurationsMs[i] || 3000) / 1000);

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
      const loopCount = originalDuration > durSec ? 0 : -1;

      const vfChain = `scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;
      const videoArgs = ["-y", "-hide_banner"];

      if (loopCount === -1) {
        videoArgs.push("-stream_loop", "-1");
      }

      videoArgs.push(
        "-i", mediaPath,
        "-t", durSec.toFixed(3),
        "-vf", vfChain,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-r", "24",
        "-pix_fmt", "yuv420p",
        "-an",
        "-avoid_negative_ts", "make_zero",
        "-fflags", "+genpts+discardcorrupt",
        videoClipOut
      );

      try {
        await spawnFFmpegWithMonitoring(videoArgs, {
          timeout: 60000,
          processId: `compose-video-${i}`
        });
      } catch (error) {
        if (error.message === "사용자에 의해 취소됨") {
          throw new Error("cancelled");
        }
        console.error(`[ERROR] Video clip ${i + 1} failed: ${error.message}`);
        throw error;
      }

      videoClips.push(videoClipOut);
      const realSec = await probeDurationSec(videoClipOut);
      totalVideoSec += realSec;
    } else if (scene.asset.type === "image") {
      // 이미지: duration 동안 패닝 효과와 함께 표시
      const imageClipOut = path.join(tempDir, `scene_${String(i).padStart(3, "0")}_${Date.now()}.mp4`);

      const totalFrames = Math.floor(durSec * 24);
      const panHeight = 324;
      const panPerFrame = (panHeight / totalFrames).toFixed(6);
      const vfChain = `scale=2496:1404:force_original_aspect_ratio=decrease,pad=2496:1404:(ow-iw)/2:(oh-ih)/2,crop=1920:1080:288:'max(0,${panHeight}-${panPerFrame}*n)',setsar=1,format=yuv420p`;

      const imageArgs = [
        "-y", "-hide_banner",
        "-framerate", "24",
        "-loop", "1",
        "-i", mediaPath,
        "-t", durSec.toFixed(3),
        "-vf", vfChain,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-r", "24",
        "-pix_fmt", "yuv420p",
        "-avoid_negative_ts", "make_zero",
        "-fflags", "+genpts+discardcorrupt",
        imageClipOut,
      ];

      try {
        await spawnFFmpegWithMonitoring(imageArgs, {
          timeout: 60000,
          processId: `compose-image-${i}`
        });
      } catch (error) {
        if (error.message === "사용자에 의해 취소됨") {
          throw new Error("cancelled");
        }
        console.error(`[ERROR] Image clip ${i + 1} failed: ${error.message}`);
        throw error;
      }

      videoClips.push(imageClipOut);
      const realSec = await probeDurationSec(imageClipOut);
      totalVideoSec += realSec;
    }

    // 진행률 전송
    if (event?.sender) {
      const progress = Math.round(((i + 1) / scenes.length) * 50);
      event.sender.send("ffmpeg:progress", progress);
    }
  }

  return { videoClips, totalVideoSec };
}

// ✅ 오디오 concat 파일 설정
async function setupAudioConcat(audioFiles, tempDir) {
  if (!audioFiles || audioFiles.length === 0) {
    return null;
  }

  const audioConcatPath = path.join(tempDir, `audio_concat_${Date.now()}.txt`);
  const audioConcatContent = audioFiles
    .map((filePath) => {
      const escapedPath = filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
      return `file '${escapedPath}'`;
    })
    .join("\n");
  await fsp.writeFile(audioConcatPath, audioConcatContent, "utf8");
  return audioConcatPath;
}

// ✅ 최종 FFmpeg 필터 복합체 구성
function buildFinalFilterComplex(videoClips, audioFiles, srtPath) {
  let filterComplex = videoClips.map((_, i) => `[${i}:v]`).join("");
  filterComplex += `concat=n=${videoClips.length}:v=1:a=0[outv]`;

  let finalVideoLabel = "[outv]";
  const subtitleSettings = getSubtitleSettings();

  if (subtitleSettings.enableSubtitles && srtPath && fs.existsSync(srtPath)) {
    const srtContent = fs.readFileSync(srtPath, "utf-8");
    const subtitles = parseSRT(srtContent);

    let currentLabel = "[outv]";
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];
      const nextLabel = i === subtitles.length - 1 ? "[v]" : `[st${i}]`;

      const drawtextFilter = createDrawtextFilterAdvanced(subtitle, subtitleSettings, null, 1920, 1080);
      filterComplex += `;${currentLabel}${drawtextFilter}${nextLabel}`;
      currentLabel = nextLabel;
    }

    finalVideoLabel = "[v]";
  } else {
    filterComplex += `;[outv]format=yuv420p[v]`;
    finalVideoLabel = "[v]";
  }

  return { filterComplex, finalVideoLabel };
}

// ✅ 씬 기반 비디오 합성 (비디오/이미지 혼합 지원)
// 핵심 로직:
// 1. 각 씬별 비디오/이미지 클립 생성 → generateClips()
// 2. 오디오 concat 파일 준비 → setupAudioConcat()
// 3. 최종 FFmpeg 필터 복합체 구성 → buildFinalFilterComplex()
// 4. FFmpeg 실행 및 결과 처리
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

  // 1️⃣ 각 씬별 비디오/이미지 클립 생성
  const { videoClips } = await generateClips(scenes, mediaFiles, sceneDurationsMs, tempDir, event);

  if (videoClips.length === 0) {
    throw new Error("생성된 비디오 클립이 없습니다");
  }

  // 2️⃣ 오디오 concat 파일 준비
  const audioConcatPath = await setupAudioConcat(audioFiles, tempDir);

  // 3️⃣ FFmpeg 최종 arguments 구성
  const finalArgs = ["-y", "-hide_banner"];

  // 비디오 클립들을 입력으로 추가
  videoClips.forEach((clip) => {
    finalArgs.push("-i", clip);
  });

  // 오디오는 concat demuxer로 추가
  const audioInputIndex = videoClips.length;
  if (audioConcatPath) {
    finalArgs.push("-f", "concat", "-safe", "0", "-i", audioConcatPath);
  }

  // 4️⃣ 필터 복합체 구성
  const { filterComplex, finalVideoLabel } = buildFinalFilterComplex(videoClips, audioFiles, srtPath);

  // ✅ filter_complex가 길면 파일로 저장
  if (filterComplex.length > 3000) {
    const filterScriptPath = path.join(tempDir, `filter_${Date.now()}.txt`);
    await fsp.writeFile(filterScriptPath, filterComplex, "utf8");
    finalArgs.push("-filter_complex_script", filterScriptPath);
  } else {
    finalArgs.push("-filter_complex", filterComplex);
  }

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

  // ✅ 한글 경로 처리: 임시 경로 사용 후 최종 경로로 이동
  let finalOutputPath = outputPath;
  let tempOutputPath = outputPath;

  // 한글이 포함되어 있으면 임시 경로 사용
  if (/[㄀-ㅎ|ㅏ-ㅣ|가-힣]/.test(outputPath)) {
    tempOutputPath = path.join(tempDir, `video_${Date.now()}.mp4`);
    console.log(`⚠️ 한글 경로 감지, 임시 경로 사용: ${tempOutputPath}`);
    console.log(`   최종 경로: ${finalOutputPath}`);
  }

  finalArgs.push(tempOutputPath);

  // ✅ FFmpeg 명령어 로깅
  console.log(`🎬 FFmpeg 실행 시작...`);
  console.log(`   Output: ${tempOutputPath}`);
  console.log(`   Args: ${finalArgs.length}개 인자`);

  const result = await runFFmpeg(finalArgs, (progress) => {
    if (event?.sender) {
      const mapped = 50 + Math.round((progress / 100) * 50); // 50-100%
      event.sender.send("ffmpeg:progress", Math.min(99, mapped));
    }
  });

  // ✅ FFmpeg 실행 결과 상세 로깅
  console.log(`🎬 FFmpeg 실행 완료`);
  console.log(`   Success: ${result.success}`);
  if (result.output) {
    console.log(`   Output: ${result.output.substring(0, 500)}...`);
  }
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }

  // ✅ FFmpeg 성공 후 파일 생성 확인
  if (result.success) {
    const fileExists = fs.existsSync(tempOutputPath);
    console.log(`   File exists: ${fileExists} (${tempOutputPath})`);

    if (!fileExists) {
      console.error(`❌ FFmpeg 성공했으나 파일 없음: ${tempOutputPath}`);

      // 임시 폴더 확인
      try {
        const tempDirContents = fs.readdirSync(tempDir);
        console.log(`   Temp dir 내용 (${tempDirContents.length}개):`, tempDirContents.slice(0, 10));
      } catch (e) {
        console.error(`   Temp dir 읽기 실패: ${e.message}`);
      }

      return { success: false, error: "FFmpeg 실행 완료했으나 파일이 생성되지 않았습니다." };
    }

    // 임시 경로 사용 시 최종 경로로 이동
    if (tempOutputPath !== finalOutputPath) {
      try {
        await fsp.mkdir(path.dirname(finalOutputPath), { recursive: true });
        await fsp.rename(tempOutputPath, finalOutputPath);
        console.log(`✅ 파일 이동 완료: ${tempOutputPath} → ${finalOutputPath}`);
      } catch (moveError) {
        console.error(`❌ 파일 이동 실패: ${moveError.message}`);
        // 이동 실패 시 복사 시도
        try {
          await fsp.mkdir(path.dirname(finalOutputPath), { recursive: true });
          await fsp.copyFile(tempOutputPath, finalOutputPath);
          await fsp.unlink(tempOutputPath);
          console.log(`✅ 파일 복사로 완료: ${tempOutputPath} → ${finalOutputPath}`);
        } catch (copyError) {
          console.error(`❌ 파일 복사도 실패: ${copyError.message}`);
          return { success: false, error: `파일 이동/복사 실패: ${copyError.message}` };
        }
      }
    }
  }

  if (result.success && event?.sender) {
    event.sender.send("ffmpeg:progress", 100);
  }

  // ✅ 최종 경로를 반환 결과에 추가
  if (result.success) {
    result.outputPath = finalOutputPath;
  }

  return result;
}

module.exports = { register };
