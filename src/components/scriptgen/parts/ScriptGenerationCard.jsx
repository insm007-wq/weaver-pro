import React from "react";
import {
  Card,
  Text,
  Button,
  tokens,
} from "@fluentui/react-components";
import { SparkleRegular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";

const AI_ENGINE_OPTIONS = [
  {
    key: "openai-gpt5mini",
    text: "🤖 OpenAI GPT-5 Mini",
    desc: "최신 GPT-5 모델, 롱폼 대본 최적화",
    processingTime: "2-5분",
  },
  {
    key: "anthropic", 
    text: "🧠 Anthropic Claude",
    desc: "Claude Sonnet/Haiku, 정확하고 자연스러운 문체",
    processingTime: "1-3분",
  },
  {
    key: "minimax",
    text: "🚀 Minimax Abab", 
    desc: "중국 Minimax API, 빠른 처리 속도",
    processingTime: "30초-2분",
  },
];

function ScriptGenerationCard({ 
  form, 
  isLoading, 
  fullVideoState, 
  onGenerate 
}) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  const isDisabled = isLoading || !form.topic?.trim() || !form.promptName || !form.aiEngine || fullVideoState.isGenerating;
  
  const selectedEngine = AI_ENGINE_OPTIONS.find((engine) => engine.key === form.aiEngine);

  const getValidationErrors = () => {
    const errors = [];
    if (!form.topic?.trim()) errors.push("• 영상 주제 입력");
    if (!form.promptName) errors.push("• 대본 생성 프롬프트 선택");
    if (!form.aiEngine) errors.push("• AI 엔진 선택");
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
            : "AI 엔진을 선택해 대본을 생성합니다"}
        </Text>
        {selectedEngine && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
            예상 처리 시간: {selectedEngine.processingTime}
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