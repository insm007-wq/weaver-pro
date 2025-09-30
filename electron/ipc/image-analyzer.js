// electron/ipc/image-analyzer.js
const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { createReplicate, resolveLatestVersionId } = require("../services/replicateClient");

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

async function readReplicateKey() {
  try {
    const { getSecret } = require("../services/secrets");
    const v = await getSecret("replicateKey");
    return v || process.env.REPLICATE_API_TOKEN || null;
  } catch {
    return null;
  }
}

// ---------- 유틸 ----------
async function detectImageFormat(filePath) {
  try {
    const sharp = require('sharp');
    const metadata = await sharp(filePath).metadata();
    
    // Sharp에서 감지된 실제 이미지 포맷을 기반으로 MIME 타입 결정
    switch (metadata.format) {
      case 'jpeg':
        return "image/jpeg";
      case 'png':
        return "image/png";
      case 'webp':
        return "image/webp";
      case 'gif':
        return "image/gif";
      case 'tiff':
        return "image/tiff";
      case 'bmp':
        return "image/bmp";
      default:
        // 포맷을 감지할 수 없는 경우 파일 확장자로 폴백
        const ext = (path.extname(filePath) || "").toLowerCase();
        if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
        if (ext === ".png") return "image/png";
        if (ext === ".webp") return "image/webp";
        return "image/jpeg"; // 기본값으로 JPEG 사용
    }
  } catch (error) {
    console.warn(`[이미지 포맷 감지 실패] ${filePath}:`, error.message);
    // Sharp 실패 시 파일 확장자로 폴백
    const ext = (path.extname(filePath) || "").toLowerCase();
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    return "image/jpeg"; // 기본값
  }
}

async function fileToBase64Parts(filePath) {
  try {
    // Sharp를 사용하여 이미지 최적화 (해상도 제한 + JPEG 변환)
    const sharp = require('sharp');
    const buffer = await sharp(filePath)
      .resize(1568, 1568, {
        fit: 'inside',              // 비율 유지하며 리사이즈
        withoutEnlargement: true    // 작은 이미지는 확대 안 함
      })
      .jpeg({ quality: 85 })        // 최적화된 품질 (육안 차이 없음)
      .toBuffer();

    return {
      mime: "image/jpeg",
      b64: buffer.toString("base64")
    };
  } catch (error) {
    console.warn(`[이미지 변환 실패] ${filePath}, 원본 파일 사용:`, error.message);
    // Sharp 실패 시 원본 파일 사용
    const buf = fs.readFileSync(filePath);
    const mime = await detectImageFormat(filePath);
    return { mime, b64: buf.toString("base64") };
  }
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
    const { mime, b64 } = await fileToBase64Parts(filePath);
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
    const { mime, b64 } = await fileToBase64Parts(filePath);
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

// ---------- Replicate 이미지 분석 (LLaVA) ----------
async function analyzeWithReplicate({ filePath, description }) {
  console.log('[Replicate] 이미지 분석 시작, 파일:', filePath);

  const apiKey = await readReplicateKey();
  console.log('[Replicate] API 키 상태:', apiKey ? '있음' : '없음');

  if (!apiKey || typeof apiKey !== "string") {
    console.log('[Replicate] API 키 없음, Anthropic으로 폴백');
    return { ok: false, message: "no_replicate_key" };
  }

  if (!filePath) {
    return { ok: false, message: "image_required" };
  }

  try {
    // 이미지 파일을 base64로 변환
    const { mime, b64 } = await fileToBase64Parts(filePath);
    if (!b64 || !mime) return { ok: false, message: "invalid_image_file" };

    console.log('[Replicate] 이미지 데이터 준비 완료, MIME:', mime);

    // LLaVA 13B 모델 사용 (더 상세한 분석)
    const replicate = createReplicate(apiKey);

    // 분석 프롬프트 구성
    let prompt = PROMPT_V7;
    if (description && typeof description === "string" && description.trim()) {
      prompt += `\n\n추가 사용자 설명: ${description.trim()}`;
    }

    console.log('[Replicate] 분석 요청 전송 중...');

    // LLaVA 13B 사용 (특정 버전 ID 사용)
    let prediction = await replicate.predictions.create({
      version: "80537f9eead1a5bfa72d5ac6ea6414379be41d4d4f6679fd776e9535d1eb58bb",
      input: {
        image: `data:${mime};base64,${b64}`,
        prompt: prompt,
        max_tokens: 1024,
        temperature: 0.2
      }
    });

    console.log(`[Replicate] 예측 생성: ${prediction.id}`);

    // 즉시 상태 확인 (최대 5초만 대기)
    const maxWait = 5;
    let waited = 0;

    while (prediction.status === "starting" && waited < maxWait) {
      await new Promise(r => setTimeout(r, 1000));
      waited++;
      prediction = await replicate.predictions.get(prediction.id);
    }

    // starting 상태면 바로 실패 처리
    if (prediction.status === "starting" || prediction.status === "queued") {
      console.error(`[Replicate] 모델이 시작되지 않음: ${prediction.status}`);
      return {
        ok: false,
        message: "replicate_timeout",
        detail: "Replicate 모델이 시작되지 않습니다. 다른 엔진을 사용해주세요."
      };
    }

    // processing 상태면 계속 대기 (최대 30초)
    const maxProcessWait = 30;
    let processWaited = 0;

    while (prediction.status === "processing" && processWaited < maxProcessWait) {
      await new Promise(r => setTimeout(r, 1000));
      processWaited++;

      if (processWaited % 5 === 0) {
        console.log(`[Replicate] 처리 중: ${processWaited}/${maxProcessWait}초`);
      }

      prediction = await replicate.predictions.get(prediction.id);
    }

    if (prediction.status !== "succeeded") {
      console.error(`[Replicate] 분석 실패: ${prediction.status}`);
      return {
        ok: false,
        message: "replicate_failed",
        detail: prediction.error || `상태: ${prediction.status}`
      };
    }

    console.log(`[Replicate] 분석 완료, 상태: ${prediction.status}`);

    // 결과 처리
    const result = Array.isArray(prediction.output)
      ? prediction.output.join("")
      : typeof prediction.output === "string"
      ? prediction.output
      : String(prediction.output || "");

    console.log('[Replicate] 분석 완료, 결과 길이:', result.length);

    return {
      ok: true,
      text: result.trim(),
      raw: result.trim(),
      english: "",
      korean: ""
    };

  } catch (error) {
    console.error("[Replicate] 오류 발생:", error);
    console.error("[Replicate] 오류 상세:", error?.message, error?.stack);
    return {
      ok: false,
      message: `replicate_error: ${error?.message || error}`,
      raw: String(error)
    };
  }
}

// ---------- 이미지 분석 (Anthropic 전용) ----------
async function analyzeWithSelectedEngine({ filePath, description }) {
  console.log('[이미지 분석] Anthropic 엔진 사용');
  return await analyzeWithAnthropic({ filePath, description });
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
