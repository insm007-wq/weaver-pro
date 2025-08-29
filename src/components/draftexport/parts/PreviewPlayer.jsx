// 간단한 미리보기 플레이어 (오토플레이/루프)
// props: { url?: string }
import { useEffect, useRef } from "react";

export default function PreviewPlayer({ url }) {
  const vref = useRef(null);

  useEffect(() => {
    const v = vref.current;
    if (!v) return;
    v.muted = true;
    const play = () => v.play().catch(() => {});
    if (v.readyState >= 2) play();
    else v.addEventListener("canplay", play, { once: true });
  }, [url]);

  return (
    <div className="w-full">
      <div className="aspect-video bg-slate-100 rounded-lg border overflow-hidden flex items-center justify-center">
        {url ? (
          <video
            ref={vref}
            src={url}
            className="w-full h-full"
            controls
            muted
            autoPlay
            loop
            playsInline
          />
        ) : (
          <div className="text-sm text-slate-500">
            렌더링된 초안이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
