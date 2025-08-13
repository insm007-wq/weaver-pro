// electron/ipc/image-analyzer.js
const { ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// ---------- API KEY 로딩 (env → keytar) ----------
async function readAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    // ApiTab에서 setSecret({ key: "anthropicKey", value: ... })로 저장함
    const { getSecret } = require("../services/secrets");
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

// ---------- 프롬프트 ----------
const PROMPT_V5 = `
You are an expert prompt writer for ImageFX-style thumbnails.
FORMAT STRICTLY:
English Prompt:
<one concise block, ~5-8 lines, thumbnail-friendly, include composition/framing/lighting/lens/space for text if relevant, NO markdown, NO extra labels>

한국어 해석:
<faithful Korean explanation of the English prompt, ~5-8 lines, NO markdown, NO extra labels>
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

    // Anthropic Messages API는 type: "image"
    imagePart = {
      type: "image",
      source: { type: "base64", media_type: mime, data: b64 },
    };
  }

  const content = [{ type: "text", text: PROMPT_V5 }];

  if (
    description &&
    typeof description === "string" &&
    description.trim().length
  ) {
    content.push({
      type: "text",
      text: "Additional user description:\n" + description.trim(),
    });
  }

  if (imagePart) content.push(imagePart);

  const body = {
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 1024,
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
  const text = json?.content?.[0]?.text || "";

  // "English Prompt:\n...\n\n한국어 해석:\n..." 형태 파싱
  let english = "";
  let korean = "";

  const splitKor = text.split(/\n한국어 해석:\s*/);
  if (splitKor.length >= 2) {
    const enPart = splitKor[0].replace(/^English Prompt:\s*/i, "").trim();
    const koPart = splitKor.slice(1).join("\n").trim();
    english = enPart;
    korean = koPart;
  } else {
    english = text.trim();
    korean = "";
  }

  return { ok: true, english, korean, raw: text };
}

// ---------- IPC 핸들러 ----------
// 신규 권장 채널
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
