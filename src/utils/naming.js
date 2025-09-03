// 파일명 규칙 유틸 (KeywordsTab에서 사용)
const pad2 = (n) => String(n).padStart(2, "0");
const safe = (s) =>
  String(s || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 40);

export function guessProvider(urlOrHost = "", fallback = "stock") {
  const s = String(urlOrHost).toLowerCase();
  if (s.includes("pexels")) return "pexels";
  if (s.includes("pixabay")) return "pixabay";
  return fallback;
}
function guessExt(from = "", def = "mp4") {
  const m = String(from).match(/\.([a-z0-9]{2,4})(?:\?|#|$)/i);
  return (m && m[1].toLowerCase()) || def;
}
export function guessId(from = "") {
  const all = String(from).match(/\d{3,}/g);
  return all && all.length ? all.sort((a, b) => b.length - a.length)[0] : null;
}
function guessWH(from = "", w, h) {
  const m = String(from).match(/(\d{3,5})x(\d{3,5})/i);
  if (m) return { w: +m[1], h: +m[2] };
  return { w, h };
}

// 최종 파일명: {키워드}_{NN}_{provider-id}_{WxH}.{ext}
export function buildNiceName(keyword, seq, item, chosenRes) {
  const k = safe(keyword);
  const host = (() => {
    try {
      return new URL(item.url).host;
    } catch {
      return "";
    }
  })();
  const provider = safe(item.provider || guessProvider(host));
  const base = item.filename || item.url || "";
  const ext = guessExt(base, "mp4");
  const id = item.assetId || guessId(base) || "x";
  const wh = guessWH(base, chosenRes.w, chosenRes.h);
  return `${k}_${pad2(seq)}_${provider}-${id}_${wh.w}x${wh.h}.${ext}`;
}

export default { buildNiceName, guessProvider, guessId };
