import { useEffect, useMemo, useState } from "react";
import SectionCard from "../parts/SectionCard";
import AssetLibrary from "../parts/AssetLibrary";
import { extractKeywords } from "../../../utils/extractKeywords";

/** 현재 실행 환경 모드 감지 */
function detectMode() {
  if (window?.api?.canva?.scanAndDownload) return "auto";
  if (window?.api?.canva?.openBrowser || window?.api?.canvaOpenBrowser) return "manual";
  return "none";
}

/** 실행 라우팅: 자동/수동 모두 지원 */
async function runCanvaAction({ keywords, onlyVideo, perKeyword, concurrency, minBytes, maxBytes }) {
  const mode = detectMode();
  if (mode === "auto") {
    return window.api.canva.scanAndDownload({ keywords, perKeyword, concurrency, minBytes, maxBytes, onlyVideo });
  }
  if (mode === "manual") {
    const open = window.api?.canva?.openBrowser || window?.api?.canvaOpenBrowser;
    const q = keywords?.[0] || "";
    return open({ query: q, media: onlyVideo ? "videos" : "images" });
  }
  throw new Error("Canva IPC 연결이 없습니다.");
}

export default function KeywordsTab({ assets, addAssets }) {
  const [mode, setMode] = useState("none");
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState("");
  const [srtFileName, setSrtFileName] = useState(null);

  const [onlyVideo, setOnlyVideo] = useState(true);
  const [perKeyword, setPerKeyword] = useState(1);
  const [concurrency, setConcurrency] = useState(2);
  const [minMB, setMinMB] = useState(1);
  const [maxMB, setMaxMB] = useState(10);

  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [target, setTarget] = useState(0);
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState({
    stage: "idle",
    keyword: null,
    kIndex: 0,
    totalKeywords: 0,
    found: 0,
    totalDownloaded: 0,
    totalPlanned: 0,
    message: "",
  });

  useEffect(() => {
    setMode(detectMode());
  }, []);

  useEffect(() => {
    const offDownloaded = window.api?.onCanvaDownloaded?.((d) => {
      if (!d?.ok) return;
      const filePath = d.path;
      const type = d.type || (/video/i.test(d.mime) ? "video" : "image");
      const fileUrl = process.platform === "win32" ? "file:///" + filePath.replace(/\\/g, "/") : "file://" + filePath;
      addAssets([
        {
          id: "dl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
          type,
          thumbUrl: fileUrl,
          filePath,
        },
      ]);
      setCompleted((n) => n + 1);
    });

    const attach = window.api?.onCanvaProgress || window.api?.canva?.onProgress;
    const offProgress =
      attach?.((p) => {
        if (p?.bytes) setProgress({ received: p.bytes.received ?? 0, total: p.bytes.total ?? 0 });
        if (p?.stage) {
          setStatus((s) => ({ ...s, ...p }));
          if (typeof p.totalDownloaded === "number") setCompleted(p.totalDownloaded);
          if (typeof p.totalPlanned === "number") setTarget(p.totalPlanned);
        }
        if (p?.stage === "done") setBusy(false);
      }) || null;

    return () => {
      offDownloaded && offDownloaded();
      offProgress && offProgress();
    };
  }, [addAssets]);

  useEffect(() => {
    (async () => {
      try {
        const srtPath = await window.api.getSetting?.("paths.srt");
        if (srtPath) setSrtFileName(srtPath.split(/[/\\]/).pop());
      } catch {}
    })();
  }, []);

  const addKeyword = (k) => {
    const trimmed = (k || "").trim();
    if (!trimmed) return;
    setKeywords((old) => (old.includes(trimmed) ? old : [...old, trimmed]).slice(0, 100));
  };
  const removeKeyword = (k) => setKeywords((old) => old.filter((x) => x !== k));
  const clearKeywords = () => setKeywords([]);

  const addFromInput = () => {
    const items = input
      .split(/[,/\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    items.forEach(addKeyword);
    setInput("");
  };

  const extractFromSrt = async () => {
    try {
      const srtPath = await window.api.getSetting?.("paths.srt");
      if (!srtPath) return alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
      const raw = await window.api.readTextFile?.(srtPath);
      const cleaned = raw
        .replace(/\r/g, "\n")
        .replace(/\d+\s*\n(?=\d{2}:\d{2}:\d{2},\d{3})/g, "")
        .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}.*\n/g, "");
      const kws = extractKeywords(cleaned, { topK: 20, minLen: 2 });
      if (!kws.length) return alert("추출된 키워드가 없습니다. 직접 추가해 주세요.");
      setKeywords(kws);
      setSrtFileName(srtPath.split(/[/\\]/).pop());
    } catch (e) {
      console.error(e);
      alert("키워드 추출 중 오류가 발생했습니다.");
    }
  };

  const canStart = useMemo(() => keywords.length > 0 && !busy && (mode === "auto" || (mode === "manual" && keywords[0])), [keywords, busy, mode]);

  const startAction = async () => {
    try {
      if (!keywords.length) return;
      setBusy(true);
      setCompleted(0);
      setProgress(null);

      if (mode === "auto") {
        const planned = perKeyword * keywords.length;
        setTarget(planned);
        setStatus((s) => ({
          ...s,
          stage: "start",
          keyword: null,
          kIndex: 0,
          totalKeywords: keywords.length,
          totalPlanned: planned,
          totalDownloaded: 0,
          found: 0,
        }));
      } else {
        setTarget(0);
        setStatus((s) => ({ ...s, stage: "search", keyword: keywords[0], kIndex: 0, totalKeywords: 1, totalPlanned: 0, totalDownloaded: 0 }));
      }

      await runCanvaAction({
        keywords,
        onlyVideo,
        perKeyword,
        concurrency,
        minBytes: Math.max(0, Math.floor(minMB * 1024 * 1024)),
        maxBytes: Math.max(0, Math.floor(maxMB * 1024 * 1024)),
      });
    } catch (e) {
      console.error(e);
      alert("실행 중 오류: " + (e?.message || e));
      setBusy(false);
    }
  };

  const openForKeyword = async (k) => {
    if (mode !== "manual") return;
    const open = window.api?.canva?.openBrowser || window.api?.canvaOpenBrowser;
    if (!open) return alert("수동 검색 IPC가 없습니다.");
    try {
      setBusy(true);
      setProgress(null);
      setStatus((s) => ({ ...s, stage: "search", keyword: k, kIndex: 0, totalKeywords: 1, totalPlanned: 0, totalDownloaded: 0 }));
      await open({ query: k, media: onlyVideo ? "videos" : "images" });
    } catch (e) {
      console.error(e);
      alert("검색창 열기 실패: " + (e?.message || e));
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <SectionCard
        title="키워드 구성"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={extractFromSrt}
              className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-60"
              disabled={busy}
              title="SRT에서 자동 추출"
            >
              {busy ? "작업 중…" : "SRT에서 추출"}
            </button>
            <button
              onClick={clearKeywords}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              disabled={busy || keywords.length === 0}
              title="현재 키워드 전부 지우기"
            >
              비우기
            </button>
          </div>
        }
      >
        <div className="text-xs text-slate-600 mb-2">
          {srtFileName ? (
            <>
              현재 SRT: <span className="font-medium">{srtFileName}</span>
            </>
          ) : (
            <>SRT 미연결 (셋업에서 선택)</>
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFromInput()}
            placeholder="키워드 입력 후 Enter (쉼표/줄바꿈으로 여러 개)"
            className="flex-1 h-9 px-3 text-sm rounded-lg border border-slate-200 outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button onClick={addFromInput} className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50" disabled={!input.trim() || busy}>
            추가
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {keywords.length === 0 ? (
            <div className="text-[12px] text-slate-500">키워드를 추가하거나 SRT에서 추출해 주세요.</div>
          ) : (
            keywords.map((k) => (
              <span key={k} className="px-2 py-1.5 h-8 rounded-full border border-slate-200 bg-white text-sm inline-flex items-center gap-2">
                <span className="px-1">#{k}</span>
                {mode === "manual" && (
                  <button
                    onClick={() => openForKeyword(k)}
                    className="text-slate-500 hover:text-blue-600 text-xs px-2 py-0.5 rounded-md border border-slate-200 hover:bg-slate-50"
                    title="이 키워드로 검색창 열기"
                    disabled={busy}
                  >
                    검색
                  </button>
                )}
                <button onClick={() => removeKeyword(k)} className="text-slate-400 hover:text-slate-600" title="제거">
                  ✕
                </button>
              </span>
            ))
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-700 flex flex-col gap-1">
            {mode === "auto" ? "키워드당 개수" : "키워드당 개수 (자동 전용)"}
            <input
              type="number"
              min={1}
              max={10}
              value={perKeyword}
              onChange={(e) => setPerKeyword(Math.max(1, +e.target.value || 1))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              disabled={mode !== "auto"}
            />
          </label>
          <label className="text-xs text-slate-700 flex flex-col gap-1">
            {mode === "auto" ? "동시 작업" : "동시 작업 (자동 전용)"}
            <input
              type="number"
              min={1}
              max={6}
              value={concurrency}
              onChange={(e) => setConcurrency(Math.max(1, +e.target.value || 1))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              disabled={mode !== "auto"}
            />
          </label>
          <label className="text-xs text-slate-700 flex flex-col gap-1">
            최소 용량(MB)
            <input
              type="number"
              min={0}
              max={100}
              value={minMB}
              onChange={(e) => setMinMB(Math.max(0, +e.target.value || 0))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              disabled={mode !== "auto"}
            />
          </label>
          <label className="text-xs text-slate-700 flex flex-col gap-1">
            최대 용량(MB)
            <input
              type="number"
              min={0}
              max={500}
              value={maxMB}
              onChange={(e) => setMaxMB(Math.max(0, +e.target.value || 0))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              disabled={mode !== "auto"}
            />
          </label>

          <label className="text-xs text-slate-700 flex items-center gap-2 col-span-2">
            <input type="checkbox" className="h-4 w-4" checked={onlyVideo} onChange={(e) => setOnlyVideo(!!e.target.checked)} />
            <span>{mode === "auto" ? "비디오만 다운로드" : "비디오만 보기/다운로드"}</span>
          </label>

          <div className="text-xs text-slate-500 col-span-2">
            {mode === "auto" ? (
              <>
                Canva 유료 계정 로그인 후 선택한 키워드로 자동 검색하여 <b>비디오</b>를 다운로드합니다.
              </>
            ) : mode === "manual" ? (
              <>
                각 키워드로 <b>검색창을 열어 수동으로 다운로드</b>합니다. 저장이 완료되면 에셋 라이브러리에 자동 추가됩니다.
              </>
            ) : (
              <>Canva IPC 연결을 먼저 완료해 주세요.</>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={startAction}
            disabled={!canStart}
            className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {mode === "auto"
              ? busy
                ? "시작 중…"
                : "검색 & 다운로드 시작"
              : busy
              ? "검색창 여는 중…"
              : `검색창 열기${keywords[0] ? ` (“${keywords[0]}”)` : ""}`}
          </button>
          <span className="text-xs text-slate-500">
            선택 키워드: <b>{keywords.length}</b>개
          </span>
          {mode === "manual" && keywords.length > 1 && (
            <span className="text-[11px] text-slate-400">
              추가 키워드는 태그의 <b>검색</b> 버튼으로 열 수 있어요.
            </span>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-700 space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status.stage === "search"
                    ? "bg-amber-500"
                    : status.stage === "download"
                    ? "bg-blue-500"
                    : status.stage === "done"
                    ? "bg-emerald-500"
                    : status.stage === "error"
                    ? "bg-rose-500"
                    : "bg-slate-300"
                }`}
              />
              <b>
                {status.stage === "search" && "캔바에서 검색 중…"}
                {status.stage === "enqueue" && "결과 정리 중…"}
                {status.stage === "download" && "다운로드 중…"}
                {status.stage === "saved" && "저장 완료"}
                {status.stage === "done" && "완료"}
                {status.stage === "error" && (status.message || "오류")}
                {["idle", "start"].includes(status.stage) && "대기"}
              </b>
            </span>
            {status.keyword ? (
              <span>
                (<b>{status.kIndex + 1}</b>
                {status.totalKeywords ? ` / ${status.totalKeywords}` : ""}) "{status.keyword}"
              </span>
            ) : null}
          </div>
          <div className="text-slate-600">
            다운로드: <b>{completed}</b>
            {target ? (
              <>
                {" "}
                / <b>{target}</b> (키워드당 {perKeyword}개)
              </>
            ) : null}
          </div>
          {progress?.total ? (
            <div className="h-2 bg-slate-200 rounded">
              <div className="h-2 bg-blue-500 rounded" style={{ width: `${Math.min(100, (progress.received / progress.total) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      </SectionCard>

      <div className="xl:col-span-1">
        <SectionCard title="에셋 라이브러리">
          <AssetLibrary assets={assets} onPick={() => alert("해당 씬에 배치")} />
        </SectionCard>
      </div>

      <div className="xl:col-span-1">
        <SectionCard title="다운로드 안내">
          <div className="text-sm text-slate-700 space-y-2">
            <p>
              1) 키워드를 추가하거나 <b>SRT에서 추출</b>하세요.
            </p>
            {mode === "auto" ? (
              <p>
                2) <b>검색 & 다운로드 시작</b>을 누르면 키워드별로 자동 저장됩니다.
              </p>
            ) : mode === "manual" ? (
              <p>
                2) <b>검색창 열기</b>로 Canva 창이 열립니다. 원하는 항목을 <b>Download</b>하면 자동 저장됩니다.
              </p>
            ) : (
              <p>Canva 연결을 먼저 완료해 주세요.</p>
            )}
            <p className="text-[12px] text-slate-500">저장이 완료되면 에셋 라이브러리에 자동 추가됩니다. 진행률과 상태는 아래에 표시됩니다.</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
