// src/components/assemble/tabs/SetupTab.jsx
// ============================================================================
// 셋업 탭
// - SRT / MP3 선택, 경로 표시/복사
// - 자동 매칭 토글/옵션 저장 (즉시 저장)
// - ✅ 파일 이동/삭제 시 즉시 "해제" (watcher + 포커스 복귀 재검사)
// - 콘솔 로그로 상태 추적 (값 확인용)
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import SectionCard from "../parts/SectionCard";

/* -------------------------------------------------------------------------- */
/* 작은 컴포넌트들                                                             */
/* -------------------------------------------------------------------------- */

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={!!checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span
        className={`w-10 h-6 rounded-full transition relative ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

/** 파일명만 표시 + 경로 보기/복사 컨트롤. path 없으면 '미선택' */
function FileRow({ icon, label, path, showFull, onToggleFull }) {
  const fileName = path ? String(path).split(/[/\\]/).pop() : null;

  const copyPath = async () => {
    if (!path) return;
    try {
      await navigator.clipboard.writeText(path);
      alert("전체 경로가 클립보드에 복사되었습니다.");
    } catch {
      alert("복사에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  return (
    <div className="grid grid-cols-[84px,1fr,auto] items-center gap-2 text-xs w-full">
      <div className="inline-flex items-center gap-1 text-slate-700">
        <span aria-hidden>{icon}</span>
        <span className="font-medium">{label}</span>
      </div>

      <div className="w-full max-w-full overflow-hidden">
        <div
          className={`truncate ${path ? "text-slate-600" : "text-slate-400"}`}
        >
          {fileName || "미선택"}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          onClick={onToggleFull}
          disabled={!path}
          title={path ? "전체 경로 보기/숨기기" : "파일을 먼저 선택하세요"}
        >
          🔍
        </button>
        <button
          className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          onClick={copyPath}
          disabled={!path}
          title={path ? "전체 경로 복사" : "파일을 먼저 선택하세요"}
        >
          📋
        </button>
      </div>

      {showFull && path && (
        <div className="col-span-3 text-[11px] text-slate-400 break-all mt-0.5">
          {path}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 유틸                                                                       */
/* -------------------------------------------------------------------------- */

const DEFAULT_AUTO_OPTS = {
  emptyOnly: true,
  byKeywords: true,
  byOrder: true,
  overwrite: false,
};

const norm = (p) => (p ? String(p).replace(/\\/g, "/").toLowerCase() : "");

/** 안전 저장 헬퍼 */
const saveSetting = (key, value) =>
  window.api
    .setSetting?.({ key, value })
    .catch((e) => console.warn("[SetupTab] setSetting error:", e));

/** 경로 존재 확인 */
async function checkExists(p) {
  try {
    const res = await window.api.checkPathExists?.(p);
    return !!res?.exists;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* 메인 컴포넌트                                                              */
/* -------------------------------------------------------------------------- */

export default function SetupTab({
  srtConnected,
  mp3Connected,
  setSrtConnected,
  setMp3Connected,
  autoMatch,
  setAutoMatch,
  autoOpts,
  setAutoOpts,
}) {
  // 경로 / UI
  const [srtPath, setSrtPath] = useState(null);
  const [mp3Path, setMp3Path] = useState(null);
  const [showFullSrt, setShowFullSrt] = useState(false);
  const [showFullMp3, setShowFullMp3] = useState(false);

  /* ----------------------------- 초기 복원 ----------------------------- */
  useEffect(() => {
    (async () => {
      try {
        // paths
        const [srtSaved, mp3Saved] = await Promise.all([
          window.api.getSetting?.("paths.srt"),
          window.api.getSetting?.("paths.mp3"),
        ]);

        // 존재 확인
        const [srtOk, mp3Ok] = await Promise.all([
          srtSaved ? checkExists(srtSaved) : Promise.resolve(false),
          mp3Saved ? checkExists(mp3Saved) : Promise.resolve(false),
        ]);

        console.log("[SetupTab] restore", { srtSaved, srtOk, mp3Saved, mp3Ok });

        if (srtOk) {
          setSrtPath(srtSaved);
          setSrtConnected?.(true);
        } else {
          setSrtPath(null);
          setSrtConnected?.(false);
          if (srtSaved) await saveSetting("paths.srt", ""); // 깨끗이 정리
        }

        if (mp3Ok) {
          setMp3Path(mp3Saved);
          setMp3Connected?.(true);
        } else {
          setMp3Path(null);
          setMp3Connected?.(false);
          if (mp3Saved) await saveSetting("paths.mp3", "");
        }

        // auto-match
        const [am, ao] = await Promise.all([
          window.api.getSetting?.("autoMatch.enabled"),
          window.api.getSetting?.("autoMatch.options"),
        ]);

        if (typeof setAutoMatch === "function") {
          const on = am === true || am === "true" || am === 1 || am === "1";
          setAutoMatch(on);
        }
        if (typeof setAutoOpts === "function") {
          let parsed = {};
          try {
            parsed = typeof ao === "string" ? JSON.parse(ao || "{}") : ao || {};
          } catch {
            parsed = {};
          }
          setAutoOpts((s) => ({
            ...DEFAULT_AUTO_OPTS,
            ...(s || {}),
            ...parsed,
          }));
        }
      } catch (e) {
        console.warn("[SetupTab] 초기 설정 복원 실패:", e);
      }
    })();
  }, [setMp3Connected, setSrtConnected, setAutoMatch, setAutoOpts]);

  /* ------------------------ 자동 저장 (토글/옵션) ------------------------ */
  useEffect(() => {
    const t = setTimeout(() => {
      saveSetting("autoMatch.enabled", String(!!autoMatch));
      saveSetting("autoMatch.options", JSON.stringify(autoOpts || {}));
      console.log("[SetupTab] autosave", { autoMatch, autoOpts });
    }, 300);
    return () => clearTimeout(t);
  }, [autoMatch, autoOpts]);

  /* ------------------- 선택 핸들러 (SRT / MP3) ------------------- */
  const handlePickSrt = useCallback(async () => {
    try {
      const res = await window.api?.selectSrt?.();
      if (!res || res.canceled) return;
      setSrtPath(res.filePath);
      setSrtConnected?.(true);
      setShowFullSrt(false);
      await saveSetting("paths.srt", res.filePath);
      console.log("[SetupTab] SRT selected:", res.filePath);
    } catch (e) {
      console.error(e);
      alert("SRT 선택 중 오류가 발생했습니다.");
    }
  }, [setSrtConnected]);

  const handlePickMp3 = useCallback(async () => {
    try {
      const res = await window.api?.selectMp3?.();
      if (!res || res.canceled) return;
      setMp3Path(res.filePath);
      setMp3Connected?.(true);
      setShowFullMp3(false);
      await saveSetting("paths.mp3", res.filePath);
      console.log("[SetupTab] MP3 selected:", res.filePath);
    } catch (e) {
      console.error(e);
      alert("오디오(MP3) 선택 중 오류가 발생했습니다.");
    }
  }, [setMp3Connected]);

  /* ---------------- 파일 이동/삭제 감지: watcher + 포커스 재검사 -------------- */

  // 1) OS 파일 이벤트 (즉시 해제)
  useEffect(() => {
    // 중복 감시 방지 위해 고유 경로만
    const targets = [srtPath, mp3Path].filter(Boolean);
    if (targets.length === 0) return;

    const off = window.api.onPathMissing?.(({ path }) => {
      const p = norm(path);
      if (srtPath && norm(srtPath) === p) {
        console.log("[SetupTab] watcher: SRT missing", srtPath);
        setSrtPath(null);
        setSrtConnected?.(false);
        saveSetting("paths.srt", "");
      }
      if (mp3Path && norm(mp3Path) === p) {
        console.log("[SetupTab] watcher: MP3 missing", mp3Path);
        setMp3Path(null);
        setMp3Connected?.(false);
        saveSetting("paths.mp3", "");
      }
    });

    targets.forEach((p) => window.api.watchPath?.(p));
    console.log("[SetupTab] watch start:", targets);

    return () => {
      if (off) off();
      targets.forEach((p) => window.api.unwatchPath?.(p));
      console.log("[SetupTab] watch cleanup:", targets);
    };
  }, [srtPath, mp3Path, setSrtConnected, setMp3Connected]);

  // 2) 백업: 포커스 돌아오면 한 번 더 확인
  useEffect(() => {
    const onFocus = async () => {
      if (srtPath) {
        const ok = await checkExists(srtPath);
        if (!ok) {
          console.log("[SetupTab] focus check: SRT missing", srtPath);
          setSrtPath(null);
          setSrtConnected?.(false);
          saveSetting("paths.srt", "");
        }
      }
      if (mp3Path) {
        const ok = await checkExists(mp3Path);
        if (!ok) {
          console.log("[SetupTab] focus check: MP3 missing", mp3Path);
          setMp3Path(null);
          setMp3Connected?.(false);
          saveSetting("paths.mp3", "");
        }
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [srtPath, mp3Path, setSrtConnected, setMp3Connected]);

  /* ------------------------------- 렌더 -------------------------------- */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 자막 / 오디오 연결 */}
      <SectionCard
        title="자막 / 오디오 연결"
        right={<span className="text-xs text-slate-500">프로젝트 준비</span>}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePickSrt}
              className={`h-10 px-4 rounded-lg text-sm border ${
                srtConnected
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              title={srtConnected ? "SRT 연결됨" : "SRT 파일 선택"}
            >
              {srtConnected ? "SRT 연결됨" : "SRT 연결"}
            </button>

            <button
              onClick={handlePickMp3}
              className={`h-10 px-4 rounded-lg text-sm border ${
                mp3Connected
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              title={mp3Connected ? "오디오 연결됨" : "MP3 파일 선택"}
            >
              {mp3Connected ? "오디오 연결됨" : "오디오 연결(MP3)"}
            </button>
          </div>

          {/* 항상 두 줄 렌더 → 레이아웃 흔들림 방지 */}
          <div className="space-y-1">
            <FileRow
              icon="📜"
              label="SRT:"
              path={srtPath}
              showFull={showFullSrt}
              onToggleFull={() => setShowFullSrt((v) => !v)}
            />
            <FileRow
              icon="🎧"
              label="MP3:"
              path={mp3Path}
              showFull={showFullMp3}
              onToggleFull={() => setShowFullMp3((v) => !v)}
            />
          </div>
        </div>
      </SectionCard>

      {/* 자동 매칭 */}
      <SectionCard
        title="자동 매칭"
        right={
          <span className="text-xs text-slate-500">신규 에셋 자동 배치</span>
        }
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={!!autoMatch}
            onChange={setAutoMatch}
            label="자동 매칭 ON/OFF"
          />
          <div className="grid grid-cols-2 gap-3">
            {[
              ["emptyOnly", "빈 씬만 채우기"],
              ["byKeywords", "키워드 매칭 사용"],
              ["byOrder", "순차 배치 사용"],
              ["overwrite", "덮어쓰기 허용"],
            ].map(([k, label]) => (
              <Toggle
                key={k}
                checked={!!autoOpts?.[k]}
                onChange={(v) => setAutoOpts((s) => ({ ...(s || {}), [k]: v }))}
                label={label}
              />
            ))}
          </div>
          <div className="text-[12px] text-slate-500">
            새로 다운로드된 에셋을 감지하면 규칙에 따라 빈 씬부터 자동
            배치합니다. 실패 시 자동으로 OFF 됩니다.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
