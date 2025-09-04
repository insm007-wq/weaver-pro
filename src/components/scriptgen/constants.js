// src/constants.js
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
  google: ["ko-KR-Wavenet-A", "ko-KR-Wavenet-B", "ko-KR-Standard-A", "ko-KR-Standard-B"],
  azure: ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"],
  polly: ["Seoyeon"],
  openai: ["alloy", "nova", "verse"],
};

// ✅ 대본 프롬프트(원문 그대로 전송). 필요시 사용자가 직접 템플릿을 편집함.
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

// ✅ 레퍼런스 프롬프트 — {referenceText}, {duration}, {topic}, {maxScenes}만 치환
export const DEFAULT_REFERENCE_PROMPT = `
## 레퍼런스 대본 분석 및 적용

요청 사양:
- 분량: {duration}분
- 최대 장면 수: {maxScenes}개
- 주제: {topic}
- 언어: 한국어

=== 레퍼런스 대본 ===
{referenceText}
=== 레퍼런스 대본 끝 ===

지시사항:
1) 레퍼런스의 어투/톤, 전개 방식, 설명 기법을 분석하세요.
2) 구조적 장점은 유지하되, 내용은 주제({topic})에 맞춰 **완전히 새로 작성**하세요.
3) 총 분량이 {duration}분을 충족하도록 충분한 텍스트를 작성하세요.
4) 씬은 1~{maxScenes}개로 구성하고, **각 씬의 텍스트 길이와 duration이 일치**하도록 작성하세요
   (짧은 텍스트에 긴 duration 금지).
5) 각 씬마다 화면에 보여줄 **시각적 설명(visual_description)**을 1~2문장 포함하세요.

반드시 유효한 JSON으로만 응답하세요:
{
  "title": "영상 제목",
  "total_duration": {duration},
  "scenes": [
    {
      "scene_number": 1,
      "text": "씬 1의 상세 대본",
      "duration": 60,
      "character_count": "실제 글자 수",
      "visual_description": "화면에 보여줄 내용"
    }
  ]
}
`.trim();

const DEFAULT_TEMPLATE = `Imagen-3 결과를 참고해서
붙여넣기한 사진이나 붙여넣기한 내용을 토대로
인물의 표정, 인물의 위치 및 배치, 복장을 자세히 묘사 하고 분석한 뒤에
Imagen-3 프롬프트를 만들어줘. 프롬프트는 영어로 만들어줘.
더 극적이고 자극적으로 만들어줘.
당신은 "Imagen-3 프롬프트 제너레이터"입니다.
사용자가 아래 형식으로 **이미지나 장면 설명**을 붙여넣으면, 곧바로 상세하고 예술적인 이미지 생성 프롬프트를 출력해야 합니다.

### 장면 설명: {content}{referenceAnalysis}

1. 원본 설명에서 **주제 대상**(사람·사물·생물·장소 등)과 **핵심 특징**(머리 모양·의상·표정 등)을 뽑아
 → "길게 늘어뜨린 붉은색 머리를 두 겹의 굵은 땋은 머리로 스타일링한 아시아 여인"

2. 배경·장면·조명·텍스처·소품·분위기·연출·키워드 등을
 - **조명·텍스처**: "빨강·파랑 네온 조명이 희미하게 깔린 어두운 작업실"
 - **소품·소도구**: "흐릿한 빛을 발하는 버섯과 커다란 체스말"
 - **스타일**: "흔들리는 필름 그레인과 구불구불한 경계의 빈티지 필름 테두리"
 - **암시적 요소**: "반투명 천이 부드러운 곡선을 은근히 드러내는 암시적 누드 표현"
 - **분위기 키워드**: "alluring, enigmatic, provocative"
 - **구도·무대감**: "관객 뒤에서 비추는 극장 조명 같은 무대감", "하단 1/3은 자막을 위한 여백으로 비워 두고 인물은 프레임 상단 중앙에 배치"
 - **후처리·효과**: "형광 빛 에너지가 공중에서 소용돌이치는 초현실적 효과"
 - **촬영 스타일**: "상반신 중심 구도 (medium close-up), 감정 중심 포커싱"
 - **썸네일 최적화**: "thumbnail-friendly framing, emotional clarity, caption-safe layout"

3. 위 요소들을 **자연스러운 한 문장**으로 조합해 최종 프롬프트를 생성한다.
 - 절대 "[ ]" 같은 플레이스홀더를 남기지 말 것.
 - 묘사된 디테일, 감성 단어, 연출 단어를 빠짐없이 담을 것.

### 중요한 제약사항:
- 반드시 **Asian person** 또는 **Korean** 명시 (동양인 인물로 생성)
- 반드시 **no text, no words, no letters** 포함 (글자 없이 생성)
- **16:9 aspect ratio** 명시 (썸네일 비율)
- **ultra-realistic, cinematic style** 포함 (고품질 스타일)
- **dramatic lighting** 포함 (극적인 조명)

### 사용 예시:
**사무실 커피 모멸 장면**
"An explosive moment of humiliation unfolds in a high-pressure South Korean office: a furious male team leader in a sharply tailored navy suit hurls a full cup of coffee at a young Korean female employee. The liquid detonates mid-air in a dramatic burst—dark coffee splattering in every direction, frozen in a chaotic, high-speed arc that captures each droplet suspended in motion. The young woman, wearing a crisp white blouse now soaked through and clinging to her skin, reveals the faint silhouette of her undergarments beneath, amplifying her visible vulnerability... ultra-realistic, cinematic style with dramatic lighting, medium close-up framing, 16:9 aspect ratio, no text, no words, no letters"

**공항 보안대치 장면**
"A high-stakes confrontation unfolds at a sleek, modern airport security checkpoint: a confident Asian woman with sharp features and shoulder-length jet-black hair stands tall in a form-fitting black blazer that accentuates her silhouette, worn open over a low-cut, silk white blouse that subtly reveals her curves with a commanding sensuality. Her expression is one of poised indignation... ultra-realistic, cinematic style with dramatic lighting, medium close-up framing, 16:9 aspect ratio, no text, no words, no letters"

영문 Imagen-3 생성 프롬프트만 응답해주세요:`;

export { DEFAULT_TEMPLATE };
