import { useState, useCallback, useEffect } from "react";

/**
 * 위저드 스텝 관리 커스텀 훅
 * 다단계 프로세스의 단계 진행을 관리합니다.
 *
 * @param {Object} options 설정 옵션
 * @param {number} options.totalSteps 전체 단계 수
 * @param {number} options.initialStep 초기 단계 (기본값: 1)
 * @param {Function} options.onStepChange 단계 변경 시 콜백
 * @returns {Object} 단계 관리 함수와 상태
 */
export const useWizardStep = ({ totalSteps = 3, initialStep = 1, onStepChange } = {}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 단계 유효성 검증
  const isValidStep = useCallback(
    (step) => step >= 1 && step <= totalSteps,
    [totalSteps]
  );

  // 다음 단계로 이동
  const nextStep = useCallback(() => {
    if (currentStep < totalSteps) {
      setIsTransitioning(true);
      setTimeout(() => {
        const nextStepNumber = currentStep + 1;
        setCurrentStep(nextStepNumber);
        setIsTransitioning(false);
        onStepChange?.(nextStepNumber);
      }, 300); // 애니메이션 시간
    }
  }, [currentStep, totalSteps, onStepChange]);

  // 이전 단계로 이동
  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        const prevStepNumber = currentStep - 1;
        setCurrentStep(prevStepNumber);
        setIsTransitioning(false);
        onStepChange?.(prevStepNumber);
      }, 300);
    }
  }, [currentStep, onStepChange]);

  // 특정 단계로 이동
  const goToStep = useCallback(
    (step) => {
      if (isValidStep(step)) {
        setIsTransitioning(true);
        // 400ms로 애니메이션 시간 조정 (부드러운 전환)
        setTimeout(() => {
          setCurrentStep(step);
          setIsTransitioning(false);
          onStepChange?.(step);
        }, 400);
      }
    },
    [currentStep, isValidStep, onStepChange]
  );

  // 현재 단계를 완료로 표시
  const completeCurrentStep = useCallback(() => {
    setCompletedSteps((prev) => {
      const newSet = new Set(prev);
      newSet.add(currentStep);
      return newSet;
    });
  }, [currentStep]);

  // 특정 단계를 완료로 표시
  const completeStep = useCallback((step) => {
    if (isValidStep(step)) {
      setCompletedSteps((prev) => {
        const newSet = new Set(prev);
        newSet.add(step);
        return newSet;
      });
    }
  }, [isValidStep]);

  // 현재 단계 완료 상태 확인
  const isCurrentStepCompleted = completedSteps.has(currentStep);

  // 특정 단계 완료 상태 확인
  const isStepCompleted = useCallback(
    (step) => completedSteps.has(step),
    [completedSteps]
  );

  // 모든 단계 완료 여부
  const isAllStepsCompleted = completedSteps.size === totalSteps;

  // 단계 완료 후 자동으로 다음 단계로 이동
  const completeAndNext = useCallback(() => {
    completeCurrentStep();
    // 약간의 딜레이를 주어 완료 상태를 시각적으로 보여줌
    setTimeout(() => {
      nextStep();
    }, 500);
  }, [completeCurrentStep, nextStep]);

  // 위저드 초기화
  const reset = useCallback(() => {
    setCurrentStep(initialStep);
    setCompletedSteps(new Set());
    setIsTransitioning(false);
  }, [initialStep]);

  // 단계 진행률 계산 (퍼센트)
  const progress = Math.round((completedSteps.size / totalSteps) * 100);

  // 현재 단계가 첫 번째인지
  const isFirstStep = currentStep === 1;

  // 현재 단계가 마지막인지
  const isLastStep = currentStep === totalSteps;

  // 다음 단계로 이동 가능한지 (현재 단계가 완료되어야 함)
  const canGoNext = isCurrentStepCompleted && !isLastStep;

  // 이전 단계로 이동 가능한지
  const canGoPrev = !isFirstStep;

  return {
    // 상태
    currentStep,
    completedSteps: Array.from(completedSteps),
    isTransitioning,
    progress,
    isFirstStep,
    isLastStep,
    isCurrentStepCompleted,
    isAllStepsCompleted,
    canGoNext,
    canGoPrev,

    // 액션
    nextStep,
    prevStep,
    goToStep,
    completeCurrentStep,
    completeStep,
    completeAndNext,
    isStepCompleted,
    reset,
  };
};

export default useWizardStep;
