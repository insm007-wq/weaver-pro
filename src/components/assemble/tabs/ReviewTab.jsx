// src/components/assemble/tabs/ReviewTab.jsx
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import SectionCard from "../parts/SectionCard";
import SubtitlePreview from "../parts/SubtitlePreview";
import SubtitleOverlay from "../parts/SubtitleOverlay";
import SubtitleControls, { PRESETS } from "../parts/SubtitleControls";

/* ================= Fullscreen helper (컨테이너 기준) ================= */
function useFullscreen() {
  const [isFs, setIsFs] = useState(false);

  const getFsEl = () =>
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement;

  const enter = (el) =>
    (
      el?.requestFullscreen ||
      el?.webkitRequestFullscreen ||
      el?.mozRequestFullScreen ||
      el?.msRequestFullscreen
    )?.call(el);

  const exit = () =>
    (
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen
    )?.call(document);

  const toggle = (el) => (getFsEl() ? exit() : enter(el));

  useEffect(() => {
    const onChange = () => setIsFs(!!getFsEl());
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    document.addEventListener("mozfullscreenchange", onChange);
    document.addEventListener("MSFullscreenChange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
      document.removeEventListener("mozfullscreenchange", onChange);
      document.removeEventListener("MSFullscreenChange", onChange);
    };
  }, []);

  return { isFs, toggle, exit };
}

