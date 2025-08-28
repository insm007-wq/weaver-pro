// src/scriptgen/tabs/SetupTab.jsx
import { useEffect, useState } from "react";
import SectionCard from "../parts/SectionCard";
import useAutoMatch from "../../../hooks/useAutoMatch";

/* Toggle */
function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
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

/** 파일명만 표시 + 경로 보기/복사 */
function FileRow({ icon, label, path, showFull, onToggleFull }) {
  const fileName = path ? path.split(/[/\\]/).pop() : null;

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
          title={fileName || undefined}
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

const DEFAULT_AUTO_OPTS = {
  emptyOnly: true,
  byKeywords: true,
  byOrder: true,
  overwrite: false,
};

export default function SetupTab({
  srtConnected,
  mp3Connected,
  setSrtConnected,
  setMp3Connected,
}) {
  // 자동 매칭: 공용 훅
  const {
    enabled: autoMatch,
    setEnabled: setAutoMatch,
    options: autoOpts,
    setOption: setAutoOpt,
  } = useAutoMatch();

  // 자막/오디오 경로 저장/복원
  const [srtPath, setSrtPath] = useState(null);
  const [mp3Path, setMp3Path] = useState(null);
  const [showFullSrt, setShowFullSrt] = useState(false);
  const [showFullMp3, setShowFullMp3] = useState(false);

  const checkExists = async (p) => {
    try {
      const res = await window.api?.checkPathExists?.(p);
      return !!res?.exists;
    } catch {
      return false;
    }
  };

  // 최초 로드: settings에서 복원 + 실제 존재 검사
  useEffect(() => {
    (async () => {
      try {
        const srt = await window.api.getSetting?.("paths.srt");
        const mp3 = await window.api.getSetting?.("paths.mp3");

        if (srt && (await checkExists(srt))) {
          setSrtPath(srt);
          setSrtConnected?.(true);
        } else {
          setSrtPath(null);
          setSrtConnected?.(false);
          if (srt)
            await window.api.setSetting?.({ key: "paths.srt", value: "" });
        }

        if (mp3 && (await checkExists(mp3))) {
          setMp3Path(mp3);
          setMp3Connected?.(true);
        } else {
          setMp3Path(null);
          setMp3Connected?.(false);
          if (mp3)
            await window.api.setSetting?.({ key: "paths.mp3", value: "" });
        }
      } catch (e) {
        console.warn("초기 설정 복원 실패:", e);
      }
    })();
  }, [setMp3Connected, setSrtConnected]);

  // 주기적 유효성 확인 (삭제/이동 시 연결 해제)
  useEffect(() => {
    const t = setInterval(async () => {
      if (srtPath && !(await checkExists(srtPath))) {
        setSrtPath(null);
        setSrtConnected?.(false);
        await window.api.setSetting?.({ key: "paths.srt", value: "" });
      }
      if (mp3Path && !(await checkExists(mp3Path))) {
        setMp3Path(null);
        setMp3Connected?.(false);
        await window.api.setSetting?.({ key: "paths.mp3", value: "" });
      }
    }, 3000);
    return () => clearInterval(t);
  }, [srtPath, mp3Path, setMp3Connected, setSrtConnected]);

  // --- 선택 핸들러 (즉시 경고 제거: 선택값을 신뢰하고 저장) ---
  const handlePickSrt = async () => {
    try {
      const res = await window.api?.selectSrt?.();
      if (!res || res.canceled) return;
      const filePath =
        res.filePath ||
        (Array.isArray(res.filePaths) ? res.filePaths[0] : null);
      if (!filePath) return;

      // 존재 체크는 시도하되, 실패해도 경로를 우선 저장하고 주기 점검에서 끊음
      try {
        const chk = await window.api?.checkPathExists?.(filePath);
        if (chk && chk.exists === false) {
          console.warn("[SetupTab] exists:false but accepting path:", filePath);
        }
      } catch {}

      setSrtPath(filePath);
      setSrtConnected?.(true);
      setShowFullSrt(false);
      await window.api.setSetting?.({ key: "paths.srt", value: filePath });
    } catch (e) {
      console.error(e);
      alert("SRT 선택 중 오류가 발생했습니다.");
    }
  };

  const handlePickMp3 = async () => {
    try {
      const res = await window.api?.selectMp3?.();
      if (!res || res.canceled) return;
      const filePath =
        res.filePath ||
        (Array.isArray(res.filePaths) ? res.filePaths[0] : null);
      if (!filePath) return;

      try {
        const chk = await window.api?.checkPathExists?.(filePath);
        if (chk && chk.exists === false) {
          console.warn("[SetupTab] exists:false but accepting path:", filePath);
        }
      } catch {}

      setMp3Path(filePath);
      setMp3Connected?.(true);
      setShowFullMp3(false);
      await window.api.setSetting?.({ key: "paths.mp3", value: filePath });
    } catch (e) {
      console.error(e);
      alert("오디오(MP3) 선택 중 오류가 발생했습니다.");
    }
  };

  /* ------------------------------- 렌더 ------------------------------- */
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
                checked={!!(autoOpts?.[k] ?? DEFAULT_AUTO_OPTS[k])}
                onChange={(v) => setAutoOpt(k, v)}
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
