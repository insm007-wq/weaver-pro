// electron/ipc/script.js
const { ipcMain } = require("electron");

/** 초(실수 가능) -> "HH:MM:SS,mmm" */
function toSrtTime(sec) {
  const totalMs = Math.max(0, Math.round((Number(sec) || 0) * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss},${String(ms).padStart(3, "0")}`;
}

/** 텍스트 정리(여러 줄 -> 한 줄, 공백 정돈) */
function normalizeText(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** SRT 파서: 텍스트 -> { title, scenes[] } */
function parseSrt(srtText = "") {
  const text = String(srtText || "")
    .replace(/\r/g, "")
    .trim();
  if (!text) return { title: "Imported SRT", scenes: [] };

  // 블록 분리 (빈 줄 1개 이상)
  const blocks = text.split(/\n{2,}/);
  const scenes = [];
  let idx = 0;

  // 00:00:00,000 --> 00:00:03,000
  const timeRe =
    /(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/;

  const toSec = (h, m, s, ms) =>
    Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) continue;

    // 보통 1행: 인덱스, 2행: 타임라인
    let timeLine =
      lines[0].match(timeRe) || (lines[1] && lines[1].match(timeRe));
    let textStartLine = timeLine ? (lines[0].match(timeRe) ? 1 : 2) : -1;

    if (!timeLine) continue;

    const start = toSec(timeLine[1], timeLine[2], timeLine[3], timeLine[4]);
    const end = toSec(timeLine[5], timeLine[6], timeLine[7], timeLine[8]);

    const body = normalizeText(lines.slice(textStartLine).join("\n"));
    if (!body) continue;

    scenes.push({
      id: String(++idx),
      start,
      end: Math.max(end, start + 0.5), // 최소 0.5초 보장
      text: body,
      charCount: body.length,
    });
  }

  return { title: "Imported SRT", scenes };
}

/** doc.scenes -> SRT 문자열 */
ipcMain.handle("script/toSrt", async (_evt, { doc }) => {
  const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];
  const lines = [];

  scenes.forEach((sc, i) => {
    const start = toSrtTime(sc.start);
    const end = toSrtTime(sc.end);
    const text = normalizeText(sc.text);

    lines.push(String(i + 1));
    lines.push(`${start} --> ${end}`);
    lines.push(text || "");
    lines.push(""); // 빈 줄
  });

  return { ok: true, srt: lines.join("\n") };
});

/** SRT 텍스트 -> { title, scenes[] } */
ipcMain.handle("script/importSrt", async (_evt, { srtText }) => {
  const doc = parseSrt(srtText || "");
  return doc;
});
