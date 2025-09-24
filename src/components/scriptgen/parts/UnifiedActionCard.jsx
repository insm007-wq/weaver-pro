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

function UnifiedActionCard({
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
      steps: [
        { step: "대본 생성", desc: "AI가 주제에 맞는 대본 작성" },
        { step: "음성 합성", desc: "선택한 음성으로 나레이션 생성" },
        { step: "이미지 생성", desc: "대본에 맞는 AI 이미지 생성" },
        { step: "영상 합성", desc: "모든 요소를 결합해 최종 영상 완성" }
      ],
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
      steps: [
        { step: "대본 생성", desc: "AI가 주제에 맞는 대본 작성" },
        { step: "음성 합성", desc: "선택한 음성으로 나레이션 생성" },
        { step: "자막 생성", desc: "음성에 맞는 SRT 자막 파일 생성" }
      ],
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

  // 중앙 배치 최적화 레이아웃 (회색/반투명 배경 제거)
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

        {/* 실행 버튼 영역 (배경 제거) */}
        <div style={{ background: "rgba(255,255,255,0.1)",
          borderRadius: 8,
          padding: 4,
          gap: 4 }}>
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

        {/* 설명 영역 (배경 제거) */}
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

  // 기본 레이아웃 (회색/반투명 배경 전부 제거)
  return (
    <Card
      style={{
        background: currentMode.gradient,
        border: "none",
        borderRadius: 16,
        padding: tokens.spacingVerticalL,
        color: "white",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)"
      }}
    >
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: tokens.spacingVerticalM
        }}
      >
        <div
          style={{
            padding: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Icon style={{ fontSize: 24 }} />
        </div>
        <div>
          <Text size={500} weight="bold" style={{ color: "white", display: "block" }}>
            {currentMode.title}
          </Text>
          <Text size={300} style={{ color: "rgba(255,255,255,0.95)", display: "block", marginTop: 4 }}>
            {currentMode.description}
          </Text>
        </div>
      </div>

      {/* 프로세스 단계 (배경 제거) */}
      <div
        style={{
          padding: tokens.spacingVerticalM,
          marginBottom: tokens.spacingVerticalM
        }}
      >
        <Text
          size={300}
          weight="semibold"
          style={{ color: "white", marginBottom: tokens.spacingVerticalS, display: "block" }}
        >
          🔄 생성 프로세스
        </Text>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {currentMode.steps.map((step, index) => (
            <div key={index} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "white",
                }}
              >
                {index + 1}
              </div>
              <div>
                <Text size={200} weight="semibold" style={{ color: "white", display: "block" }}>
                  {step.step}
                </Text>
                <Text size={100} style={{ color: "rgba(255,255,255,0.9)" }}>
                  {step.desc}
                </Text>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 설정 정보 (배경 제거) */}
      <div
        style={{
          padding: tokens.spacingVerticalM,
          marginBottom: tokens.spacingVerticalM
        }}
      >
        <Text
          size={300}
          weight="semibold"
          style={{ color: "white", marginBottom: tokens.spacingVerticalS, display: "block" }}
        >
          ⚙️ 현재 설정
        </Text>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {form.topic?.trim() ? (
            <Text size={200} style={{ color: "rgba(255,255,255,0.95)" }}>
              📋 주제: {form.topic}
            </Text>
          ) : hasValidReference ? (
            <Text size={200} style={{ color: "rgba(255,255,255,0.95)" }}>
              📜 레퍼런스 대본: 적용됨 ({form.referenceScript.trim().length.toLocaleString()}자)
            </Text>
          ) : (
            <Text size={200} style={{ color: "rgba(255,255,255,0.85)" }}>
              ⚠️ 영상 주제 또는 레퍼런스 대본 필요
            </Text>
          )}

          {form.promptName ? (
            <Text size={200} style={{ color: "rgba(255,255,255,0.95)" }}>
              🤖 프롬프트: {form.promptName}
            </Text>
          ) : (
            <Text size={200} style={{ color: "rgba(255,255,255,0.85)" }}>
              ⚠️ 대본 생성 프롬프트 선택 필요
            </Text>
          )}

          <Text size={200} style={{ color: "rgba(255,255,255,0.9)" }}>
            🎤 음성: {form.voiceId ? `${form.voiceId} (${form.voiceGender})` : "기본 음성"}
          </Text>

          <Text size={200} style={{ color: "rgba(255,255,255,0.9)" }}>
            🧠 AI 모델: {selectedEngine?.text.replace(/🤖|🧠|🚀/g, "").trim() || "기본 모델"}
          </Text>
        </div>
      </div>

      {/* 예상 결과 (배경 제거) */}
      <div
        style={{
          padding: tokens.spacingVerticalM,
          marginBottom: tokens.spacingVerticalL
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Text size={200} weight="semibold" style={{ color: "white", display: "block" }}>
              📄 출력 결과
            </Text>
            <Text size={200} style={{ color: "rgba(255,255,255,0.9)" }}>
              {currentMode.outputFormat}
            </Text>
          </div>
          <div style={{ textAlign: "right" }}>
            <Text size={200} weight="semibold" style={{ color: "white", display: "block" }}>
              ⏱️ 예상 시간
            </Text>
            <Text size={200} style={{ color: "rgba(255,255,255,0.9)" }}>
              {currentMode.estimatedTime}
            </Text>
          </div>
        </div>
      </div>

      {/* 실행 버튼 */}
      <Button
        appearance="primary"
        icon={fullVideoState.isGenerating ? <SparkleRegular /> : <PlayRegular />}
        onClick={currentMode.onGenerate}
        disabled={isDisabled}
        style={{
          width: "100%",
          padding: "16px 24px",
          fontSize: "16px",
          fontWeight: "bold",
          backgroundColor: "rgba(255,255,255,0.9)",
          color: "#333",
          border: "none",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)"
        }}
      >
        {fullVideoState.isGenerating ? currentMode.loadingText : currentMode.buttonText}
      </Button>

      {/* 유효성 검사 오류 (배경 제거) */}
      {validationErrors.length > 0 && (
        <div
          style={{
            marginTop: tokens.spacingVerticalM,
            padding: tokens.spacingVerticalS
          }}
        >
          <Text size={200} weight="semibold" style={{ color: "white", display: "block", marginBottom: 4 }}>
            ⚠️ 완료해야 할 설정:
          </Text>
          {validationErrors.map((error, index) => (
            <Text
              key={index}
              size={200}
              style={{
                color: "rgba(255,255,255,0.95)",
                display: "block",
                marginTop: 2
              }}
            >
              {error}
            </Text>
          ))}
        </div>
      )}
    </Card>
  );
}

export default UnifiedActionCard;