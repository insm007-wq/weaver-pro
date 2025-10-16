// electron/ipc/ai-keywords.js
const { ipcMain } = require("electron");

// 한글 콘솔 출력을 위한 환경 설정
if (process.platform === 'win32') {
  process.env.PYTHONIOENCODING = 'utf-8';
}

class AIKeywordService {
  constructor() {
    this.client = null;
    this.aiProvider = null;
  }

  // 🔧 새 세션 초기화 (호환성을 위해 유지)
  initNewSession() {
  }

  // 🔥 세션 캐시 수동 초기화 메서드 (호환성을 위해 유지)
  clearSessionCache() {
  }

  // AI 프로바이더 초기화
  async initializeAI(llmModel) {
    const store = require("../services/store");
    const { getSecret } = require("../services/secrets");

    try {
      let apiKey;

      // LLM 모델별 API 키 확인 (keytar에서 우선 확인, 없으면 store에서 확인)
      switch (llmModel) {
        case "anthropic":
          apiKey = await getSecret("anthropicKey") || await getSecret("claudeKey") ||
                   store.get("anthropicApiKey") || store.get("claudeApiKey");
          if (!apiKey) {
            throw new Error("Anthropic API 키가 설정되지 않았습니다. 전역 설정 > 기본 설정에서 API 키를 입력해주세요.");
          }
          await this.initializeAnthropic(apiKey);
          break;

        case "replicate":
        case "replicate-llama3":
          apiKey = await getSecret("replicateKey") || store.get("replicateApiKey");
          if (!apiKey) {
            throw new Error("Replicate API 키가 설정되지 않았습니다. 전역 설정 > 기본 설정에서 API 키를 입력해주세요.");
          }
          await this.initializeReplicate(apiKey);
          break;

        default:
          console.warn(`[키워드 추출] 알 수 없는 LLM 모델: ${llmModel}, Anthropic으로 폴백`);
          apiKey = await getSecret("anthropicKey") || await getSecret("claudeKey") ||
                   store.get("anthropicApiKey") || store.get("claudeApiKey");
          if (!apiKey) {
            throw new Error("API 키를 찾을 수 없습니다. 전역 설정에서 LLM 모델과 해당 API 키를 설정해주세요.");
          }
          await this.initializeAnthropic(apiKey);
          break;
      }

    } catch (error) {
      console.error("[키워드 추출] AI 초기화 실패:", error);
      throw error;
    }
  }

  async initializeAnthropic(apiKey) {
    const Anthropic = require("@anthropic-ai/sdk");
    this.client = new Anthropic({
      apiKey: apiKey,
    });
    this.aiProvider = "Anthropic";
  }

  async initializeReplicate(apiKey) {
    try {
      const Replicate = require("replicate");
      this.client = new Replicate({
        auth: apiKey,
      });
      this.aiProvider = "Replicate";
    } catch (error) {
      throw new Error("Replicate 패키지를 찾을 수 없습니다. npm install replicate를 실행해주세요.");
    }
  }

  // AI 모델별 최적화된 프롬프트 생성
  buildPrompt(subtitleText, subtitleCount, aiProvider) {
    const baseRules = `🎯 **절대 규칙**:
1. **각 자막마다 무조건 반드시 1개 키워드 추출** (빈 자막 절대 금지!)
2. **자막 내용을 보고 실제 화면에 나올 법한 장면을 상상한 후 그에 맞는 키워드 추출**
3. **영상 검색 플랫폼에서 실제 검색했을 때 관련 영상이 나올 만한 키워드만 선택**
4. **모든 자막 번호(1,2,3...)에 대해 빠짐없이 키워드 반환 필수**

💡 **올바른 변환 예시**:
- 자막: "한국 개는 충성스럽다" → **"진돗개"** (절대 "한국 개" 안됨!)
- 자막: "카페에서 친구와 이야기했다" → **"카페"** (절대 "이야기" 안됨!)
- 자막: "의사 선생님의 의견을 들어보자" → **"의사"** (절대 "의견" 안됨!)
- 자막: "미국 개는 크다" → **"골든리트리버"** (절대 "미국 개" 안됨!)

🔥🔥🔥 **중요: 반드시 모든 자막 번호에 대해 키워드를 제공하세요!** 🔥🔥🔥
- 자막이 ${subtitleCount}개라면, 1번부터 ${subtitleCount}번까지 모든 번호에 키워드 필수!
- 어떤 자막이든 최소 1개 키워드는 반드시 추출!`;

    switch (aiProvider) {
      case "Anthropic":
      case "Replicate":
        return `다음 자막에서 영상 검색에 최적화된 키워드를 추출하세요.

🎬 **핵심 원칙: 장면 맥락을 생각하고 실제 검색 가능한 키워드만 추출**

자막:
${subtitleText}

${baseRules}

JSON 응답 형식 (모든 번호 포함 필수):
{
  "keywords": {
    "1": ["진돗개"],
    "2": ["카페"],
    "3": ["의사"]
  }
}`;

      default:
        return `다음 자막에서 영상 검색에 최적화된 키워드를 추출하세요.

자막:
${subtitleText}

${baseRules}

JSON 응답 형식:
{
  "keywords": {
    "1": ["키워드"],
    "2": ["키워드"],
    "3": ["키워드"]
  }
}`;
    }
  }

