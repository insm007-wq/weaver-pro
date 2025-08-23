// src/components/tabs/KeywordsTab.jsx
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import { extractKeywords as fallbackExtract } from "../../../utils/extractKeywords";

const MB = 1024 * 1024;

const RES_PRESETS = [
  { id: "hd", label: "HD (1280×720)", w: 1280, h: 720 },
  { id: "fhd", label: "FHD (1920×1080)", w: 1920, h: 1080 },
  { id: "qhd", label: "QHD (2560×1440)", w: 2560, h: 1440 },
  { id: "uhd", label: "4K (3840×2160)", w: 3840, h: 2160 },
];

/* 진행상황 reducer */
const progInit = { total: 0, picked: 0, saved: 0, rows: {} };
function progReducer(state, action) {
  switch (action.type) {
    case "init": {
      const rows = {};
      for (const k of action.keywords) rows[k] = { picked: 0, saved: 0, status: "대기" };
      return { total: action.keywords.length * action.perKeyword, picked: 0, saved: 0, rows };
    }
    case "status": {
      const { k, status } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      return { ...state, rows: { ...state.rows, [k]: { ...row, status } } };
    }
    case "picked": {
      const { k, n = 1 } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      const nextPicked = row.picked + n;
      return { ...state, picked: state.picked + n, rows: { ...state.rows, [k]: { ...row, picked: nextPicked, status: `선택 ${nextPicked}` } } };
    }
    case "saved": {
      const { k, n = 1 } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      const nextSaved = row.saved + n;
      return { ...state, saved: state.saved + n, rows: { ...state.rows, [k]: { ...row, saved: nextSaved, status: "저장 중" } } };
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

export default function KeywordsTab() {
  // ---------------- state ----------------
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [keywords, setKeywords] = useState([]); // 자동 추출 후 저장

  // 옵션
  const [minMB, setMinMB] = useState(1);
  const [maxMB, setMaxMB] = useState(14);
  const [resPreset, setResPreset] = useState("fhd");
  const [perKeyword, setPerKeyword] = useState(1);
  const [concurrency, setConcurrency] = useState(3);
  const [dedupAcrossKeywords, setDedupAcrossKeywords] = useState(true);
  const [usePexels, setUsePexels] = useState(true);
  const [usePixabay, setUsePixabay] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [strictKeyword, setStrictKeyword] = useState(true);
  const [maxKeywordsToUse, setMaxKeywordsToUse] = useState(30);

  // provider key
  const [hasPexelsKey, setHasPexelsKey] = useState(false);
  const [hasPixabayKey, setHasPixabayKey] = useState(false);

  // 진행 상황
  const [progress, dispatchProg] = useReducer(progReducer, progInit);
  const percent = progress.total ? Math.round((progress.saved / progress.total) * 100) : 0;
  const savedRef = useRef(0);
  useEffect(() => {
    savedRef.current = progress.saved;
  }, [progress.saved]);
  const [listSlice, setListSlice] = useState({ start: 0, size: 20 });

  const chosenRes = useMemo(() => RES_PRESETS.find((r) => r.id === resPreset) || RES_PRESETS[2], [resPreset]);

  // API 키 확인
  useEffect(() => {
    (async () => {
      try {
        const [px, pb] = await Promise.all([window.api.getSecret?.("pexelsApiKey"), window.api.getSecret?.("pixabayApiKey")]);
        setHasPexelsKey(!!px);
        setHasPixabayKey(!!pb);
        if (!px) setUsePexels(false);
        if (!pb) setUsePixabay(false);
      } catch {}
    })();
  }, []);

  // ---------------- helpers ----------------
  const pLimit = (n) => {
    let active = 0;
    const q = [];
    const next = () => {
      active--;
      if (q.length) q.shift()();
    };
    return (fn) =>
      new Promise((res, rej) => {
        const run = () => {
          active++;
          fn().then(
            (v) => {
              res(v);
              next();
            },
            (e) => {
              rej(e);
              next();
            }
          );
        };
        if (active < n) run();
        else q.push(run);
      });
  };

  const readCleanSrt = async () => {
    const srtPath = await window.api.getSetting?.("paths.srt");
    if (!srtPath) {
      alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
      return null;
    }
    const raw = await window.api.readTextFile?.(srtPath);
    return String(raw || "")
      .replace(/\r/g, "\n")
      .replace(/\d+\s*\n(?=\d{2}:\d{2}:\d{2},\d{3})/g, "")
      .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}.*\n/g, "");
  };

  const extractKeywordsAuto = async (topK = 60) => {
    const text = await readCleanSrt();
    if (!text) return [];
    try {
      const apiKey = await window.api.getSecret?.("openaiKey");
      if (apiKey && typeof window.api.aiExtractKeywords === "function") {
        setMsg("AI가 키워드를 추출 중…");
        const r = await window.api.aiExtractKeywords({ apiKey, text, topK, language: "ko" });
        if (r?.ok && Array.isArray(r.keywords) && r.keywords.length) return r.keywords;
      }
    } catch {}
    // 로컬 대체
    const local = fallbackExtract(text, { topK, minLen: 2 });
    return Array.isArray(local) ? local : [];
  };

  // ---------------- download (자동 추출 → 다운로드) ----------------
  const downloadFromKeywords = async () => {
    // 버튼은 항상 활성화: 빈 경우 자동 추출
    let baseKeywords = keywords;
    try {
      setBusy(true);

      if (!Array.isArray(baseKeywords) || baseKeywords.length === 0) {
        setMsg("SRT에서 키워드 추출 중…");
        const extracted = await extractKeywordsAuto(Math.max(60, maxKeywordsToUse));
        if (!extracted.length) {
          setMsg("키워드 추출 실패");
          alert("키워드를 추출하지 못했습니다.");
          return;
        }
        baseKeywords = extracted;
        setKeywords(extracted); // 화면에도 유지
        setMsg(`키워드 ${extracted.length}개 추출됨 · 다운로드 시작`);
      }

      const providerList = [...(usePexels && hasPexelsKey ? ["pexels"] : []), ...(usePixabay && hasPixabayKey ? ["pixabay"] : [])];
      if (providerList.length === 0) {
        alert("사용할 수 있는 제공사가 없습니다. (Pexels/Pixabay 키 확인)");
        return;
      }

      const runKeywords = baseKeywords.slice(0, Math.max(1, Math.min(maxKeywordsToUse, baseKeywords.length)));
      dispatchProg({ type: "init", keywords: runKeywords, perKeyword });
      setListSlice((s) => ({ ...s, start: 0 }));
      const targetTotal = runKeywords.length * perKeyword;

      const [pexelsKey, pixabayKey, openaiKey] = await Promise.all([
        window.api.getSecret?.("pexelsApiKey"),
        window.api.getSecret?.("pixabayApiKey"),
        window.api.getSecret?.("openaiKey"),
      ]);

      // 번역(ko→en)
      let enMap = {};
      if (autoTranslate && openaiKey && typeof window.api.aiTranslateTerms === "function") {
        const koTerms = runKeywords.filter((k) => /[ㄱ-ㅎ가-힣]/.test(k));
        if (koTerms.length) {
          try {
            const tr = await window.api.aiTranslateTerms({ apiKey: openaiKey, terms: koTerms });
            if (tr?.ok && Array.isArray(tr.terms)) koTerms.forEach((ko, i) => (enMap[ko] = tr.terms[i] || ko));
          } catch {}
        }
      }

      const SEARCH_OPTS = {
        perPage: Math.min(10, perKeyword * 3),
        minBytes: Math.max(0, Math.floor(minMB * MB)),
        maxBytes: Math.max(0, Math.floor(maxMB * MB)),
        targetRes: { w: chosenRes.w, h: chosenRes.h },
        sizeProbeConcurrency: 6,
        providers: providerList,
        pexelsKey,
        pixabayKey,
        type: "videos",
        strictKeyword,
      };

      const limit = pLimit(Math.max(1, Math.min(6, concurrency)));
      const seenGlobal = new Set();

      const tasks = runKeywords.map((k) =>
        limit(async () => {
          dispatchProg({ type: "status", k, status: "검색 중" });

          const kEn = enMap[k];
          const queries = kEn && kEn !== k ? [k, kEn] : [k];

          let r = await window.api.stockSearch({ queries, ...SEARCH_OPTS });
          if ((!r?.ok || !Array.isArray(r.items) || r.items.length === 0) && strictKeyword) {
            dispatchProg({ type: "status", k, status: "재시도(완화)" });
            r = await window.api.stockSearch({ queries, ...SEARCH_OPTS, strictKeyword: false });
          }

          if (!r?.ok) return dispatchProg({ type: "status", k, status: "실패" });
          if (!Array.isArray(r.items) || r.items.length === 0) return dispatchProg({ type: "status", k, status: "결과 없음" });

          const picked = [];
          for (const it of r.items) {
            if (!it?.url) continue;
            if (dedupAcrossKeywords && seenGlobal.has(it.url)) continue;
            seenGlobal.add(it.url);
            picked.push(it);
            if (picked.length >= perKeyword) break;
          }
          if (!picked.length) return dispatchProg({ type: "status", k, status: "결과 없음" });
          dispatchProg({ type: "picked", k, n: picked.length });

          for (const item of picked) {
            dispatchProg({ type: "saved", k, n: 1 });
            await window.api.saveUrlToProject({ url: item.url, category: "videos", fileName: item.filename });
          }
          dispatchProg({ type: "done", k });
        })
      );

      await Promise.allSettled(tasks);
      setMsg(`다운로드 완료: ${savedRef.current}/${targetTotal}`);
    } catch (e) {
      console.error(e);
      setMsg("오류: " + (e?.message || e));
      alert("다운로드 중 오류: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const estimatedDownloads = Math.min(keywords.length, maxKeywordsToUse) * perKeyword;

  return (
    <div className="w-full max-w-screen-xl mx-auto px-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start [&>*]:min-w-0">
        {/* 다운로드 옵션 */}
        <SectionCard title="다운로드 옵션" right={<span className="text-xs text-slate-500">필터 & 제공사</span>}>
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

            <label className="text-xs text-slate-700 flex items-center gap-2 min-w-0">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={dedupAcrossKeywords}
                onChange={(e) => setDedupAcrossKeywords(!!e.target.checked)}
                disabled={busy}
              />
              키워드 간 중복 영상 제거
            </label>

            <label className="text-xs text-slate-700 flex items-center gap-2 min-w-0">
              <input type="checkbox" className="h-4 w-4" checked={autoTranslate} onChange={(e) => setAutoTranslate(!!e.target.checked)} disabled={busy} />
              한→영 자동 변환(권장)
            </label>

            <label className="text-xs text-slate-700 flex items-center gap-2 min-w-0">
              <input type="checkbox" className="h-4 w-4" checked={strictKeyword} onChange={(e) => setStrictKeyword(!!e.target.checked)} disabled={busy} />
              키워드 엄격(태그 포함 필수)
            </label>
          </div>

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
                disabled={busy} // ← 키워드가 없어도 자동 추출을 위해 busy만 체크
                title="SRT에서 키워드 자동 추출 후 스톡 영상 다운로드"
              >
                {busy ? "추출+다운로드 중…" : "키워드로 영상 받기"}
              </button>
              {msg && <div className="mt-2 text-[12px] text-slate-600">{msg}</div>}
            </div>
          </div>
        </SectionCard>

        {/* 진행 상황 */}
        <SectionCard title="진행 상황" right={<span className="text-xs text-slate-400">실시간</span>}>
          <div className="text-sm text-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-slate-600">
                저장: <b>{progress.saved}</b> / 목표 <b>{progress.total}</b>
              </span>
              <span className="text-[12px] text-slate-600">{percent}%</span>
            </div>
            <div className="h-1.5 w-full rounded bg-slate-100 overflow-hidden">
              <div className="h-1.5 bg-emerald-500 transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-3 mb-1 flex items-center justify-between text-[12px] text-slate-500">
              <div>
                다운로드 완료: <b>{progress.saved}</b>개
                <span className="ml-1">
                  (키워드 {Object.keys(progress.rows).length}개, 키워드당 {perKeyword}개 목표)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 rounded border" onClick={() => setListSlice((s) => ({ start: Math.max(0, s.start - s.size), size: s.size }))}>
                  이전
                </button>
                <button
                  className="px-2 py-1 rounded border"
                  onClick={() =>
                    setListSlice((s) => {
                      const total = Object.keys(progress.rows).length;
                      const next = Math.min(Math.max(0, total - s.size), s.start + s.size);
                      return { start: next, size: s.size };
                    })
                  }
                >
                  다음
                </button>
              </div>
            </div>

            <div className="border rounded-lg bg-white divide-y max-h-80 overflow-y-auto">
              {Object.keys(progress.rows).length === 0 ? (
                <div className="p-3 text-[12px] text-slate-500">아직 실행된 작업이 없습니다.</div>
              ) : (
                Object.entries(progress.rows)
                  .slice(listSlice.start, listSlice.start + listSlice.size)
                  .map(([k, r]) => (
                    <div key={k} className="px-3 py-2 flex items-center justify-between text-[13px]">
                      <div className="truncate pr-2">#{k}</div>
                      <div className="flex items-center gap-3 shrink-0 text-slate-600">
                        <span className="text-[12px]">pick {r.picked}</span>
                        <span className="text-[12px]">save {r.saved}</span>
                        <span className="text-[12px] text-slate-400">{r.status}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
