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

export const DEFAULT_GENERATE_PROMPT = `{duration}분 길이의 한국어 영상 대본을 작성하세요.

주제: {topic}  
스타일: {style}  
최대 장면 수: {maxScenes}

조건:
- 전체 글자수 {minCharacters}~{maxCharacters}자
- 장면별 평균 {avgCharactersPerScene}자 이상
- 모든 장면 duration 합계 = {totalSeconds}초
- 각 장면의 text 길이는 duration에 맞게 작성

출력(JSON만 응답):
{
  "title": "영상 제목",
  "total_duration": {duration},
  "total_characters": "총 글자 수",
  "scenes": [
    {
      "scene_number": 1,
      "text": "대본 내용",
      "duration": 초,
      "character_count": "글자 수",
      "visual_description": "장면 설명"
    }
  ]
}
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
