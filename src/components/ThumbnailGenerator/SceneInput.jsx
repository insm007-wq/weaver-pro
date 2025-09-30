import { Field, Label, Textarea, Caption1 } from "@fluentui/react-components";
import { SparkleRegular } from "@fluentui/react-icons";
import { tokens } from "@fluentui/react-components";
import { StandardCard } from "../common";

const SceneInput = ({ prompt, setPrompt, provider }) => {
  return (
    <StandardCard variant="glass" title="장면 설명" icon={<SparkleRegular />}>
      <Field>
        <Textarea
          rows={6}
          placeholder={
            provider === "replicate"
              ? "🎨 어떤 썸네일을 원하시나요? 인물의 표정, 상황, 감정을 구체적으로 적어주세요."
              : "🎯 장면에 대한 설명을 입력하세요. 참고 이미지와 함께 프롬프트 템플릿에 활용됩니다."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          style={{
            border: "2px solid rgba(102, 126, 234, 0.2)",
            borderRadius: "12px",
            padding: "16px",
            fontFamily: tokens.fontFamilyBase,
            fontSize: "14px",
            transition: "all 0.3s ease",
            background: "rgba(248, 250, 252, 0.5)",
          }}
        />
        <Caption1 style={{ 
          marginTop: tokens.spacingVerticalXS, 
          color: tokens.colorNeutralForeground3 
        }}>
          □ 장면 설명이 템플릿의 {"{content}"} 변수에 삽입되어 프롬프트가 생성됩니다.
        </Caption1>
      </Field>
    </StandardCard>
  );
};

export default SceneInput;