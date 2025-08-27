export const DUR_OPTIONS = [1, 3, 5, 7, 10, 15, 20, 25, 30];
export const MAX_SCENE_OPTIONS = [6, 8, 10, 12, 15, 20, 25, 30];

export const LLM_OPTIONS = [
  { label: "Anthropic Claude 3.5/3.7", value: "anthropic" },
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

## 📝 대본 작성 가이드

**실제 음성 시간 기준:**
- 한국어 음성 속도: 분당 300-400자
- 총 {duration}분 = 총 {minCharacters}-{maxCharacters}자 필요
- 각 장면 평균 {avgCharactersPerScene}자 이상 필수

**장면별 분량 계산:**
- 5초 = 25-35자
- 10초 = 50-70자  
- 30초 = 150-200자
- 60초 = 300-400자

**절대 규칙:**
1. 각 장면의 duration은 실제 text 길이와 정확히 일치해야 함
2. 짧은 텍스트에 긴 duration 절대 금지
3. 총 텍스트 길이가 {minCharacters}자 미만이면 무조건 더 추가
4. 모든 장면의 duration 합계가 정확히 {totalSeconds}초여야 함

## 🎬 풍부하고 상세한 {duration}분 대본 생성 가이드

**🔥 핵심 목표: 반드시 {duration}분 전체를 채우는 충분한 분량**
- 절대로 짧은 대본을 작성하지 마세요
- 각 주제를 깊이 있고 상세하게 다루어 시간을 충분히 채우세요
- 시청자가 {duration}분 내내 몰입할 수 있는 풍부한 내용 제공

**상세한 텍스트 작성 전략:**
1. **인트로 확장**: 주제 소개를 단순히 한 문장이 아닌, 배경 설명, 중요성, 시청자 혜택까지 포함
2. **구체적 예시 다수 포함**: 하나의 포인트마다 여러 개의 실제 사례와 예시 제시
3. **단계별 상세 설명**: 과정이나 방법을 설명할 때 각 단계를 자세히 풀어서 설명
4. **배경 정보 추가**: 왜 그런지, 어떤 원리인지 배경 지식까지 설명
5. **시청자 관점 포함**: "여러분도 이런 경험 있으시죠?", "많은 분들이 궁금해하시는" 등 공감대 형성

**필수 분량 검증:**
- 각 장면 텍스트를 실제로 소리내서 읽어보세요
- 읽는 시간이 설정한 duration과 정확히 맞는지 확인
- 전체 텍스트 읽는데 정말로 {duration}분이 걸리는지 반드시 검증
- 만약 부족하면 더 많은 설명, 예시, 배경 정보를 추가하세요

**🔥 중요**: 반드시 유효한 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

응답 형식:
{
  "title": "흥미롭고 구체적인 영상 제목",
  "total_duration": {duration},
  "total_characters": "실제 총 글자 수 ({minCharacters}자 이상)",
  "scenes": [
    {
      "scene_number": 1,
      "text": "장면 1의 상세한 대본 텍스트입니다. 예를 들어, 이 주제가 왜 중요한지부터 시작해서 구체적인 예시를 들어 설명하겠습니다...",
      "duration": 45,
      "character_count": "이 장면의 실제 글자 수",
      "visual_description": "이 장면에서 보여줄 구체적이고 상세한 시각적 요소 설명"
    }
  ]
}

## 🚨 절대 준수 사항

**분량 절대 기준:**
✅ 전체 시간: 정확히 NaN초 ({duration}분)
✅ 최소 글자 수: {minCharacters}자 이상 (절대 이보다 적으면 안됨!)
✅ 권장 글자 수: {minCharacters}-{maxCharacters}자
✅ 각 장면마다 충분한 텍스트 분량 (duration에 맞는 적절한 길이)

**내용 풍부함 검증:**
✅ 모든 장면이 구체적 예시와 상세 설명 포함
✅ 단순한 나열이 아닌 깊이 있는 내용 전개
✅ 시청자가 {duration}분 내내 몰입할 수 있는 정보량
✅ "왜 그런지" 배경과 원리까지 설명

**기술적 요구사항:**
✅ 모든 장면의 duration 합계가 정확히 NaN초
✅ 각 장면 텍스트를 실제로 읽는 시간과 duration 일치
✅ 짧은 텍스트에 긴 duration 설정 금지
✅ 너무 긴 텍스트에 짧은 duration 설정 금지`;

// src/components/constants.js
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
- 레퍼런스 대본보다 더 나은 품질의 대본을 만들어주세요
`.trim();
