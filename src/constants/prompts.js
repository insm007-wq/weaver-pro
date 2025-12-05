// 프롬프트 템플릿 관련 상수들

// ✅ 대본 생성 프롬프트 (Vrew 스타일 - 간결하고 명확함)
export const DEFAULT_GENERATE_PROMPT = `다음 조건에 맞는 {duration}분 길이의 영상 대본을 작성해주세요.

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

// ✅ 레퍼런스 분석 프롬프트 (간소화)
export const DEFAULT_REFERENCE_PROMPT = `아래 레퍼런스 대본의 스타일을 분석하여 새로운 주제로 대본을 작성해주세요.

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

⚡ JSON만 출력하고 다른 설명은 절대 포함하지 마세요.`.trim();

// ✅ 쇼츠 생성 프롬프트 (15~60초 짧은 영상 최적화)
export const SHORTS_GENERATE_PROMPT = `다음 조건에 맞는 {seconds}초 길이의 쇼츠 영상 대본을 작성해주세요.

🎯 쇼츠 핵심 원칙:
• 첫 3초 안에 시청자를 사로잡아야 함 (후킹 필수!)
• 빠른 템포, 즉각적인 메시지 전달
• 스크롤 방지: 궁금증 유발 → 해결

📋 기본 정보:
• 주제: {topic}
• 스타일: {style}
• 길이: {seconds}초
• 언어: 한국어

📺 쇼츠 구성 (반드시 준수):
• 총 길이: {seconds}초
• 장면 구성: {minSceneCount}~{maxSceneCount}개 (권장: {targetSceneCount}개)
• 각 장면: 3~15초 (15~50자)

📝 작성 방식:
• 첫 장면(오프닝): 강렬한 후킹 (3~5초, 15~25자)
  - 질문형: "이거 모르면 손해"
  - 충격형: "절대 믿을 수 없는 사실"
  - 호기심형: "이것만 알면 인생 바뀜"
• 중간 장면: 핵심 내용 빠르게 전달
• 마지막 장면: CTA 또는 여운 (좋아요/팔로우 유도)
• 군더더기 없이 핵심만
• 자연스러운 구어체

⚠️ 중요:
1. 첫 장면이 가장 중요 - 반드시 후킹!
2. 15초~60초에 맞춰 장면 수 조정
3. 장면당 15~50자 (너무 길지 않게)
4. 빠른 템포 유지

📤 응답 형식 (JSON만 반환):
{
  "title": "쇼츠 제목",
  "scenes": [
    {"text": "첫 장면 - 강렬한 후킹 (15~25자)", "duration": 3},
    {"text": "두 번째 장면 (20~40자)", "duration": 8},
    ... (총 {minSceneCount}~{maxSceneCount}개 장면)
  ]
}

⚡ JSON만 출력하고 다른 설명은 절대 포함하지 마세요.`;

export const DEFAULT_TEMPLATE = `{content}{referenceAnalysis}

Ultra-realistic, cinematic YouTube thumbnail, dramatic lighting, vibrant colors, 16:9 aspect ratio, no text`;