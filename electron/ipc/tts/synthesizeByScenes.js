// electron/ipc/tts/synthesizeByScenes.js
const { ipcMain } = require("electron");
const textToSpeech = require("@google-cloud/text-to-speech");

/* ======================= SSML/텍스트 유틸 ======================= */
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function buildSceneSsml(text) {
  // 필요시 <break time="150ms"/> 등을 추가 가능
  return `<speak><mark name="start"/>${esc(text)}<mark name="end"/></speak>`;
}
function parseLangFromVoiceName(voiceName = "") {
  // 예: "ko-KR-Wavenet-A" → "ko-KR"
  const m = String(voiceName).match(/^([a-z]{2}-[A-Z]{2})-/);
  return m ? m[1] : "ko-KR";
}
function normalizeForCount(s) {
  let t = String(s ?? "");
  try {
    t = t.normalize("NFC");
  } catch {}
  return t.replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
}
function charCountKo(s) {
  return Array.from(normalizeForCount(s)).length;
}
// 문장 분절: 마침표/물음표/느낌표/…/공백단위 안전 분절
const SENTENCE_RE = /([^.!?…]+[.!?…]+|\S+(?:\s+|$))/g;
function splitSentences(text) {
  const t = String(text || "").trim();
  const m = t.match(SENTENCE_RE);
  if (m && m.length) return m.map((s) => s.trim()).filter(Boolean);
  return t ? [t] : [];
}

/* ======================= Timemap 생성기 ======================= */
/**
 * Google TTS timepoint 기반 절대 타임라인 timemap 생성
 * @param {Array<{id?:string,text:string}>} scenes
 * @param {Array<{index:number, duration:number}>} marks
 */
function buildTimemapFromMarks(scenes, marks) {
  const MIN_SEG_SEC = 0.6;
  const out = {
    version: 1,
    source: "google-ssml-marks",
    totalDuration: 0,
    scenes: [],
  };

  // index → mark 매핑
  const byIndex = new Map((marks || []).map((m) => [m.index, m]));

  let acc = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i] || {};
    const text = String(s.text || "").trim();
    if (!text) continue;

    const mk = byIndex.get(i) || {};
    let dur = Number(mk.duration) || 0;

    // timepoint 누락 등 비상 폴백: (1) 계획 구간 있으면 사용, (2) 문자수 추정치
    if (!Number.isFinite(dur) || dur <= 0) {
      const planned = Math.max(
        0,
        (Number(s.end) || 0) - (Number(s.start) || 0)
      );
      dur = planned || Math.max(1.2, charCountKo(text) * 0.06);
    }

    // 문장 분절 → 문자수 비례로 씬 내부 cue 시간 배분(총합=dur)
    const parts = splitSentences(text);
    const counts = parts.map(charCountKo);
    const sum = counts.reduce((a, b) => a + b, 0) || 1;

    let alloc = counts.map((n) => Math.max(MIN_SEG_SEC, (dur * n) / sum));
    const total = alloc.reduce((a, b) => a + b, 0);
    const scale = total ? dur / total : 1;
    alloc = alloc.map((x) => x * scale);

    const cues = [];
    let t = 0;
    for (let j = 0; j < parts.length; j++) {
      const st = t;
      const en = j === parts.length - 1 ? dur : t + alloc[j];
      cues.push({ idx: j, start: st, end: en, text: parts[j] });
      t = en;
    }

    out.scenes.push({
      idx: i,
      id: s.id ?? `sc${i + 1}`,
      start: acc,
      end: acc + dur,
      duration: dur,
      text,
      cues, // 씬 내부 상대시간 (프리뷰/변환시 절대시간=scene.start+cue.start)
    });

    acc += dur;
  }

  out.totalDuration = acc;
  return out;
}

/* ======================= IPC 핸들러 ======================= */
module.exports = function registerTtsSynthesizeByScenes() {
  ipcMain.handle("tts/synthesizeByScenes", async (_evt, payload) => {
    const doc = payload?.doc || {};
    const tts = payload?.tts || {};
    const engine = (tts.engine || "google").toLowerCase();

    if (engine !== "google") {
      throw new Error("현재 구현은 Google TTS 전용입니다. (engine=google)");
    }

    const client = new textToSpeech.TextToSpeechClient();

    const parts = []; // [{ index, sceneId, fileName, base64 }]
    const marks = []; // [{ index, sceneId, start, end, duration }]
    const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i] || {};
      const text = String(sc.text || "").trim();
      if (!text) continue; // 빈 텍스트는 건너뜀

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
          // SSML 마크 타임포인트 켜기
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

      parts.push({
        index: i,
        sceneId: sc.id || `s${i + 1}`,
        fileName,
        base64,
        // 편의를 위해 duration도 포함
        duration,
      });

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

    // ★ timepoint(실제 길이) 기반 절대 타임라인 timemap 생성
    const timemap = buildTimemapFromMarks(scenes, marks);

    // 반환: 기존 호환(parts, marks) + 정밀 타임맵
    return { parts, marks, timemap };
  });
};
