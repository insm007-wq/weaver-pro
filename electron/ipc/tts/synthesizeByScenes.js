// electron/ipc/tts/synthesizeByScenes.js
const { ipcMain } = require("electron");
const textToSpeech = require("@google-cloud/text-to-speech");

// SSML 안전 이스케이프
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSceneSsml(text) {
  // 필요 시 문장 사이에 살짝 쉬는 구간을 넣고 싶으면 <break time="150ms"/> 등 추가 가능
  return `<speak><mark name="start"/>${esc(text)}<mark name="end"/></speak>`;
}

function parseLangFromVoiceName(voiceName = "") {
  // 예: "ko-KR-Wavenet-A" → "ko-KR"
  const m = String(voiceName).match(/^([a-z]{2}-[A-Z]{2})-/);
  return m ? m[1] : "ko-KR";
}

module.exports = function registerTtsSynthesizeByScenes() {
  ipcMain.handle("tts/synthesizeByScenes", async (evt, payload) => {
    const doc = payload?.doc || {};
    const tts = payload?.tts || {};
    const engine = (tts.engine || "google").toLowerCase();

    if (engine !== "google") {
      throw new Error("현재 구현은 Google TTS 전용입니다. (engine=google)");
    }

    const client = new textToSpeech.TextToSpeechClient();

    const parts = [];
    const marks = []; // [{ index, sceneId, start, end, duration }]
    const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i] || {};
      const text = String(sc.text || "").trim();
      if (!text) {
        // 빈 텍스트는 건너뜀
        continue;
      }

      const ssml = buildSceneSsml(text);

      const voiceName = tts.voiceName || ""; // ex) "ko-KR-Wavenet-A"
      const languageCode = parseLangFromVoiceName(voiceName);
      const speakingRate = Number(tts.speakingRate ?? 1.0);
      const pitch = Number(tts.pitch ?? 0);

      const request = {
        input: { ssml },
        voice: voiceName
          ? { languageCode, name: voiceName }
          : { languageCode, ssmlGender: "FEMALE" },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate,
          pitch,
          // ★ SSML 마크 타임포인트 켜기
          enableTimePointing: ["SSML_MARK"],
        },
      };

      const [res] = await client.synthesizeSpeech(request);

      const tp = Array.isArray(res.timepoints) ? res.timepoints : [];
      const tpStart = tp.find((t) => t?.markName === "start");
      const tpEnd = tp.find((t) => t?.markName === "end");
      const start = Number(tpStart?.timeSeconds ?? 0);
      const end = Number(tpEnd?.timeSeconds ?? 0);
      const duration = end > start ? end - start : 0;

      const base64 = res.audioContent
        ? Buffer.from(res.audioContent, "binary").toString("base64")
        : "";

      const fileName = `scene-${String(i + 1).padStart(3, "0")}.mp3`;
      parts.push({ index: i, sceneId: sc.id || `s${i + 1}`, fileName, base64 });

      marks.push({
        index: i,
        sceneId: sc.id || `s${i + 1}`,
        start,
        end,
        duration,
      });
    }

    // index 기준 정렬(안전)
    parts.sort((a, b) => a.index - b.index);
    marks.sort((a, b) => a.index - b.index);

    return { parts, marks };
  });
};
