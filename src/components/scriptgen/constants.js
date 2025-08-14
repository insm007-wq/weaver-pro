export const DUR_OPTIONS = [1, 3, 5, 7, 10, 15];
export const MAX_SCENE_OPTIONS = [6, 8, 10, 12, 15, 20];

export const LLM_OPTIONS = [
  { label: "Anthropic Claude 3.5/3.7", value: "anthropic" },
  { label: "Minimax abab", value: "minimax" },
  { label: "OpenAI GPT-5 mini", value: "openai-gpt5mini" },
];

export const TTS_ENGINES = [
  { label: "Google Cloud TTS", value: "google" },
  { label: "Azure Speech", value: "azure" },
  { label: "Amazon Polly", value: "polly" },
  { label: "OpenAI TTS", value: "openai" },
];

export const VOICES_BY_ENGINE = {
  google: [
    "ko-KR-Wavenet-A",
    "ko-KR-Wavenet-B",
    "ko-KR-Standard-A",
    "ko-KR-Standard-B",
  ],
  azure: ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"],
  polly: ["Seoyeon"],
  openai: ["alloy", "nova", "verse"],
};

export const DEFAULT_GENERATE_PROMPT = `다음 조건에 맞는 {duration}분 길이의 영상 대본을 작성해주세요:

주제: {topic}
스타일: {style}
언어: 한국어
최대 장면 수: {maxScenes}개

요구사항:
- 장면 수는 가능한 한 최대 장면 수에 가깝게 분할
- 자연스러운 구어체
- JSON 외 텍스트 금지`;

export const DEFAULT_REFERENCE_PROMPT = `## 레퍼런스 대본 분석 및 적용

다음 레퍼런스 대본을 분석하고 그 장점을 활용해주세요:

=== 레퍼런스 대본 ===
{referenceScript}
=== 레퍼런스 대본 끝 ===

요구사항:
- 레퍼런스의 구조/톤/템포를 참고하되, 표절 없이 새로 작성
- 한국어 구어체
- JSON 외 텍스트 금지`;
