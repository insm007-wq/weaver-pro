// src/utils/parseSrt.js
function timeToSeconds(t) {
  // "HH:MM:SS,mmm" 또는 "HH:MM:SS.mmm"
  const m = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(t.trim());
  if (!m) return 0;
  const hh = Number(m[1]),
    mm = Number(m[2]),
    ss = Number(m[3]),
    ms = Number(m[4]);
  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

/** CR/LF 섞임, 인덱스줄 유무, 마지막 블록 누락 등 다양한 케이스 견고하게 처리 */
export function parseSrtToScenes(srtText) {
  if (!srtText) return [];
  const lines = srtText.replace(/\r/g, "").split("\n");
  const scenes = [];
  let i = 0,
    idx = 1;

  while (i < lines.length) {
    // 공백 스킵
    while (i < lines.length && /^\s*$/.test(lines[i])) i++;

    // 인덱스 줄(숫자) 스킵
    if (i < lines.length && /^\d+$/.test(lines[i].trim())) i++;

    if (i >= lines.length) break;

    // 타임라인
    const timeLine = (lines[i] || "").trim();
    const tm = timeLine.match(/(\d{2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{1,3})/);
    if (!tm) {
      i++;
      continue;
    }
    const start = timeToSeconds(tm[1]);
    const end = timeToSeconds(tm[2]);
    i++;

    // 자막 줄 수집 (빈 줄 전까지)
    const textLines = [];
    while (i < lines.length && !/^\s*$/.test(lines[i])) {
      textLines.push(lines[i]);
      i++;
    }
    const text = textLines.join(" ").trim();

    scenes.push({
      id: `sc${idx++}`,
      start,
      end: Math.max(end, start + 0.01),
      text,
      assetId: null,
    });
  }

  scenes.sort((a, b) => a.start - b.start);
  return scenes;
}
