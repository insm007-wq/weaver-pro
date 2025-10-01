// 대본 생성 설정 관련 상수들
export const DUR_OPTIONS = [1, 3, 5, 7, 10, 15, 20, 25, 30];

export const STYLE_OPTIONS = [
  { key: "informative", text: "📚 정보 전달형", desc: "교육적이고 명확한 설명" },
  { key: "engaging", text: "🎯 매력적인", desc: "흥미롭고 재미있는 톤" },
  { key: "professional", text: "💼 전문적인", desc: "비즈니스에 적합한 스타일" },
  { key: "casual", text: "😊 캐주얼한", desc: "친근하고 편안한 분위기" },
  { key: "dramatic", text: "🎭 극적인", desc: "강렬하고 임팩트 있는 전개" },
  { key: "storytelling", text: "📖 스토리텔링", desc: "이야기 형식의 구성" },
];

export const DURATION_OPTIONS = [
  { key: 3, text: "3분 (표준)" },
  { key: 5, text: "5분 (중편)" },
  { key: 10, text: "10분 (긴편)" },
  { key: 15, text: "15분 (중간편)" },
  { key: 20, text: "20분 (장편)" },
  { key: 30, text: "30분 (초장편)" },
];

// 영상 길이별 최적 장면 수를 자동 계산하여 제공하므로 MAX_SCENE_OPTIONS는 사용하지 않음
// 대신 getRecommendedScenes 함수에서 동적으로 계산됨

export const IMAGE_STYLE_OPTIONS = [
  { key: "photo", text: "실사" },
  { key: "illustration", text: "일러스트" },
  { key: "cinematic", text: "시네마틱" },
  { key: "sketch", text: "스케치" },
];

export const AI_ENGINE_OPTIONS = [
  {
    key: "anthropic",
    text: "🧠 Anthropic Claude",
    desc: "Claude Sonnet/Haiku, 정확하고 자연스러운 문체",
    processingTime: "1-3분",
    features: ["✨ 자연스런 문체", "🎪 창의성", "📚 교육적"],
    rating: 4.9,
  },
  {
    key: "replicate",
    text: "🦙 Replicate Llama",
    desc: "Llama 3 모델, 빠르고 효율적",
    processingTime: "1-2분",
    features: ["⚡ 빠른 속도", "💰 비용 효율", "🎯 정확성"],
    rating: 4.6,
  },
];

export const ADVANCED_PRESETS = [
  {
    name: "🎯 유튜브 최적화",
    description: "유튜브 알고리즘에 최적화된 설정",
    settings: {
      style: "engaging",
      durationMin: 8,
      maxScenes: 12,
      temperature: 1.1,
      imageStyle: "cinematic",
    },
  },
  {
    name: "📚 교육 컨텐츠",
    description: "교육용 영상에 최적화된 설정",
    settings: {
      style: "informative",
      durationMin: 5,
      maxScenes: 8,
      temperature: 0.9,
      imageStyle: "illustration",
    },
  },
  {
    name: "💼 비즈니스 프레젠테이션",
    description: "기업 발표용 영상 설정",
    settings: {
      style: "professional",
      durationMin: 3,
      maxScenes: 6,
      temperature: 0.8,
      imageStyle: "photo",
    },
  },
  {
    name: "🎪 엔터테인먼트",
    description: "재미있고 매력적인 콘텐츠 설정",
    settings: {
      style: "dramatic",
      durationMin: 2,
      maxScenes: 10,
      temperature: 1.2,
      imageStyle: "cinematic",
    },
  },
];

export const GENERATION_TYPE_OPTIONS = [
  { value: "auto", label: "자동 생성", description: "주제와 스타일 기반 자동 대본 생성" },
  { value: "reference", label: "레퍼런스 기반", description: "기존 대본을 참고하여 유사한 스타일로 생성" },
  { value: "template", label: "템플릿 사용", description: "사전 정의된 템플릿 기반 생성" },
  { value: "custom", label: "사용자 정의", description: "직접 작성한 프롬프트 사용" },
];

export const CPM_PRESETS = [
  { label: "빠른 속도 (400-500자/분)", min: 400, max: 500 },
  { label: "표준 속도 (300-400자/분)", min: 300, max: 400 },
  { label: "느린 속도 (200-300자/분)", min: 200, max: 300 },
  { label: "사용자 정의", min: null, max: null },
];

export const LLM_OPTIONS = [
  { label: "Anthropic Claude 3.5/3.7", value: "anthropic" },
  { label: "Replicate Llama 3", value: "replicate" },
];

export const makeDefaultForm = () => ({
  topic: "",
  style: "informative",
  durationMin: 3, // 기본값 3분
  aiEngine: "anthropic",
  temperature: 1.0,
  imageStyle: "cinematic",
  generateImages: true,
  generateVoice: true,
  ttsEngine: "google",
  voice: "ko-KR-Wavenet-A",
  cpmMin: 300, // 분당 최소 글자수 (한국어 TTS 기준)
  cpmMax: 400, // 분당 최대 글자수
});