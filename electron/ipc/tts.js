// electron/ipc/tts.js
const { ipcMain } = require("electron");
const { getSecret } = require("../services/secrets");

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

ipcMain.handle("tts/synthesizeByScenes", async (_evt, { doc, tts }) => {
  const { engine, voiceName, speakingRate, pitch } = tts || {};
  if (engine !== "google") {
    throw new Error("현재 구현된 TTS는 Google Cloud TTS만 지원합니다.");
  }

  const apiKey = await getSecret("googleTtsApiKey");
  if (!apiKey) throw new Error("Google TTS API Key가 설정되지 않았습니다.");

  const scenes = doc?.scenes || [];
  const lang = (() => {
    // ex) ko-KR-Wavenet-A → ko-KR
    const parts = String(voiceName || "").split("-");
    return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : "ko-KR";
  })();

  const parts = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const body = {
      input: { text: String(sc.text || "") },
      voice: { languageCode: lang, name: voiceName || "ko-KR-Wavenet-A" },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Number(speakingRate ?? 1),
        pitch: Number(pitch ?? 0),
      },
    };

    const res = await fetch(`${GOOGLE_TTS_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Google TTS 실패(${i + 1}): ${res.status} ${txt}`);
    }
    const data = await res.json();
    const base64 = data?.audioContent;
    if (!base64) throw new Error(`Google TTS 응답 오류(${i + 1})`);
    parts.push({
      fileName: `scene-${String(i + 1).padStart(3, "0")}.mp3`,
      base64,
      mime: "audio/mpeg",
    });
  }

  return { ok: true, partsCount: parts.length, parts };
});
