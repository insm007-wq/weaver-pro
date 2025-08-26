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
//   4) 시간 포맷 "," 또는 "." 밀리초 구분자
//   5) 공백 많은 라인/유니코드 화살표(예: "→")가 섞여도 안전
// - 기존 UI 의존성 고려:
//   * text는 기본적으로 여러 줄을 "스페이스로 합쳐" 한 줄 문자열로 반환 (현재 구현과 호환)
// ============================================================================

/**
 * "HH:MM:SS,mmm" 또는 "HH:MM:SS.mmm" → 초(second, float)
 * - 일부 SRT는 밀리초 자릿수가 1~3자리로 오는 경우가 있어 3자리 기준으로 보정
 * - 잘못된 포맷이면 0 반환
 */
function timeToSeconds(t) {
  if (!t) return 0;
  const str = String(t).trim();

  // 빠르게 거르기: 숫자/콜론이 아닌 경우
  if (!/\d{2}:\d{2}:\d{2}[,\.]\d{1,3}/.test(str)) return 0;

  const m = /^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/.exec(str);
  if (!m) return 0;

  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  // 밀리초: 1~3자리 → 3자리 기준으로 보정 (예: "5" → "005")
  const msStr = m[4].padStart(3, "0");
  const ms = Number(msStr);

  return hh * 3600 + mm * 60 + ss + ms / 1000;
}

/**
 * 내부 유틸: 불필요한 공백을 1칸으로 압축
 * - SRT 본문은 개행 구분이 의미 있을 수 있으나,
 *   현재 UI는 한 줄 텍스트를 기대하므로 "스페이스로 합침".
 * - 필요 시 여기에서 "\n" 유지로 바꿔도 됨.
 */
function normalizeTextLines(lines) {
  // 빈 줄/트림/연속 공백 압축
  const joined = (lines || [])
    .map((ln) => (ln || "").trim())
    .filter((ln) => ln.length > 0)
    .join(" ");
  return joined.replace(/\s+/g, " ").trim();
}

/**
 * 내부 유틸: 타임라인 라인에서 시작/종료 시간 추출
 * - 포맷 예: "00:00:05,000 --> 00:00:07,500"
 * - 다양한 공백/유니코드 화살표도 허용
 */
function extractTimeRange(line) {
  if (!line) return null;
  const s = String(line).trim();

  // "-->" 기본 + 유니코드 화살표 "→" 혼용 허용
  // 그룹1: 시작, 그룹2: 종료
  const re =
    /(\d{2}:\d{2}:\d{2}[,\.]\d{1,3})\s*(?:-->|→|⟶|⟹|➡)\s*(\d{2}:\d{2}:\d{2}[,\.]\d{1,3})/;
  const tm = s.match(re);
  if (!tm) return null;

  const start = timeToSeconds(tm[1]);
  const end = timeToSeconds(tm[2]);

  return {
    start,
    end: Math.max(end, start + 0.01), // 동일/역전 방지 (최소 0.01초 보장)
  };
}

/**
 * CR/LF 섞임, 인덱스줄 유무, 마지막 블록 누락 등 다양한 케이스 견고하게 처리
 * 반환: [{ id, start, end, text, assetId }]
 */
export function parseSrtToScenes(srtText) {
  if (!srtText || typeof srtText !== "string") return [];

  // 1) BOM 제거 + CR 제거 + 개행 분리
  const text = srtText.replace(/^\uFEFF/, "");
  const lines = text.replace(/\r/g, "").split("\n");

  const scenes = [];
  let i = 0;
  let idx = 1;

  while (i < lines.length) {
    // A. 빈 줄 스킵
    while (i < lines.length && /^\s*$/.test(lines[i])) i++;

    if (i >= lines.length) break;

    // B. 인덱스 라인(숫자만) 스킵 (있을 수도/없을 수도)
    if (/^\d+\s*$/.test(lines[i] || "")) {
      i++;
      // 인덱스 라인 다음도 빈 줄일 수 있으니 스킵
      while (i < lines.length && /^\s*$/.test(lines[i])) i++;
    }

    if (i >= lines.length) break;

    // C. 타임라인 라인 파싱
    const timeLine = (lines[i] || "").trim();
    const range = extractTimeRange(timeLine);
    if (!range) {
      // 타임라인 라인이 아니면 다음 줄로 진행
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
    const text = normalizeTextLines(textLines);

    scenes.push({
      id: `sc${idx++}`,
      start: range.start,
      end: range.end,
      text,
      assetId: null,
    });

    // 다음 블록으로 넘어가기 위해 빈 줄 스킵
    while (i < lines.length && /^\s*$/.test(lines[i])) i++;
  }

  // 시간 순 정렬 (입력 순서가 뒤죽박죽이어도 안전)
  scenes.sort((a, b) => a.start - b.start);

  return scenes;
}

/* ========================================================================== *
 * (선택) 유틸 추가: 씬 → SRT 변환이 필요해질 수 있어 보조 함수 제공
 *  - 현재는 사용하지 않더라도 향후 "SRT 익스포트"에 바로 재사용 가능
 *  - export는 하지 않고, 필요할 때 공개하세요.
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

/**
 * (참고) 씬 → SRT 문자열 (미공개)
 * - 현재 파일에서 필요 시 export 하세요.
 */
function scenesToSrt(scenes = []) {
  let n = 1;
  const parts = [];
  for (const sc of scenes) {
    parts.push(String(n++));
    parts.push(
      `${secondsToSrtTime(sc.start)} --> ${secondsToSrtTime(
        Math.max(sc.end, sc.start + 0.01)
      )}`
    );
    parts.push((sc.text || "").replace(/\r?\n/g, " "));
    parts.push(""); // 빈 줄
  }
  return parts.join("\n");
}
