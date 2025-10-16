// src/utils/time.js

// 내부 공용
function toIntSeconds(sec = 0) {
  let s = Number(sec);
  if (!Number.isFinite(s)) s = 0;
  return Math.max(0, Math.round(s)); // 기존 secToTime과 동일하게 반올림
}
const pad2 = (n) => String(n).padStart(2, "0");

// mm:ss
export function fmtMmSs(sec = 0) {
  const s = toIntSeconds(sec);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${pad2(mm)}:${pad2(ss)}`;
}

// hh:mm:ss
export function fmtHhMmSs(sec = 0) {
  const s = toIntSeconds(sec);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

// 시가 0이면 mm:ss, 있으면 hh:mm:ss (기존 코드와 완전 호환)
export function secToTime(sec) {
  const s = toIntSeconds(sec);
  const hh = Math.floor(s / 3600);
  return hh > 0 ? fmtHhMmSs(s) : fmtMmSs(s);
}

// 안전하게 기본(default)도 제공 (원래 secToTime만 쓰던 코드 보호)
export default secToTime;
