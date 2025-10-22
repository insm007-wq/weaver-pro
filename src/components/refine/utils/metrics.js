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

// 여러 줄 균형 분할 (한국어 기준 간단 규칙)
// maxLines: 최대 줄 수 (기본값 2)
// fontSize: 폰트 크기 (기본값 52, 픽셀 너비 계산용)
export function splitBalancedLines(text = "", maxLines = 2, fontSize = 52) {
  const clean = text.replace(/\s+/g, " ").trim();

  // 이미 줄바꿈이 있으면 그대로 사용
  if (text.includes("\n")) {
    const lines = text.split("\n").map(line => line.trim()).filter(line => line);
    // maxLines 제한 적용
    return lines.slice(0, maxLines);
  }

  // maxLines가 1이면 분할하지 않음
  if (maxLines === 1) {
    return [clean];
  }

  // 텍스트가 너무 짧으면 1줄로 반환 (20자 이하)
  if (clean.length <= 20) {
    return [clean];
  }

  // ✅ 자동 줄 수 조정: 폰트 크기를 고려한 픽셀 기반 계산
  // 한글 문자당 평균 너비: fontSize * 0.72 (실제 측정값 기반)
  // 85% maxWidth 기준: 1920 * 0.85 = 1632px
  const charWidthPx = fontSize * 0.72;
  const maxWidthPx = 1632; // 1920 * 0.85
  const maxCharsPerLine = Math.floor(maxWidthPx / charWidthPx);

  let effectiveMaxLines = maxLines;
  const avgCharsPerLine = clean.length / maxLines;
  // 개별 줄의 최대 글자 수 체크: 한 줄이 maxCharsPerLine을 초과하면 3줄로
  if (avgCharsPerLine > maxCharsPerLine && maxLines === 2) {
    effectiveMaxLines = 3;
  }

  // 추가 체크: 3줄로도 부족하면 4줄로
  if (avgCharsPerLine / effectiveMaxLines > maxCharsPerLine && effectiveMaxLines === 3) {
    effectiveMaxLines = 4;
  }

  // 추가 체크: 4줄로도 부족하면 5줄로
  if (avgCharsPerLine / effectiveMaxLines > maxCharsPerLine && effectiveMaxLines === 4) {
    effectiveMaxLines = 5;
  }

  // effectiveMaxLines만큼 균등 분할
  const lines = [];
  let remaining = clean;

  for (let lineIndex = 0; lineIndex < effectiveMaxLines && remaining.length > 0; lineIndex++) {
    const isLastLine = lineIndex === effectiveMaxLines - 1;

    if (isLastLine) {
      // 마지막 줄은 나머지 전부
      lines.push(remaining.trim());
      break;
    }

    // 목표 길이 계산 (남은 텍스트를 남은 줄 수로 나눔)
    const remainingLines = effectiveMaxLines - lineIndex;
    const targetLength = Math.ceil(remaining.length / remainingLines);

    // 목표 길이 근처에서 공백이나 구두점 찾기
    let cut = Math.min(targetLength, remaining.length);
    let foundBreak = false;

    // 목표 위치부터 앞뒤로 공백/구두점 찾기 (범위: ±20%)
    const searchRange = Math.floor(targetLength * 0.2);
    for (let offset = 0; offset <= searchRange && cut + offset < remaining.length; offset++) {
      // 먼저 목표 위치 뒤쪽 검색
      if (offset > 0 && cut + offset < remaining.length && /[ \-–—·,.:;!?]/.test(remaining[cut + offset])) {
        cut = cut + offset + 1;
        foundBreak = true;
        break;
      }
      // 목표 위치 앞쪽 검색
      if (offset > 0 && cut - offset > 0 && /[ \-–—·,.:;!?]/.test(remaining[cut - offset])) {
        cut = cut - offset + 1;
        foundBreak = true;
        break;
      }
    }

    // 공백을 못 찾았으면 목표 길이에서 강제 분할
    if (!foundBreak && cut < remaining.length) {
      cut = targetLength;
    }

    const line = remaining.slice(0, cut).trim();
    if (line) {
      lines.push(line);
    }
    remaining = remaining.slice(cut).trim();
  }

  return lines.filter(line => line); // 빈 줄 제거
}