  // AI 모델별 배치 처리용 최적화된 프롬프트 생성
  buildBatchPrompt(subtitleText, subtitleCount, aiProvider, batchNum, totalBatches) {
    const baseRules = `🎯 **절대 규칙**:
1. **각 자막마다 무조건 반드시 1개 키워드 추출** (빈 자막 절대 금지!)
2. **자막 내용을 보고 실제 화면에 나올 법한 장면을 상상한 후 그에 맞는 키워드 추출**
3. **영상 검색 플랫폼에서 실제 검색했을 때 관련 영상이 나올 만한 키워드만 선택**
4. **모든 자막 번호(1,2,3...)에 대해 빠짐없이 키워드 반환 필수**

💡 **올바른 변환 예시**:
- 자막: "한국 개는 충성스럽다" → **"진돗개"** (절대 "한국 개" 안됨!)
- 자막: "카페에서 친구와 이야기했다" → **"카페"** (절대 "이야기" 안됨!)
- 자막: "의사 선생님의 의견을 들어보자" → **"의사"** (절대 "의견" 안됨!)

🔥🔥🔥 **중요: 반드시 모든 자막 번호에 대해 키워드를 제공하세요!** 🔥🔥🔥
- 자막이 ${subtitleCount}개라면, 1번부터 ${subtitleCount}번까지 모든 번호에 키워드 필수!
- 어떤 자막이든 최소 1개 키워드는 반드시 추출!`;

    const batchContext = totalBatches > 1 ? `\n📦 **배치 정보**: ${batchNum}/${totalBatches} 배치 (이 배치만 처리하면 됩니다)` : "";

    switch (aiProvider) {
      case "Anthropic":
      case "Replicate":
        return `다음 자막 배치에서 영상 검색에 최적화된 키워드를 추출하세요.

🎬 **핵심 원칙: 장면 맥락을 생각하고 실제 검색 가능한 키워드만 추출**${batchContext}

자막:
${subtitleText}

${baseRules}

JSON 응답 형식 (모든 번호 포함 필수):
{
  "keywords": {
    "1": ["진돗개"],
    "2": ["카페"],
    "3": ["의사"]
  }
}`;

      default:
        return `다음 자막 배치에서 영상 검색에 최적화된 키워드를 추출하세요.${batchContext}

자막:
${subtitleText}

${baseRules}

JSON 응답 형식:
{
  "keywords": {
    "1": ["키워드"],
    "2": ["키워드"],
    "3": ["키워드"]
  }
}`;
    }
  }

  async extractKeywords(subtitles) {
    // 입력 검증
    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      throw new Error("자막 데이터가 없거나 유효하지 않습니다.");
    }

    // 전역 설정에서 LLM 모델 가져오기
    let llmModel;
    try {
      const { ipcMain } = require("electron");
      const store = require("../services/store");
      llmModel = store.get("llmModel") || "anthropic";
    } catch (error) {
      console.warn("[키워드 추출] LLM 모델 설정 로드 실패, 기본값(anthropic) 사용:", error);
      llmModel = "anthropic";
    }

    // LLM 모델별 API 키 확인 및 설정
    await this.initializeAI(llmModel);

    // Balanced batch processing for speed and reliability
    const BATCH_TOKEN_LIMIT = 15000; // 15k token limit per batch
    const PROMPT_OVERHEAD = 1200; // Reasonable overhead
    const SAFETY_MARGIN = 0.75; // Balanced margin

    const estimateTokens = (text) => {
      // More conservative token estimation (Korean text is often more token-heavy)
      return Math.floor(text.length / 3 + 100);
    };

    const safeLimit = Math.floor((BATCH_TOKEN_LIMIT - PROMPT_OVERHEAD) * SAFETY_MARGIN);

