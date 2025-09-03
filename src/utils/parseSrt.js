// src/utils/parseSrt.js
// ============================================================================
// SRT Parser (robust)
// - 입력: SRT 문자열
// - 출력: 씬 배열 [{ id, start, end, text, assetId }]
//   * start/end: 초(second, float). millisecond 정밀도 유지
// - 특이 케이스를 견고하게 처리:
//   1) CR/LF 혼용("\r\n" / "\n")
//   2) 인덱스 라인 유/무
//   3) 공백 블록/마지막 블록 누락
//   4) 시간 포맷 "," 또는 "." 밀리초 구분자(밀리초 생략도 허용)
//   5) 다양한 화살표(--> / → / ⟶ / ⟹ / ➡ / —>)와 들쭉날쭉한 공백
// - UI 의존성 고려: text는 여러 줄을 스페이스로 합쳐 한 줄 문자열로 반환
// ============================================================================

/**
 * "HH:MM:SS,mmm" | "HH:MM:SS.mmm" | "HH:MM:SS" → 초(second, float)
 * - 밀리초 자릿수 1~3 허용 (부재 시 0)
 */
function timeToSeconds(t) {
  if (!t) return 0;
  const str = String(t).trim();
  const m = /^(\d{2}):(\d{2}):(\d{2})(?:[,.](\d{1,3}))?$/.exec(str);
  if (!m) return 0;

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ms = m[4] ? Number(String(m[4]).padStart(3, "0")) : 0;

  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

/**
 * 여러 줄 텍스트를 스페이스 한 칸으로 합침
 */
function normalizeTextLines(lines) {
  const joined = (lines || [])
    .map((ln) => (ln || "").trim())
    .filter((ln) => ln.length > 0)
    .join(" ");
  return joined.replace(/\s+/g, " ").trim();
}

/**
 * 타임라인 라인에서 시작/종료 시간 추출
 * - 예: "00:00:05,000 --> 00:00:07,500"
 * - 다양한 화살표/공백 허용
 */
function extractTimeRange(line) {
  if (!line) return null;
  const s = String(line).trim();

  // 그룹1: 시작, 그룹2: 종료
  const re = /(\d{2}:\d{2}:\d{2}(?:[,.]\d{1,3})?)\s*(?:-->|→|⟶|⟹|➡|—>)\s*(\d{2}:\d{2}:\d{2}(?:[,.]\d{1,3})?)/;

  const tm = s.match(re);
  if (!tm) return null;

  const start = timeToSeconds(tm[1]);
  const end = timeToSeconds(tm[2]);

  // 동일/역전 방지 (최소 0.01초)
  return { start, end: Math.max(end, start + 0.01) };
}

/**
 * CR/LF 섞임, 인덱스줄 유무, 마지막 블록 누락 등 다양한 케이스 견고하게 처리
 * 반환: [{ id, start, end, text, assetId }]
 */
export function parseSrtToScenes(srtText) {
  if (!srtText || typeof srtText !== "string") return [];

  // 1) BOM 제거 + CR 제거 + 개행 분리
  const src = srtText.replace(/^\uFEFF/, "");
  const lines = src.replace(/\r/g, "").split("\n");

  const scenes = [];
  let i = 0;
  let idx = 1;

  while (i < lines.length) {
    // A. 선행 빈 줄 스킵
    while (i < lines.length && /^\s*$/.test(lines[i])) i++;
    if (i >= lines.length) break;

    // B. 인덱스 라인(숫자만) 스킵 (있을 수도/없을 수도)
    if (/^\d+\s*$/.test(lines[i] || "")) {
      i++;
      while (i < lines.length && /^\s*$/.test(lines[i])) i++;
    }
    if (i >= lines.length) break;

    // C. 타임라인 라인 파싱
    const timeLine = (lines[i] || "").trim();
    const range = extractTimeRange(timeLine);
    if (!range) {
      // 타임라인이 아니면 다음 줄로 이동
      i++;
      continue;
    }
    i++;

    // D. 자막 본문 수집 (빈 줄 전까지)
    const textLines = [];
    while (i < lines.length && !/^\s*$/.test(lines[i])) {
      textLines.push(lines[i]);
      i++;
    }
    const oneLineText = normalizeTextLines(textLines);

    scenes.push({
      id: `sc${idx++}`,
      start: range.start,
      end: range.end,
      text: oneLineText,
      assetId: null,
    });

    // 다음 블록을 위해 후행 빈 줄 스킵 (EOF여도 안전)
    while (i < lines.length && /^\s*$/.test(lines[i])) i++;
  }

  // 시간 순 정렬
  scenes.sort((a, b) => a.start - b.start);
  return scenes;
}

/* ========================================================================== *
 * (선택) 유틸: 씬 → SRT 변환 (현재는 export 안 함)
 * ========================================================================== */
function secondsToSrtTime(secFloat = 0) {
  const totalMs = Math.max(0, Math.round(secFloat * 1000));
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const m = totalMin % 60;
  const h = Math.floor(totalMin / 60);
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, "0")}`;
}

function scenesToSrt(scenes = []) {
  let n = 1;
  const parts = [];
  for (const sc of scenes) {
    parts.push(String(n++));
    parts.push(`${secondsToSrtTime(sc.start)} --> ${secondsToSrtTime(Math.max(sc.end, sc.start + 0.01))}`);
    parts.push((sc.text || "").replace(/\r?\n/g, " "));
    parts.push("");
  }
  return parts.join("\n");
}

// 필요에 따라 default 임포트도 지원
export default parseSrtToScenes;
