/**
 * 진행 단계 표시 컴포넌트
 *
 * @description
 * 자동화 모드와 대본 생성 모드의 각 단계별 진행 상황을 시각적으로 표시하는 컴포넌트
 * 단계별 아이콘, 제목, 진행률, 완료 상태 등을 표시합니다.
 *
 * @features
 * - 🎯 모드별 단계 순서 지원 (automation_mode vs script_mode)
 * - 🎨 단계별 상태 표시 (대기/진행중/완료/오류)
 * - 📊 실시간 진행률 바 표시
 * - 🎭 애니메이션 및 시각적 피드백
 * - 🔄 동적 아이콘 변경 (스피너, 체크마크, 에러)
 *
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from "react";
import { Text, tokens, Spinner, ProgressBar } from "@fluentui/react-components";
import { CheckmarkCircleRegular, DismissCircleRegular } from "@fluentui/react-icons";

/**
 * 진행 단계를 시각적으로 표시하는 컴포넌트
 *
 * @component
 * @param {Object} props - 컴포넌트 props
 * @param {string} props.step - 현재 단계 키 ("script" | "audio" | "images" | "video" | "subtitle")
 * @param {string} props.currentStep - 현재 진행중인 단계
 * @param {Object} props.progress - 각 단계별 진행률 객체
 * @param {number} props.progress.script - 대본 생성 진행률 (0-100)
 * @param {number} props.progress.audio - 음성 생성 진행률 (0-100)
 * @param {number} props.progress.images - 이미지 생성 진행률 (0-100)
 * @param {number} props.progress.video - 영상 합성 진행률 (0-100)
 * @param {number} props.progress.subtitle - 자막 생성 진행률 (0-100)
 * @param {string} props.title - 단계 제목 ("대본 생성", "음성 생성" 등)
 * @param {React.Component} props.icon - 단계 아이콘 컴포넌트 (Fluent UI 아이콘)
 * @param {string} props.mode - 실행 모드 ("automation_mode" | "script_mode" | "idle")
 * @param {boolean} props.isCompleted - 단계 완료 여부
 * @param {boolean} props.hasError - 오류 발생 여부
 *
 * @example
 * ```jsx
 * // 사용 예시
 * import ProgressStepComponent from './parts/ProgressStepComponent';
 * import { DocumentEditRegular } from "@fluentui/react-icons";
 *
 * function MyComponent() {
 *   const [progress, setProgress] = useState({ script: 50, audio: 0, images: 0, video: 0, subtitle: 0 });
 *
 *   return (
 *     <ProgressStepComponent
 *       step="script"
 *       currentStep="script"
 *       progress={progress}
 *       title="대본 생성"
 *       icon={DocumentEditRegular}
 *       mode="script_mode"
 *       isCompleted={false}
 *       hasError={false}
 *     />
 *   );
 * }
 * ```
 *
 * @example
 * ```jsx
 * // 자동화 모드에서 사용
 * const automationProgress = {
 *   script: 100,    // 대본 생성 완료
 *   audio: 75,      // 음성 생성 진행중
 *   images: 0,      // 이미지 생성 대기
 *   video: 0,       // 영상 합성 대기
 *   subtitle: 0     // 사용하지 않음
 * };
 *
 * <ProgressStepComponent
 *   step="audio"
 *   currentStep="audio"
 *   progress={automationProgress}
 *   title="음성 생성"
 *   icon={MicRegular}
 *   mode="automation_mode"
 *   isCompleted={false}
 *   hasError={false}
 * />
 * ```
 */
