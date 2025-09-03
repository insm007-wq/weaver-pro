// src/components/assemble/tabs/KeywordsTab.jsx
// ----------------------------------------------------------------------------
// 키워드 추출 + 스톡 영상 다운로드 (키워드 칩 + 다운로드/패스 요약)
// - 기능 동일(엄격검색→완화 1회, 파일명 규칙 동일)
// - 새 유틸 사용: ipcSafe, pLimit, naming, extractKeywords
// - UX 향상: 추출 시간 표시, 완료 배지/하이라이트, 진행바 강화
// - 🔧 변경점: 다운로드 완료한 에셋을 addAssets로 상위에 올려 자동배치가 돌도록 함
// ----------------------------------------------------------------------------
import { useEffect, useMemo, useReducer, useRef, useState, useCallback } from "react";
import SectionCard from "../parts/SectionCard";

// 유틸들
import { extractKeywords as fallbackExtract } from "../../../utils/extractKeywords";
import { getSetting, getSecret, readTextAny, stockSearch, saveUrlToProject, aiExtractKeywords } from "../../../utils/ipcSafe";
import pLimit from "../../../utils/pLimit";
import { buildNiceName, guessProvider, guessId } from "../../../utils/naming";

const MB = 1024 * 1024;

const RES_PRESETS = [
  { id: "hd", label: "HD (1280×720)", w: 1280, h: 720 },
  { id: "fhd", label: "FHD (1920×1080)", w: 1920, h: 1080 },
  { id: "qhd", label: "QHD (2560×1440)", w: 2560, h: 1440 },
  { id: "uhd", label: "4K (3840×2160)", w: 3840, h: 2160 },
];

/* ---------------------- 진행상황 reducer ---------------------- */
const progInit = {
  total: 0,
  saved: 0,
  skipped: 0,
  rows: {}, // { [k]: { picked, saved, status } }
  skipsBy: { noResult: 0, searchError: 0, saveError: 0, other: 0 },
};
function progReducer(state, action) {
  switch (action.type) {
    case "init": {
      const rows = {};
      for (const k of action.keywords) rows[k] = { picked: 0, saved: 0, status: "대기" };
      return {
        total: action.keywords.length * action.perKeyword,
        saved: 0,
        skipped: 0,
        rows,
        skipsBy: { noResult: 0, searchError: 0, saveError: 0, other: 0 },
      };
    }
    case "status": {
      const { k, status } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      return { ...state, rows: { ...state.rows, [k]: { ...row, status } } };
    }
    case "picked": {
      const { k, n = 1 } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      const nextPicked = (row.picked || 0) + n;
      return { ...state, rows: { ...state.rows, [k]: { ...row, picked: nextPicked } } };
    }
    case "saved": {
      const { k, n = 1 } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      const nextSaved = (row.saved || 0) + n;
      return {
        ...state,
        saved: state.saved + n,
        rows: { ...state.rows, [k]: { ...row, saved: nextSaved, status: "저장" } },
      };
    }
    case "skip": {
      const { k, n = 1, reason = "other" } = action;
      const by = { ...state.skipsBy };
      by[reason] = (by[reason] || 0) + n;
      return { ...state, skipped: state.skipped + n, skipsBy: by };
    }
    case "done": {
      const { k } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      return { ...state, rows: { ...state.rows, [k]: { ...row, status: "완료" } } };
    }
    default:
      return state;
  }
}

/* ---------------------- 작은 헬퍼들 ---------------------- */
function formatMs(ms) {
  if (!ms || ms < 0) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const ss = Math.round(s % 60);
  return `${m}m ${ss}s`;
}

