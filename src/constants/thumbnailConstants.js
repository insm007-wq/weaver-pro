// 업로드 정책
export const MAX_UPLOAD_MB = 10;

// 품질 설정 프리셋
export const QUALITY_PRESETS = [
  {
    value: "fast",
    label: "빠른 생성",
    steps: 20,
    cfg: 7,
    description: "빠른 속도, 적절한 품질",
    estimatedTime: "약 10-15초",
  },
  {
    value: "balanced",
    label: "균형 잡힌",
    steps: 30,
    cfg: 8,
    description: "속도와 품질의 균형",
    estimatedTime: "약 20-30초",
  },
  {
    value: "quality",
    label: "최고 품질",
    steps: 50,
    cfg: 10,
    description: "최상의 품질, 느린 속도",
    estimatedTime: "약 40-60초",
  },
];

// 지원하는 파일 형식
export const SUPPORTED_IMAGE_TYPES = /image\/(png|jpe?g)$/i;
export const SUPPORTED_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg"];

// 기본 프롬프트 키워드
export const DEFAULT_PROMPT_KEYWORDS = {
  common: [
    "ultra-realistic",
    "cinematic style",
    "dramatic lighting",
    "16:9 aspect ratio",
    "no text, no words, no letters",
    "thumbnail-friendly framing",
  ],
  dramatic: [
    "high contrast",
    "emotional clarity", 
    "tense atmosphere"
  ],
  calm: [
    "soft lighting",
    "natural mood",
    "subtle color palette"
  ],
};