function ProgressStepComponent({
  step,
  currentStep,
  progress,
  title,
  icon,
  mode,
  isCompleted,
  hasError
}) {
  // 현재 단계가 활성화되어 있는지 확인
  const isActive = currentStep === step;

  // 모드별 단계 순서 정의
  // 자동화 모드: 대본 → 음성 → 이미지 → 영상
  // 대본 생성 모드: 대본 → 음성 → 자막
  const automationOrder = ["script", "audio", "images", "video", "complete"];
  const scriptModeOrder = ["script", "audio", "subtitle", "completed"];
  const stepOrder = mode === "automation_mode" ? automationOrder : scriptModeOrder;

  // 현재 단계가 이미 완료되었는지 확인 (과거 단계인지)
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const thisStepIndex = stepOrder.indexOf(step);

  // 과거 단계 판단: 현재 단계가 이 단계보다 앞서거나, 오류가 발생했을 때 이 단계가 현재 단계보다 앞선 경우
  const isPast = currentStepIndex > thisStepIndex ||
    (hasError && thisStepIndex < currentStepIndex);

  /**
   * 단계별 배경 색상 결정 함수
   * @returns {string} Fluent UI 토큰 색상값
   */
  const getStepColor = () => {
    if (hasError) return tokens.colorPaletteRedBackground1;           // 오류: 빨간색
    if (isCompleted || isPast) return tokens.colorPaletteLightGreenBackground1;  // 완료: 연한 녹색
    if (isActive) return tokens.colorPaletteBlueBackground1;          // 진행중: 파란색
    return tokens.colorNeutralBackground3;                           // 대기: 회색
  };

  /**
   * 아이콘 색상 결정 함수
   * @returns {string} Fluent UI 토큰 색상값
   */
  const getIconColor = () => {
    if (hasError) return tokens.colorPaletteRedForeground1;           // 오류: 빨간색
    if (isCompleted || isPast) return tokens.colorPaletteLightGreenForeground1;  // 완료: 녹색
    if (isActive) return tokens.colorPaletteBlueForeground1;          // 진행중: 파란색
    return tokens.colorNeutralForeground3;                           // 대기: 회색
  };

  // 현재 단계의 진행률 (0-100)
  const stepProgress = progress[step] || 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        // 활성/완료된 단계는 불투명도 100%, 대기 단계는 60%
        opacity: isActive || isPast || isCompleted ? 1 : 0.6,
      }}
    >
      {/* 단계 아이콘 원형 컨테이너 */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          backgroundColor: getStepColor(),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${getIconColor()}`,
          position: "relative",
        }}
      >
        {/* 상태별 아이콘 표시 */}
        {hasError ? (
          // 오류 발생 시: X 아이콘
          <DismissCircleRegular style={{ fontSize: 24, color: getIconColor() }} />
        ) : isCompleted || isPast ? (
          // 완료 시: 체크마크 아이콘
          <CheckmarkCircleRegular style={{ fontSize: 24, color: getIconColor() }} />
        ) : isActive ? (
          // 진행중일 때: 회전하는 스피너
          <Spinner size="medium" />
        ) : (
          // 대기 중일 때: 원본 아이콘
          React.createElement(icon, { style: { fontSize: 24, color: getIconColor() } })
        )}
      </div>

      {/* 단계 제목 및 진행률 표시 영역 */}
      <div style={{ textAlign: "center" }}>
        {/* 단계 제목 */}
        <Text
          size={300}
          weight={isActive ? "semibold" : "regular"}
          style={{ color: getIconColor() }}
        >
          {title}
        </Text>

        {/* 진행률 바 (활성 단계이고 진행률이 0보다 클 때만 표시) */}
        {isActive && stepProgress > 0 && (
          <div style={{ width: 80, marginTop: 4 }}>
            <ProgressBar value={stepProgress / 100} />
            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
              {stepProgress}%
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProgressStepComponent;

/**
 * @typedef {Object} ProgressData
 * @property {number} script - 대본 생성 진행률 (0-100)
 * @property {number} audio - 음성 생성 진행률 (0-100)
 * @property {number} images - 이미지 생성 진행률 (0-100)
 * @property {number} video - 영상 합성 진행률 (0-100)
 * @property {number} subtitle - 자막 생성 진행률 (0-100)
 */

/**
 * @typedef {('automation_mode'|'script_mode'|'idle')} Mode
 * - automation_mode: 완전 자동화 모드 (대본→음성→이미지→영상)
 * - script_mode: 대본 생성 모드 (대본→음성→자막)
 * - idle: 대기 상태
 */

/**
 * @typedef {('script'|'audio'|'images'|'video'|'subtitle'|'complete'|'completed'|'error'|'idle')} StepType
 * 각 단계별 식별자
 */