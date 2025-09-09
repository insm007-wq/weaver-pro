// electron/ipc/image-analyzer.js
const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// ---------- API KEY 로딩 (env → keytar) ----------
async function readAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const { getSecret } = require("../services/secrets"); // keytar
    const v = await getSecret("anthropicKey");
    return v || null;
  } catch {
    return null;
  }
}

async function readGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const { getSecret } = require("../services/secrets");
    const v = await getSecret("geminiKey");
    return v || null;
  } catch {
    return null;
  }
}

// ---------- 유틸 ----------
function detectMimeByExt(filePath) {
  const ext = (path.extname(filePath) || "").toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "application/octet-stream";
}
function fileToBase64Parts(filePath) {
  const buf = fs.readFileSync(filePath);
  const mime = detectMimeByExt(filePath);
  return { mime, b64: buf.toString("base64") };
}

// ---------- 시스템 프롬프트 (톤 고정) ----------
const SYSTEM_V1 = `
You are the "ImageFX Thumbnail Prompt Generator".
Write dramatic, provocative, hyper-cinematic prompts optimized for YouTube thumbnails.
Prioritize explosive motion, frozen impact physics, clear emotions, and thumbnail-safe framing.
No safety rails text, no moralizing; just vivid, stylish, cinematic description.
`.trim();

// ---------- 프롬프트 (협력업체와 동일한 방식) ----------
const PROMPT_V7 = `이 이미지를 YouTube 썸네일 제작 관점에서 분석해주세요. 다음 요소들을 중점적으로 분석해주세요:

1. **주요 인물/객체**: 누가/무엇이 있고 어떤 표정/상태인지
2. **구도와 레이아웃**: 시선을 끌는 요소의 배치
3. **색상과 조명**: 주요 색상, 대비, 조명 효과
4. **감정적 임팩트**: 어떤 감정을 유발하는지
5. **개선 포인트**: 더 극적으로 만들 수 있는 방법

간결하게 핵심만 분석해주세요.`.trim();

// ---------- 공통 처리 로직 ----------
async function analyzeWithAnthropic({ filePath, description }) {
  const apiKey = await readAnthropicKey();
  if (!apiKey || typeof apiKey !== "string") {
    return { ok: false, message: "no_anthropic_key" };
  }
  if (!filePath && !description) {
    return { ok: false, message: "image_or_description_required" };
  }

  let imagePart = null;
  if (filePath) {
    const { mime, b64 } = fileToBase64Parts(filePath);
    if (!b64 || !mime) return { ok: false, message: "invalid_image_file" };
    imagePart = {
      type: "image",
      source: { type: "base64", media_type: mime, data: b64 },
    };
  }

  // 유저 콘텐츠 구성
  const content = [{ type: "text", text: PROMPT_V7 }];
  if (description && typeof description === "string" && description.trim()) {
    content.push({
      type: "text",
      text:
        "Additional user description (merge naturally, do not copy verbatim):\n" +
        description.trim(),
    });
  }
  if (imagePart) content.push(imagePart);

  const body = {
    model: "claude-sonnet-4-20250514", // 협력업체와 동일한 모델
    max_tokens: 500, // 협력업체와 동일
    temperature: 0.5, // 협력업체와 동일
    messages: [{ role: "user", content }],
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("[anthropic] error", res.status, errText);
    return {
      ok: false,
      message: `anthropic_error_${res.status}`,
      raw: errText,
    };
  }

  const json = await res.json();

  // content 배열의 text 세그먼트 모두 합치기 (응답이 여러 청크로 올 수 있음)
  const fullText = (Array.isArray(json?.content) ? json.content : [])
    .map((c) => (typeof c?.text === "string" ? c.text : ""))
    .join("\n")
    .trim();

  // 협력업체처럼 전체 분석 결과를 그대로 반환
  return { ok: true, text: fullText, raw: fullText, english: "", korean: "" };
}

