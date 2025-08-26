import { useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import SubtitlePreview from "../parts/SubtitlePreview";
import SubtitleControls, { PRESETS } from "../parts/SubtitleControls";

export default function ReviewTab({
  scenes = [],
  selectedSceneIdx = 0,
  srtConnected,
  mp3Connected,
}) {
  const playableScenes = useMemo(
    () =>
      (Array.isArray(scenes) ? scenes : [])
        .filter((sc) => sc?.asset?.path)
        .sort((a, b) => (a.start || 0) - (b.start || 0)),
    [scenes]
  );
  const playableCount = playableScenes.length;
  const durationSec = useMemo(
    () =>
      scenes.length ? Math.max(...scenes.map((s) => Number(s.end || 0)), 0) : 0,
    [scenes]
  );
  const firstPlayablePath = playableScenes[0]?.asset?.path || null;

  // 자막 스타일 & 자막 목록 펼침
  const [subStyle, setSubStyle] = useState({
    ...PRESETS.ytCompact,
    preset: "ytCompact",
  });
  const [listExpanded, setListExpanded] = useState(false);

  // 프리뷰/오디오/상태
  const [previewUrl, setPreviewUrl] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [progress, setProgress] = useState({
    percent: 0,
    phase: "idle",
    etaSec: null,
  });
  const [isEncoding, setIsEncoding] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isComposed, setIsComposed] = useState(false); // 합성 여부

  const videoRef = useRef(null);
  const audioRef = useRef(null);

  // 합성 전: 첫 소스 미리보기
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!firstPlayablePath) {
          setPreviewUrl(null);
          return;
        }
        const url = await window.api.videoPathToUrl(firstPlayablePath);
        if (!mounted) return;
        setPreviewUrl(url);
        setIsComposed(false);
      } catch {
        if (mounted) setPreviewUrl(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [firstPlayablePath]);

  // MP3 오디오 URL
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mp3Path = await window.api.getSetting?.("paths.mp3");
        if (!mp3Path) {
          setAudioUrl(null);
          return;
        }
        const url = await window.api.videoPathToUrl(mp3Path);
        if (mounted) setAudioUrl(url);
      } catch {
        if (mounted) setAudioUrl(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mp3Connected]);

  // 선택 씬으로 점프
  useEffect(() => {
    const v = videoRef.current,
      a = audioRef.current;
    const sc = scenes[selectedSceneIdx];
    if (!v || !sc) return;
    try {
      v.currentTime = Math.max(0, sc.start || 0);
      if (a) a.currentTime = v.currentTime;
    } catch {}
  }, [selectedSceneIdx, scenes]);

  /* ----------------------------------------------------------
   * ✅ 자막 갱신: 오디오 시계를 항상 우선 사용
   * - audio.timeupdate 이벤트로 갱신
   * - 보강용으로 rAF도 함께 사용
   * -------------------------------------------------------- */
  useEffect(() => {
    const a = audioRef.current;
    const v = videoRef.current;

    const onAudio = () => setCurrentTime(a?.currentTime || 0);
    const onVideo = () => {
      if (!a) setCurrentTime(v?.currentTime || 0);
    };

    a?.addEventListener("timeupdate", onAudio);
    v?.addEventListener("timeupdate", onVideo);

    let raf;
    const loop = () => {
      const t =
        a && Number.isFinite(a.currentTime)
          ? a.currentTime
          : v?.currentTime || 0;
      setCurrentTime(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      a?.removeEventListener("timeupdate", onAudio);
      v?.removeEventListener("timeupdate", onVideo);
      cancelAnimationFrame(raf);
    };
  }, [audioUrl, previewUrl]);

  const onPlay = () => {
    try {
      audioRef.current?.play?.();
    } catch {}
  };
  const onPause = () => {
    try {
      audioRef.current?.pause?.();
    } catch {}
  };
  const onSeeking = () => {
    const v = videoRef.current,
      a = audioRef.current;
    if (v && a) a.currentTime = v.currentTime;
  };

  // 현재 자막
  const activeIndex = useMemo(() => {
    if (!Array.isArray(scenes) || scenes.length === 0) return -1;
    const t = Number.isFinite(currentTime) ? currentTime : 0;
    return scenes.findIndex((sc) => t >= (sc.start || 0) && t < (sc.end || 0));
  }, [scenes, currentTime]);
  const activeText = activeIndex >= 0 ? scenes[activeIndex]?.text || "" : "";
  const activeScene = activeIndex >= 0 ? scenes[activeIndex] : null;
  const progressInScene = activeScene
    ? Math.min(
        1,
        Math.max(
          0,
          (currentTime - activeScene.start) /
            Math.max(0.01, activeScene.end - activeScene.start)
        )
      )
    : 0;

  // 합성
  const handleCompose = async () => {
    if (!playableCount) {
      alert("배치된 소스가 없습니다.\n배치 탭에서 씬에 영상을 넣어주세요.");
      return;
    }
    try {
      setIsEncoding(true);
      setProgress({ percent: 0, phase: "start", etaSec: null });

      const cues = (scenes || []).map((sc) => ({
        start: Math.round((sc.start || 0) * 1000),
        end: Math.round(Math.max(sc.end || 0, (sc.start || 0) + 0.01) * 1000),
        text: sc.text || "",
      }));
      const ffmpegScenes = playableScenes.map((sc) => ({
        start: sc.start,
        end: sc.end,
        asset: { path: sc.asset.path },
        fit: sc.fit || "cover",
        kenBurns: !!sc.kenBurns,
        transition: sc.transition || "none",
      }));
      const audioPath = await window.api.getSetting?.("paths.mp3");

      const res = await window.api.preview.compose({
        scenes: ffmpegScenes,
        cues,
        width: 1280,
        height: 720,
        bitrateK: 1200,
        burnSubtitles: false,
        durationSec: durationSec || undefined,
        audioPath: audioPath || undefined,
      });

      const playUrl = await window.api.videoPathToUrl(res?.url || res?.path);
      setPreviewUrl(playUrl || res?.url || null);
      setIsComposed(true);
      setIsEncoding(false);
      setProgress({ percent: 100, phase: "done", etaSec: 0 });

      requestAnimationFrame(() => videoRef.current?.play?.());
    } catch (err) {
      console.error("[preview.compose] error:", err);
      setIsEncoding(false);
      setProgress({ percent: 0, phase: "error", etaSec: null });
      alert(err?.message || "초안 합성 중 오류가 발생했습니다.");
    }
  };

  /* ---------- 시청자 친화 스타일 (정확한 1~N줄 보장) ---------- */
  const lineHeightNum = 1.35;
  const fontSizePx = subStyle.fontSize || 20;
  const lines = Math.max(1, subStyle.lineClamp || 2);
  const vPad = subStyle.bgStyle === "none" ? 0 : 12; // 상하 패딩합(6px*2)

  const outlineShadow = subStyle.outline
    ? "0 0 2px #000, 0 0 2px #000, 1px 1px 2px #000, -1px 1px 2px #000"
    : "0 1px 2px rgba(0,0,0,.8)";

  // 정확한 최대 높이로 잘라 '세 번째 줄 비침' 방지
  const overlayTextBase = {
    textAlign: "center",
    lineHeight: lineHeightNum,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
    fontSize: `${fontSizePx}px`,
    maxHeight: `${Math.ceil(lineHeightNum * fontSizePx * lines + vPad)}px`,
  };

  const textColorGradient =
    subStyle.mode === "karaoke"
      ? {
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          backgroundImage: `linear-gradient(90deg, ${subStyle.color} ${
            progressInScene * 100
          }%, rgba(255,255,255,0.35) ${progressInScene * 100}%)`,
          textShadow: "0 1px 2px rgba(0,0,0,.8)",
        }
      : { color: subStyle.color, textShadow: outlineShadow };

  const bgColor = rgba(
    subStyle.bgColor || "#000000",
    subStyle.bgOpacity ?? 0.25
  );
  const boxStyle = {
    maxWidth: `${subStyle.maxWidthPct || 78}%`,
    borderRadius:
      subStyle.bgStyle === "pill"
        ? "9999px"
        : subStyle.bgStyle === "box"
        ? "8px"
        : "0px",
    padding: subStyle.bgStyle === "none" ? "0" : "6px 12px",
    backgroundColor: subStyle.bgStyle === "none" ? "transparent" : bgColor,
  };

  const safeSides = {
    left: `${subStyle.safeMarginPct || 0}%`,
    right: `${subStyle.safeMarginPct || 0}%`,
  };
  const verticalPos =
    subStyle.mode === "overlay"
      ? subStyle.position === "top"
        ? { top: `${subStyle.vOffsetPct || 0}%` }
        : { bottom: `${subStyle.vOffsetPct || 8}%` }
      : {};

  const onClickJump = (sec) => {
    const v = videoRef.current,
      a = audioRef.current;
    if (!v) return;
    try {
      v.currentTime = Math.max(0, sec || 0);
      if (a) a.currentTime = v.currentTime;
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 좌측: 비디오 프리뷰 + 자막 */}
      <SectionCard
        title="미리보기"
        right={
          <div className="text-xs text-slate-500">
            자막: {srtConnected ? "연결" : "미연결"} · 오디오:{" "}
            {mp3Connected ? "연결" : "미연결"} · 소스 있는 씬 {playableCount}/
            {scenes.length}
          </div>
        }
        className="lg:col-span-2"
      >
        <div className="relative aspect-video w-full bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <>
              <video
                ref={videoRef}
                src={previewUrl}
                className="w-full h-full"
                controls
                loop={!isComposed} // 합성 전에는 루프
                onPlay={onPlay}
                onPause={onPause}
                onSeeking={onSeeking}
              />
              {audioUrl ? (
                <audio ref={audioRef} src={audioUrl} preload="auto" />
              ) : null}

              {/* 오버레이/배너/가라오케 */}
              {activeText &&
              (subStyle.mode === "overlay" ||
                subStyle.mode === "banner" ||
                subStyle.mode === "karaoke") ? (
                <div
                  className="pointer-events-none absolute flex justify-center"
                  style={{
                    ...safeSides,
                    ...verticalPos,
                    left: safeSides.left,
                    right: safeSides.right,
                    bottom:
                      subStyle.mode !== "overlay" ? 0 : verticalPos.bottom,
                  }}
                >
                  <div
                    style={{
                      ...boxStyle,
                      ...overlayTextBase,
                      ...textColorGradient,
                    }}
                  >
                    {activeText}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-center px-4 text-slate-500">
              (에셋이 없으면) 배경 에셋을 추가하세요
              <div className="mt-1 text-xs text-slate-400">
                초안 내보내기를 누르면 저해상도 프리뷰가 생성됩니다.
              </div>
            </div>
          )}
        </div>

        {/* below 모드 */}
        {activeText && subStyle.mode === "below" ? (
          <div className="mt-2 w-full flex justify-center">
            <div
              style={{ ...boxStyle, ...overlayTextBase, ...textColorGradient }}
            >
              {activeText}
            </div>
          </div>
        ) : null}

        {/* 진행/버튼 */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, progress.percent || 0)
                  )}%`,
                }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              상태: {labelPhase(progress.phase)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="h-10 px-4 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              onClick={() => {
                const v = videoRef.current,
                  a = audioRef.current;
                const sc = scenes[selectedSceneIdx];
                if (v && sc) {
                  v.currentTime = Math.max(0, sc.start || 0);
                  v.pause();
                  if (a) a.currentTime = v.currentTime;
                }
              }}
              disabled={!previewUrl}
            >
              프레임 미리보기
            </button>
            {isEncoding ? (
              <button
                className="h-10 px-4 rounded-lg bg-rose-600 text-white text-sm hover:bg-rose-500"
                onClick={() => setIsEncoding(false)}
              >
                작업 취소
              </button>
            ) : (
              <button
                className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
                onClick={handleCompose}
                disabled={!playableCount}
              >
                초안 내보내기
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* 우측: 자막 목록(컴팩트) + 설정 */}
      <div className="lg:col-span-1 lg:flex lg:flex-col gap-4">
        <SubtitlePreview
          scenes={scenes}
          currentTime={currentTime}
          onJump={onClickJump}
          className={listExpanded ? "flex-1" : "h-56"}
        />
        <button
          onClick={() => setListExpanded((v) => !v)}
          className="h-9 rounded-lg border border-slate-200 text-xs hover:bg-slate-50"
        >
          {listExpanded ? "자막 목록 접기" : "자막 목록 펼치기"}
        </button>
        <SubtitleControls value={subStyle} onChange={setSubStyle} />
      </div>
    </div>
  );
}

function labelPhase(phase) {
  switch (phase) {
    case "start":
      return "시작";
    case "encoding":
      return "인코딩 중";
    case "done":
      return "완료";
    case "error":
      return "오류";
    default:
      return "대기";
  }
}

function rgba(hex, a = 1) {
  let c = hex.replace("#", "");
  if (c.length === 3)
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
