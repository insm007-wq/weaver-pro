// Re-export from common hooks with thumbnail-specific configuration
import { useProgressTracking as useProgressTrackingBase } from '../../../hooks/useProgressTracking';

export const useProgressTracking = () => {
  return useProgressTrackingBase({
    toastDuration: 1600,
    phaseMessages: {
      idle: "대기 중...",
      analyzing: "이미지 분석 중...",
      generating: "썸네일 생성 중...",
      processing: "후처리 중...",
      completed: "완료!",
    }
  });
};