    // Force multi-batch processing for large subtitle counts
    if (subtitles.length > 80) {
      return await this.extractKeywordsMulti(subtitles, safeLimit);
    } else {
      const totalText = subtitles.map((sub, i) => `${i + 1}. ${sub.text}`).join("\n");
      const totalTokens = estimateTokens(totalText);

      if (totalTokens <= safeLimit) {
        return await this.extractKeywordsSingle(subtitles);
      } else {
        return await this.extractKeywordsMulti(subtitles, safeLimit);
      }
    }
  }

  async extractKeywordsSingle(subtitles) {
    // 🔥 배치 내 순서 사용 (AI가 1,2,3... 순서로 응답하도록)
    const subtitleText = subtitles.map((sub, idx) => `${idx + 1}. ${sub.text}`).join("\n");

    const prompt = this.buildPrompt(subtitleText, subtitles.length, this.aiProvider);

    return await this.callAIAPI(prompt, subtitles);
  }

  async extractKeywordsMulti(subtitles, safeLimit) {
    // weaver-pro 최적화: 더 안정적인 배치 크기
    const chunkSize = Math.min(25, Math.max(10, Math.floor(safeLimit / 300))); // weaver-pro용 최적화
    const allKeywords = {};
    const allMappings = {};
    const totalBatches = Math.ceil(subtitles.length / chunkSize);
    const maxRetries = 3; // 재시도 횟수

    let successfulBatches = 0;
    let failedBatches = 0;

    for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
      const startIdx = batchNum * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, subtitles.length);
      const batchSubtitles = subtitles.slice(startIdx, endIdx);

      let batchSuccess = false;
      let retryCount = 0;

      // 🔥 재시도 로직 추가
      while (!batchSuccess && retryCount < maxRetries) {
        try {
          if (retryCount > 0) {
            // 재시도 시 더 긴 지연
            await new Promise((resolve) => setTimeout(resolve, 2000 + retryCount * 1000));
          }

          // 🔥 배치 내 순서 사용 (AI가 1,2,3... 순서로 응답하도록)
          const batchText = batchSubtitles.map((sub, idx) => `${idx + 1}. ${sub.text}`).join("\n");

          const batchPrompt = this.buildBatchPrompt(batchText, batchSubtitles.length, this.aiProvider, batchNum + 1, totalBatches);
          const prompt = batchPrompt;

          // API 호출 시도
          const apiResponse = await this.callAIAPI(prompt, batchSubtitles, true); // true = batch mode

          const content = apiResponse.content;

          // Extract JSON from response
          const jsonStart = content.indexOf("{");
          const jsonEnd = content.lastIndexOf("}") + 1;

          if (jsonStart === -1 || jsonEnd <= jsonStart) {
            throw new Error("JSON 형식을 찾을 수 없음");
          }

          const jsonStr = content.substring(jsonStart, jsonEnd);
          const data = JSON.parse(jsonStr);

          if (!data.keywords) {
            throw new Error("키워드 데이터가 없음");
          }

          // 🔥 CRITICAL: AI 응답 검증 - 모든 자막에 대해 키워드가 있는지 확인
          const missingNumbers = [];
          for (let i = 1; i <= batchSubtitles.length; i++) {
            if (!data.keywords[String(i)] || data.keywords[String(i)].length === 0) {
              missingNumbers.push(i);
            }
          }

          if (missingNumbers.length > 0) {
            throw new Error(`AI가 다음 자막 번호들에 대해 키워드를 반환하지 않음: ${missingNumbers.join(", ")}`);
          }

          // 🔥 CRITICAL: 실제 자막 순서대로 정확하게 매핑
          let processedInBatch = 0;
          for (let batchPosition = 0; batchPosition < batchSubtitles.length; batchPosition++) {
            const subtitle = batchSubtitles[batchPosition];

            // AI 응답에서 이 자막에 해당하는 키워드 찾기 (1-based)
            const aiKey = String(batchPosition + 1);
            const extractedKeywords = data.keywords[aiKey] || [];

            // 실제 자막 인덱스를 키로 하여 저장
            const actualSubtitleIndex = subtitle.index;
            allKeywords[actualSubtitleIndex] = Array.isArray(extractedKeywords)
              ? extractedKeywords.map((kw) => kw.trim()).filter((kw) => kw)
              : [];

            // 🔥 빈 키워드 검증 - 이 경우 에러로 처리
            if (allKeywords[actualSubtitleIndex].length === 0) {
              throw new Error(`자막 ${batchPosition + 1}번에 대해 AI가 키워드를 반환하지 않음: "${subtitle.text.substring(0, 50)}..."`);
            }

            // 매핑에 키워드 추가 (한국어 → 한국어)
            allKeywords[actualSubtitleIndex].forEach((keyword) => {
              if (keyword && !allMappings[keyword]) {
                allMappings[keyword] = keyword;
              }
            });

            processedInBatch++;
          }

          batchSuccess = true;
          successfulBatches++;

          // 성공 시 짧은 지연
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          retryCount++;
          console.error(`  ❌ 실패 (${retryCount}/${maxRetries}):`, error.message);

          if (retryCount >= maxRetries) {
            console.error(`  🔥 최종 실패 - 빈 키워드로 설정`);
            failedBatches++;

            // 최종 실패 시 빈 키워드로 설정
            for (let i = 0; i < batchSubtitles.length; i++) {
              const subtitle = batchSubtitles[i];
              allKeywords[subtitle.index] = [];
            }
          }
        }
      }
    }

    // 🔥 CRITICAL: 모든 자막에 대해 키워드 확인 및 누락된 것들 빈 배열로 초기화
    let missingCount = 0;
    for (let i = 0; i < subtitles.length; i++) {
      const subtitle = subtitles[i];
      const actualIndex = subtitle.index;

      if (!(actualIndex in allKeywords)) {
        // 누락된 자막은 빈 배열로 설정 (기본 키워드 할당 안함)
        allKeywords[actualIndex] = [];
        missingCount++;
      }
    }

    const totalProcessed = Object.keys(allKeywords).length;

    if (totalProcessed !== subtitles.length) {
      console.error(`🚨 심각한 오류: 처리된 자막 수(${totalProcessed})와 입력 자막 수(${subtitles.length})가 다름!`);
    }

    return { keywords: allKeywords, mapping: allMappings };
  }

  async callAIAPI(prompt, subtitles, isBatchMode = false) {
    let response;
    let content;

    try {
      switch (this.aiProvider) {
        case "Anthropic":
          response = await this.client.messages.create({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 4000,
            temperature: 0.7,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          });
          content = response.content[0].text.trim();
          break;

        case "Replicate":
          response = await this.client.run(
            "meta/meta-llama-3-70b-instruct",
            {
              input: {
                prompt: prompt,
                max_tokens: 4000,
                temperature: 0.7,
              }
            }
          );
          content = response.join('').trim();
          break;

        default:
          throw new Error(`지원되지 않는 AI 프로바이더: ${this.aiProvider}`);
      }

      if (isBatchMode) {
        // 배치 모드에서는 원시 응답 반환
        return { content };
      }

      // Extract JSON from response
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}") + 1;

      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const jsonStr = content.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonStr);

        // Convert keywords to array format with proper indices
        const keywordsBySubtitle = {};
        for (let i = 0; i < subtitles.length; i++) {
          const key = String(i + 1);
          const keywords = data.keywords?.[key] || [];
          // 🔧 자막의 실제 인덱스를 키로 사용 (subtitle.index와 일치)
          const subtitleActualIndex = subtitles[i].index;
          keywordsBySubtitle[subtitleActualIndex] = Array.isArray(keywords) ? keywords.map((kw) => kw.trim()).filter((kw) => kw) : [];
        }

        // 🔧 한국어 키워드만 수집 (매핑 없이)
        const allKoreanKeywords = new Set();
        Object.values(keywordsBySubtitle).forEach((keywords) => {
          keywords.forEach((keyword) => allKoreanKeywords.add(keyword));
        });

        // 🔧 모든 키워드를 매핑에 포함 (중복 제거 로직 제거)
        const koreanToKoreanMapping = {};
        allKoreanKeywords.forEach((keyword) => {
          koreanToKoreanMapping[keyword] = keyword;
        });

        return {
          keywords: keywordsBySubtitle,
          mapping: koreanToKoreanMapping,
        };
      }
    } catch (error) {
      console.error("API CALL FAILED:", error);
      throw error;
    }

    // Return empty data on failure
    const emptyKeywords = {};
    for (let i = 0; i < subtitles.length; i++) {
      emptyKeywords[subtitles[i].index] = [];
    }
    return { keywords: emptyKeywords, mapping: {} };
  }

  countKeywordUsage(subtitles, keywords) {
    const keywordCounts = {};

    for (const subtitleKeywords of Object.values(keywords)) {
      for (const keyword of subtitleKeywords) {
        keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
      }
    }

    return keywordCounts;
  }
}

// weaver-pro 키워드 추출 서비스 인스턴스
const aiKeywordService = new AIKeywordService();

// IPC 핸들러 등록
ipcMain.handle("ai:extractKeywords", async (event, { subtitles }) => {
  try {
    // 입력 검증
    if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
      throw new Error("유효한 자막 데이터가 없습니다.");
    }

    // 키워드 추출 실행
    const startTime = Date.now();
    const result = await aiKeywordService.extractKeywords(subtitles);
    const duration = Date.now() - startTime;

    return {
      success: true,
      ...result,
      duration,
    };
  } catch (error) {
    console.error("[weaver-pro IPC] ❌ 키워드 추출 실패:", error.message);

    return {
      success: false,
      error: error.message,
      keywords: {},
      mapping: {},
    };
  }
});
