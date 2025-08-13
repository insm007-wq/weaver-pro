// electron/ipc/llm.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
// 기본 모델은 최신 Claude 3.5/3.7 중 하나
const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest";

ipcMain.handle("llm/generateScript", async (_evt, payload) => {
  const { type, topic, style, duration, maxScenes, referenceText, llm } =
    payload || {};
  if (llm !== "anthropic") {
    throw new Error("현재 구현된 LLM은 Anthropic만 지원합니다.");
  }

  const apiKey = await getSecret("anthropicKey");
  if (!apiKey) throw new Error("Anthropic API Key가 설정되지 않았습니다.");

  // 프롬프트: JSON만 출력하도록 강하게 유도
  const sys = [
    "You are a professional scriptwriter.",
    "Return ONLY valid JSON with this exact schema:",
    `{
  "title": "string",
  "scenes": [
    { "id": "string", "text": "string" }
  ]
}`,
    "Do not add commentary. Korean language output.",
  ].join("\n");

  const user = [
    `주제: ${topic || "(미지정)"}`,
    `스타일: ${style || "(자유)"}`,
    `목표 길이(분): ${duration}`,
    `최대 장면 수: ${maxScenes}`,
    type === "reference" ? `\n[레퍼런스]\n${referenceText || ""}` : "",
    "\n**요구사항**",
    "- 장면 수는 가능한 한 최대 장면 수에 가깝게 분할",
    "- 각 장면은 자연스러운 구어체",
    "- JSON 외 텍스트 금지",
  ].join("\n");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 2000,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Anthropic 요청 실패: ${res.status} ${txt}`);
  }
  const data = await res.json();

  // 응답 파싱
  const text = data?.content?.[0]?.text || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/```json([\s\S]*?)```/);
    if (m) parsed = JSON.parse(m[1]);
  }
  if (!parsed?.scenes?.length) throw new Error("대본 JSON 파싱 실패");

  // 시간정보 부여(균등 분배). 초단위 start/end.
  const totalSecs = Math.max(1, Number(duration || 5) * 60);
  const n = parsed.scenes.length;
  const step = Math.floor(totalSecs / n);

  const scenes = parsed.scenes.map((s, i) => {
    const start = i * step;
    // 마지막 씬은 남은 전체 시간 할당
    const end = i === n - 1 ? totalSecs : (i + 1) * step;
    const text = String(s.text || "").trim();
    return {
      id: String(s.id || i + 1),
      start,
      end,
      text,
      charCount: text.length,
    };
  });

  return {
    title: parsed.title || topic || "자동 생성 대본",
    scenes,
  };
});
