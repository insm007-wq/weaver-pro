// AI 모델 관련 상수들
export const DEFAULT_SETTINGS = {
  // videoSaveFolder는 electron에서 OS별로 자동 설정됨
  defaultResolution: "1080p",
  imageModel: "sdxl",
  videoModel: "veo-3",
  imageResolution: "1024x1024",
  videoQuality: "1080p",
  llmModel: "anthropic",
  ttsEngine: "google",
  ttsSpeed: "1.0",
};

export const AI_OPTIONS = {
  imageModels: [
    { value: "flux-dev", text: "Flux Dev (고품질)", cost: "35원/장", provider: "Replicate", status: "available" },
    { value: "flux-schnell", text: "Flux Schnell (속도 우선)", cost: "15원/장", provider: "Replicate", status: "available" },
    { value: "sdxl", text: "Stable Diffusion XL", cost: "무료", provider: "Replicate", status: "available" },
    { value: "midjourney", text: "Midjourney (예술적)", cost: "별도 요금", provider: "Midjourney", status: "준비 중" },
  ],

  imageResolutions: [
    { value: "512x512", text: "512x512", speed: "빠름" },
    { value: "1024x1024", text: "1024x1024", speed: "표준" },
    { value: "1536x1536", text: "1536x1536", speed: "고화질" },
    { value: "2048x2048", text: "2048x2048", speed: "최고화질" },
  ],

  videoModels: [
    { value: "veo-3", text: "Google Veo 3", length: "8초", provider: "Google", status: "추천" },
    { value: "kling", text: "Kling AI", length: "5초", provider: "Kuaishou", status: "준비 중" },
    { value: "runway", text: "Runway ML", length: "4초", provider: "Runway", status: "준비 중" },
    { value: "pika", text: "Pika Labs", length: "3초", provider: "Pika", status: "준비 중" },
    { value: "stable-video", text: "Stable Video", length: "4초", provider: "Stability AI", status: "무료" },
  ],

  videoQualities: [
    { value: "720p", text: "720p", speed: "빠름" },
    { value: "1080p", text: "1080p", speed: "표준" },
    { value: "4k", text: "4K", speed: "느림" },
  ],

  llmModels: [
    { value: "replicate", text: "🦙 Replicate Llama 3", provider: "Replicate", cost: "저렴함" },
    { value: "anthropic", text: "🧠 Anthropic Claude", provider: "Anthropic", cost: "안정성" },
  ],

  ttsEngines: [
    {
      value: "google",
      text: "Google Cloud TTS",
      provider: "Google",
      description: "안정적 발음, 자연스러운 한국어",
      status: "available",
      languages: ["ko-KR", "en-US", "ja-JP"]
    },
    // 향후 추가될 TTS 엔진들 (Amazon Polly, KT 보이스, ElevenLabs 등)
  ],

  ttsSpeeds: [
    { value: "0.9", text: "느림 (0.9x)" },
    { value: "1.0", text: "보통 (1.0x)" },
    { value: "1.1", text: "빠름 (1.1x)" },
  ],
};

export const AI_MODEL_INFO = {
  title: "AI 모델 관련 참고 사항",
  description: [
    "프레임레이트: **24fps** 고정",
    "영상 길이: 모델별 제한 (Veo 3: 8초, Kling: 5초)",
    "오디오 생성: AI 모델에 따라 지원 여부 상이"
  ]
};