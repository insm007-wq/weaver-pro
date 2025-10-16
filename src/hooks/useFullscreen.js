// src/hooks/useFullscreen.js
import { useEffect, useState } from "react";

export default function useFullscreen() {
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
