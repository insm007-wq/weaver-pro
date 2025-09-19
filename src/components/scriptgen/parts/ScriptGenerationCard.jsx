import React from "react";
import {
  Card,
  Text,
  Button,
  tokens,
} from "@fluentui/react-components";
import { SparkleRegular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { AI_ENGINE_OPTIONS } from "../../../constants/scriptSettings";

function ScriptGenerationCard({
  form,
  isLoading,
  fullVideoState,
  globalSettings = {},
  onGenerate
}) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  // ✅ 하이브리드 모드 지원: 주제 OR 레퍼런스(50자 이상) 중 하나만 있으면 활성화
  const hasValidTopic = form.topic?.trim();
  const hasValidReference = form.referenceScript?.trim() && form.referenceScript.trim().length >= 50;
  const isReferenceOnlyMode = hasValidReference && !hasValidTopic;
  const isDisabled = isLoading || (!hasValidTopic && !hasValidReference) || (!isReferenceOnlyMode && !form.promptName) || fullVideoState.isGenerating;

  const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === globalSettings.llmModel);

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

  return (
    <Card className={cardStyles.settingsCard}>
      <div className={settingsStyles.sectionHeader}>
        <div className={settingsStyles.sectionTitle}>
          <SparkleRegular />
          <Text size={400} weight="semibold">
            대본 생성 (기본 모드)
          </Text>
        </div>
      </div>
      
      <div style={{ marginBottom: tokens.spacingVerticalM }}>
        <Text size={300} color="secondary" style={{ lineHeight: 1.4 }}>
          {selectedEngine
            ? `${selectedEngine.text.replace(/🤖|🧠|🚀/g, "").trim()}로 대본을 생성합니다`
            : "전역 설정의 LLM 모델로 대본을 생성합니다"}
        </Text>
        {selectedEngine && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
            예상 처리 시간: {selectedEngine.processingTime}
          </Text>
        )}
        {!selectedEngine && globalSettings.llmModel && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
            현재 모델: {globalSettings.llmModel} (전역 설정)
          </Text>
        )}
      </div>

      <Button
        appearance="primary"
        icon={<SparkleRegular />}
        onClick={onGenerate}
        disabled={isDisabled}
        style={{
          width: "100%",
          padding: "14px",
          fontSize: "16px",
          fontWeight: "600",
        }}
      >
        {isLoading ? "대본 생성 중..." : "📝 대본 생성 시작"}
      </Button>

      {validationErrors.length > 0 && (
        <div style={{ 
          marginTop: tokens.spacingVerticalS, 
          padding: tokens.spacingVerticalS,
          backgroundColor: tokens.colorNeutralBackground2,
          borderRadius: 8 
        }}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, fontWeight: "500" }}>
            완료해야 할 설정:
          </Text>
          {validationErrors.map((error, index) => (
            <Text key={index} size={200} style={{ 
              display: "block", 
              color: tokens.colorPaletteRedForeground1, 
              marginTop: 2 
            }}>
              {error}
            </Text>
          ))}
        </div>
      )}
    </Card>
  );
}

export default ScriptGenerationCard;