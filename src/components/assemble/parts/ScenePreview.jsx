import { useEffect, useMemo, useRef } from "react";

/**
 * props
 * - scene: { start:number, end:number }   // 씬 길이만 사용 (구간 반복)
 * - videoUrl?: string                      // http/https/blob URL
 *
 * 내부 카드/타이틀/여백 없음: 외부(ArrangeTab) 카드 안에 그대로 꽉 차게 들어가도록 설계
 */
export default function ScenePreview({ scene, videoUrl }) {
  const videoRef = useRef(null);

  const sceneLen = Math.max(0, (scene?.end || 0) - (scene?.start || 0));
  const src = useMemo(() => videoUrl || "", [videoUrl, sceneLen]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // 메타 로드 후 0초부터 자동재생(무음)
    const onLoaded = async () => {
      try {
        v.currentTime = 0;
        await v.play().catch(() => {});
      } catch {}
    };

    // 씬 길이(구간)만큼 재생 → 0초로 점프해서 반복
    const onTime = () => {
      const stopAt = Math.min(v.duration || Infinity, sceneLen || Infinity);
      if (Number.isFinite(stopAt) && v.currentTime >= stopAt - 0.05) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [sceneLen, src]);

  return (
    <div className="aspect-video rounded-xl overflow-hidden bg-black">
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          controls
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
          비디오 소스가 없습니다
        </div>
      )}
    </div>
  );
}
