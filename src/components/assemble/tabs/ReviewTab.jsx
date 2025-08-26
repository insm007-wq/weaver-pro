// src/components/assemble/tabs/ReviewTab.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [activeIdx, setActiveIdx] = useState(
    Number.isFinite(selectedSceneIdx) ? selectedSceneIdx : 0
  );
  const [playing, setPlaying] = useState(false);

  const total = useMemo(
    () => (scenes.length ? scenes[scenes.length - 1].end : 0),
    [scenes]
  );

  // mp3 로드
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

  // 오디오 이벤트
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
    if (!scenes.length) return setActiveIdx(0);
    let idx = scenes.findIndex((s) => now >= s.start && now < s.end);
    if (idx < 0) idx = scenes.length - 1;
    setActiveIdx(idx);
  }, [now, scenes]);

  // activeIdx → 비디오 소스
  useEffect(() => {
    (async () => {
      const sc = scenes[activeIdx];
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
  }, [activeIdx, scenes]);

  // 컨트롤러
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seek = (sec) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = clamp(sec, 0, total || 0);
    a.play().catch(() => {});
  };
  const step = (delta) => seek((audioRef.current?.currentTime || 0) + delta);
  const jumpToScene = (i) => scenes[i] && seek(scenes[i].start + 0.01);
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
    scenes.filter((s) => !!s?.asset?.path || !!s?.asset?.url).length
  }/${scenes.length}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 좌측: 미리보기 + 컨트롤 */}
      <SectionCard
        title="미리보기"
        right={<div className="text-xs text-slate-500">{status}</div>}
        className="lg:col-span-2"
        bodyClass="space-y-3"
      >
        <div className="relative aspect-video w-full bg-black border border-slate-200 rounded-lg overflow-hidden">
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
            text={scenes[activeIdx]?.text || ""}
            options={styleOpt}
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
                jumpToScene(Math.min(scenes.length - 1, activeIdx + 1))
              }
              disabled={!mp3Url || !total}
            >
              다음 씬
            </button>
          </div>
        </div>

        <audio ref={audioRef} src={mp3Url || undefined} />
      </SectionCard>

      {/* 우측: sticky 사이드 – 미리보기 높이 제한 + 설정 */}
      <div className="space-y-4 lg:sticky lg:top-4">
        <SectionCard title="자막 미리보기" bodyClass="p-0">
          <SubtitlePreview
            embedded
            scenes={scenes}
            activeIndex={activeIdx}
            onJump={(i) => jumpToScene(i)}
            maxHeight={280} // <- 여기 숫자를 240~320 사이로 취향에 맞게 조절
          />
        </SectionCard>

        <SubtitleControls value={styleOpt} onChange={setStyleOpt} />
      </div>
    </div>
  );
}
