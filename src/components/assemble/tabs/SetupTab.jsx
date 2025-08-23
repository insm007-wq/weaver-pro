import { useEffect, useMemo, useState } from "react";
import SectionCard from "../parts/SectionCard";

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={`w-10 h-6 rounded-full transition ${checked ? "bg-blue-600" : "bg-slate-300"} relative`}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

/** 파일명만 표시 + 경로 보기/복사 컨트롤. path 없으면 '미선택' */
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
        <div className={`truncate ${path ? "text-slate-600" : "text-slate-400"}`}>{fileName || "미선택"}</div>
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

      {showFull && path && <div className="col-span-3 text-[11px] text-slate-400 break-all mt-0.5">{path}</div>}
    </div>
  );
}

export default function SetupTab({ srtConnected, mp3Connected, setSrtConnected, setMp3Connected, autoMatch, setAutoMatch, autoOpts, setAutoOpts }) {
  // 경로는 Settings에 영구 저장/복원 → 탭 왔다갔다 해도 유지
  const [srtPath, setSrtPath] = useState(null);
  const [mp3Path, setMp3Path] = useState(null);
  const [showFullSrt, setShowFullSrt] = useState(false);
  const [showFullMp3, setShowFullMp3] = useState(false);

  // ✅ Canva 로그인/토큰 상태
  const [canvaBusy, setCanvaBusy] = useState(false);
  const [canvaMsg, setCanvaMsg] = useState("");
  const [canvaToken, setCanvaToken] = useState(null); // { access_token, expires_in, refresh_token, ... }
  const [canvaLoggedAt, setCanvaLoggedAt] = useState(null); // Date.now()

  const tokenPeek = useMemo(() => (canvaToken?.access_token ? canvaToken.access_token.slice(0, 12) + "…" : ""), [canvaToken]);

  const minutesLeft = useMemo(() => {
    if (!canvaToken?.expires_in || !canvaLoggedAt) return null;
    const msLeft = canvaLoggedAt + canvaToken.expires_in * 1000 - Date.now();
    return Math.max(0, Math.floor(msLeft / 60000));
  }, [canvaToken, canvaLoggedAt]);

  // 최초 로드 시 Settings에서 복원
  useEffect(() => {
    (async () => {
      try {
        const srt = await window.api.getSetting?.("paths.srt");
        const mp3 = await window.api.getSetting?.("paths.mp3");
        if (srt) {
          setSrtPath(srt);
          setSrtConnected?.(true);
        }
        if (mp3) {
          setMp3Path(mp3);
          setMp3Connected?.(true);
        }

        // Canva 토큰 복원
        const rawToken = await window.api.getSetting?.("canva.token");
        const rawAt = await window.api.getSetting?.("canva.loggedAt");
        if (rawToken) {
          try {
            const parsed = typeof rawToken === "string" ? JSON.parse(rawToken) : rawToken;
            setCanvaToken(parsed);
            setCanvaLoggedAt(Number(rawAt) || Date.now());
            setCanvaMsg("이전에 로그인된 Canva 세션이 감지되었습니다.");
          } catch {
            // ignore
          }
        }
      } catch (e) {
        console.warn("초기 설정 복원 실패:", e);
      }
    })();
  }, [setMp3Connected, setSrtConnected]);

  const handlePickSrt = async () => {
    try {
      const res = await window.api?.selectSrt?.();
      if (!res || res.canceled) return;
      setSrtPath(res.filePath);
      setSrtConnected?.(true);
      setShowFullSrt(false);
      await window.api.setSetting?.({ key: "paths.srt", value: res.filePath });
    } catch (e) {
      console.error(e);
      alert("SRT 선택 중 오류가 발생했습니다.");
    }
  };

  const handlePickMp3 = async () => {
    try {
      const res = await window.api?.selectMp3?.();
      if (!res || res.canceled) return;
      setMp3Path(res.filePath);
      setMp3Connected?.(true);
      setShowFullMp3(false);
      await window.api.setSetting?.({ key: "paths.mp3", value: res.filePath });
    } catch (e) {
      console.error(e);
      alert("오디오(MP3) 선택 중 오류가 발생했습니다.");
    }
  };

  /* ---------------------------- Canva: 로그인/해제 ---------------------------- */
  const handleCanvaLogin = async () => {
    if (!window.api?.canva?.login) {
      alert("Canva IPC가 초기화되지 않았습니다. preload/main 등록을 확인하세요.");
      return;
    }
    setCanvaBusy(true);
    setCanvaMsg("캔바 로그인 중…");
    try {
      // { access_token, refresh_token, expires_in, ... }
      const token = await window.api.canva.login();
      setCanvaToken(token);
      const loggedAt = Date.now();
      setCanvaLoggedAt(loggedAt);

      // 영구 저장(앱 재시작 유지)
      await window.api.setSetting?.({
        key: "canva.token",
        value: JSON.stringify(token),
      });
      await window.api.setSetting?.({
        key: "canva.loggedAt",
        value: String(loggedAt),
      });

      setCanvaMsg("로그인 성공! Export/Assets API 사용 가능");
    } catch (e) {
      console.error(e);
      setCanvaMsg("로그인 실패: " + (e?.message || e));
    } finally {
      setCanvaBusy(false);
    }
  };

  const handleCanvaLogout = async () => {
    // 로컬 저장만 비움 (Canva 세션 완전 종료는 브라우저/캔바에서 처리)
    setCanvaToken(null);
    setCanvaLoggedAt(null);
    await window.api.setSetting?.({ key: "canva.token", value: "" });
    await window.api.setSetting?.({ key: "canva.loggedAt", value: "" });
    setCanvaMsg("로컬 토큰을 삭제했습니다.");
  };

  const copyAccessToken = async () => {
    try {
      if (!canvaToken?.access_token) return;
      await navigator.clipboard.writeText(canvaToken.access_token);
      alert("access_token 복사 완료");
    } catch {
      alert("복사 실패");
    }
  };

  /* --------------------------------- 렌더 --------------------------------- */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ✅ Canva 연결 섹션 */}
      <SectionCard title="Canva 연결" right={<span className="text-xs text-slate-500">OAuth (PKCE)</span>}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCanvaLogin}
              disabled={canvaBusy}
              className="h-10 px-4 rounded-lg text-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              title="Canva 로그인"
            >
              {canvaBusy ? "로그인 중…" : "캔바 로그인"}
            </button>

            <button
              onClick={handleCanvaLogout}
              disabled={canvaBusy || !canvaToken?.access_token}
              className="h-10 px-4 rounded-lg text-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
              title="로컬 토큰 삭제"
            >
              토큰 삭제
            </button>

            <span className="text-xs text-slate-500">
              {canvaToken?.access_token ? (
                <>
                  로그인됨 <span className="mx-1">•</span> token {tokenPeek}
                  {typeof minutesLeft === "number" && <span> (만료까지 약 {minutesLeft}분)</span>}
                </>
              ) : (
                "로그인 필요"
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAccessToken}
              disabled={!canvaToken?.access_token}
              className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-xs"
              title="access_token 복사"
            >
              access_token 복사
            </button>
            <span className="text-[12px] text-slate-500">
              스코프: <code>design:content:read</code>, <code>asset:write</code>, <code>profile:read</code>
            </span>
          </div>

          {canvaMsg && <div className="text-[12px] text-slate-600">{canvaMsg}</div>}
        </div>
      </SectionCard>

      {/* 자막 / 오디오 연결 */}
      <SectionCard title="자막 / 오디오 연결" right={<span className="text-xs text-slate-500">프로젝트 준비</span>}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePickSrt}
              className={`h-10 px-4 rounded-lg text-sm border ${
                srtConnected ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              title={srtConnected ? "SRT 연결됨" : "SRT 파일 선택"}
            >
              {srtConnected ? "SRT 연결됨" : "SRT 연결"}
            </button>

            <button
              onClick={handlePickMp3}
              className={`h-10 px-4 rounded-lg text-sm border ${
                mp3Connected ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              title={mp3Connected ? "오디오 연결됨" : "MP3 파일 선택"}
            >
              {mp3Connected ? "오디오 연결됨" : "오디오 연결(MP3)"}
            </button>
          </div>

          {/* 항상 두 줄 렌더 → 레이아웃 흔들림 방지 */}
          <div className="space-y-1">
            <FileRow icon="📜" label="SRT:" path={srtPath} showFull={showFullSrt} onToggleFull={() => setShowFullSrt((v) => !v)} />
            <FileRow icon="🎧" label="MP3:" path={mp3Path} showFull={showFullMp3} onToggleFull={() => setShowFullMp3((v) => !v)} />
          </div>
        </div>
      </SectionCard>

      {/* 자동 매칭 */}
      <SectionCard title="자동 매칭" right={<span className="text-xs text-slate-500">신규 에셋 자동 배치</span>}>
        <div className="flex flex-col gap-4">
          <Toggle checked={autoMatch} onChange={setAutoMatch} label="자동 매칭 ON/OFF" />
          <div className="grid grid-cols-2 gap-3">
            {[
              ["emptyOnly", "빈 씬만 채우기"],
              ["byKeywords", "키워드 매칭 사용"],
              ["byOrder", "순차 배치 사용"],
              ["overwrite", "덮어쓰기 허용"],
            ].map(([k, label]) => (
              <Toggle key={k} checked={!!autoOpts[k]} onChange={(v) => setAutoOpts((s) => ({ ...s, [k]: v }))} label={label} />
            ))}
          </div>
          <div className="text-[12px] text-slate-500">새로 다운로드된 에셋을 감지하면 규칙에 따라 빈 씬부터 자동 배치합니다. 실패 시 자동으로 OFF 됩니다.</div>
        </div>
      </SectionCard>
    </div>
  );
}
