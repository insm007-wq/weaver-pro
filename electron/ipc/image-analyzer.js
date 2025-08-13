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

// ---------- 프롬프트 (극적/자극적 V7) ----------
const PROMPT_V7 = `
Return TWO blocks in this exact order and labels:

English Prompt:
Write ONE flowing paragraph of 130–170 words. Make it sensational and cinematic. Naturally include:
- subject (only age/gender vibe if visually implied), facial expression, decisive action/pose with impact physics (spray, shards, ripples, motion arcs)
- camera: framing (close-up/MCU/waist-up or full if action demands), angle, lens in mm
- lighting: key/rim/ambient, contrast ratio, mood, color palette or gels
- setting: background/location, props, crowd reactions, depth-of-field or creamy bokeh
- composition: rule of thirds, lead room/headroom, dynamic diagonals, leave the lower third empty for captions
- style: hyper-realistic/photorealistic/cinematic, film grain or matte grade, thumbnail-friendly clarity
- negative cues: no text, no letters, no logos, no watermarks, no captions, no UI

한국어 해석:
Translate the English prompt faithfully into Korean with similar length (130–170 words). Keep the same cinematic intensity and vocabulary. No markdown, no lists, no brackets, no placeholders.
`.trim();

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
    model: "claude-3-5-sonnet-20240620", // 안정 버전
    max_tokens: 2048, // ⬆️ 길이 확보
    temperature: 0.8, // ⬆️ 창의성/강조
    top_p: 0.9, // ⬆️ 어휘 다양성
    system: SYSTEM_V1, // ← 시네마틱/자극 톤 고정
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

  // "English Prompt:" / "한국어 해석:" 라벨 기준으로 안전 파싱
  let english = "";
  let korean = "";

  if (fullText) {
    const enMatch = fullText.match(
      /English Prompt:\s*([\s\S]*?)(?:\n한국어 해석:|$)/i
    );
    const koMatch = fullText.match(/\n한국어 해석:\s*([\s\S]*)$/);
    english = enMatch ? enMatch[1].trim() : fullText;
    korean = koMatch ? koMatch[1].trim() : "";
  }

  return { ok: true, english, korean, raw: fullText };
}

// ---------- IPC 핸들러 ----------
ipcMain.handle("image:analyze", async (_e, payload = {}) => {
  try {
    const { filePath, description } = payload;
    return await analyzeWithAnthropic({ filePath, description });
  } catch (err) {
    console.error("[image:analyze] error", err);
    return { ok: false, message: String(err?.message || err) };
  }
});

// 하위호환: 기존 imagefx 채널도 유지(필요시 삭제 가능)
ipcMain.handle("imagefx:analyze", async (_e, payload = {}) => {
  try {
    const { filePath, description } = payload;
    return await analyzeWithAnthropic({ filePath, description });
  } catch (err) {
    console.error("[imagefx:analyze] error", err);
    return { ok: false, message: String(err?.message || err) };
  }
});
