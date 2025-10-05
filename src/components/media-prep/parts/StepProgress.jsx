import React, { memo } from "react";
import { tokens, Text } from "@fluentui/react-components";
import { Checkmark24Filled } from "@fluentui/react-icons";

/**
 * 위저드 스텝 진행률 표시 컴포넌트
 */
const StepProgress = memo(({ currentStep, totalSteps, completedSteps = [], stepLabels = [] }) => {
  // 기본 스텝 레이블
  const defaultLabels = ["파일 업로드", "키워드 추출", "완료"];
  const labels = stepLabels.length > 0 ? stepLabels : defaultLabels;

  // 스텝 렌더링
  const renderStep = (stepNumber) => {
    const isActive = currentStep === stepNumber;
    const isCompleted = completedSteps.includes(stepNumber);
    const isPast = stepNumber < currentStep;

    return (
      <div
        key={stepNumber}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flex: 1,
          position: "relative",
        }}
      >
        {/* 연결선 (첫 번째 스텝 제외) */}
        {stepNumber > 1 && (
          <div
            style={{
              position: "absolute",
              top: "18px",
              left: "-50%",
              right: "50%",
              height: "2px",
              backgroundColor: isPast || isCompleted ? tokens.colorBrandBackground : tokens.colorNeutralStroke2,
              transition: "background-color 400ms ease",
              zIndex: 0,
            }}
          />
        )}

        {/* 스텝 원 */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isCompleted
              ? tokens.colorBrandBackground
              : isActive
              ? tokens.colorBrandBackground
              : tokens.colorNeutralBackground3,
            border: isActive
              ? `3px solid ${tokens.colorBrandStroke1}`
              : `2px solid ${isCompleted ? tokens.colorBrandStroke1 : tokens.colorNeutralStroke2}`,
            transition: "all 400ms cubic-bezier(0.23, 1, 0.32, 1)",
            transform: isActive ? "scale(1.25)" : "scale(1)",
            boxShadow: isActive
              ? `0 4px 16px ${tokens.colorBrandBackground}90, 0 0 0 4px ${tokens.colorBrandBackground}20`
              : isCompleted
              ? `0 1px 4px ${tokens.colorBrandBackground}30`
              : "none",
            position: "relative",
            zIndex: isActive ? 2 : 1,
          }}
        >
          {isCompleted ? (
            <Checkmark24Filled
              style={{
                color: tokens.colorNeutralForegroundInverted,
                fontSize: isActive ? "20px" : "18px",
                transition: "font-size 300ms ease",
              }}
            />
          ) : (
            <Text
              size={isActive ? 400 : 300}
              weight="bold"
              style={{
                color: isActive ? tokens.colorNeutralForegroundInverted : tokens.colorNeutralForeground3,
                transition: "color 300ms ease",
              }}
            >
              {stepNumber}
            </Text>
          )}
        </div>

        {/* 스텝 레이블 */}
        <Text
          size={isActive ? 300 : 200}
          weight={isActive ? "bold" : "regular"}
          style={{
            marginTop: tokens.spacingVerticalXXS,
            color: isActive
              ? tokens.colorBrandForeground1
              : isCompleted
              ? tokens.colorNeutralForeground2
              : tokens.colorNeutralForeground3,
            transition: "all 300ms ease",
            textAlign: "center",
            maxWidth: "100px",
          }}
        >
          {labels[stepNumber - 1] || `단계 ${stepNumber}`}
        </Text>
      </div>
    );
  };

  return (
    <div
      style={{
        backgroundColor: tokens.colorNeutralBackground1,
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
        borderRadius: "10px",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        marginBottom: tokens.spacingVerticalM,
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
      }}
    >
      {/* 진행률 텍스트 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: tokens.spacingVerticalXS,
        }}
      >
        <Text size={300} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>
          진행 단계
        </Text>
        <Text size={200} style={{ color: tokens.colorBrandForeground1, fontWeight: 600 }}>
          {currentStep} / {totalSteps}
        </Text>
      </div>

      {/* 스텝 표시 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          position: "relative",
          paddingTop: tokens.spacingVerticalXXS,
        }}
      >
        {Array.from({ length: totalSteps }, (_, i) => renderStep(i + 1))}
      </div>
    </div>
  );
});

StepProgress.displayName = "StepProgress";

export default StepProgress;
