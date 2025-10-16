import { useEffect, useMemo, useRef, useState } from "react";
// import "../../styles/cw.css";
import PreviewPlayer from "./parts/PreviewPlayer";
import SubtitleList from "./parts/SubtitleList";
import TimelineBar from "./parts/TimelineBar";
import TopToolbar from "./parts/TopToolbar";
import {
  calcCPS,
  calcCPL,
  splitBalancedLines,
  secToTime,
  timeToSec,
} from "./utils/metrics";

/**
 * RefineEditor (편집 및 다듬기)
 * - 파일 구조: src/components/refine/...
 * - 폭 통일: --cw-page-w 사용 (다른 탭과 동일)
 * - 외부로부터 scenes 전달 가능: {start,end,text,id}
 *   - 없으면 내부에서 데모 씬 생성
 */
export default function RefineEditor({
  scenes: propScenes = [],
  onChangeScenes, // 선택
}) {
  // ---------- 씬/자막 상태 ----------
  const [scenes, setScenes] = useState(() =>
    propScenes.length
      ? propScenes
      : Array.from({ length: 10 }).map((_, i) => ({
          id: `sc${String(i + 1).padStart(2, "0")}`,
          start: i * 5,
          end: i * 5 + 5,
          text:
            i === 0
              ? "안녕하세요, 편집 및 다듬기 탭입니다."
              : `샘플 대사 ${i + 1}`,
        }))
  );
  useEffect(() => {
    if (propScenes.length) setScenes(propScenes);
  }, [propScenes]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const duration = useMemo(
    () => (scenes.length ? scenes[scenes.length - 1].end - scenes[0].start : 0),
    [scenes]
  );

  // ---------- 스타일/프리뷰 상태 ----------
  const [style, setStyle] = useState({
    fontSize: 34,
    outline: true,
    align: "center", // left|center|right
    lineClamp: 2,
    maxLineChars: 16,
  });
  const [aspectRatio, setAspectRatio] = useState("16:9");

  // ---------- 내부 setScenes 헬퍼 (상위 콜백 연동) ----------
  const updateScenes = (next) => {
    setScenes(next);
    onChangeScenes?.(next);
  };

  // ---------- CRUD: 텍스트/타이밍 ----------
  const updateText = (idx, text) => {
    const next = scenes.map((s, i) => (i === idx ? { ...s, text } : s));
    updateScenes(next);
  };

  const updateTime = (idx, patch) => {
    const next = scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    // 겹침 자동 방지(간단 룰): 이전 end ≤ 현재 start, 현재 end ≤ 다음 start
    if (idx > 0 && next[idx - 1].end > next[idx].start)
      next[idx - 1].end = next[idx].start;
    if (idx < next.length - 1 && next[idx].end > next[idx + 1].start)
      next[idx].end = next[idx + 1].start;
    updateScenes(next);
  };

  const splitCue = (idx, atSec) => {
    const s = scenes[idx];
    if (!s) return;
    const cut = Math.min(
      Math.max(atSec ?? (s.start + s.end) / 2, s.start + 0.1),
      s.end - 0.1
    );
    const [l1, l2] = splitBalancedLines(s.text, style.maxLineChars);
    const a = { ...s, end: cut, text: l1 || s.text };
    const b = { id: `${s.id}-b`, start: cut, end: s.end, text: l2 || s.text };
    const next = [...scenes.slice(0, idx), a, b, ...scenes.slice(idx + 1)];
    updateScenes(next);
    setSelectedIdx(idx + 1);
  };

  const mergeWithNext = (idx) => {
    if (idx >= scenes.length - 1) return;
    const a = scenes[idx];
    const b = scenes[idx + 1];
    const next = [...scenes];
    next[idx] = { ...a, end: b.end, text: `${a.text} ${b.text}`.trim() };
    next.splice(idx + 1, 1);
    updateScenes(next);
  };

  // ---------- 파일 입/출력 ----------
  const exportSRT = async () => {
    const srt = scenes
      .map((s, i) => {
        const start = secToTime(s.start, true);
        const end = secToTime(s.end, true);
        const text = s.text?.replace(/\n+/g, "\n") || "";
        return `${i + 1}\n${start} --> ${end}\n${text}\n`;
      })
      .join("\n");

    // window.api 있으면 네이티브 저장
    if (window?.api?.saveText) {
      try {
        await window.api.saveText("subtitles.srt", srt);
        return;
      } catch (e) {
        console.warn("saveText failed, fallback to download", e);
      }
    }
    // 브라우저 다운로드
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importSRT = async () => {
    try {
      if (window?.api?.openText) {
        const raw = await window.api.openText({ filter: "srt" });
        if (raw) parseSrtAndSet(raw);
        return;
      }
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".srt";
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const raw = await file.text();
        parseSrtAndSet(raw);
      };
      input.click();
    } catch (e) {
      console.warn("importSRT failed", e);
    }
  };

  const parseSrtAndSet = (raw) => {
    const blocks = raw
      .split(/\r?\n\r?\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const parsed = [];
    for (const block of blocks) {
      const lines = block.split(/\r?\n/);
      const idxLine = /^\d+$/.test(lines[0]) ? 1 : 0;
      const m = lines[idxLine]?.match(
        /(\d{2}:\d{2}:\d{2},\d{3})\s-->\s(\d{2}:\d{2}:\d{2},\d{3})/
      );
      if (!m) continue;
      const textLines = lines.slice(idxLine + 1);
      parsed.push({
        id: `sc${String(parsed.length + 1).padStart(2, "0")}`,
        start: timeToSec(m[1]),
        end: timeToSec(m[2]),
        text: textLines.join("\n"),
      });
    }
    if (parsed.length) {
      updateScenes(parsed);
      setSelectedIdx(0);
      setCurrentTime(parsed[0].start);
    }
  };

  // ---------- 현재 선택 자막 메트릭 ----------
  const sel = scenes[selectedIdx];
  const cps = sel ? calcCPS(sel.text, sel.end - sel.start) : 0;
  const cpl = sel ? calcCPL(sel.text) : 0;

  // ---------- 렌더 ----------
  return (
    <div className="mx-auto px-6 md:px-8">
      <div className="mx-auto w-[var(--cw-page-w)] min-w-[var(--cw-page-w)] max-w-[var(--cw-page-w)] bg-white rounded-2xl shadow-md border border-slate-200 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">편집 및 다듬기</h1>
          <TopToolbar
            onImport={importSRT}
            onExport={exportSRT}
            onSplit={() => splitCue(selectedIdx)}
            onMerge={() => mergeWithNext(selectedIdx)}
            normalizeText={() =>
              sel && updateText(selectedIdx, normalizeKo(sel.text))
            }
            toggleOutline={() =>
              setStyle((s) => ({ ...s, outline: !s.outline }))
            }
          />
        </div>

        {/* 메트릭/상태바 */}
        <div className="mb-4 text-xs text-slate-600 flex items-center gap-4">
          <div>현재시간: {secToTime(currentTime, true)}</div>
          <div>
            선택:{" "}
            {sel
              ? `${secToTime(sel.start, true)} ~ ${secToTime(sel.end, true)}`
              : "-"}
          </div>
          <div className={`${cps > 17 ? "text-amber-600" : ""}`}>
            CPS: {cps.toFixed(1)}
          </div>
          <div
            className={`${cpl > style.maxLineChars ? "text-amber-600" : ""}`}
          >
            CPL: {cpl}
          </div>
        </div>

        {/* 그리드: 좌(자막리스트) / 중(프리뷰+타임라인) / 우(스타일/세부) */}
        <div className="grid grid-cols-[360px,1fr,300px] gap-6">
          {/* 왼쪽: 자막 리스트 */}
          <section className="rounded-2xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              자막 리스트
            </h2>
            <SubtitleList
              scenes={scenes}
              selectedIdx={selectedIdx}
              onSelect={setSelectedIdx}
              onChangeText={updateText}
              onSplit={splitCue}
              onMerge={mergeWithNext}
              onChangeTime={updateTime}
            />
          </section>

          {/* 중앙: 미리보기 + 타임라인 */}
          <section className="space-y-4 min-w-0">
            <div className="rounded-2xl border border-slate-200 shadow-sm p-4">
              <PreviewPlayer
                currentTime={currentTime}
                onSeek={setCurrentTime}
                scene={sel}
                styleOpt={style}
                aspectRatio={aspectRatio}
              />
              <div className="mt-4">
                <TimelineBar
                  duration={duration}
                  scenes={scenes}
                  currentTime={currentTime}
                  onSeek={setCurrentTime}
                  onNudge={(delta) =>
                    setCurrentTime((t) =>
                      Math.min(Math.max(0, t + delta), duration)
                    )
                  }
                />
              </div>
            </div>
          </section>

          {/* 오른쪽: 스타일/세부옵션 */}
          <aside className="rounded-2xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              스타일 & 규칙
            </h2>

            {/* 화면 비율 선택 */}
            <div className="mb-4">
              <label className="block text-xs text-slate-600 mb-2">
                화면 비율 (프리뷰)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {["16:9", "9:16", "1:1", "4:3"].map((ratio) => (
                  <button
                    key={ratio}
                    className={`px-2 py-2 rounded-lg border text-xs font-medium transition-all ${
                      aspectRatio === ratio
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-700 border-slate-300 hover:border-indigo-400"
                    }`}
                    onClick={() => setAspectRatio(ratio)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {aspectRatio === "16:9" ? "가로형 (유튜브)" :
                 aspectRatio === "9:16" ? "세로형 (쇼츠)" :
                 aspectRatio === "1:1" ? "정사각형 (인스타)" : "일반 (4:3)"}
              </div>
            </div>

            <label className="block text-xs text-slate-600 mb-1">
              폰트 크기
            </label>
            <input
              type="range"
              min={20}
              max={54}
              value={style.fontSize}
              onChange={(e) =>
                setStyle((s) => ({ ...s, fontSize: Number(e.target.value) }))
              }
              className="w-full"
            />
            <div className="text-sm text-slate-700 mb-3">
              {style.fontSize}px
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-600">외곽선/그림자</span>
              <button
                className={`h-8 px-3 rounded-lg border ${
                  style.outline
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
                onClick={() => setStyle((s) => ({ ...s, outline: !s.outline }))}
              >
                {style.outline ? "켜짐" : "꺼짐"}
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-600">정렬</span>
              <div className="inline-flex rounded-xl border border-slate-200 p-1 bg-slate-50">
                {["left", "center", "right"].map((v) => (
                  <button
                    key={v}
                    className={`px-3 h-9 rounded-lg text-sm ${
                      style.align === v ? "bg-white shadow-sm" : ""
                    }`}
                    onClick={() => setStyle((s) => ({ ...s, align: v }))}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs text-slate-600 mb-1">
              줄당 최대 글자
            </label>
            <input
              type="range"
              min={10}
              max={24}
              value={style.maxLineChars}
              onChange={(e) =>
                setStyle((s) => ({
                  ...s,
                  maxLineChars: Number(e.target.value),
                }))
              }
              className="w-full"
            />
            <div className="text-sm text-slate-700">{style.maxLineChars}자</div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* 간단 텍스트 정리기 (한국어용 기본 정돈) */
function normalizeKo(text = "") {
  return text
    .replace(/\.\.\.|···/g, "…")
    .replace(/ ?! ?/g, "! ")
    .replace(/ ?\? ?/g, "? ")
    .replace(/\s{2,}/g, " ")
    .replace(/“|”|\"/g, '"')
    .replace(/\'/g, "’")
    .trim();
}