/* =============================== 컴포넌트 =============================== */
export default function KeywordsTab({ addAssets }) {
  // 🔸 addAssets를 상위에서 받음
  // 상태
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [keywords, setKeywords] = useState([]);

  // 옵션
  const [minMB, setMinMB] = useState(1);
  const [maxMB, setMaxMB] = useState(14);
  const [resPreset, setResPreset] = useState("fhd");
  const [perKeyword, setPerKeyword] = useState(1);
  const [concurrency, setConcurrency] = useState(3);
  const [usePexels, setUsePexels] = useState(true);
  const [usePixabay, setUsePixabay] = useState(true);
  const [maxKeywordsToUse, setMaxKeywordsToUse] = useState(30);

  const [hasPexelsKey, setHasPexelsKey] = useState(false);
  const [hasPixabayKey, setHasPixabayKey] = useState(false);

  // 진행/시간
  const [progress, dispatchProg] = useReducer(progReducer, progInit);
  const savedRef = useRef(0);
  useEffect(() => {
    savedRef.current = progress.saved;
  }, [progress.saved]);

  const [extractMs, setExtractMs] = useState(0); // ⏱️ 키워드 추출 소요
  const runStartRef = useRef(0);
  const [runMs, setRunMs] = useState(0); // ⏱️ 전체 실행 소요
  const [doneFlash, setDoneFlash] = useState(false); // ✅ 완료 배지 하이라이트

  const chosenRes = useMemo(() => RES_PRESETS.find((r) => r.id === resPreset) || RES_PRESETS[2], [resPreset]);
  const seqRef = useRef({}); // 키워드별 파일명 시퀀스

  // 키 소유 확인
  useEffect(() => {
    (async () => {
      try {
        const [px, pb] = await Promise.all([getSecret("pexelsApiKey"), getSecret("pixabayApiKey")]);
        setHasPexelsKey(!!px);
        setHasPixabayKey(!!pb);
        if (!px) setUsePexels(false);
        if (!pb) setUsePixabay(false);
      } catch {}
    })();
  }, []);

  /* ---------------------- helpers ---------------------- */
  const readCleanSrt = useCallback(async () => {
    const srtPath = await getSetting("paths.srt");
    if (!srtPath) {
      alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
      return null;
    }
    const raw = await readTextAny(srtPath);
    return String(raw || "")
      .replace(/\r/g, "\n")
      .replace(/\d+\s*\n(?=\d{2}:\d{2}:\d{2},\d{3})/g, "")
      .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}.*\n/g, "");
  }, []);

  const extractKeywordsAuto = useCallback(
    async (topK = 60) => {
      const text = await readCleanSrt();
      if (!text) return [];
      const t0 = performance.now();
      try {
        const apiKey = await getSecret("openaiKey");
        if (apiKey) {
          setMsg("AI가 키워드를 추출 중…");
          const r = await aiExtractKeywords({ apiKey, text, topK, language: "ko" });
          const t1 = performance.now();
          setExtractMs(t1 - t0);
          if (r?.ok && Array.isArray(r.keywords) && r.keywords.length) return r.keywords;
        }
      } catch {}
      const local = fallbackExtract(text, { topK, minLen: 2 });
      const t1 = performance.now();
      setExtractMs(t1 - t0);
      return Array.isArray(local) ? local : [];
    },
    [readCleanSrt]
  );

  /* ---------------------- 실행(추출→다운로드) ---------------------- */
  const downloadFromKeywords = useCallback(async () => {
    let baseKeywords = keywords;

    try {
      setBusy(true);
      runStartRef.current = performance.now();

      // 1) 키워드 없으면 자동 추출
      if (!Array.isArray(baseKeywords) || baseKeywords.length === 0) {
        setMsg("SRT에서 키워드 추출 중…");
        const extracted = await extractKeywordsAuto(Math.max(60, maxKeywordsToUse));
        if (!extracted.length) {
          setMsg("키워드 추출 실패");
          alert("키워드를 추출하지 못했습니다.");
          return;
        }
        baseKeywords = extracted;
        setKeywords(extracted); // 화면에 노출
        setMsg(`키워드 ${extracted.length}개 추출됨 · 다운로드 시작`);
      }

      // 2) 제공사 키 확인
      const [pexelsKey, pixabayKey] = await Promise.all([getSecret("pexelsApiKey"), getSecret("pixabayApiKey")]);
      const providers = [...(usePexels && pexelsKey ? ["pexels"] : []), ...(usePixabay && pixabayKey ? ["pixabay"] : [])];
      if (!providers.length) {
        alert("사용할 수 있는 제공사가 없습니다. (Pexels/Pixabay 키 확인)");
        return;
      }

      // 3) 실행 키워드 집합/진행 초기화
      const runKeywords = baseKeywords.slice(0, Math.max(1, Math.min(maxKeywordsToUse, baseKeywords.length)));
      dispatchProg({ type: "init", keywords: runKeywords, perKeyword });
      seqRef.current = {};

      // 4) 검색 옵션
      const SEARCH_OPTS_BASE = {
        perPage: Math.min(10, perKeyword * 3),
        minBytes: Math.max(0, Math.floor(minMB * MB)),
        maxBytes: Math.max(0, Math.floor(maxMB * MB)),
        targetRes: { w: chosenRes.w, h: chosenRes.h },
        providers,
        pexelsKey,
        pixabayKey,
        type: "videos",
      };

      const limit = pLimit(Math.max(1, Math.min(6, concurrency)));
      const newlySaved = [];

      // 5) 병렬 실행
      const tasks = runKeywords.map((k) =>
        limit(async () => {
          dispatchProg({ type: "status", k, status: "검색 중" });

          // 단일 호출(완화 검색 1회만)
          const r = await stockSearch({
            queries: [k],
            ...SEARCH_OPTS_BASE,
            strictKeyword: false,
          });
          if (!r?.ok) {
            dispatchProg({ type: "status", k, status: "검색 오류" });
            dispatchProg({ type: "skip", k, n: perKeyword, reason: "searchError" });
            return;
          }
          if (!Array.isArray(r.items) || r.items.length === 0) {
            dispatchProg({ type: "status", k, status: "결과 없음" });
            dispatchProg({ type: "skip", k, n: perKeyword, reason: "noResult" });
            return;
          }

          if (!Array.isArray(r.items) || r.items.length === 0) {
            dispatchProg({ type: "status", k, status: "결과 없음" });
            dispatchProg({ type: "skip", k, n: perKeyword, reason: "noResult" });
            return;
          }

          const picked = r.items.slice(0, Math.max(1, perKeyword));
          dispatchProg({ type: "picked", k, n: picked.length });

          for (const item of picked) {
            if (!item?.url) {
              dispatchProg({ type: "skip", k, n: 1, reason: "other" });
              continue;
            }
            const seq = (seqRef.current[k] = (seqRef.current[k] || 0) + 1);
            const niceName = buildNiceName(k, seq, item, chosenRes);

            try {
              const save = await saveUrlToProject({ url: item.url, category: "videos", fileName: niceName });
              if (save?.ok) {
                dispatchProg({ type: "saved", k, n: 1 });
                newlySaved.push({
                  path: save.path,
                  keyword: k,
                  width: chosenRes.w,
                  height: chosenRes.h,
                  provider: item.provider || guessProvider(item.url || ""),
                  assetId: item.assetId || guessId(item.url || "") || undefined,
                  savedAt: Date.now(),
                });
              } else {
                dispatchProg({ type: "skip", k, n: 1, reason: "saveError" });
              }
            } catch {
              dispatchProg({ type: "skip", k, n: 1, reason: "saveError" });
            }
          }

          const deficit = Math.max(0, perKeyword - picked.length);
          if (deficit) dispatchProg({ type: "skip", k, n: deficit, reason: "noResult" });

          dispatchProg({ type: "done", k });
        })
      );

      await Promise.allSettled(tasks);

      // 🔸 프론트 자동배치용: newlySaved → 에셋 모델로 변환 후 상위로 전달
      const toAsset = (x, idx) => ({
        id: x.assetId || x.path || `dl_${Date.now()}_${idx}`, // 반드시 id 보장
        type: "video",
        path: x.path,
        thumbUrl: x.thumbUrl || "", // 있으면 채우고, 없으면 빈 값
        durationSec: x.durationSec ?? 0, // 알 수 없으면 0
        tags: [x.keyword].filter(Boolean), // 키워드 1개라도 반드시 태그로
      });
      if (Array.isArray(newlySaved) && newlySaved.length && typeof addAssets === "function") {
        try {
          addAssets(newlySaved.map(toAsset));
        } catch {}
      }

      // (옵션) 백엔드 자동 배치 훅
      if (typeof window.api?.autoPlace === "function") {
        try {
          await window.api.autoPlace(newlySaved);
        } catch {}
      }

      setMsg("");
    } catch (e) {
      console.error(e);
      setMsg("오류: " + (e?.message || e));
      alert("다운로드 중 오류: " + (e?.message || e));
    } finally {
      setRunMs(performance.now() - runStartRef.current);
      setBusy(false);
      // 완료 배지 하이라이트
      setDoneFlash(true);
      setTimeout(() => setDoneFlash(false), 2200);
    }
  }, [
    keywords,
    extractKeywordsAuto,
    maxKeywordsToUse,
    perKeyword,
    minMB,
    maxMB,
    chosenRes.w,
    chosenRes.h,
    usePexels,
    usePixabay,
    concurrency,
    addAssets, // 🔸 의존성 추가
  ]);

  /* ---------------------- 요약/표시 데이터 ---------------------- */
  const pct = useMemo(() => {
    if (!progress.total) return 0;
    const done = Math.min(progress.saved + progress.skipped, progress.total);
    return Math.round((done / progress.total) * 100);
  }, [progress.saved, progress.skipped, progress.total]);

  const keywordDisplay = useMemo(() => {
    const fromProgress = Object.keys(progress.rows || {});
    if (fromProgress.length) return fromProgress;
    return keywords.slice(0, maxKeywordsToUse);
  }, [progress.rows, keywords, maxKeywordsToUse]);

  const isDone = progress.total > 0 && progress.saved + progress.skipped >= progress.total;

  const estimatedDownloads = Math.min(keywords.length, maxKeywordsToUse) * perKeyword;

  /* ---------------------------- UI ---------------------------- */
  return (
    <div className="w-full max-w-screen-xl mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch [&>*]:min-w-0">
        {/* 옵션 */}
        <SectionCard
          className="h-full"
          title="다운로드 옵션"
          right={
            <span className="text-xs text-slate-500">
              필터 & 제공사 · <span className="text-slate-400">추출 {formatMs(extractMs)}</span>
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-slate-700 flex flex-col gap-1 min-w-0">
              해상도
              <select
                value={resPreset}
                onChange={(e) => setResPreset(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white w-full"
                disabled={busy}
              >
                {RES_PRESETS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-slate-700 flex flex-col gap-1 min-w-0">
              키워드당 개수
              <input
                type="number"
                min={1}
                max={6}
                value={perKeyword}
                onChange={(e) => setPerKeyword(Math.max(1, Math.min(6, +e.target.value || 1)))}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-slate-700 flex flex-col gap-1 min-w-0">
              최소 용량 (MB)
              <input
                type="number"
                min={0}
                max={500}
                value={minMB}
                onChange={(e) => setMinMB(Math.max(0, +e.target.value || 0))}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-slate-700 flex flex-col gap-1 min-w-0">
              최대 용량 (MB)
              <input
                type="number"
                min={0}
                max={2000}
                value={maxMB}
                onChange={(e) => setMaxMB(Math.max(0, +e.target.value || 0))}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-slate-700 flex flex-col gap-1 min-w-0">
              동시 다운로드
              <input
                type="number"
                min={1}
                max={6}
                value={concurrency}
                onChange={(e) => setConcurrency(Math.max(1, Math.min(6, +e.target.value || 1)))}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-slate-700 flex flex-col gap-1 min-w-0">
              상위 키워드만 사용
              <input
                type="number"
                min={1}
                max={300}
                value={maxKeywordsToUse}
                onChange={(e) => setMaxKeywordsToUse(Math.max(1, Math.min(300, +e.target.value || 30)))}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm w-full"
                disabled={busy}
              />
              <span className="text-[11px] text-slate-400 break-words">긴 대본일 때 과도한 호출을 방지합니다.</span>
            </label>
          </div>

          {/* 제공사 */}
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-700 mb-2">제공사</div>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className={`inline-flex items-center gap-2 ${!hasPexelsKey ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={usePexels && hasPexelsKey}
                  onChange={(e) => setUsePexels(!!e.target.checked)}
                  disabled={!hasPexelsKey || busy}
                />
                Pexels {hasPexelsKey ? "" : "(키 없음)"}
              </label>
              <label className={`inline-flex items-center gap-2 ${!hasPixabayKey ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={usePixabay && hasPixabayKey}
                  onChange={(e) => setUsePixabay(!!e.target.checked)}
                  disabled={!hasPixabayKey || busy}
                />
                Pixabay {hasPixabayKey ? "" : "(키 없음)"}
              </label>
            </div>

            <div className="mt-2 text-[12px] text-slate-500">
              현재 해상도: <b>{chosenRes.label}</b> · 용량:{" "}
              <b>
                {minMB}–{maxMB}MB
              </b>{" "}
              · 동시성: <b>{concurrency}</b>
            </div>
            <div className="mt-2 text-[12px] text-slate-500">
              예상 다운로드: <b>{estimatedDownloads}</b>개
            </div>

            <div className="mt-3">
              <button
                onClick={downloadFromKeywords}
                className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60"
                disabled={busy}
              >
                {busy ? "추출+다운로드 중…" : "키워드로 영상 받기"}
              </button>
              {msg && <div className="mt-2 text-[12px] text-slate-600">{msg}</div>}
            </div>
          </div>
        </SectionCard>

        {/* 진행/키워드 표시 */}
        <SectionCard
          className="h-full"
          title="진행 상황"
          right={
            <span className="text-xs text-slate-400">
              {isDone ? (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 ${
                    doneFlash ? "animate-pulse" : ""
                  }`}
                >
                  ✅ 완료 100% · 총 {formatMs(runMs)}
                </span>
              ) : (
                "실시간"
              )}
            </span>
          }
        >
          <div className="h-full flex flex-col">
            {/* 요약 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-slate-700 mb-2 shrink-0">
              <span>
                다운로드 <b>{progress.saved}</b>개
              </span>
              <span>
                패스 <b>{progress.skipped}</b>개
                {Object.values(progress.skipsBy || {}).some(Boolean) ? (
                  <span className="text-slate-500">
                    {" "}
                    (
                    {Object.entries(progress.skipsBy)
                      .filter(([_, v]) => v)
                      .map(([k, v]) => {
                        const m = { noResult: "결과없음", searchError: "검색오류", saveError: "저장오류", other: "기타" };
                        return `${m[k]} ${v}`;
                      })
                      .join(", ")}
                    )
                  </span>
                ) : null}
              </span>
              <span className="text-slate-500">
                총 {progress.total || 0} · {pct}%
              </span>
              {/* ⏱️ 추출 시간/전체 시간 */}
              {extractMs > 0 && <span className="text-slate-400">추출 {formatMs(extractMs)}</span>}
              {runMs > 0 && <span className="text-slate-400">전체 {formatMs(runMs)}</span>}
            </div>

            {/* 진행바 (얇게) */}
            <div
              className={`relative h-1.5 w-full rounded ${
                isDone ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-slate-100"
              } overflow-hidden mb-3 shrink-0 transition-colors`}
            >
              <div className="h-1.5 bg-emerald-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>

            {/* 키워드 칩 */}
            <div className="mb-2 text-xs text-slate-600 shrink-0">키워드 {keywordDisplay.length}개</div>

            {/* 키워드 영역: 아래 섹션까지 꽉 채우고 스크롤 */}
            <div className="flex-1 min-h-[240px]">
              <div className="h-full w-full rounded-lg border bg-white p-2 overflow-auto">
                {keywordDisplay.length ? (
                  <div className="flex flex-wrap gap-2">
                    {keywordDisplay.map((k) => {
                      const st = progress.rows?.[k]?.status;
                      let klass = "bg-slate-100 text-slate-700";
                      if (st) {
                        if (st.includes("완료") || st.includes("저장")) klass = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                        else if (st.includes("결과 없음")) klass = "bg-slate-100 text-slate-500 border border-slate-200";
                        else if (st.includes("검색 오류")) klass = "bg-rose-100 text-rose-700 border border-rose-200";
                        else klass = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                      }
                      return (
                        <span key={k} title={st || ""} className={`px-2 py-1 rounded-lg text-[12px] ${klass} max-w-[12rem] truncate`}>
                          #{k}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-[12px] text-slate-500">아직 실행된 작업이 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
