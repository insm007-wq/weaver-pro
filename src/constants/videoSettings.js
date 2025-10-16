// 비디오 설정 관련 상수들
export const VIDEO_RESOLUTION_OPTIONS = [
  { value: "720p", label: "720p (HD)", width: 1280, height: 720 },
  { value: "1080p", label: "1080p (Full HD)", width: 1920, height: 1080 },
  { value: "1440p", label: "1440p (2K)", width: 2560, height: 1440 },
  { value: "2160p", label: "2160p (4K)", width: 3840, height: 2160 },
];

export const VIDEO_FRAME_RATE_OPTIONS = [
  { value: 24, label: "24fps (영화)" },
  { value: 30, label: "30fps (표준)" },
  { value: 60, label: "60fps (고품질)" },
];

export const VIDEO_CODEC_OPTIONS = [
  { value: "h264", label: "H.264 (호환성 우수)" },
  { value: "h265", label: "H.265 (고압축)" },
  { value: "av1", label: "AV1 (최신 압축)" },
];

export const VIDEO_BITRATE_OPTIONS = [
  { value: "low", label: "낮음 (파일 크기 작음)" },
  { value: "medium", label: "보통 (균형)" },
  { value: "high", label: "높음 (고품질)" },
  { value: "custom", label: "사용자 정의" },
];

export const ASPECT_RATIO_OPTIONS = [
  { value: "16:9", label: "16:9 (와이드스크린)" },
  { value: "9:16", label: "9:16 (세로형)" },
  { value: "1:1", label: "1:1 (정사각형)" },
  { value: "4:3", label: "4:3 (클래식)" },
];