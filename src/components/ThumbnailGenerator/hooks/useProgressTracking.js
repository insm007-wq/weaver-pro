import { useState, useEffect } from "react";

export const useProgressTracking = () => {
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
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

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
    const phaseMessages = {
      idle: "대기 중...",
      analyzing: "이미지 분석 중...",
      generating: "썸네일 생성 중...",
      processing: "후처리 중...",
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

  return {
    progress,
    estimatedTime,
    remainingTime,
    toast,
    setToast,
    updateProgress,
    startProgress,
    resetProgress,
  };
};