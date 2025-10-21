/**
 * 대본 생성 진행 시간 관리 훅
 *
 * 실시간 생성 시간 및 예상 남은 시간을 계산합니다.
 */

import { useState, useEffect } from 'react';
import { calculateOptimalTimeout } from '../utils/generationHelper';

export function useGenerationTimer(isGenerating, startTime, currentStep, durationMin = 3) {
  const [remainingTime, setRemainingTime] = useState('');
  const [elapsedTime, setElapsedTime] = useState('');
  const [estimatedTotalTime, setEstimatedTotalTime] = useState('');

  useEffect(() => {
    if (!isGenerating || !startTime) {
      setRemainingTime('');
      setElapsedTime('');
      setEstimatedTotalTime('');
      return;
    }

    const updateTime = () => {
      const now = new Date();
      const start = new Date(startTime);
      const elapsedSec = Math.floor((now - start) / 1000);

      // 각 단계별 예상 시간 (초) - 더 현실적인 공식
      const scriptEstimatedSec = Math.min(durationMin * 8, 600); // 최대 10분
      const audioEstimatedSec = durationMin * 60 * 0.2; // 병렬 처리로 더 빠름
      const subtitleEstimatedSec = 10;
      const totalEstimatedSec = scriptEstimatedSec + audioEstimatedSec + subtitleEstimatedSec;

      // 경과 시간
      const elapsedMin = Math.floor(elapsedSec / 60);
      const elapsedSecOnly = elapsedSec % 60;
      setElapsedTime(`${String(elapsedMin).padStart(2, '0')}:${String(elapsedSecOnly).padStart(2, '0')}`);

      // 남은 시간
      const remainingSec = Math.max(0, totalEstimatedSec - elapsedSec);

      if (remainingSec === 0 && elapsedSec > totalEstimatedSec) {
        setRemainingTime('생성 중...');
      } else {
        const remainingMin = Math.floor(remainingSec / 60);
        const remainingSecOnly = Math.floor(remainingSec % 60);
        setRemainingTime(`${String(remainingMin).padStart(2, '0')}:${String(remainingSecOnly).padStart(2, '0')}`);
      }

      // 예상 총 시간
      const totalMin = Math.floor(totalEstimatedSec / 60);
      const totalSecOnly = totalEstimatedSec % 60;
      setEstimatedTotalTime(`${String(totalMin).padStart(2, '0')}:${String(totalSecOnly).padStart(2, '0')}`);
    };

    updateTime(); // 즉시 실행
    const interval = setInterval(updateTime, 1000); // 1초마다 업데이트

    return () => clearInterval(interval);
  }, [isGenerating, startTime, durationMin]);

  return {
    remainingTime,
    elapsedTime,
    estimatedTotalTime,
  };
}

export default useGenerationTimer;
