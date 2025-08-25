import { useEffect, useMemo, useRef, useState } from "react";

/**
 * props
 * - scene: { start:number, end:number }
 * - videoUrl: string
 * - offsetSec: number    // 씬 내 시작 오프셋
 * - fit: "cover"|"contain"
 * - kenBurns: boolean
 */
export default function ScenePreview({
  scene,
  videoUrl,
  offsetSec = 0,
  fit = "cover",
  kenBurns = false,
}) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const [duration, setDuration] = useState(0);

  const sceneLen = Math.max(0, (scene?.end || 0) - (scene?.start || 0));
  const src = useMemo(
    () => videoUrl || "",
    [videoUrl, sceneLen, offsetSec, kenBurns, fit]
  );

  // 비디오 메타/루프 + Ken Burns(프로그레시브 트랜스폼)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = async () => {
      setDuration(v.duration || 0);
      try {
        v.currentTime = Math.max(
          0,
          Math.min(offsetSec, Math.max(0, (v.duration || 0) - 0.05))
        );
        await v.play().catch(() => {});
      } catch {}
    };

    const onTime = () => {
      const t = v.currentTime;
      const stopAt = Math.min(v.duration || Infinity, offsetSec + sceneLen);

      // Ken Burns: progress 0~1
      if (kenBurns && wrapRef.current && Number.isFinite(stopAt)) {
        const p = Math.min(
          1,
          Math.max(0, (t - offsetSec) / Math.max(0.001, sceneLen))
        );
        // 방향을 씬 id로 섞어서 다양하게
        const dir = ((scene?.id || "").charCodeAt(0) || 0) % 2 ? 1 : -1;
        const scale = 1.08 + 0.12 * p; // 1.08 → 1.20
        const move = 2.5 * (p * dir); // -2.5% → +2.5%
        wrapRef.current.style.transform = `scale(${scale}) translate(${move}%, ${-move}%)`;
      } else if (wrapRef.current) {
        wrapRef.current.style.transform = "none";
      }

      // 루프: [offsetSec, offsetSec+sceneLen]
      if (Number.isFinite(stopAt) && t >= stopAt - 0.03) {
        v.currentTime = Math.max(0, offsetSec);
        v.play().catch(() => {});
      }
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
      if (wrapRef.current) wrapRef.current.style.transform = "none";
    };
  }, [offsetSec, sceneLen, src, kenBurns, scene?.id]);

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black relative">
      {src ? (
        <div
          className="w-full h-full will-change-transform transition-transform duration-100 linear"
          ref={wrapRef}
        >
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full"
            style={{ objectFit: fit }}
            autoPlay
            muted
            playsInline
            controls
          />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
          비디오 소스가 없습니다
        </div>
      )}
      <div className="absolute bottom-2 right-3 text-[11px] text-white/80">
        씬 {Math.round(sceneLen)}s / 원본 {Math.round(duration)}s
      </div>
    </div>
  );
}
