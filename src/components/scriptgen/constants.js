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
  google: ["ko-KR-Wavenet-A", "ko-KR-Wavenet-B", "ko-KR-Standard-A", "ko-KR-Standard-B"],
  azure: ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"],
  polly: ["Seoyeon"],
  openai: ["alloy", "nova", "verse"],
};

export const DEFAULT_GENERATE_PROMPT = `다음 조건에 맞는 {duration}분 길이의 영상 대본을 작성해주세요.

주제: {topic}
스타일: {style}
언어: 한국어
장면 수: 정확히 {maxScenes}개

## 📝 대본 작성 가이드

**실제 음성 시간 기준**
- 한국어 평균 말하기 속도: 분당 300~400자
- 총 {duration}분 (아래 자동 계산된 제약을 반드시 따르세요)

## ✅ 절대 규칙(반드시 지켜야 함)
1) 모든 장면의 duration(초) 합계 = 정확히 [AUTO_TOTAL_SECONDS]초
2) 전체 텍스트 길이(모든 장면 text 합산) ≥ [AUTO_MIN_CHARS]자 (권장: [AUTO_MIN_CHARS]~[AUTO_MAX_CHARS]자)
3) 각 장면의 text는 해당 duration에 비례해 충분한 분량으로 작성(짧은 텍스트에 긴 duration 금지)
4) 장면 수는 정확히 {maxScenes}개
5) 접두어/화자명/대괄호 등 불필요한 표기는 text에 넣지 말 것
6) 가능한 한 구체적 예시·배경 설명·단계별 설명을 포함해 내용 밀도를 높일 것

## 🔒 자동 계산 제약(모델이 반드시 준수)
- 총 시간(초): [AUTO_TOTAL_SECONDS]
- 총 글자수 최소/권장: [AUTO_MIN_CHARS] ~ [AUTO_MAX_CHARS]
- 장면당 평균 최소 글자수: [AUTO_AVG_PER_SCENE]자 이상

## 🔎 출력 형식(중요: 유효한 JSON만 반환. 다른 텍스트 금지)
{
  "title": "흥미롭고 구체적인 영상 제목",
  "total_duration": {duration},
  "total_characters": "숫자(전체 글자 수)",
  "scenes": [
    {
      "scene_number": 1,
      "text": "장면 1의 상세한 대본 텍스트입니다. 배경 설명·예시·단계별 설명을 포함하여 충분한 분량으로 작성하세요...",
      "duration": 45,
      "character_count": "숫자(이 장면의 글자 수)",
      "visual_description": "이 장면에서 보여줄 구체적인 시각 요소 설명"
    }
  ]
}

## ✅ 자체 검증(모델이 체크)
- scenes 길이 = {maxScenes}
- sum(scenes[*].duration) = [AUTO_TOTAL_SECONDS]
- 총 글자수 ≥ [AUTO_MIN_CHARS]
- 각 장면 분량이 duration에 비례하여 충분한지
- JSON 외 추가 텍스트 절대 금지
`;

export const DEFAULT_REFERENCE_PROMPT = `## 레퍼런스 대본 분석 및 적용

다음 레퍼런스 대본을 분석하고 그 장점을 활용해주세요:

=== 레퍼런스 대본 ===
{referenceScript}
=== 레퍼런스 대본 끝 ===

레퍼런스 대본 분석 요청:
1. 위 레퍼런스 대본의 어투와 스타일을 분석하세요
2. 문장 구조와 전개 방식을 파악하세요
3. 시청자의 관심을 끄는 방법을 찾으세요
4. 정보 전달 방식과 설명 기법을 분석하세요
5. 장면 전환과 흐름을 참고하세요

적용 방법:
- 레퍼런스 대본의 어투와 스타일을 유지하면서 내 주제({topic})에 맞게 변형
- 레퍼런스 대본의 구조적 장점을 참고하되, 새로운 내용으로 완전히 재작성
- 레퍼런스 대본의 시청자 참여 방식이나 설명 기법을 활용
- 전체적인 톤앤매너와 전개 방식을 참고하여 더 매력적인 대본 생성

주의사항:
- 레퍼런스 대본의 내용을 복사하지 말고, 스타일과 구조만 참고하세요
- 반드시 주제({topic})에 맞는 새로운 내용으로 작성하세요
- 레퍼런스 대본보다 더 나은 품질의 대본을 만들어주세요`;
