// src/components/tabs/KeywordsTab.jsx
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import AssetLibrary from "../parts/AssetLibrary";
import { extractKeywords as fallbackExtract } from "../../../utils/extractKeywords";

const MB = 1024 * 1024;

const RES_PRESETS = [
  { id: "hd", label: "HD (1280×720)", w: 1280, h: 720 },
  { id: "fhd", label: "FHD (1920×1080)", w: 1920, h: 1080 },
  { id: "qhd", label: "QHD (2560×1440)", w: 2560, h: 1440 },
  { id: "uhd", label: "4K (3840×2160)", w: 3840, h: 2160 },
];

/* =========================
   진행상황 reducer (안정적인 게이지/카운트)
   ========================= */
const progInit = { total: 0, picked: 0, saved: 0, rows: {} }; // rows: { [k]: { picked, saved, status } }
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
      return {
        ...state,
        picked: state.picked + n,
        rows: { ...state.rows, [k]: { ...row, picked: nextPicked, status: `선택 ${nextPicked}` } },
      };
    }
    case "saved": {
      const { k, n = 1 } = action;
      const row = state.rows[k] || { picked: 0, saved: 0, status: "" };
      const nextSaved = row.saved + n;
      return {
        ...state,
        saved: state.saved + n,
        rows: { ...state.rows, [k]: { ...row, saved: nextSaved, status: "저장 중" } },
      };
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

export default function KeywordsTab({ assets, addAssets }) {
  // ---------------- state: keywords & ui ----------------
  const [keywords, setKeywords] = useState([]);
  const [input, setInput] = useState("");
  const [srtFileName, setSrtFileName] = useState(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // 옵션
  const [minMB, setMinMB] = useState(1);
  const [maxMB, setMaxMB] = useState(14);
  const [resPreset, setResPreset] = useState("qhd");
  const [perKeyword, setPerKeyword] = useState(1);
  const [concurrency, setConcurrency] = useState(3);
  const [dedupAcrossKeywords, setDedupAcrossKeywords] = useState(true);
  const [usePexels, setUsePexels] = useState(true);
  const [usePixabay, setUsePixabay] = useState(true);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [strictKeyword, setStrictKeyword] = useState(true);
  const [maxKeywordsToUse, setMaxKeywordsToUse] = useState(30); // 긴 대본 방지

  // provider key 보유 여부
  const [hasPexelsKey, setHasPexelsKey] = useState(false);
  const [hasPixabayKey, setHasPixabayKey] = useState(false);

  // 진행 상황 (reducer + slice 목록)
  const [progress, dispatchProg] = useReducer(progReducer, progInit);
  const percent = progress.total ? Math.round((progress.saved / progress.total) * 100) : 0;
  const savedRef = useRef(0);
  useEffect(() => {
    savedRef.current = progress.saved;
  }, [progress.saved]);
  const [listSlice, setListSlice] = useState({ start: 0, size: 20 });

  const chosenRes = useMemo(() => RES_PRESETS.find((r) => r.id === resPreset) || RES_PRESETS[2], [resPreset]);

  // SRT & API 키 확인
  useEffect(() => {
    (async () => {
      try {
        const srtPath = await window.api.getSetting?.("paths.srt");
        if (srtPath) setSrtFileName(srtPath.split(/[/\\]/).pop());
      } catch {}
      try {
        const [px, pb] = await Promise.all([window.api.getSecret?.("pexelsApiKey"), window.api.getSecret?.("pixabayApiKey")]);
        setHasPexelsKey(!!px);
        setHasPixabayKey(!!pb);
        if (!px) setUsePexels(false);
        if (!pb) setUsePixabay(false);
      } catch {}
    })();
  }, []);

  // ---------------- keyword helpers ----------------
  const addKeyword = (k) => {
    const t = (k || "").trim();
    if (!t) return;
    setKeywords((old) => (old.includes(t) ? old : [...old, t]).slice(0, 300));
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

  // ---------------- SRT read/clean ----------------
  const readCleanSrt = async () => {
    const srtPath = await window.api.getSetting?.("paths.srt");
    if (!srtPath) {
      alert("먼저 [셋업] 탭에서 SRT 파일을 연결해 주세요.");
      return null;
    }
    const raw = await window.api.readTextFile?.(srtPath);
    const cleaned = String(raw || "")
      .replace(/\r/g, "\n")
      .replace(/\d+\s*\n(?=\d{2}:\d{2}:\d{2},\d{3})/g, "")
      .replace(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}.*\n/g, "");
    setSrtFileName(srtPath.split(/[/\\]/).pop());
    return cleaned;
  };

  // ---------------- AI extract ----------------
  const extractFromSrtAI = async () => {
    try {
      setBusy(true);
      setMsg("SRT 로드 중…");
      const text = await readCleanSrt();
      if (!text) return;

      const apiKey = await window.api.getSecret?.("openaiKey");
      if (!apiKey) {
        alert("OpenAI API 키가 없습니다. [Settings > API]에서 먼저 저장해 주세요.");
        return;
      }

      setMsg("AI가 키워드를 추출 중…");
      const res = await window.api.aiExtractKeywords({ apiKey, text, topK: 60, language: "ko" });
      if (res?.ok && Array.isArray(res.keywords) && res.keywords.length) {
        setKeywords(res.keywords);
        setMsg(`AI 추출 완료 · ${res.keywords.length}개`);
      } else {
        const local = fallbackExtract(text, { topK: 30, minLen: 2 });
        if (local.length) {
          setKeywords(local);
          setMsg("AI 실패 → 로컬 추출로 대체 (완료)");
        } else {
          setMsg("키워드 추출 실패");
          alert("키워드를 추출하지 못했습니다.");
        }
      }
    } catch (e) {
      console.error(e);
      setMsg("오류: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // ---------------- utility: p-limit ----------------
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

  // ---------------- download by keywords ----------------
  const downloadFromKeywords = async () => {
    if (!keywords.length) return;

    // 사용 가능한 provider
    const providerList = [...(usePexels && hasPexelsKey ? ["pexels"] : []), ...(usePixabay && hasPixabayKey ? ["pixabay"] : [])];
    if (providerList.length === 0) {
      alert("사용할 수 있는 제공사가 없습니다. (Pexels/Pixabay 키 확인)");
      return;
    }

    // 긴 대본 → 상위 N개만 사용
    const runKeywords = keywords.slice(0, Math.max(1, Math.min(maxKeywordsToUse, keywords.length)));
    dispatchProg({ type: "init", keywords: runKeywords, perKeyword });
    setListSlice((s) => ({ ...s, start: 0 })); // 목록 첫 페이지로
    const targetTotal = runKeywords.length * perKeyword;

    try {
      setBusy(true);
      setMsg("스톡 검색 준비…");

      const [pexelsKey, pixabayKey, openaiKey] = await Promise.all([
        window.api.getSecret?.("pexelsApiKey"),
        window.api.getSecret?.("pixabayApiKey"),
        window.api.getSecret?.("openaiKey"),
      ]);

      // 한→영 번역
      let enMap = {};
      if (autoTranslate && openaiKey && typeof window.api.aiTranslateTerms === "function") {
        const koTerms = runKeywords.filter((k) => /[ㄱ-ㅎ가-힣]/.test(k));
        if (koTerms.length) {
          try {
            const tr = await window.api.aiTranslateTerms({ apiKey: openaiKey, terms: koTerms });
            if (tr?.ok && Array.isArray(tr.terms)) {
              koTerms.forEach((ko, i) => (enMap[ko] = tr.terms[i] || ko));
            }
          } catch {
            // ignore
          }
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
      const seenGlobal = new Set(); // ✅ 키워드 간 중복 제거용

      const tasks = runKeywords.map((k) =>
        limit(async () => {
          dispatchProg({ type: "status", k, status: "검색 중" });

          const kEn = enMap[k];
          const queries = kEn && kEn !== k ? [k, kEn] : [k];

          let r = await window.api.stockSearch({ queries, ...SEARCH_OPTS });

          // 엄격 매칭에서 0건 → 완화 재시도
          if ((!r?.ok || !Array.isArray(r.items) || r.items.length === 0) && strictKeyword) {
            dispatchProg({ type: "status", k, status: "재시도(완화)" });
            r = await window.api.stockSearch({ queries, ...SEARCH_OPTS, strictKeyword: false });
          }

          if (!r?.ok) {
            // 429 백오프 등: 상위에서 재호출·다음 키워드 진행
            dispatchProg({ type: "status", k, status: "실패" });
            return;
          }
          if (!Array.isArray(r.items) || r.items.length === 0) {
            dispatchProg({ type: "status", k, status: "결과 없음" });
            return;
          }

          // 선택
          const picked = [];
          for (const it of r.items) {
            if (!it?.url) continue;
            if (dedupAcrossKeywords && seenGlobal.has(it.url)) continue;
            seenGlobal.add(it.url);
            picked.push(it);
            if (picked.length >= perKeyword) break;
          }
          if (picked.length) dispatchProg({ type: "picked", k, n: picked.length });
          else {
            dispatchProg({ type: "status", k, status: "결과 없음" });
            return;
          }

          // 저장
          for (const item of picked) {
            dispatchProg({ type: "saved", k, n: 1 });
            const save = await window.api.saveUrlToProject({
              url: item.url,
              category: "videos",
              fileName: item.filename,
            });
            if (save?.ok && save?.path) {
              const filePath = save.path;
              const fileUrl = process.platform === "win32" ? "file:///" + filePath.replace(/\\/g, "/") : "file://" + filePath;

              addAssets([
                {
                  id: "stk-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
                  type: "video",
                  thumbUrl: fileUrl,
                  filePath,
                },
              ]);
            }
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
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px_420px] gap-4 items-start [&>*]:min-w-0">
      {/* 키워드 구성 */}
      <SectionCard
        title="키워드 구성"
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={extractFromSrtAI}
              className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-60"
              disabled={busy}
              title="SRT에서 GPT-5 mini로 추출"
            >
              {busy ? "AI 추출 중…" : "SRT에서 AI 추출"}
            </button>

            <button
              onClick={downloadFromKeywords}
              className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60"
              disabled={busy || keywords.length === 0}
              title="키워드로 스톡 영상 다운로드"
            >
              {busy ? "처리 중…" : "키워드로 영상 받기"}
            </button>

            <button
              onClick={clearKeywords}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
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
            disabled={busy}
          />
          <button
            onClick={addFromInput}
            className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={!input.trim() || busy}
          >
            추가
          </button>
        </div>

        {/* 키워드 칩: 내부 스크롤로 UI 안정화 */}
        <div className="mt-3 flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
          {keywords.length === 0 ? (
            <div className="text-[12px] text-slate-500">SRT에서 AI 추출하거나, 직접 키워드를 추가해 주세요.</div>
          ) : (
            keywords.map((k) => (
              <span key={k} className="px-2 py-1.5 h-8 rounded-full border border-slate-200 bg-white text-sm inline-flex items-center gap-2">
                <span className="px-1">#{k}</span>
                <button onClick={() => removeKeyword(k)} className="text-slate-400 hover:text-slate-600" title="제거">
                  ✕
                </button>
              </span>
            ))
          )}
        </div>

        <div className="mt-3 text-[12px] text-slate-600">
          예상 다운로드: <b>{estimatedDownloads}</b>개
        </div>
        {msg && <div className="mt-3 text-[12px] text-slate-600">{msg}</div>}
      </SectionCard>

      {/* 다운로드 옵션 */}
      <SectionCard title="다운로드 옵션" right={<span className="text-xs text-slate-500">필터 & 제공사</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-slate-700 flex flex-col gap-1">
            해상도
            <select
              value={resPreset}
              onChange={(e) => setResPreset(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white"
              disabled={busy}
            >
              {RES_PRESETS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            키워드당 개수
            <input
              type="number"
              min={1}
              max={6}
              value={perKeyword}
              onChange={(e) => setPerKeyword(Math.max(1, Math.min(6, +e.target.value || 1)))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            최소 용량 (MB)
            <input
              type="number"
              min={0}
              max={500}
              value={minMB}
              onChange={(e) => setMinMB(Math.max(0, +e.target.value || 0))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            최대 용량 (MB)
            <input
              type="number"
              min={0}
              max={2000}
              value={maxMB}
              onChange={(e) => setMaxMB(Math.max(0, +e.target.value || 0))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            동시 다운로드
            <input
              type="number"
              min={1}
              max={6}
              value={concurrency}
              onChange={(e) => setConcurrency(Math.max(1, Math.min(6, +e.target.value || 1)))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
          </label>

          <label className="text-xs text-slate-700 flex flex-col gap-1">
            상위 키워드만 사용
            <input
              type="number"
              min={1}
              max={300}
              value={maxKeywordsToUse}
              onChange={(e) => setMaxKeywordsToUse(Math.max(1, Math.min(300, +e.target.value || 30)))}
              className="h-9 px-3 rounded-lg border border-slate-200 text-sm"
              disabled={busy}
            />
            <span className="text-[11px] text-slate-400">긴 대본일 때 과도한 호출을 방지합니다.</span>
          </label>

          <label className="text-xs text-slate-700 flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={dedupAcrossKeywords}
              onChange={(e) => setDedupAcrossKeywords(!!e.target.checked)}
              disabled={busy}
            />
            키워드 간 중복 영상 제거
          </label>

          <label className="text-xs text-slate-700 flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={autoTranslate} onChange={(e) => setAutoTranslate(!!e.target.checked)} disabled={busy} />
            한→영 자동 변환(권장)
          </label>

          <label className="text-xs text-slate-700 flex items-center gap-2">
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

          {/* 목록: 조각(slice) + 내부 스크롤 → 넓은 화면에서도 UI 안정 */}
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

      {/* 라이브러리 */}
      <SectionCard title="에셋 라이브러리">
        <AssetLibrary assets={assets} onPick={() => alert("해당 씬에 배치")} />
      </SectionCard>
    </div>
  );
}
