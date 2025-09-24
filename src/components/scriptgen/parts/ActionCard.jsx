import React from "react";
import {
  Card,
  Text,
  Button,
  tokens,
} from "@fluentui/react-components";
import {
  VideoRegular,
  DocumentEditRegular,
  SparkleRegular,
  PlayRegular,
  WarningRegular
} from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { AI_ENGINE_OPTIONS } from "../../../constants/scriptSettings";

function ActionCard({
  selectedMode,
  form,
  isLoading,
  fullVideoState,
  onAutomationGenerate,
  onScriptGenerate,
  centered = false
}) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  // 유효성 검사
  const hasValidTopic = form.topic?.trim();
  const hasValidReference = form.referenceScript?.trim() && form.referenceScript.trim().length >= 50;
  const isReferenceOnlyMode = hasValidReference && !hasValidTopic;

  const getValidationErrors = () => {
    const errors = [];
    if (!hasValidTopic && !hasValidReference) {
      errors.push("• 영상 주제 입력 또는 레퍼런스 대본 입력 (50자 이상)");
    }
    if (!isReferenceOnlyMode && !form.promptName) {
      errors.push("• 대본 생성 프롬프트 선택");
    }
    return errors;
  };

  const validationErrors = getValidationErrors();
  const isDisabled = isLoading || validationErrors.length > 0 || fullVideoState.isGenerating;
  const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === form.aiEngine);

  const modes = {
    automation_mode: {
      title: "🎬 완전 자동화 영상 생성",
      description: "AI가 대본부터 최종 영상까지 모든 과정을 자동으로 처리합니다",
      buttonText: "🚀 완전 자동화 시작",
      loadingText: "자동화 생성 중...",
      icon: VideoRegular,
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      estimatedTime: "8-12분",
      outputFormat: "MP4 영상 파일 + 음성 + 자막",
      onGenerate: onAutomationGenerate
    },
    script_mode: {
      title: "📝 대본 생성 (기본 모드)",
      description: "빠르게 대본과 음성을 생성하여 콘텐츠 제작을 시작합니다",
      buttonText: "📝 대본 생성 시작",
      loadingText: "대본 생성 중...",
      icon: DocumentEditRegular,
      gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
      estimatedTime: "3-5분",
      outputFormat: "대본 텍스트 + 음성 파일 + SRT 자막",
      onGenerate: onScriptGenerate
    }
  };

  const currentMode = modes[selectedMode];
  const Icon = currentMode?.icon;

  if (!selectedMode || !currentMode) {
    return (
      <Card className={cardStyles.settingsCard} style={{ textAlign: "center", padding: tokens.spacingVerticalXL }}>
        <WarningRegular style={{ fontSize: 48, color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalM }} />
        <Text size={400} style={{ color: tokens.colorNeutralForeground3 }}>
          생성 모드를 선택해주세요
        </Text>
      </Card>
    );
  }

  // 중앙 배치 최적화 레이아웃
  if (centered) {
    return (
      <Card
        style={{
          background: currentMode.gradient,
          border: "none",
          borderRadius: 12,
          padding: tokens.spacingVerticalM,
          color: "white",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          textAlign: "center",
          height: "fit-content",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* 헤더 */}
        <div style={{ marginBottom: tokens.spacingVerticalS }}>
          <Text size={400} weight="semibold" style={{ color: "white" }}>
            {currentMode.title}
          </Text>
        </div>

        {/* 실행 버튼 영역 */}
        <div style={{
          background: "rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: 4,
          gap: 4
        }}>
          <Button
            appearance="primary"
            icon={fullVideoState.isGenerating ? <SparkleRegular /> : <PlayRegular />}
            onClick={currentMode.onGenerate}
            disabled={isDisabled}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "14px",
              fontWeight: "bold",
              backgroundColor: "rgba(255,255,255,0.9)",
              color: "#333",
              border: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
          >
            {fullVideoState.isGenerating ? currentMode.loadingText : currentMode.buttonText}
          </Button>
        </div>

        {/* 설명 영역 */}
        <div
          style={{
            marginTop: tokens.spacingVerticalS,
            padding: tokens.spacingVerticalS,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Text size={200} style={{ color: "rgba(255,255,255,0.95)" }}>
            {currentMode.description}
          </Text>
        </div>
      </Card>
    );
  }

  // 기본 레이아웃 (사용 안함 - centered만 사용)
  return null;
}

export default ActionCard;