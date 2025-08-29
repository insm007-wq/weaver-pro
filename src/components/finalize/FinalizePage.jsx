import { useEffect, useMemo, useRef, useState } from "react";

import Deliverables from "./parts/Deliverables";
import PublishPanel from "./parts/PublishPanel";
import Checklist from "./parts/Checklist";
import RenderQueue from "./parts/RenderQueue";
import ProgressDonut from "./parts/ProgressDonut";

export default function FinalizePage({ scenes: propScenes = [] }) {
  // ----- 상태 -----
  const [deliverables, setDeliverables] = useState([
    {
      id: "landscape_1080p",
      name: "YouTube 1080p (16:9)",
      enabled: true,
      burnSubs: false,
      sidecar: "srt",
    },
    {
      id: "square_1080",
      name: "Feed 1080x1080 (1:1)",
      enabled: true,
      burnSubs: true,
      sidecar: null,
    },
    {
      id: "story_1080x1920",
      name: "Story 1080x1920 (9:16)",
      enabled: false,
      burnSubs: true,
      sidecar: null,
    },
    {
      id: "tiktok_1080x1920",
      name: "TikTok 1080x1920 (9:16)",
      enabled: false,
      burnSubs: true,
      sidecar: null,
    },
  ]);

  const [meta, setMeta] = useState({
    title: "프로젝트 타이틀",
    description: "",
    tags: "review, demo, cwpro",
    thumbs: [],
  });

  const [check, setCheck] = useState({
    loudness: true,
    safeMargin: true,
    spelling: true,
    brandWatermark: false, // 최종본은 기본 꺼짐
    colorSpace: "sRGB",
  });

  const [queue, setQueue] = useState([]); // {id,label,status,progress}
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [eta, setEta] = useState("00:00");
  const tickRef = useRef(null);

  const enabledJobs = useMemo(
    () => deliverables.filter((d) => d.enabled),
    [deliverables]
  );

  // ----- 데모 렌더 타이머 -----
  useEffect(() => {
    if (!isRendering) return;
    const totalMs = Math.max(20000, enabledJobs.length * 12000);
    const started = Date.now();
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
        setIsRendering(false);
        setQueue((q) =>
          q.map((item) =>
            item.status === "running"
              ? { ...item, status: "done", progress: 100 }
              : item
          )
        );
      }
    }, 200);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [isRendering, enabledJobs.length]);

  const startRender = async () => {
    if (!enabledJobs.length) return;
    setQueue((q) => [
      ...enabledJobs.map((d) => ({
        id: `${d.id}-${Date.now()}`,
        label: d.name,
        status: "running",
        progress: 0,
      })),
      ...q,
    ]);
    setProgress(0);
    setIsRendering(true);
    // 실제 구현 시: window.api.invoke("finalize:start", { deliverables, meta, check })
  };

  const cancelRender = async () => {
    setIsRendering(false);
    setProgress(0);
    setQueue((q) =>
      q.map((i) => (i.status === "running" ? { ...i, status: "canceled" } : i))
    );
    // 실제 구현 시: window.api.invoke("finalize:cancel")
  };

  const totalDuration = useMemo(() => {
    if (!propScenes?.length) return 0;
    return propScenes[propScenes.length - 1].end - propScenes[0].start;
  }, [propScenes]);

  return (
    <div className="mx-auto px-6 md:px-8">
      <div className="mx-auto w-[var(--cw-page-w)] min-w-[var(--cw-page-w)] max-w-[var(--cw-page-w)] bg-white rounded-2xl shadow-md border border-slate-200 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">최종 완성</h1>
          <div className="text-xs text-slate-600">
            {propScenes?.length
              ? `총 길이 ${secToTime(totalDuration)}`
              : "씬 정보 없음"}
          </div>
        </div>

        {/* 그리드: 좌(딜리버러블) / 중(프리뷰+진행) / 우(발행·체크리스트) */}
        <div className="grid grid-cols-[360px,1fr,320px] gap-6">
          {/* 좌: 납품물/포맷 */}
          <section className="rounded-2xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              납품물 설정
            </h2>
            <Deliverables value={deliverables} onChange={setDeliverables} />
          </section>

          {/* 중: 미리보기 + 진행 */}
          <section className="space-y-4 min-w-0">
            <div className="rounded-2xl border border-slate-200 shadow-sm p-4">
              {/* 미리보기 (샘플) */}
              <div className="relative w-full aspect-video rounded-xl bg-slate-100 overflow-hidden">
                <div className="absolute inset-0 grid place-items-center">
                  <span className="text-slate-500 text-sm">최종 미리보기</span>
                </div>
              </div>

              {/* 진행 상태 */}
              <div className="mt-6 flex items-center justify-center">
                <ProgressDonut percent={progress} />
              </div>
              <div className="mt-2 text-center text-sm text-slate-600">
                {isRendering ? <>남은 시간 {eta}</> : <>준비됨</>}
              </div>

              <div className="mt-4 flex gap-2 justify-center">
                <button
                  className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold whitespace-nowrap"
                  onClick={startRender}
                  disabled={isRendering || !enabledJobs.length}
                >
                  최종 렌더 시작
                </button>
                <button
                  className="h-11 px-5 rounded-xl border border-slate-300 hover:bg-slate-50 whitespace-nowrap"
                  onClick={cancelRender}
                  disabled={!isRendering}
                >
                  취소
                </button>
              </div>
            </div>

            {/* 렌더 큐 */}
            <RenderQueue items={queue} />
          </section>

          {/* 우: 발행/체크리스트 */}
          <aside className="space-y-4">
            <PublishPanel meta={meta} onChange={setMeta} />
            <Checklist value={check} onChange={setCheck} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function secToTime(total = 0) {
  const h = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}
