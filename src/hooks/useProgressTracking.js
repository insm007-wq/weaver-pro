import { useState, useEffect } from "react";

export const useProgressTracking = (options = {}) => {
  const { toastDuration = 1600 } = options;

  const [progress, setProgress] = useState({
    phase: "idle",
    percentage: 0,
    message: "",
    current: 0,
    total: 0,
  });

  const [estimatedTime, setEstimatedTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [toast, setToast] = useState(null);

  // Toast 자동 숨김
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toastDuration);
    return () => clearTimeout(t);
  }, [toast, toastDuration]);

  // 실시간 카운트다운
  useEffect(() => {
    if (!startTime || !estimatedTime) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const remaining = Math.max(0, estimatedTime - elapsed);
      setRemainingTime(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, estimatedTime]);

  const updateProgress = (phase, current = 0, total = 0, message = "") => {
    const phaseMessages = options.phaseMessages || {
      idle: "대기 중...",
      analyzing: "분석 중...",
      generating: "생성 중...",
      processing: "처리 중...",
      completed: "완료!",
    };

    setProgress({
      phase,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      message: message || phaseMessages[phase] || "",
      current,
      total,
    });
  };

  const startProgress = (estimatedTimeInSeconds) => {
    const now = Date.now();
    setEstimatedTime(estimatedTimeInSeconds);
    setStartTime(now);
    setRemainingTime(estimatedTimeInSeconds);
  };

  const resetProgress = () => {
    setRemainingTime(null);
    setStartTime(null);
    setEstimatedTime(null);
    updateProgress("idle");
  };

  const showToast = (type, text) => {
    setToast({ type, text });
  };

  return {
    progress,
    estimatedTime,
    remainingTime,
    toast,
    setToast,
    updateProgress,
    startProgress,
    resetProgress,
    showToast,
  };
};