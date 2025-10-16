// electron/constants/defaultPrompts.js
// 기본 프롬프트 템플릿 (CommonJS 형태)

const DEFAULT_GENERATE_PROMPT = `다음 조건에 맞는 {duration}분 길이의 영상 대본을 작성해주세요.

📋 기본 정보:
• 주제: {topic}
• 스타일: {style}
• 언어: 한국어

📺 영상 구성 (반드시 준수):
• 총 길이: {duration}분 ({totalSeconds}초)
• 장면 구성: {minSceneCount}~{maxSceneCount}개 (권장: {targetSceneCount}개)
• 각 장면: 7~10초 (40~60자)

📝 작성 방식:
• 각 장면은 50~60자 (너무 짧으면 안됨!)
• 각 장면마다 하나의 완결된 메시지 전달
• 장면 간 자연스러운 흐름 유지
• 지루하지 않게 적절한 템포 유지
• 마크다운/불릿포인트 금지
• 자연스러운 구어체 문단

⚠️ 중요:
1. 반드시 {minSceneCount}개 이상 장면 포함
2. 전체 글자 수는 최소 {minCharacters}자 이상 필수!
3. 각 장면은 50자 이상 작성 (40자 이하는 불합격)
4. 요청 시간보다 최대 30% 길어져도 괜찮음

📤 응답 형식 (JSON만 반환):
{
  "title": "대본 제목",
  "scenes": [
    {"text": "첫 번째 장면 (50~60자)", "duration": 8},
    {"text": "두 번째 장면 (50~60자)", "duration": 8},
    ... (총 {minSceneCount}~{maxSceneCount}개 장면)
  ]
}

⚡ JSON만 출력하고 다른 설명은 절대 포함하지 마세요.`;

const DEFAULT_REFERENCE_PROMPT = `아래 레퍼런스 대본의 스타일을 분석하여 새로운 주제로 대본을 작성해주세요.

📋 기본 정보:
• 주제: {topic}
• 분량: {duration}분 ({totalSeconds}초)
• 장면 구성: {minSceneCount}~{maxSceneCount}개

📄 레퍼런스 대본:
{referenceText}

📝 작성 지침:
1. 레퍼런스의 어투, 톤, 전개 방식 분석
2. 구조는 유지하되 내용은 새로운 주제로 완전히 재작성
3. 각 장면은 50~60자로 작성
4. 자연스러운 흐름 유지

📤 응답 형식 (JSON만 반환):
{
  "title": "대본 제목",
  "scenes": [
    {"text": "첫 번째 장면 (50~60자)", "duration": 8},
    {"text": "두 번째 장면 (50~60자)", "duration": 8},
    ... (총 {minSceneCount}~{maxSceneCount}개 장면)
  ]
}

⚡ JSON만 출력하고 다른 설명은 절대 포함하지 마세요.`;

const DEFAULT_TEMPLATE = `{content}{referenceAnalysis}

Ultra-realistic, cinematic YouTube thumbnail, dramatic lighting, vibrant colors, 16:9 aspect ratio, no text`;

module.exports = {
  DEFAULT_GENERATE_PROMPT,
  DEFAULT_REFERENCE_PROMPT,
  DEFAULT_TEMPLATE
};