// electron/ipc/tts/timemap.js
// -----------------------------------------------------------------------------
// 씬별로 생성된 오디오 파일들의 '실제' 재생 길이를 ffprobe로 측정하여
// 최종 MP3 타임라인 기준의 timemap(JSON)을 저장/반환한다.
// 사용법: buildAndSaveTimemap({ scenes, chunkPaths, finalMp3Path })
// -----------------------------------------------------------------------------

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { execFileSync } = require("child_process");

function probeDurationSec(file) {
  try {
    const out = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        file,
      ],
      { encoding: "utf8" }
    );
    const sec = parseFloat(String(out || "").trim());
    return Number.isFinite(sec) ? Math.max(0, sec) : 0;
  } catch (e) {
    console.warn("[timemap] ffprobe failed:", e?.message || e);
    return 0;
  }
}

/** 간단한 문장 분절 (toSrt와 동일 규칙 유지) */
const SENTENCE_RE = /([^.!?…]+[.!?…]+|\S+(?:\s+|$))/g;
function splitSentences(text) {
  const t = String(text || "").trim();
  const m = t.match(SENTENCE_RE);
  if (m && m.length) return m.map((s) => s.trim()).filter(Boolean);
  return t ? [t] : [];
}
function charCountKo(s) {
  try {
    return Array.from(String(s ?? "").normalize("NFC")).length;
  } catch {
    return Array.from(String(s ?? "")).length;
  }
}

/**
 * @param {Object} p
 * @param {{id?:string,start:number,end:number,text:string}[]} p.scenes  // 원본 씬(텍스트 필요)
 * @param {string[]} p.chunkPaths   // 각 씬 오디오 파일 경로(합치기 전 조각들)
 * @param {string} p.finalMp3Path   // 최종 mp3 경로 (타임맵은 sameName.timemap.json)
 */
async function buildAndSaveTimemap({ scenes, chunkPaths, finalMp3Path }) {
  if (!Array.isArray(scenes) || !Array.isArray(chunkPaths)) {
    throw new Error("scenes/chunkPaths are required arrays");
  }
  if (scenes.length !== chunkPaths.length) {
    throw new Error("scenes.length must equal chunkPaths.length");
  }
  const out = {
    version: 1,
    totalDuration: 0,
    scenes: [],
  };

  let acc = 0;
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i] || {};
    const file = chunkPaths[i];
    const dur = probeDurationSec(file);

    // 문장 cue는 '해당 씬의 실제 길이' 기준으로 문자 비례 분배 (엔진에 상관없이 안정적)
    const parts = splitSentences(s.text);
    const counts = parts.map(charCountKo);
    const sum = counts.reduce((a, b) => a + b, 0) || 1;
    const MIN_SEG_SEC = 0.6;
    let alloc = counts.map((n) => Math.max(MIN_SEG_SEC, (dur * n) / sum));
    // 정규화 (총합=dur)
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
      text: s.text || "",
      cues, // 씬 내부에서의 상대 시간
    });
    acc += dur;
  }
  out.totalDuration = acc;

  const jsonPath =
    finalMp3Path && finalMp3Path.endsWith(".mp3")
      ? finalMp3Path.replace(/\.mp3$/i, ".timemap.json")
      : (finalMp3Path || "").concat(".timemap.json");

  if (jsonPath) {
    await fsp.writeFile(jsonPath, JSON.stringify(out, null, 2), "utf8");
  }
  return { timemap: out, timemapPath: jsonPath };
}

module.exports = { buildAndSaveTimemap };
