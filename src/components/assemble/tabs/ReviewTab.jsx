import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import SectionCard from "../parts/SectionCard";
import SubtitlePreview from "../parts/SubtitlePreview";
import SubtitleOverlay from "../parts/SubtitleOverlay";
import SubtitleControls, { PRESETS } from "../parts/SubtitleControls";

export default function ReviewTab({
  scenes = [],
  selectedSceneIdx = 0,
  srtConnected = false,
  mp3Connected = false,
}) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);

  const [styleOpt, setStyleOpt] = useState(PRESETS.ytCompact);
  const [mp3Url, setMp3Url] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);

  // 레이아웃 기준 refs
  const leftColRef = useRef(null); // 왼쪽 전체(미리보기+자막설정)
  const leftBottomRef = useRef(null); // '자막 설정' 카드의 바닥
  const rightWrapRef = useRef(null); // 오른쪽 카드 wrapper
  const rightBodyRef = useRef(null); // 오른쪽 카드에서 리스트가 시작되는 위치
  const [rightInnerH, setRightInnerH] = useState(260);

  // 오른쪽 리스트의 "실 사용 가능 높이" = min(왼쪽 밑변까지, 뷰포트 끝까지)
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

  // ===== 씬 중복 제거 =====
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

  // 오디오 이벤트 + tick
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

    const tryPlay = () => a.play().catch(() => {});
    a.muted = false;
    if (a.readyState >= 2) tryPlay();
    else a.addEventListener("canplay", tryPlay, { once: true });

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

  // 컨트롤
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seek = (sec) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = clamp(sec, 0, total || 0);
    a.play().catch(() => {});
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

  // 오버레이 살짝 키움
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
            className="relative aspect-video w-full bg-black border border-slate-200 rounded-lg overflow-hidden"
            style={{ maxHeight: "56vh" }}
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
                autoPlay
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">
                (에셋이 없으면) 배경 에셋을 추가하세요
              </div>
            )}

            <SubtitleOverlay
              text={uniqScenes[activeIdx]?.text || ""}
              options={overlayOpt}
            />
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

          <audio ref={audioRef} src={mp3Url || undefined} />
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
          {/* 리스트가 시작되는 정확한 위치 */}
          <div ref={rightBodyRef} className="flex-1 min-h-0">
            <SubtitlePreview
              embedded
              scenes={uniqScenes}
              activeIndex={activeIdx}
              onJump={(i) => jumpToScene(i)}
              // 숫자로 전달 → 내부에서 height/maxHeight 고정 → 확실히 스크롤 생성
              maxHeight={rightInnerH}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
