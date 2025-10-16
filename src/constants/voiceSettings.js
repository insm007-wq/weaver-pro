// 음성 설정 관련 상수들
export const TTS_ENGINES = [
  { label: "Google Cloud TTS", value: "google" },
  { label: "Azure Speech", value: "azure" },
  { label: "Amazon Polly", value: "polly" },
  { label: "OpenAI TTS", value: "openai" },
];

export const VOICES_BY_ENGINE = {
  google: ["ko-KR-Wavenet-A", "ko-KR-Wavenet-B", "ko-KR-Standard-A", "ko-KR-Standard-B"],
  azure: ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"],
  polly: ["Seoyeon"],
  openai: ["alloy", "nova", "verse"],
};

export const VOICE_SPEED_OPTIONS = [
  { value: 0.5, label: "0.5x (매우 느림)" },
  { value: 0.75, label: "0.75x (느림)" },
  { value: 1.0, label: "1.0x (보통)" },
  { value: 1.25, label: "1.25x (빠름)" },
  { value: 1.5, label: "1.5x (매우 빠름)" },
];

export const VOICE_PITCH_OPTIONS = [
  { value: -5, label: "-5 (매우 낮음)" },
  { value: -2, label: "-2 (낮음)" },
  { value: 0, label: "0 (보통)" },
  { value: 2, label: "+2 (높음)" },
  { value: 5, label: "+5 (매우 높음)" },
];

export const AUDIO_FORMAT_OPTIONS = [
  { value: "mp3", label: "MP3 (표준)" },
  { value: "wav", label: "WAV (고품질)" },
  { value: "aac", label: "AAC (압축)" },
];