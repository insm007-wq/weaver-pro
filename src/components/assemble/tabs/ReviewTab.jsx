// src/tabs/ReviewTab.jsx
import { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import SectionCard from "../parts/SectionCard";
import SubtitlePreview from "../parts/SubtitlePreview";
import SubtitleOverlay from "../parts/SubtitleOverlay";
import SubtitleControls, { PRESETS } from "../parts/SubtitleControls";

/* ================= Fullscreen helper (컨테이너 기준) ================= */
function useFullscreen() {
  const [isFs, setIsFs] = useState(false);
  const getFsEl = () =>
    document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

  const enter = (el) =>
    (el?.requestFullscreen || el?.webkitRequestFullscreen || el?.mozRequestFullScreen || el?.msRequestFullscreen)?.call(el);

  const exit = () =>
    (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen)?.call(document);

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

/* ===================== 유틸: 텍스트 분절 & 길이 ===================== */
function normalizeForCount(s) {
  let t = String(s ?? "");
  try {
    t = t.normalize("NFC");
  } catch {}
  t = t.replace(/\r\n/g, "\n").replace(/[\u200B-\u200D\uFEFF]/g, "");
  return t;
}
function charCountKo(s) {
  return Array.from(normalizeForCount(s)).length;
}
const SENTENCE_RE = /([^.!?…]+[.!?…]+|\S+(?:\s+|$))/g;
function hardWrapByChars(text, maxChars = 38) {
  const arr = [];
  let t = normalizeForCount(text).trim();
  while (t.length > maxChars) {
    arr.push(t.slice(0, maxChars));
    t = t.slice(maxChars);
  }
  if (t) arr.push(t);
  return arr;
}
function splitSceneToCues(scene, opts = {}) {
  const start = Number(scene.start) || 0;
  const end = Number(scene.end) || 0;
  const dur = Math.max(0, end - start);
  const text = String(scene.text || "").trim();
  if (!dur || !text) return [];

  const MIN_SEG_SEC = Number(opts.minSegSec ?? 0.6);
  const MAX_LINE_CHARS = Number(opts.maxLineChars ?? 38);

  let parts = [];
  const m = text.match(SENTENCE_RE);
  if (m && m.length) {
    parts = m.map((s) => s.trim()).filter(Boolean);
  } else {
    parts = [text];
  }

  let refined = [];
  for (const p of parts) {
    if (charCountKo(p) > MAX_LINE_CHARS * 2) {
      refined = refined.concat(hardWrapByChars(p, MAX_LINE_CHARS));
    } else refined.push(p);
  }
  parts = refined.length ? refined : parts;

  const counts = parts.map(charCountKo);
  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  let alloc = counts.map((n) => Math.max(MIN_SEG_SEC, (dur * n) / sum));

  const total = alloc.reduce((a, b) => a + b, 0);
  const scale = total ? dur / total : 1;
  alloc = alloc.map((x) => x * scale);

  const cues = [];
  let t = start;
  for (let i = 0; i < parts.length; i++) {
    const st = t;
    const en = i === parts.length - 1 ? end : t + alloc[i];
    cues.push({ start: st, end: en, text: parts[i] });
    t = en;
  }
  return cues;
}

/* =============================== Component =============================== */
export default function ReviewTab({ scenes = [], selectedSceneIdx = 0, srtConnected = false, mp3Connected = false }) {
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const fs = useFullscreen();

  const [styleOpt, setStyleOpt] = useState(PRESETS.ytCompact);
  const [mp3Url, setMp3Url] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);

  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(false);

  // 싱크/스케일
  const [syncOffsetMs, setSyncOffsetMs] = useState(0); // 기본 0ms
  const [audioDur, setAudioDur] = useState(0);
  const [timeScale, setTimeScale] = useState(1);

  // 레이아웃 refs
  const leftColRef = useRef(null);
  const leftBottomRef = useRef(null);
  const rightWrapRef = useRef(null);
  const rightBodyRef = useRef(null);
  const [rightInnerH, setRightInnerH] = useState(260);

  const pauseBoth = () => {
    try {
      audioRef.current?.pause();
    } catch {}
    try {
      videoRef.current?.pause();
    } catch {}
  };

  useEffect(() => {
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

  // 오른쪽 리스트 높이 계산
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

  const plannedTotal = useMemo(() => (uniqScenes.length ? uniqScenes[uniqScenes.length - 1].end : 0), [uniqScenes]);

  // MP3 로드 & 길이 확보
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

  // 오디오 이벤트 + RAF로 now 갱신
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    const onLoaded = () => {
      const dur = Number(a.duration) || 0;
      setAudioDur(dur);
      if (plannedTotal > 0 && dur > 0) setTimeScale(dur / plannedTotal);
      else setTimeScale(1);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setNow(Number(a.duration) || 0);
      setPlaying(false);
    };

    a.addEventListener("loadedmetadata", onLoaded);
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
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      cancelAnimationFrame(raf);
    };
  }, [mp3Url, plannedTotal]);

  // 보정된 타임라인(오디오 길이에 맞춰 스케일)
  const scenesForPlayback = useMemo(() => {
    const scale = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1;
    return (uniqScenes || []).map((s) => ({
      ...s,
      start: s.start * scale,
      end: s.end * scale,
    }));
  }, [uniqScenes, timeScale]);

  // cue 생성
  const cuesForPlayback = useMemo(() => {
    const arr = [];
    for (const sc of scenesForPlayback) {
      const cues = splitSceneToCues(sc, { minSegSec: 0.6, maxLineChars: 38 });
      if (cues.length) arr.push(...cues);
    }
    return arr;
  }, [scenesForPlayback]);

  // now(+오프셋) → 활성 cue index (EPS 허용)
  const [activeIdx, setActiveIdx] = useState(Number.isFinite(selectedSceneIdx) ? selectedSceneIdx : 0);
  useEffect(() => {
    if (!cuesForPlayback.length) return setActiveIdx(0);
    const EPS = 0.08; // 80ms 관용치
    const t = Math.max(0, now + syncOffsetMs / 1000);

    // 1) 범위 내 검색(EPS 포함)
    let idx = cuesForPlayback.findIndex((s) => t >= s.start - EPS && t < s.end + EPS);
    if (idx >= 0) return setActiveIdx(idx);

    // 2) 얕은 갭을 직전 cue로 처리
    let last = -1;
    for (let i = 0; i < cuesForPlayback.length; i++) {
      if (t >= cuesForPlayback[i].start - EPS) last = i;
      else break;
    }
    setActiveIdx(last >= 0 ? last : 0);
  }, [now, cuesForPlayback, syncOffsetMs]);

  // 활성 cue가 속한 씬 비디오 세팅
  useEffect(() => {
    (async () => {
      const cue = cuesForPlayback[activeIdx];
      if (!cue) return setVideoUrl(null);
      const sc = scenesForPlayback.find((s) => cue.start >= s.start && cue.start < s.end) || scenesForPlayback[0];
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
  }, [activeIdx, cuesForPlayback, scenesForPlayback]);

  // 씬 바뀌면 비디오 0초부터
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    try {
      v.currentTime = 0;
      if (playing) v.play().catch(() => {});
      else v.pause();
    } catch {}
  }, [videoUrl, playing]);

  // 오디오 상태에 비디오 동기화
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => {});
    else v.pause();
  }, [playing]);

  // 컨트롤
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const totalLogic = cuesForPlayback.length ? cuesForPlayback[cuesForPlayback.length - 1].end : 0;

  const seek = (logicSec) => {
    const a = audioRef.current;
    if (!a) return;
    const actual = clamp(logicSec - syncOffsetMs / 1000, 0, Number(a.duration) || audioDur || totalLogic || 0);
    const wasPlaying = !a.paused;
    a.currentTime = actual;
    if (wasPlaying) a.play().catch(() => {});
    else a.pause();
  };
  const step = (d) => seek(now + syncOffsetMs / 1000 + d);
  const jumpToCue = (i) => cuesForPlayback[i] && seek(cuesForPlayback[i].start + 0.01);
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

  const status = `자막: ${srtConnected ? "연결" : "미연결"} · 오디오: ${mp3Url ? "연결" : "미연결"} · 문장 ${cuesForPlayback.length}개`;

  const overlayOpt = useMemo(() => ({ ...styleOpt }), [styleOpt]);

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
  }, [fs, now, syncOffsetMs]);

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

            {/* cue 기준으로 교체(키 포함) */}
            <SubtitleOverlay key={activeIdx} text={cuesForPlayback[activeIdx]?.text || ""} options={overlayOpt} />

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

            <button
              type="button"
              onClick={() => fs.toggle(previewRef.current)}
              className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-md bg-black/45 hover:bg-black/60 text-white"
              title="전체 화면 (더블클릭/F 키)"
            >
              ⛶
            </button>
          </div>

          {/* 컨트롤 + 싱크/스케일 표시 */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">
                상태: {playing ? "재생" : "대기"} · {fmt(now)} / {fmt(audioDur || totalLogic)}
                {plannedTotal > 0 && <span className="ml-2 text-[11px] text-slate-400">(보정 {timeScale.toFixed(3)}×)</span>}
              </div>
              <div className="flex gap-2">
                <button
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                  onClick={() => step(-5)}
                  disabled={!mp3Url || !(audioDur || totalLogic)}
                >
                  {" "}
                  -5s{" "}
                </button>
                <button
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                  onClick={onPlayPause}
                  disabled={!mp3Url || !(audioDur || totalLogic)}
                >
                  {playing ? "일시정지" : "재생"}
                </button>
                <button
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                  onClick={() => step(+5)}
                  disabled={!mp3Url || !(audioDur || totalLogic)}
                >
                  {" "}
                  +5s{" "}
                </button>
                <button
                  className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
                  onClick={() => jumpToCue(Math.max(0, activeIdx - 1))}
                  disabled={!mp3Url || !(audioDur || totalLogic)}
                >
                  이전 문장
                </button>
                <button
                  className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
                  onClick={() => jumpToCue(Math.min(cuesForPlayback.length - 1, activeIdx + 1))}
                  disabled={!mp3Url || !(audioDur || totalLogic)}
                >
                  다음 문장
                </button>
              </div>
            </div>

            {/* 싱크 오프셋 */}
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 w-24">싱크 오프셋</div>
              <button
                className="h-8 px-2 rounded border border-slate-200 text-xs hover:bg-slate-50"
                onClick={() => setSyncOffsetMs((v) => v - 100)}
              >
                -100ms
              </button>
              <input
                type="range"
                min={-1500}
                max={1500}
                step={50}
                value={syncOffsetMs}
                onChange={(e) => setSyncOffsetMs(parseInt(e.target.value || 0, 10))}
                className="flex-1"
              />
              <button
                className="h-8 px-2 rounded border border-slate-200 text-xs hover:bg-slate-50"
                onClick={() => setSyncOffsetMs((v) => v + 100)}
              >
                +100ms
              </button>
              <div className="w-16 text-right text-xs text-slate-600">{syncOffsetMs}ms</div>
              <button
                className="h-8 px-2 rounded border border-slate-200 text-xs hover:bg-slate-50"
                onClick={() => setSyncOffsetMs(0)}
                title="오프셋 초기화"
              >
                리셋
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