/* =============================== Component =============================== */
export default function ReviewTab({
  scenes = [],
  selectedSceneIdx = 0,
  srtConnected = false,
  mp3Connected = false,
}) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const previewRef = useRef(null); // 전체 화면 컨테이너
  const fs = useFullscreen();

  const [styleOpt, setStyleOpt] = useState(PRESETS.ytCompact);
  const [mp3Url, setMp3Url] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false); // 오디오 상태에 동기

  // 레이아웃 기준 refs
  const leftColRef = useRef(null);
  const leftBottomRef = useRef(null);
  const rightWrapRef = useRef(null);
  const rightBodyRef = useRef(null);
  const [rightInnerH, setRightInnerH] = useState(260);

  // ===== 가시성/탭 이동 감지로 "떠나면 멈추고, 돌아와도 멈춤" 보장 =====
  const pauseBoth = () => {
    try {
      audioRef.current?.pause();
    } catch {}
    try {
      videoRef.current?.pause();
    } catch {}
  };

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) pauseBoth(); // 떠날 때 멈춤
      else pauseBoth(); // 돌아와도 자동재생 금지(멈춘 채 대기)
    };
    const onBlur = () => pauseBoth();

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);

    let io;
    if (previewRef.current) {
      io = new IntersectionObserver(
        ([ent]) => {
          if (!ent || !ent.isIntersecting)
            pauseBoth(); // 화면에서 사라지면 멈춤
          else pauseBoth(); // 다시 보여져도 멈춤 유지
        },
        { threshold: 0.01 }
      );
      io.observe(previewRef.current);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      io?.disconnect();
      pauseBoth();
    };
  }, []);

  // 오른쪽 리스트의 "실 사용 가능 높이"
  useLayoutEffect(() => {
    const calc = () => {
      if (!leftBottomRef.current || !rightBodyRef.current) return;
      const fudge = 6;
      const leftBottom = leftBottomRef.current.getBoundingClientRect().bottom;
      const bodyTop = rightBodyRef.current.getBoundingClientRect().top;
      const byLeft = leftBottom - bodyTop - fudge;
      const byViewport = window.innerHeight - bodyTop - 16;
      const h = Math.max(200, Math.min(byLeft, byViewport));
      if (Number.isFinite(h)) setRightInnerH(h);
    };
    const roL = new ResizeObserver(calc);
    const roR = new ResizeObserver(calc);
    leftColRef.current && roL.observe(leftColRef.current);
    rightWrapRef.current && roR.observe(rightWrapRef.current);
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("scroll", calc, { passive: true });
    return () => {
      roL.disconnect();
      roR.disconnect();
      window.removeEventListener("resize", calc);
      window.removeEventListener("scroll", calc);
    };
  }, []);

  // ===== 씬 정제 =====
  const uniqScenes = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of scenes || []) {
      const start = Number(s.start) || 0;
      const end = Number(s.end) || 0;
      const text = String(s.text || "").trim();
      if (!(end > start) || !text) continue;
      const key = `${start}|${end}|${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...s, start, end, text });
    }
    return out.length ? out : scenes;
  }, [scenes]);

  const [activeIdx, setActiveIdx] = useState(
    Number.isFinite(selectedSceneIdx) ? selectedSceneIdx : 0
  );
  const total = useMemo(
    () => (uniqScenes.length ? uniqScenes[uniqScenes.length - 1].end : 0),
    [uniqScenes]
  );

  // MP3 로드
  useEffect(() => {
    (async () => {
      try {
        const mp3Path = await window.api.getSetting?.("paths.mp3");
        if (!mp3Path) return setMp3Url(null);
        const url = await window.api.videoPathToUrl(mp3Path);
        setMp3Url(url || null);
      } catch {
        setMp3Url(null);
      }
    })();
  }, [mp3Connected]);

  // 오디오 이벤트 + tick (자동재생 제거!)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onTime = () => setNow(a.currentTime || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setNow(total);
      setPlaying(false);
    };

    // 🔴 자동 재생을 시도하지 않는다 (돌아왔을 때 멈춘 채 대기)
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    let raf = 0;
    const tick = () => {
      setNow(a.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      cancelAnimationFrame(raf);
    };
  }, [mp3Url, total]);

  // now → activeIdx
  useEffect(() => {
    if (!uniqScenes.length) return setActiveIdx(0);
    let idx = uniqScenes.findIndex((s) => now >= s.start && now < s.end);
    if (idx < 0) idx = uniqScenes.length - 1;
    setActiveIdx(idx);
  }, [now, uniqScenes]);

  // activeIdx → 비디오 소스
  useEffect(() => {
    (async () => {
      const sc = uniqScenes[activeIdx];
      if (!sc) return setVideoUrl(null);
      const p = sc?.asset?.url || sc?.asset?.path;
      if (!p) return setVideoUrl(null);
      let u = p;
      if (!/^((blob|data|https?):)/i.test(String(p))) {
        try {
          u = await window.api.videoPathToUrl(p);
        } catch {
          u = null;
        }
      }
      setVideoUrl(u || null);
    })();
  }, [activeIdx, uniqScenes]);

  // 씬 변경 시 비디오 0초로 리셋하되, 재생은 "playing" 상태에 따라
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = 0;
      if (playing) v.play().catch(() => {});
      else v.pause();
    } catch {}
  }, [activeIdx, videoUrl, playing]);

  // 오디오 상태(playing)에 비디오 재생을 동기화
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  // 컨트롤
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seek = (sec) => {
    const a = audioRef.current;
    if (!a) return;
    const wasPlaying = !a.paused; // 이전 상태 기억
    a.currentTime = clamp(sec, 0, total || 0);
    if (wasPlaying) a.play().catch(() => {});
    else a.pause();
  };
  const step = (d) => seek((audioRef.current?.currentTime || 0) + d);
  const jumpToScene = (i) => uniqScenes[i] && seek(uniqScenes[i].start + 0.01);
  const onPlayPause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const status = `자막: ${srtConnected ? "연결" : "미연결"} · 오디오: ${
    mp3Url ? "연결" : "미연결"
  } · 소스 있는 씬 ${
    uniqScenes.filter((s) => !!s?.asset?.path || !!s?.asset?.url).length
  }/${uniqScenes.length}`;

  // 자막 오버레이(기존 프리셋 약간 키움 유지)
  const overlayOpt = useMemo(() => {
    const base = styleOpt || {};
    const fs = Math.round((base.fontSize || 28) * 1.12);
    const lh = base.lineHeight ? Math.round(base.lineHeight * 1.12) : undefined;
    const padV = base.paddingV ? Math.round(base.paddingV * 1.05) : undefined;
    const padH = base.paddingH ? Math.round(base.paddingH * 1.05) : undefined;
    return {
      ...base,
      fontSize: fs,
      ...(lh ? { lineHeight: lh } : {}),
      ...(padV ? { paddingV: padV } : {}),
      ...(padH ? { paddingH: padH } : {}),
    };
  }, [styleOpt]);

  // 핫키: Space 토글, F 전체화면, Esc 종료
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      const key = e.key?.toLowerCase?.();
      if (key === " ") {
        e.preventDefault();
        onPlayPause();
      }
      if (key === "f") fs.toggle(previewRef.current);
      if (e.key === "Escape") fs.exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ⬅ 왼쪽: 미리보기 + 자막 설정 */}
      <div ref={leftColRef} className="lg:col-span-2 space-y-4">
        <SectionCard
          title="미리보기"
          right={<div className="text-xs text-slate-500">{status}</div>}
          bodyClass="space-y-3"
        >
          <div
            ref={previewRef}
            className="relative aspect-video w-full bg-black border border-slate-200 rounded-lg overflow-hidden"
            style={{ maxHeight: "56vh", cursor: "default" }}
            onDoubleClick={() => fs.toggle(previewRef.current)} // 더블클릭 전체 화면
            title="더블클릭/F: 전체 화면 · Esc: 종료 · Space: 재생/일시정지"
          >
            {videoUrl ? (
              <video
                key={videoUrl}
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full"
                style={{ objectFit: "cover" }}
                muted
                loop
                playsInline
                // 🔴 자동재생 금지: 사용자가 재생 누를 때만 시작
                autoPlay={false}
                controls={false}
                controlsList="nofullscreen"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                (에셋이 없으면) 배경 에셋을 추가하세요
              </div>
            )}

            {/* 자막 오버레이(컨테이너 FS에서도 함께 보임) */}
            <SubtitleOverlay
              text={uniqScenes[activeIdx]?.text || ""}
              options={overlayOpt}
            />

            {/* 중앙 오버레이 플레이 버튼: 멈춤 상태에서만 노출 */}
            {!playing && (
              <button
                type="button"
                onClick={onPlayPause}
                className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center backdrop-blur-sm"
                aria-label="재생"
                title="재생 (Space)"
              >
                ▶
              </button>
            )}

            {/* 우상단 전체 화면 토글 버튼 */}
            <button
              type="button"
              onClick={() => fs.toggle(previewRef.current)}
              className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-md bg-black/45 hover:bg-black/60 text-white"
              title="전체 화면 (더블클릭/F 키)"
            >
              ⛶
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              상태: {playing ? "재생" : "대기"} · {fmt(now)} / {fmt(total)}
            </div>

            <div className="flex gap-2">
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={() => step(-5)}
                disabled={!mp3Url || !total}
              >
                -5s
              </button>
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={onPlayPause}
                disabled={!mp3Url || !total}
              >
                {playing ? "일시정지" : "재생"}
              </button>
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={() => step(+5)}
                disabled={!mp3Url || !total}
              >
                +5s
              </button>
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={() => jumpToScene(Math.max(0, activeIdx - 1))}
                disabled={!mp3Url || !total}
              >
                이전 씬
              </button>
              <button
                className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
                onClick={() =>
                  jumpToScene(Math.min(uniqScenes.length - 1, activeIdx + 1))
                }
                disabled={!mp3Url || !total}
              >
                다음 씬
              </button>
            </div>
          </div>

          <audio ref={audioRef} src={mp3Url || undefined} preload="auto" />
        </SectionCard>

        {/* 왼쪽 '자막 설정' 카드 밑변 측정용 */}
        <div ref={leftBottomRef}>
          <SubtitleControls value={styleOpt} onChange={setStyleOpt} />
        </div>
      </div>

      {/* ➡ 오른쪽: 자막 미리보기(왼쪽 밑변에 맞춤) */}
      <div ref={rightWrapRef} className="lg:sticky lg:top-4 min-h-0">
        <SectionCard
          title="자막 미리보기"
          className="flex flex-col min-h-[200px]"
          bodyClass="flex-1 p-0 flex flex-col min-h-0"
        >
          <div ref={rightBodyRef} className="flex-1 min-h-0">
            <SubtitlePreview
              embedded
              scenes={uniqScenes}
              activeIndex={activeIdx}
              onJump={(i) => jumpToScene(i)}
              maxHeight={rightInnerH}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
