// electron/ipc/script/toSrt.js
const { ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const store = require("../services/store"); // paths.mp3 사용
// ↑ 프로젝트에 따라 경로가 다르면 맞춰주세요.

// toSrt와 timemap이 같은 문장 분절 규칙을 사용하도록 통일
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

function fmtSrtTime(sec) {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 1000);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(ss)},${String(ms).padStart(3, "0")}`;
}

async function loadTimemap(mp3Path) {
  try {
    const p = mp3Path.replace(/\.mp3$/i, ".timemap.json");
    const buf = await fs.readFile(p, "utf8");
    return JSON.parse(buf);
  } catch {
    return null;
  }
}

function buildCuesFromTimemap(scenes, timemap) {
  // timemap.scenes[i] 의 {start,end,cues[]}를 절대시간 cue로 변환
  const cues = [];
  for (let i = 0; i < (timemap.scenes || []).length; i++) {
    const tsc = timemap.scenes[i];
    const text = scenes[i]?.text ?? tsc?.text ?? "";
    const parts = splitSentences(text);

    // timemap에 씬 내부 cues가 들어있으면 그걸 사용, 없으면 문자비례로 분배
    let inner =
      Array.isArray(tsc.cues) && tsc.cues.length
        ? tsc.cues.map((c, idx) => ({
            start: tsc.start + c.start,
            end: tsc.start + c.end,
            text: parts[idx] ?? c.text ?? "",
          }))
        : (() => {
            const dur = Math.max(0, tsc.end - tsc.start);
            const counts = parts.map(charCountKo);
            const sum = counts.reduce((a, b) => a + b, 0) || 1;
            let alloc = counts.map((n) => (dur * n) / sum);
            const total = alloc.reduce((a, b) => a + b, 0);
            const scale = total ? dur / total : 1;
            alloc = alloc.map((x) => x * scale);
            let t = tsc.start;
            return parts.map((p, idx) => {
              const st = t;
              const en = idx === parts.length - 1 ? tsc.end : t + alloc[idx];
              t = en;
              return { start: st, end: en, text: p };
            });
          })();

    cues.push(...inner);
  }
  return cues;
}

function buildCuesFallbackByPlanned(scenes) {
  // timemap이 없을 때: 기존 씬.start~end를 그대로 사용
  const cues = [];
  for (const s of scenes || []) {
    const parts = splitSentences(s.text);
    const dur = Math.max(0, (Number(s.end) || 0) - (Number(s.start) || 0));
    const counts = parts.map(charCountKo);
    const sum = counts.reduce((a, b) => a + b, 0) || 1;
    let alloc = counts.map((n) => (dur * n) / sum);
    const total = alloc.reduce((a, b) => a + b, 0);
    const scale = total ? dur / total : 1;
    alloc = alloc.map((x) => x * scale);
    let t = Number(s.start) || 0;
    parts.forEach((p, idx) => {
      const st = t;
      const en = idx === parts.length - 1 ? Number(s.end) || t : t + alloc[idx];
      t = en;
      cues.push({ start: st, end: en, text: p });
    });
  }
  return cues;
}

async function toSrt({ scenes, outPath, mp3Path }) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error("scenes is required (non-empty array).");
  }
  let mp3 = mp3Path;
  if (!mp3) {
    try {
      mp3 = await store.get("paths.mp3");
    } catch {}
  }

  let cues = [];
  let usedTimemap = false;

  const tm = mp3 ? await loadTimemap(mp3) : null;
  if (tm && Array.isArray(tm.scenes) && tm.scenes.length === scenes.length) {
    cues = buildCuesFromTimemap(scenes, tm);
    usedTimemap = true;
  } else {
    cues = buildCuesFallbackByPlanned(scenes);
  }

  // SRT 직렬화
  const lines = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    lines.push(String(i + 1));
    lines.push(`${fmtSrtTime(c.start)} --> ${fmtSrtTime(c.end)}`);
    lines.push(c.text || "");
    lines.push(""); // 빈 줄
  }
  const srt = lines.join("\r\n");
  await fs.writeFile(outPath, srt, "utf8");

  return { srtPath: outPath, usedTimemap, cueCount: cues.length };
}

function register() {
  ipcMain.handle("script/toSrt", async (_evt, payload) => {
    try {
      const r = await toSrt(payload || {});
      return { ok: true, ...r };
    } catch (e) {
      console.error("[script/toSrt] fail:", e);
      return { ok: false, error: String(e?.message || e) };
    }
  });
}

module.exports = { register, toSrt };
