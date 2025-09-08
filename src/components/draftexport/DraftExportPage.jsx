import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Label, Select, Segmented, Toggle, RadioRow } from "./parts/Controls";
import ProgressDonut from "./parts/ProgressDonut";

/**
 * DraftPage (width unified & ratio/overflow fixed)
 * - AssembleEditor와 동일한 "고정 폭 카드" 패턴 적용:
 *   containerRef로 최초 실제 폭 측정 → width/min/max/flex 모두 같은 값으로 고정
 *   + scrollbarGutter: 'stable both-edges' 로 스크롤바 유무에 따른 흔들림 방지
 * - 썸네일/미리보기: aspect-video + absolute img(object-cover)로 찌그러짐 방지
 * - 하단 버튼: whitespace-nowrap + text-xs (md 이상 text-sm)로 글자 넘침 방지
 */

export default function DraftPage({ scenes: propScenes = [] }) {
  /* ---------- 고정 폭 카드 컨테이너 (AssembleEditor 패턴) ---------- */
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  const containerStyle = fixedWidthPx
    ? {
        width: `${fixedWidthPx}px`,
        minWidth: `${fixedWidthPx}px`,
        maxWidth: `${fixedWidthPx}px`,
        flex: `0 0 ${fixedWidthPx}px`,
        boxSizing: "border-box",
        scrollbarGutter: "stable both-edges",
      }
    : { scrollbarGutter: "stable both-edges" };

  /* ------------------------- 씬/상태 ------------------------- */
  const seedScenes = useMemo(
    () =>
      propScenes.length
        ? propScenes
        : Array.from({ length: 10 }).map((_, i) => ({
            id: `sc${String(i + 1).padStart(2, "0")}`,
            label: String(i + 1).padStart(2, "0"),
            start: i * 5,
            end: i * 5 + 5,
            duration: 5,
            thumb: "", // 실제 썸네일 경로로 교체 가능
          })),
    [propScenes]
  );

  const [preset, setPreset] = useState("720p"); // 540p / 720p / 1080p
  const [burnSub, setBurnSub] = useState(true);
  const [watermark, setWatermark] = useState(true);
  const [range, setRange] = useState("all"); // all | selected
  const [selectedScene, setSelectedScene] = useState(seedScenes[0]?.id || null);

  const totalDuration = useMemo(() => seedScenes.reduce((acc, s) => acc + (s?.duration || 0), 0), [seedScenes]);
  const estSizeMB = useMemo(() => {
    const bitrateByPreset = { "540p": 1.5, "720p": 2.5, "1080p": 4 };
    return Math.max(1, Math.round(((totalDuration * (bitrateByPreset[preset] || 2)) / 6) * 10) / 10);
  }, [preset, totalDuration]);

  /* --------------------- 진행 상태 (데모) --------------------- */
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState("00:00");
  const tickRef = useRef(null);

  useEffect(() => {
    if (!isRunning) return;
    const started = Date.now();
    const totalMs = 45_000; // 45초 데모
    tickRef.current = setInterval(() => {
      const elapsed = Date.now() - started;
      const p = Math.min(100, Math.round((elapsed / totalMs) * 100));
      setProgress(p);
      const remain = Math.max(0, totalMs - elapsed);
      const m = Math.floor(remain / 1000 / 60)
        .toString()
        .padStart(2, "0");
      const s = Math.floor((remain / 1000) % 60)
        .toString()
        .padStart(2, "0");
      setEta(`${m}:${s}`);
      if (p >= 100) {
        clearInterval(tickRef.current);
        tickRef.current = null;
        setIsRunning(false);
      }
    }, 200);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isRunning]);

  /* -------------------------- 액션 --------------------------- */
  const handleStart = async () => {
    setProgress(0);
    setIsRunning(true);
    if (window?.api?.invoke) {
      try {
        await window.api.invoke("draft:startRender", {
          preset,
          burnSub,
          watermark,
          range,
          selectedScene,
        });
      } catch (e) {
        console.warn("draft:startRender error", e);
      }
    }
  };

  const handleCancel = async () => {
    setIsRunning(false);
    setProgress(0);
    setEta("00:00");
    if (window?.api?.invoke) {
      try {
        await window.api.invoke("draft:cancelRender");
      } catch (e) {
        console.warn("draft:cancelRender error", e);
      }
    }
  };

  /* -------------------------- UI ---------------------------- */
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div ref={containerRef} className="bg-white rounded-2xl shadow-md border border-slate-200 p-6" style={containerStyle}>
        {/* 상단 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">Weaver Pro</h1>
          <div className="text-sm text-slate-500">초안 내보내기</div>
        </div>

        {/* 폭 안정화: 기본(360/1fr/260), 2xl(380/1fr/280) */}
        <div className="grid gap-6 grid-cols-[360px,1fr,260px] 2xl:grid-cols-[380px,1fr,280px]">
          {/* 좌측: 옵션 */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">초안 내보내기</h2>

            <div className="rounded-2xl border border-slate-200 shadow-sm p-5">
              <Label>해상도</Label>
              <Select
                value={preset}
                onChange={setPreset}
                options={[
                  { value: "540p", label: "960 x 540 (SD)" },
                  { value: "720p", label: "1280 x 720 (HD)" },
                  { value: "1080p", label: "1920 x 1080 (FHD)" },
                ]}
              />

              <div className="mt-4">
                <Label className="mb-2">품질 프리셋</Label>
                <Segmented
                  value={preset}
                  onChange={setPreset}
                  items={[
                    { value: "540p", label: "저용량" },
                    { value: "720p", label: "중간" },
                    { value: "1080p", label: "높음" },
                  ]}
                />
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="min-w-0">
                  <Label>자막 번인</Label>
                  <p className="text-xs text-slate-500 mt-1 truncate">
                    예상 길이 {secToTime(totalDuration)} · 예상 용량 {estSizeMB}
                    MB
                  </p>
                </div>
                <Toggle checked={burnSub} onChange={setBurnSub} />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="min-w-0">
                  <Label>워터마크 “DRAFT”</Label>
                  <p className="text-xs text-slate-500 mt-1">내보내기 테스트 용도</p>
                </div>
                <Toggle checked={watermark} onChange={setWatermark} />
              </div>

              <div className="mt-5 min-w-0">
                <Label className="mb-2">렌더 범위</Label>
                <RadioRow
                  name="range"
                  value={range}
                  onChange={setRange}
                  items={[
                    {
                      value: "all",
                      label: `전체 타임라인 (${secToTime(totalDuration)})`,
                    },
                    {
                      value: "selected",
                      label: `선택 씬만 (${selectedScene || "없음"})`,
                    },
                  ]}
                />
              </div>

              <button
                className="mt-6 w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm transition"
                onClick={handleStart}
                disabled={isRunning}
              >
                {isRunning ? "렌더링 진행 중" : "초안 렌더링 시작"}
              </button>

              <div className="mt-6">
                <Label className="mb-2">프리플라이트</Label>
                <div className="text-sm text-slate-600 bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-hidden">
                  씬 수: {seedScenes.length} · 총 길이: {secToTime(totalDuration)}
                  <br />
                  모든 씬에 소스가 있습니다.
                </div>
              </div>
            </div>

            {/* 하단 미니 진행 요약 */}
            <div className="rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-base font-semibold text-slate-800">초안 내보내기</h3>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <div>길이 {secToTime(totalDuration)}</div>
                <div>{estSizeMB} MB</div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3">
                <button className="px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50" onClick={handleCancel}>
                  취소
                </button>
              </div>
            </div>
          </section>

          {/* 중앙: 진행 + 미리보기 */}
          <section className="space-y-4 min-w-0">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">초안 내보내기</h2>

            <div className="rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-center">
                <ProgressDonut percent={progress} />
              </div>
              <div className="mt-4 text-center">
                <p className="text-lg font-semibold">남은 시간 {eta}</p>
                <p className="text-xs text-slate-500 mt-2">job ID 86c…47ef</p>
                <p className="text-xs text-slate-500">draft.mp4</p>
              </div>
              <div className="mt-5 flex justify-center">
                <button className="h-11 w-40 rounded-xl border border-slate-200 hover:bg-slate-50" onClick={handleCancel}>
                  취소
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 shadow-sm p-4">
              {/* 비율 고정 + 넘침 방지 */}
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-100">
                {/* 실제 영상 태그로 교체 가능 */}
                <div className="absolute inset-0 grid place-items-center">
                  <span className="text-slate-500 text-sm">미리보기 영역</span>
                </div>
              </div>

              <div className="mt-3">
                <input type="range" min={0} max={100} value={progress} className="w-full" readOnly />
                <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                  <span>길이 {secToTime(totalDuration)}</span>
                  <span>{estSizeMB} MB</span>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button className="flex-1 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 whitespace-nowrap text-xs md:text-sm">
                  흐름 되기
                </button>
                <button className="flex-1 h-10 rounded-lg border border-slate-200 hover:bg-slate-50 whitespace-nowrap text-xs md:text-sm">
                  다시 내보내기
                </button>
              </div>
            </div>
          </section>

          {/* 우측: 씬 썸네일 */}
          <section className="space-y-4 min-w-0 overflow-hidden">
            <h2 className="text-lg font-semibold text-slate-800 mb-1">씬 목록</h2>

            <div className="rounded-2xl border border-slate-200 shadow-sm p-3 h-[620px] overflow-y-auto pr-1">
              <ol className="space-y-2">
                {seedScenes.map((sc) => (
                  <li key={sc.id}>
                    <button
                      className={`w-full flex items-center gap-3 rounded-xl border p-2 transition ${
                        selectedScene === sc.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
                      }`}
                      onClick={() => setSelectedScene(sc.id)}
                    >
                      {/* 비율 고정 썸네일 (절대 배치 + object-cover) */}
                      <div className="relative w-24 aspect-video rounded-lg bg-slate-200 overflow-hidden flex-shrink-0">
                        {sc.thumb ? (
                          <img src={sc.thumb} alt={sc.label} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <div className="absolute inset-0 grid place-items-center">
                            <span className="text-[11px] text-slate-600">No Thumb</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 text-left min-w-0">
                        <div className="text-xs text-slate-500">{sc.label}</div>
                        <div className="text-sm text-slate-800">{secToTime(sc.duration)}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function secToTime(total) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
