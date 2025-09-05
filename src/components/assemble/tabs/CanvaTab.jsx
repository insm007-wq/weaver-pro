// src/components/assemble/tabs/CanvaTab.jsx
// ----------------------------------------------------------------------------
// 캔바 자동 다운로드 전용 탭 (API 방식 - 로봇 탐지 우회)
// - 로그인 상태 뱃지 + 로그인 버튼 (한 번만 로그인)
// - SRT에서 자동 키워드 추출 → Canva API를 통한 자동화 실행
// - 진행/완료 요약 + 키워드 칩 상태 표시  
// - 이벤트 연동: "canva:progress", "canva:downloaded"
// - 다운로드된 에셋은 addAssets로 상위 전달 → 자동배치 트리거
// ----------------------------------------------------------------------------
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import { extractKeywords as fallbackExtract } from "../../../utils/extractKeywords";
import { getSetting, readTextAny, aiExtractKeywords, getSecret } from "../../../utils/ipcSafe";

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

// Canva UI 해상도 라벨(공백 포함, × 사용) 생성
function buildResolutionLabel(w, h) {
  // Canva-browse에서 기본 사용: "1920 × 1080"
  return `${w} × ${h}`;
}

/* =============================== 컴포넌트 =============================== */
export default function CanvaTab({ addAssets }) {
  // 상태
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [manualKeywords, setManualKeywords] = useState(""); // 수동 키워드 입력

  // 옵션
  const [minMB, setMinMB] = useState(1);
  const [maxMB, setMaxMB] = useState(14);
  const [resPreset, setResPreset] = useState("fhd");
  const [perKeyword, setPerKeyword] = useState(1);
  const [concurrency, setConcurrency] = useState(3);
  const [maxKeywordsToUse, setMaxKeywordsToUse] = useState(30);

  // 진행/시간
  const [progress, dispatchProg] = useReducer(progReducer, progInit);
  const [extractMs, setExtractMs] = useState(0);
  const runStartRef = useRef(0);
  const [runMs, setRunMs] = useState(0);
  const [doneFlash, setDoneFlash] = useState(false);
  const chosenRes = useMemo(() => RES_PRESETS.find((r) => r.id === resPreset) || RES_PRESETS[1], [resPreset]);

  // 🔐 Canva 로그인 상태
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [canvaAuthed, setCanvaAuthed] = useState(false);
  const [canvaUser, setCanvaUser] = useState(null);
  const [canvaMsg, setCanvaMsg] = useState("");

  // 이벤트 구독: canva:progress / canva:downloaded
  useEffect(() => {
    const api = window?.api;
    if (!api || typeof api.on !== "function" || typeof api.off !== "function") return;

    const onProg = (payload) => {
      // B안(canva-browse): { stage: "start|success|retry|error|no_results|..." , keyword, done, total, ... }
      // 기존 자동화:      { phase: "search|pick|download|save|done", keyword, ... }
      const k = payload?.keyword;
      if (!k) return;

      const phase = payload?.phase; // 기존
      const stage = payload?.stage; // B안

      const toStatus = (val) => {
        if (!val) return null;
        const v = String(val);
        if (["search"].includes(v)) return "검색 중";
        if (["pick"].includes(v)) return "선택";
        if (["download"].includes(v)) return "다운로드 중";
        if (["save"].includes(v)) return "저장 중";
        if (["done", "success"].includes(v)) return "완료";
        if (["retry"].includes(v)) return "재시도";
        if (["no_results", "no_results"].includes(v)) return "결과 없음";
        if (["error", "download_timeout", "editor_open_fail", "download_panel_fail"].includes(v)) return "오류";
        return v;
      };

      const status = toStatus(phase || stage);
      if (status) {
        dispatchProg({ type: "status", k, status });
        if (status === "완료") dispatchProg({ type: "done", k });
      }

      // 구버전 델타 호환
      if (payload?.pickedDelta) dispatchProg({ type: "picked", k, n: payload.pickedDelta });
      if (payload?.savedDelta) dispatchProg({ type: "saved", k, n: payload.savedDelta });
      if (payload?.skipDelta) dispatchProg({ type: "skip", k, n: payload.skipDelta, reason: payload.reason || "other" });
    };

    const onDownloaded = (x) => {
      // B안: { keyword, path, size }
      // 기존: { path, keyword, width, height, durationSec, thumbUrl, provider, assetId }
      try {
        const k = x?.keyword || "";
        if (k) {
          // 다운로드 1건 완료로 카운트 반영
          dispatchProg({ type: "saved", k, n: 1 });
          dispatchProg({ type: "status", k, status: "저장" });
        }
        if (typeof addAssets === "function" && x?.path) {
          const asset = {
            id: x.assetId || x.path,
            type: "video",
            path: x.path,
            thumbUrl: x.thumbUrl || "",
            durationSec: x.durationSec ?? 0,
            tags: [x.keyword].filter(Boolean),
          };
          addAssets([asset]);
        }
      } catch {}
    };

    api.on("canva:progress", onProg);
    api.on("canva:downloaded", onDownloaded);
    return () => {
      api.off("canva:progress", onProg);
      api.off("canva:downloaded", onDownloaded);
    };
  }, [addAssets]);

  // Canva 세션 상태 초기화 (다운로드 패널 방식)
  const refreshCanvaSession = useCallback(async () => {
    try {
      if (window?.api?.invoke) {
        const sessionResult = await window.api.invoke('canva:getSession');
        
        if (sessionResult?.ok) {
          setCanvaAuthed(true);
          setCanvaUser({ name: '기존 로그인' });
          setCanvaMsg("기존 Canva 로그인 세션을 사용합니다");
        } else {
          setCanvaAuthed(false);
          setCanvaUser(null);
          setCanvaMsg("로그인이 필요합니다. 다운로드 패널 방식을 사용합니다.");
        }
      } else {
        setCanvaAuthed(false);
        setCanvaUser(null);
        setCanvaMsg("API 초기화 대기 중...");
      }
    } catch (e) {
      setCanvaAuthed(false);
      setCanvaUser(null);
      setCanvaMsg("세션 초기화 실패");
    }
  }, []);
  useEffect(() => {
    refreshCanvaSession();
  }, [refreshCanvaSession]);

  // Canva 로그인 창 열기 (다운로드 패널 방식)
  const handleCanvaLogin = useCallback(async () => {
    try {
      setCanvaBusy(true);
      setCanvaMsg("Canva 로그인 창을 여는 중...");
      
      if (window?.api?.invoke) {
        const result = await window.api.invoke('canva:login');
        
        if (result?.ok) {
          setCanvaAuthed(true);
          setCanvaUser({ name: '로그인 대기' });
          setCanvaMsg("로그인 창이 열렸습니다. 수동으로 로그인하세요. 다운로드는 백엔드에서 자동 처리됩니다.");
        } else {
          setCanvaMsg("로그인 창 열기 실패");
        }
      } else {
        setCanvaMsg("API가 없습니다. Electron preload 설정을 확인하세요.");
      }
    } catch (e) {
      setCanvaAuthed(false);
      setCanvaUser(null);
      setCanvaMsg("로그인 창 열기 중 오류: " + (e?.message || e));
    } finally {
      setCanvaBusy(false);
    }
  }, []);

  // Canva 세션 상태 확인 (다운로드 패널 방식)
  const handleCheckLogin = useCallback(async () => {
    setCanvaBusy(true);
    setCanvaMsg("Canva 세션 확인 중...");
    
    try {
      if (window?.api?.invoke) {
        const sessionResult = await window.api.invoke('canva:getSession');
        
        if (sessionResult?.ok) {
          setCanvaAuthed(true);
          setCanvaUser({ name: '로그인됨' });
          setCanvaMsg("Canva 로그인 상태가 확인되었습니다. 다운로드 패널 방식을 사용할 수 있습니다.");
        } else {
          setCanvaAuthed(false);
          setCanvaUser(null);
          setCanvaMsg("로그인이 필요합니다. 로그인 버튼을 클릭하세요.");
        }
      }
    } catch (error) {
      setCanvaMsg("세션 확인 실패: " + (error?.message || error));
    } finally {
      setCanvaBusy(false);
    }
  }, []);

  const handleCanvaLogout = useCallback(async () => {
    try {
      setCanvaBusy(true);
      
      if (window?.api?.invoke) {
        const result = await window.api.invoke('canva:logout');
        
        if (result?.ok) {
          setCanvaAuthed(false);
          setCanvaUser(null);
          setCanvaMsg("로그아웃이 완료되었습니다.");
        } else {
          setCanvaMsg("로그아웃 실패: " + (result?.message || "알 수 없는 오류"));
        }
      }
    } finally {
      setCanvaBusy(false);
    }
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
        // ✅ OpenAI API 키가 있으면 AI로 추출 (KeywordsTab과 동일한 흐름)
        const apiKey = await getSecret("openaiKey");
        if (apiKey) {
          setMsg("AI가 키워드를 추출 중…");
          const r = await aiExtractKeywords({ apiKey, text, topK, language: "ko" });
          const t1 = performance.now();
          setExtractMs(t1 - t0);
          if (r?.ok && Array.isArray(r.keywords) && r.keywords.length) return r.keywords;
        }
      } catch {}
      // 🔁 백업: 로컬 TF-IDF/RAKE 등으로 추출
      const local = fallbackExtract(text, { topK, minLen: 2 });
      const t1 = performance.now();
      setExtractMs(t1 - t0);
      return Array.isArray(local) ? local : [];
    },
    [readCleanSrt]
  );

  /* ---------------------- 실행(추출→캔바 자동화) ---------------------- */
  const handleRun = useCallback(async () => {
    if (!window?.api?.invoke) {
      alert("API가 없습니다. Electron preload 설정을 확인하세요.");
      return;
    }

    let baseKeywords = keywords;

    try {
      setBusy(true);
      setMsg("준비 중…");
      runStartRef.current = performance.now();

      // 1) Canva 로그인 확인 및 창 열기
      if (!canvaAuthed) {
        setMsg("Canva 로그인 상태 확인 중…");
        
        try {
          // 기존 세션 확인
          const sessionResult = await window.api.invoke('canva:getSession');
          
          if (sessionResult?.ok) {
            setCanvaAuthed(true);
            setCanvaUser({ name: '기존 세션' });
            setCanvaMsg("기존 로그인 세션을 사용합니다.");
          } else {
            setCanvaMsg("Canva 로그인 창을 여는 중…");
            
            // 로그인 창 열기
            const loginResult = await window.api.invoke('canva:login');
            
            if (loginResult?.ok) {
              setCanvaAuthed(true);
              setCanvaUser({ name: '로그인 필요' });
              setCanvaMsg("로그인 창이 열렸습니다. 수동으로 로그인 후 다운로드를 시작하세요.");
            } else {
              throw new Error("로그인 창 열기 실패");
            }
          }
        } catch (e) {
          console.warn("Login check failed:", e);
          setCanvaMsg("로그인 확인 실패, 하지만 다운로드를 시도합니다");
          setCanvaAuthed(true); // 시도는 해보기
        }
      }

      // 2) 키워드 없으면 자동 추출
      if (!Array.isArray(baseKeywords) || baseKeywords.length === 0) {
        setMsg("SRT에서 키워드 추출 중…");
        const extracted = await extractKeywordsAuto(Math.max(60, maxKeywordsToUse));
        if (!extracted.length) {
          setMsg("키워드 추출 실패");
          alert("키워드를 추출하지 못했습니다.");
          return;
        }
        baseKeywords = extracted;
        setKeywords(extracted);
        setMsg(`키워드 ${extracted.length}개 추출됨 · API 기반 다운로드 시작`);
      }

      // 3) 실행 키워드 집합/진행 초기화
      const runKeywords = baseKeywords.slice(0, Math.max(1, Math.min(maxKeywordsToUse, baseKeywords.length)));
      dispatchProg({ type: "init", keywords: runKeywords, perKeyword });

      // 4) 옵션 구성 (새로운 API 방식)
      const options = {
        perKeywordLimit: Math.max(1, Math.min(10, perKeyword)),
        downloadFormat: "MP4",
        resolutionPreference: `${chosenRes.w}x${chosenRes.h}`,
      };

      setMsg(`키워드 ${runKeywords.length}개에서 총 ${runKeywords.length * perKeyword}개 영상 API 다운로드 시작`);

      // 5) 향상된 진행 상황 추적 (여러 다운로드 방법 표시)
      const progressHandler = (payload) => {
        const { stage, keyword, method, downloaded, filename, error, progress } = payload || {};
        
        if (stage === "search") {
          setMsg(`검색 중: ${keyword}`);
        } else if (stage === "downloading") {
          const progressText = progress ? ` (${Math.round(progress)}%)` : '';
          setMsg(`다운로드 중 [${method}]: ${filename || keyword}${progressText}`);
        } else if (stage === "success") {
          setMsg(`완료 [${method}]: ${filename || keyword} (총 ${downloaded}개)`);
        } else if (stage === "error") {
          console.warn(`다운로드 실패 [${method}]: ${keyword} - ${error}`);
        }
      };

      const downloadedHandler = (result) => {
        if (result?.success && result?.downloaded !== undefined) {
          const methods = result.methods || {};
          const methodsSummary = Object.entries(methods)
            .map(([method, count]) => `${method}(${count})`)
            .join(', ');
          setMsg(`다운로드 완료: 총 ${result.downloaded}개 파일 [방법: ${methodsSummary}]`);
        }
      };

      // 이벤트 리스너 등록
      if (window.api?.on) {
        window.api.on("canva:progress", progressHandler);
        window.api.on("canva:downloaded", downloadedHandler);
      }

      try {
        // 6) 향상된 세션 기반 다운로드 실행 (여러 방법 자동 시도)
        const downloadResult = await window.api.invoke('canva:enhancedDownload', {
          keywords: runKeywords,
          options: {
            perKeywordLimit: perKeyword,
            downloadFormat: "MP4",
            resolutionPreference: `${chosenRes.w}x${chosenRes.h}`,
            timeout: 60000
          }
        });

        if (downloadResult?.success) {
          const methods = downloadResult.methods || {};
          const methodsSummary = Object.entries(methods)
            .map(([method, count]) => `${method}: ${count}개`)
            .join(', ');
          
          setMsg(`세션 기반 다운로드 완료: ${downloadResult.downloaded}개 파일 다운로드됨 (${methodsSummary})`);
        } else {
          throw new Error(downloadResult?.message || "세션 기반 다운로드 실패");
        }
      } finally {
        // 이벤트 리스너 정리
        if (window.api?.off) {
          window.api.off("canva:progress", progressHandler);
          window.api.off("canva:downloaded", downloadedHandler);
        }
      }

    } catch (e) {
      console.error(e);
      setMsg("오류: " + (e?.message || e));
      alert("Canva API 다운로드 중 오류: " + (e?.message || e));
    } finally {
      setRunMs(performance.now() - runStartRef.current);
      setBusy(false);
      setDoneFlash(true);
      setTimeout(() => setDoneFlash(false), 1800);
    }
  }, [canvaAuthed, keywords, extractKeywordsAuto, maxKeywordsToUse, perKeyword, chosenRes]);

  const handleStop = useCallback(async () => {
    try {
      if (window?.api?.invoke) {
        const result = await window.api.invoke('canva:stop');
        if (result?.ok) {
          setMsg("세션 기반 다운로드 중지 요청됨");
        } else {
          setMsg("중지 실패");
        }
      }
    } catch (e) {
      setMsg("중지 실패: " + (e?.message || e));
    }
  }, []);

  /* ---------------------- 표시 데이터 ---------------------- */
  const pct = useMemo(() => {
    if (!progress.total) return 0;
    const done = Math.min(progress.saved + progress.skipped, progress.total);
    return Math.round((done / progress.total) * 100);
  }, [progress.saved, progress.skipped, progress.total]);

  const keywordDisplay = useMemo(() => Object.keys(progress.rows || {}), [progress.rows]);
  const isDone = progress.total > 0 && progress.saved + progress.skipped >= progress.total;

  const estimatedDownloads = Math.min(keywords.length || maxKeywordsToUse, maxKeywordsToUse) * perKeyword;

  /* ---------------------------- UI ---------------------------- */
  return (
    <div className="w-full max-w-screen-xl mx-auto px-4 force-text-dark">
      {/* 키워드 입력 섹션 */}
      <div className="mb-4">
        <SectionCard
          title="🧪 테스트 키워드 입력"
          right={
            <div className="text-xs text-neutral-500">
              {keywords.length > 0 ? `${keywords.length}개 키워드 설정됨` : "키워드를 입력하세요"}
            </div>
          }
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs text-neutral-700 flex flex-col gap-1">
                테스트 키워드 (쉼표로 구분)
                <input
                  type="text"
                  placeholder="예: 비디오, 테스트, 동영상"
                  value={manualKeywords}
                  onChange={(e) => setManualKeywords(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                  disabled={busy}
                />
              </label>
            </div>
            <div className="flex gap-2 items-end">
              <button
                onClick={() => {
                  const kws = manualKeywords.split(',').map(k => k.trim()).filter(k => k);
                  if (kws.length > 0) {
                    setKeywords(kws);
                    setMsg(`${kws.length}개 키워드 설정됨: ${kws.join(', ')}`);
                  } else {
                    alert('키워드를 입력해주세요');
                  }
                }}
                className="h-9 px-4 rounded-lg bg-blue-500 text-white text-sm hover:bg-blue-600 transition-colors whitespace-nowrap"
                disabled={busy}
              >
                키워드 설정
              </button>
              <button
                onClick={() => {
                  setKeywords([]);
                  setManualKeywords("");
                  setMsg("키워드 초기화됨");
                }}
                className="h-9 px-3 rounded-lg bg-gray-500 text-white text-sm hover:bg-gray-600 transition-colors whitespace-nowrap"
                disabled={busy}
              >
                초기화
              </button>
            </div>
          </div>
          {keywords.length > 0 && (
            <div className="mt-3 text-xs text-neutral-600 bg-gray-50 p-2 rounded">
              현재 키워드: <span className="font-medium">{keywords.join(', ')}</span>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch [&>*]:min-w-0">
        {/* 옵션 */}
        <SectionCard
          className="h-full"
          title="Canva 세션 기반 다운로드"
          right={
            <span className="text-xs text-neutral-600">
              다중 방법 자동 시도 · <span className="text-neutral-500">추출 {formatMs(extractMs)}</span>
            </span>
          }
        >
          {/* 로그인 상태 */}
          <div className="mb-3 flex items-center gap-2">
            {canvaAuthed ? (
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg text-[12px] bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                ✅ Canva 로그인됨{canvaUser?.email ? ` · ${canvaUser.email}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-2 py-1 rounded-lg text-[12px] bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                ⚠️ Canva 미로그인
              </span>
            )}
            {canvaMsg && (
              <span className="text-[12px] text-neutral-600" aria-live="polite">
                {canvaMsg}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button onClick={handleCanvaLogin} className="btn-primary h-9" disabled={canvaBusy} title="Canva 로그인 후 세션 정보를 저장합니다. 여러 다운로드 방법을 자동으로 시도합니다.">
              {canvaBusy ? "로그인 창 여는 중…" : canvaAuthed ? "로그인 창 다시 열기" : "Canva 세션 로그인"}
            </button>
            <button
              onClick={handleCheckLogin}
              className="btn-secondary h-9"
              disabled={canvaBusy}
              title="현재 Canva 로그인 상태를 확인합니다."
            >
              로그인 확인
            </button>
            <button
              onClick={handleCanvaLogout}
              className="btn-secondary h-9"
              disabled={canvaBusy}
              title="Canva 세션 쿠키를 모두 제거합니다."
            >
              로그아웃
            </button>
          </div>

          {/* 옵션들 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              해상도
              <select
                value={resPreset}
                onChange={(e) => setResPreset(e.target.value)}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white text-neutral-900 w-full"
                disabled={busy}
              >
                {RES_PRESETS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              키워드당 개수
              <input
                type="number"
                min={1}
                max={10}
                value={perKeyword}
                onChange={(e) => setPerKeyword(Math.max(1, Math.min(10, +e.target.value || 1)))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              최소 용량 (MB)
              <input
                type="number"
                min={0}
                max={500}
                value={minMB}
                onChange={(e) => setMinMB(Math.max(0, +e.target.value || 0))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              최대 용량 (MB)
              <input
                type="number"
                min={0}
                max={2000}
                value={maxMB}
                onChange={(e) => setMaxMB(Math.max(0, +e.target.value || 0))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              동시 다운로드
              <input
                type="number"
                min={1}
                max={6}
                value={concurrency}
                onChange={(e) => setConcurrency(Math.max(1, Math.min(6, +e.target.value || 1)))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
              <span className="text-[11px] text-neutral-500 break-words">
                현재 구현은 순차 다운로드입니다. 여러 방법을 자동으로 시도하여 안정성을 보장합니다.
              </span>
            </label>

            <label className="text-xs text-neutral-700 flex flex-col gap-1 min-w-0">
              상위 키워드만 사용
              <input
                type="number"
                min={1}
                max={300}
                value={maxKeywordsToUse}
                onChange={(e) => setMaxKeywordsToUse(Math.max(1, Math.min(300, +e.target.value || 30)))}
                className="h-9 px-3 rounded-lg border border-neutral-200 text-sm text-neutral-900 bg-white w-full"
                disabled={busy}
              />
              <span className="text-[11px] text-neutral-500 break-words">긴 대본일 때 과도한 호출을 방지합니다.</span>
            </label>
          </div>

          {/* 액션 */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={handleRun}
              className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 disabled:opacity-60"
              disabled={busy}
              title="키워드가 없으면 SRT에서 자동 추출 후 캔바에서 영상 다운로드"
            >
              {busy ? "Canva 세션 기반 다운로드 실행 중…" : "Canva 세션 기반 다운로드 시작"}
            </button>
            <button
              onClick={handleStop}
              className="h-9 px-3 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-500 disabled:opacity-60"
              disabled={busy}
              title="진행 중인 자동화를 중지 요청합니다."
            >
              중지
            </button>
            {msg && <div className="text-[12px] text-neutral-700">{msg}</div>}
          </div>

          <div className="mt-2 text-[12px] text-neutral-600">
            예상 다운로드: <b>{Math.min(keywords.length || maxKeywordsToUse, maxKeywordsToUse) * perKeyword}</b>개
          </div>
        </SectionCard>

        {/* 진행/키워드 표시 */}
        <SectionCard
          className="h-full"
          title="진행 상황"
          right={
            <span className="text-xs text-neutral-500">
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-neutral-700 mb-2 shrink-0">
              <span className="text-lg font-semibold text-emerald-600">
                {progress.saved}/{progress.total || 0}
              </span>
              <span>
                다운로드 완료 <b>{progress.saved}</b>개
              </span>
              {progress.skipped > 0 && (
                <span>
                  패스 <b>{progress.skipped}</b>개
                </span>
              )}
              <span className="text-neutral-500">
                {Math.round(((progress.saved + progress.skipped) / (progress.total || 1)) * 100)}% 완료
              </span>
              {extractMs > 0 && <span className="text-neutral-500">추출 {formatMs(extractMs)}</span>}
              {runMs > 0 && <span className="text-neutral-500">소요 {formatMs(runMs)}</span>}
            </div>

            {/* 진행바 */}
            <div
              className={`relative h-1.5 w-full rounded ${
                isDone ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-neutral-100"
              } overflow-hidden mb-3 shrink-0 transition-colors`}
            >
              <div className="h-1.5 bg-emerald-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
            </div>

            {/* 키워드 칩 */}
            <div className="mb-2 text-xs text-neutral-700 shrink-0">키워드 {keywordDisplay.length}개</div>

            {/* 키워드 영역 */}
            <div className="flex-1 min-h-[240px]">
              <div className="h-full w-full rounded-lg border bg-white p-2 overflow-auto">
                {keywordDisplay.length ? (
                  <div className="flex flex-wrap gap-2">
                    {keywordDisplay.map((k) => {
                      const st = progress.rows?.[k]?.status;
                      let klass = "bg-neutral-100 text-neutral-700";
                      if (st) {
                        if (st.includes("완료") || st.includes("저장")) klass = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                        else if (st.includes("결과 없음")) klass = "bg-neutral-100 text-neutral-500 border border-neutral-200";
                        else if (st.includes("검색") || st.includes("다운로드") || st.includes("저장 중") || st.includes("재시도"))
                          klass = "bg-indigo-50 text-indigo-700 border border-indigo-100";
                        else if (st.includes("오류")) klass = "bg-rose-50 text-rose-700 border border-rose-100";
                      }
                      return (
                        <span key={k} title={st || ""} className={`px-2 py-1 rounded-lg text-[12px] ${klass} max-w-[12rem] truncate`}>
                          #{k}
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 text-[12px] text-neutral-600">아직 실행된 작업이 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
