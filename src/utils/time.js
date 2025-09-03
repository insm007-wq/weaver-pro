export function secToTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh !== "00" ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}
