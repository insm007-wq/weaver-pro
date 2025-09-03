// src/components/assemble/tabs/ReviewTab.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import SubtitlePreview from "../parts/SubtitlePreview";
import SubtitleControls, { PRESETS } from "../parts/SubtitleControls";

import useFullscreen from "../../../hooks/useFullscreen";
import useAutoHeight from "../../../hooks/useAutoHeight";
import { splitSceneToCues } from "../../../utils/subtitle";
import { fmtMmSs } from "../../../utils/time";

/* ---------- style helpers: 위치/색상/형태/폰트 옵션을 실제 오버레이에 반영 ---------- */
const hexToRgba = (hex = "#000000", alpha = 0.45) => {
  const m = String(hex).replace("#", "");
  const n =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  const a = Math.min(1, Math.max(0, Number(alpha)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

const getSubtitleAnchorStyle = (opt = {}) => {
  const safe = Math.max(0, Number(opt.safeMarginPct ?? opt.safeMargin ?? 5));
  const vAlign = opt.vAlign || "bottom"; // 'top' | 'middle' | 'bottom'
  const yPct = Math.max(0, Number(opt.vOffsetPct ?? opt.verticalOffsetPct ?? opt.vOffset ?? 8));
  const style = { position: "absolute", left: `${safe}%`, right: `${safe}%` };
  if (vAlign === "top") return { ...style, top: `calc(${safe}% + ${yPct}%)` };
  if (vAlign === "middle") return { ...style, top: `calc(50% + ${yPct}%)`, transform: "translateY(-50%)" };
  return { ...style, bottom: `calc(${safe}% + ${yPct}%)` }; // default bottom
};

const getSubtitleBoxStyle = (opt = {}) => {
  const widthPct = Math.min(100, Math.max(40, Number(opt.widthPct ?? 95)));
  const txtColor = opt.textColor ?? "#ffffff";
  const bgHex = opt.bgColor ?? "#000000";
  const bgAlpha = Number(opt.bgAlpha ?? 0.45);
  const outline = opt.outlineOn ?? true ? "0 1px 2px rgba(0,0,0,.9)" : "none";

  const base = {
    maxWidth: `${widthPct}%`,
    color: txtColor,
    textShadow: outline,
    fontSize: `${Number(opt.fontSizePx ?? 24)}px`,
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: Number(opt.rows ?? 2),
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  // 배경형태
  if (String(opt.boxStyle) === "none") {
    return {
      ...base,
      backgroundColor: "transparent",
      backdropFilter: "none",
    };
  }
  return {
    ...base,
    backgroundColor: hexToRgba(bgHex, isNaN(bgAlpha) ? 0.45 : bgAlpha),
    backdropFilter: "blur(6px)",
  };
};

const getSubtitleShapeClass = (opt = {}) => {
  const box = String(opt.boxStyle || "box");
  if (box === "pill") return "rounded-full shadow-lg";
  if (box === "none") return ""; // no rounded/shadow
  return "rounded-2xl shadow-lg";
};
/* ------------------------------------------------------------------------ */

export default function ReviewTab({ scenes = [], selectedSceneIdx = 0, srtConnected = false, mp3Connected = false }) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const previewRef = useRef(null);

  const leftColRef = useRef(null);
  const leftBottomRef = useRef(null);
  const rightWrapRef = useRef(null);
  const rightBodyRef = useRef(null);

  const fs = useFullscreen();
  const [rightInnerH, setRightInnerH] = useState(260);
  useAutoHeight({ leftBottomRef, rightBodyRef, rightWrapRef, onChange: setRightInnerH });

  // 자막 스타일(프리셋 + 사용자 변경 값)
  const [styleOpt, setStyleOpt] = useState(PRESETS.ytCompact);
  const [mp3Url, setMp3Url] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  // 진행/재생 상태
  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);

  // 미리보기 영역에서 벗어나면 자동 정지
  useEffect(() => {
    const pauseBoth = () => {
      try {
        audioRef.current?.pause();
      } catch {}
      try {
        videoRef.current?.pause();
      } catch {}
    };
    const onVis = () => pauseBoth();
    const onBlur = () => pauseBoth();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    let io;
    if (previewRef.current) {
      io = new IntersectionObserver(
        ([ent]) => {
          if (!ent?.isIntersecting) pauseBoth();
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

  // 씬 정제(중복 제거 + 시작순 정렬)
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
    out.sort((a, b) => a.start - b.start);
    return out.length ? out : scenes;
  }, [scenes]);

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

  // 오디오 이벤트 + RAF(재생 중에만 now 갱신)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setNow(Number(a.duration) || 0);
      setPlaying(false);
    };

    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);

    let raf = 0;
    const tick = () => {
      if (!a.paused) setNow(a.currentTime || 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      cancelAnimationFrame(raf);
    };
  }, [mp3Url]);

  // cue 생성 (원본 타임라인 기준)
  const cuesForPlayback = useMemo(() => {
    const arr = [];
    for (const sc of uniqScenes) {
      const cues = splitSceneToCues(sc, { minSegSec: 0.6, maxLineChars: 38 });
      if (cues.length) arr.push(...cues);
    }
    return arr;
  }, [uniqScenes]);

  // now → 활성 cue index
  const [activeIdx, setActiveIdx] = useState(Number.isFinite(selectedSceneIdx) ? selectedSceneIdx : 0);
  useEffect(() => {
    if (!cuesForPlayback.length) return setActiveIdx(0);
    const EPS = 0.08;
    const t = Math.max(0, now);
    let idx = cuesForPlayback.findIndex((s) => t >= s.start - EPS && t < s.end + EPS);
    if (idx >= 0) return setActiveIdx(idx);
    let last = -1;
    for (let i = 0; i < cuesForPlayback.length; i++) {
      if (t >= cuesForPlayback[i].start - EPS) last = i;
      else break;
    }
    setActiveIdx(last >= 0 ? last : 0);
  }, [now, cuesForPlayback]);

  // 활성 cue가 속한 씬의 비디오 URL
  useEffect(() => {
    (async () => {
      const cue = cuesForPlayback[activeIdx];
      if (!cue) return setVideoUrl(null);
      const sc = uniqScenes.find((s) => cue.start >= s.start && cue.start < s.end) || uniqScenes[0];
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
  }, [activeIdx, cuesForPlayback, uniqScenes]);

  // 씬 바뀌면 비디오 0초부터, 오디오 상태 따라 동기화
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = 0;
      if (playing) v.play().catch(() => {});
      else v.pause();
    } catch {}
  }, [videoUrl, playing]);

  // 컨트롤
  const totalLogic = cuesForPlayback.length ? cuesForPlayback[cuesForPlayback.length - 1].end : 0;

  const seek = (logicSec) => {
    const a = audioRef.current;
    if (!a) return;
    const dur = Number(a.duration) || totalLogic || 0;
    const clamped = Math.min(Math.max(0, logicSec), dur);
    const wasPlaying = !a.paused;
    a.currentTime = clamped;
    if (wasPlaying) a.play().catch(() => {});
    else a.pause();
  };
  const step = (d) => seek(now + d);
  const jumpToCue = (i) => cuesForPlayback[i] && seek(cuesForPlayback[i].start + 0.01);
  const onPlayPause = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };

  const status = `자막: ${srtConnected ? "연결" : "미연결"} · 오디오: ${mp3Url ? "연결" : "미연결"} · 문장 ${cuesForPlayback.length}개`;

  const currentText = cuesForPlayback[activeIdx]?.text || "";

  // 핫키
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const key = e.key?.toLowerCase?.();
      if (key === " ") {
        e.preventDefault();
        onPlayPause();
      }
      if (key === "f") fs.toggle(previewRef.current);
      if (e.key === "Escape") fs.exit();
      if (key === "arrowleft") step(-1);
      if (key === "arrowright") step(+1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fs, now]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ⬅ 왼쪽: 미리보기 + 자막 설정 */}
      <div ref={leftColRef} className="lg:col-span-2 space-y-4">
        <SectionCard title="미리보기" right={<div className="text-xs text-slate-500">{status}</div>} bodyClass="space-y-3">
          <div
            ref={previewRef}
            className="relative aspect-video w-full bg-black border border-slate-200 rounded-lg overflow-hidden"
            style={{ maxHeight: "56vh", cursor: "default" }}
            onDoubleClick={() => fs.toggle(previewRef.current)}
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
                autoPlay={false}
                controls={false}
                controlsList="nofullscreen"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500">(에셋이 없으면) 배경 에셋을 추가하세요</div>
            )}

            {/* 자막 오버레이 (위치/마진/폭/색상/형태/폰트 옵션 반영) */}
            <div className="pointer-events-none flex justify-center" style={getSubtitleAnchorStyle(styleOpt)}>
              <div
                className={`
                  px-4 sm:px-5 py-2.5 sm:py-3
                  text-center leading-snug
                  [word-break:keep-all] [overflow-wrap:anywhere]
                  ${getSubtitleShapeClass(styleOpt)}
                `}
                style={getSubtitleBoxStyle(styleOpt)}
              >
                {currentText}
              </div>
            </div>

            {/* 중앙 재생 버튼 */}
            {!playing && (
              <button
                type="button"
                onClick={onPlayPause}
                className="absolute inset-0 m-auto h-16 w-16 md:h-18 md:w-18 rounded-full bg-white/20 hover:bg-white/30 text-white grid place-items-center backdrop-blur-sm"
                aria-label="재생"
                title="재생 (Space)"
              >
                ▶
              </button>
            )}

            {/* 전체 화면 버튼 */}
            <button
              type="button"
              onClick={() => fs.toggle(previewRef.current)}
              className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-md bg-black/45 hover:bg-black/60 text-white"
              title="전체 화면 (더블클릭/F 키)"
            >
              ⛶
            </button>
          </div>

          {/* 컨트롤 */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              상태: {playing ? "재생" : "대기"} · {fmtMmSs(now)} /{" "}
              {fmtMmSs((audioRef.current && audioRef.current.duration) || totalLogic || 0)}
            </div>
            <div className="flex gap-2">
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={() => step(-5)}
                disabled={!mp3Url || !(audioRef.current?.duration || totalLogic)}
              >
                -5s
              </button>
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={onPlayPause}
                disabled={!mp3Url || !(audioRef.current?.duration || totalLogic)}
              >
                {playing ? "일시정지" : "재생"}
              </button>
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={() => step(+5)}
                disabled={!mp3Url || !(audioRef.current?.duration || totalLogic)}
              >
                +5s
              </button>
              <button
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                onClick={() => jumpToCue(Math.max(0, activeIdx - 1))}
                disabled={!mp3Url || !(audioRef.current?.duration || totalLogic)}
              >
                이전 문장
              </button>
              <button
                className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
                onClick={() => jumpToCue(Math.min(cuesForPlayback.length - 1, activeIdx + 1))}
                disabled={!mp3Url || !(audioRef.current?.duration || totalLogic)}
              >
                다음 문장
              </button>
            </div>
          </div>

          <audio ref={audioRef} src={mp3Url || undefined} preload="auto" />
        </SectionCard>

        <div ref={leftBottomRef}>
          <SubtitleControls value={styleOpt} onChange={setStyleOpt} />
        </div>
      </div>

      {/* ➡ 오른쪽: 자막 미리보기(문장 cue 기준) */}
      <div ref={rightWrapRef} className="lg:sticky lg:top-4 min-h-0">
        <SectionCard title="자막 미리보기" className="flex flex-col min-h-[200px]" bodyClass="flex-1 p-0 flex flex-col min-h-0">
          <div ref={rightBodyRef} className="flex-1 min-h-0">
            <SubtitlePreview
              embedded
              scenes={cuesForPlayback}
              activeIndex={activeIdx}
              onJump={(i) => jumpToCue(i)}
              maxHeight={rightInnerH}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
