// 시간 포맷 <-> 초
export function secToTime(sec, srt = false) {
  const ms = Math.round((sec % 1) * 1000);
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  if (srt) return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
export function timeToSec(t) {
  // "HH:MM:SS,mmm" | "MM:SS,mmm" | "SS,mmm" 허용
  const m = t
    .trim()
    .match(/(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?/);
  if (!m) return 0;
  const h = Number(m[1] || 0);
  const min = Number(m[2] || 0);
  const s = Number(m[3] || 0);
  const ms = Number(m[4] || 0);
  return h * 3600 + min * 60 + s + ms / 1000;
}

// 메트릭
export function calcCPS(text = "", durationSec = 1) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length / Math.max(0.01, durationSec);
}
export function calcCPL(text = "") {
  const lines = (text || "").split(/\n/);
  return Math.max(...lines.map((l) => l.length), 0);
}

// 두 줄 균형 분할 (한국어 기준 간단 규칙)
export function splitBalancedLines(text = "", maxLine = 16) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLine) return [clean, ""];
  // 공백/구두점 기준으로 절단점 탐색
  let cut = Math.min(maxLine, clean.length - 1);
  for (let i = cut; i < clean.length; i++) {
    if (/[ \-–—·,.:;!?]/.test(clean[i])) {
      cut = i + 1;
      break;
    }
  }
  const l1 = clean.slice(0, cut).trim();
  const l2 = clean.slice(cut).trim();
  return [l1, l2];
}
