// src/hooks/usePreviewSync.js
// -----------------------------------------------------------------------------
// 비디오 <video> 요소와 타임라인의 절대시간을 양방향 동기화
// - 기능/동작은 ArrangeTab 기존 로직과 동일
// -----------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";

export function usePreviewSync({ scenes, selectedIdx, setSelectedIdx, selectedScene }) {
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewVideoRef = useRef(null);
  const [absTime, setAbsTime] = useState(0);

  // 선택된 씬의 미리보기 URL 준비 + 자동재생
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = selectedScene?.asset?.path;
        if (!p) return setPreviewUrl(null);
        const url = await window.api.videoPathToUrl(p);
        if (!cancelled) setPreviewUrl(url);
        const v = previewVideoRef.current;
        if (v) {
          v.muted = true;
          const play = () => v.play().catch(() => {});
          if (v.readyState >= 2) play();
          else v.addEventListener("canplay", play, { once: true });
        }
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedScene?.asset?.path]);

  // 특정 씬으로 이동
  const goToScene = useCallback(
    (nextIdx, { play = true } = {}) => {
      setSelectedIdx(nextIdx);
      const v = previewVideoRef.current;
      advancingRef.current = false;
      if (v) {
        try {
          v.currentTime = 0;
        } catch {}
        if (play) {
          const p = v.play?.();
          if (p && p.catch) p.catch(() => {});
        }
      }
    },
    [setSelectedIdx]
  );

  const advancingRef = useRef(false);
  const EPS = 0.05; // 50ms

  // 비디오 이벤트 → 절대시간 갱신 + 자동 다음 씬 이동
  useEffect(() => {
    const v = previewVideoRef.current;
    if (!v) return;

    const sync = () => {
      const sc = scenes[selectedIdx];
      if (!sc) return;
      const start = sc.start || 0;
      const end = sc.end || 0;
      const local = v.currentTime || 0;
      const dur = Math.max(0, end - start);

      setAbsTime(start + local);

      if (!advancingRef.current) {
        const atEnd = dur > 0 && local >= dur - EPS;
        if (atEnd) {
          advancingRef.current = true;
          if (selectedIdx < scenes.length - 1) {
            goToScene(selectedIdx + 1, { play: true });
          } else {
            try {
              v.pause();
              v.currentTime = Math.max(0, dur - 0.02);
            } catch {}
          }
        }
      }
    };

    const onMetaOrSeek = () => {
      advancingRef.current = false;
      sync();
    };

    const onEnded = () => {
      if (selectedIdx < scenes.length - 1) goToScene(selectedIdx + 1, { play: true });
    };

    v.addEventListener("timeupdate", sync);
    v.addEventListener("loadedmetadata", onMetaOrSeek);
    v.addEventListener("seeked", onMetaOrSeek);
    v.addEventListener("ended", onEnded);

    try {
      v.currentTime = 0;
    } catch {}
    onMetaOrSeek();

    return () => {
      v.removeEventListener("timeupdate", sync);
      v.removeEventListener("loadedmetadata", onMetaOrSeek);
      v.removeEventListener("seeked", onMetaOrSeek);
      v.removeEventListener("ended", onEnded);
    };
  }, [previewUrl, selectedIdx, scenes, goToScene]);

  // 타임라인 스크럽 → 비디오 이동
  const handleTimelineScrub = useCallback(
    (offsetInScene, idx, absSec) => {
      const v = previewVideoRef.current;
      const sc = scenes[idx];
      setSelectedIdx(idx);
      advancingRef.current = false;
      if (v && sc) {
        const safe = Math.max(0, Math.min(offsetInScene, v.duration || offsetInScene));
        try {
          v.currentTime = safe;
          v.play?.();
        } catch {}
        setAbsTime((sc.start || 0) + (v.currentTime || safe));
      } else {
        setAbsTime(absSec);
      }
    },
    [scenes, setSelectedIdx]
  );

  return { previewUrl, previewVideoRef, absTime, handleTimelineScrub };
}