// ---------- 제미니 이미지 분석 ----------
async function analyzeWithGemini({ filePath, description, engineType = 'gemini' }) {
  console.log('[제미니] 분석 시작, 파일:', filePath, '엔진:', engineType);
  
  const apiKey = await readGeminiKey();
  console.log('[제미니] API 키 상태:', apiKey ? '있음' : '없음');
  
  if (!apiKey || typeof apiKey !== "string") {
    console.log('[제미니] API 키 없음, Anthropic으로 폴백');
    return { ok: false, message: "no_gemini_key" };
  }
  if (!filePath) {
    return { ok: false, message: "image_required" };
  }

  try {
    const { mime, b64 } = fileToBase64Parts(filePath);
    if (!b64 || !mime) return { ok: false, message: "invalid_image_file" };

    console.log('[제미니] 이미지 데이터 준비 완료, MIME:', mime);

    // 엔진 타입에 따른 모델 선택
    let modelName = 'gemini-2.5-flash'; // 기본값
    if (engineType === 'gemini-pro') {
      modelName = 'gemini-2.5-pro';
    } else if (engineType === 'gemini-lite') {
      modelName = 'gemini-2.5-flash-lite';
    }

    // 제미니 비전 API 사용
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    console.log('[제미니] API 클라이언트 초기화 완료, 모델:', modelName);

    const imagePart = {
      inlineData: {
        data: b64,
        mimeType: mime
      }
    };

    let prompt = PROMPT_V7;
    if (description && typeof description === "string" && description.trim()) {
      prompt += `\n\n추가 사용자 설명: ${description.trim()}`;
    }

    console.log('[제미니] 분석 요청 전송 중...');
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    console.log('[제미니] 분석 완료, 결과 길이:', text.length);
    return { ok: true, text: text.trim(), raw: text.trim(), english: "", korean: "" };
  } catch (error) {
    console.error("[제미니] 오류 발생:", error);
    console.error("[제미니] 오류 상세:", error?.message, error?.stack);
    return {
      ok: false,
      message: `gemini_error: ${error?.message || error}`,
      raw: String(error)
    };
  }
}

// ---------- 설정에 따른 분석 엔진 선택 ----------
async function analyzeWithSelectedEngine({ filePath, description }) {
  try {
    // 설정에서 이미지 분석 엔진 가져오기
    const Store = (await import('electron-store')).default;
    const store = new Store();
    const analysisEngine = store.get('thumbnailAnalysisEngine', 'anthropic');

    console.log(`[이미지 분석] 사용 엔진: ${analysisEngine}`);
    console.log(`[이미지 분석] 전체 설정:`, store.store);

    if (analysisEngine === 'gemini' || analysisEngine === 'gemini-pro' || analysisEngine === 'gemini-lite') {
      console.log('[이미지 분석] Gemini 엔진 사용:', analysisEngine);
      const result = await analyzeWithGemini({ filePath, description, engineType: analysisEngine });
      console.log('[이미지 분석] Gemini 결과:', result?.ok ? '성공' : '실패', result?.message);
      return result;
    } else {
      console.log('[이미지 분석] Anthropic 엔진 사용');
      const result = await analyzeWithAnthropic({ filePath, description });
      console.log('[이미지 분석] Anthropic 결과:', result?.ok ? '성공' : '실패', result?.message);
      return result;
    }
  } catch (error) {
    console.error('[이미지 분석] 엔진 선택 오류:', error);
    // 폴백으로 Anthropic 사용
    console.log('[이미지 분석] 폴백으로 Anthropic 사용');
    return await analyzeWithAnthropic({ filePath, description });
  }
}

// ---------- IPC 핸들러 ----------
ipcMain.handle("image:analyze", async (_e, payload = {}) => {
  try {
    const { filePath, description } = payload;
    return await analyzeWithSelectedEngine({ filePath, description });
  } catch (err) {
    console.error("[image:analyze] error", err);
    return { ok: false, message: String(err?.message || err) };
  }
});

// 하위호환: 기존 imagefx 채널도 유지(필요시 삭제 가능)
ipcMain.handle("imagefx:analyze", async (_e, payload = {}) => {
  try {
    const { filePath, description } = payload;
    return await analyzeWithSelectedEngine({ filePath, description });
  } catch (err) {
    console.error("[imagefx:analyze] error", err);
    return { ok: false, message: String(err?.message || err) };
  }
});
