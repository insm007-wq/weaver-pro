import React, { useEffect, useState } from "react";
import { ErrorBoundary } from "../../ErrorBoundary";
import {
  makeStyles,
  shorthands,
  tokens,
  Card,
  Body1,
  Body2,
  Caption1,
  Title3,
  Button,
  Textarea,
  Field,
  Label,
  Spinner,
  MessageBar,
  MessageBarBody,
  Badge,
  Divider,
  Dropdown,
  Option,
} from "@fluentui/react-components";
import {
  SaveRegular,
  ArrowResetRegular,
  SparkleRegular,
  InfoRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { DEFAULT_TEMPLATE } from "../../scriptgen/constants";

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalL),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
    maxWidth: "1200px",
    margin: "0 auto",
  },

  header: {
    textAlign: "center",
    marginBottom: tokens.spacingVerticalL,
  },

  headerTitle: {
    background: `linear-gradient(135deg, ${tokens.colorBrandForeground1} 0%, ${tokens.colorPaletteBlueForeground2} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "1.4",
  },

  headerDescription: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    maxWidth: "600px",
    margin: "0 auto",
    lineHeight: "1.5",
  },

  settingsCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
  },

  templateSection: {
    marginBottom: tokens.spacingVerticalL,
  },

  templateActions: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginBottom: tokens.spacingVerticalM,
  },

  templateTextarea: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: "1.4",
    minHeight: "300px",
  },

  variableHelp: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
    marginTop: tokens.spacingVerticalS,
  },

  variableList: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap(tokens.spacingHorizontalS, tokens.spacingVerticalXS),
    marginTop: tokens.spacingVerticalS,
  },

  variableBadge: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
  },

  statusMessage: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase200,
    marginTop: tokens.spacingVerticalS,
  },

  successMessage: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteGreenBorder1),
  },

  errorMessage: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteRedBorder1),
  },

  infoBox: {
    backgroundColor: tokens.colorPaletteLightTealBackground1,
    ...shorthands.border("1px", "solid", tokens.colorPaletteLightTealBorder1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
    marginTop: tokens.spacingVerticalM,
  },

  previewSection: {
    marginTop: tokens.spacingVerticalL,
  },

  previewBox: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    whiteSpace: "pre-wrap",
    lineHeight: "1.4",
    maxHeight: "200px",
    overflowY: "auto",
  },
});

function ThumbnailTab() {
  const styles = useStyles();
  
  // 상태
  const [template, setTemplate] = useState("");
  const [originalTemplate, setOriginalTemplate] = useState("");
  const [defaultEngine, setDefaultEngine] = useState("replicate");
  const [originalEngine, setOriginalEngine] = useState("replicate");
  const [analysisEngine, setAnalysisEngine] = useState("anthropic");
  const [originalAnalysisEngine, setOriginalAnalysisEngine] = useState("anthropic");
  const [isModified, setIsModified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // 초기 로드
  useEffect(() => {
    loadTemplate();
  }, []);

  // 수정 감지
  useEffect(() => {
    setIsModified(
      template !== originalTemplate || 
      defaultEngine !== originalEngine ||
      analysisEngine !== originalAnalysisEngine
    );
  }, [template, originalTemplate, defaultEngine, originalEngine, analysisEngine, originalAnalysisEngine]);

  // 메시지 자동 숨김
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  // 템플릿 로드
  const loadTemplate = async () => {
    setLoading(true);
    try {
      const savedTemplate = await window.api.getSetting("thumbnailPromptTemplate");
      const savedEngine = await window.api.getSetting("thumbnailDefaultEngine");
      const savedAnalysisEngine = await window.api.getSetting("thumbnailAnalysisEngine");
      
      const templateToUse = savedTemplate || DEFAULT_TEMPLATE;
      const engineToUse = savedEngine || "replicate";
      const analysisEngineToUse = savedAnalysisEngine || "anthropic";
      
      setTemplate(templateToUse);
      setOriginalTemplate(templateToUse);
      setDefaultEngine(engineToUse);
      setOriginalEngine(engineToUse);
      setAnalysisEngine(analysisEngineToUse);
      setOriginalAnalysisEngine(analysisEngineToUse);
    } catch (error) {
      console.error("템플릿 로드 실패:", error);
      setMessage({ 
        type: "error", 
        text: "템플릿을 불러오는데 실패했습니다. 기본 템플릿을 사용합니다." 
      });
      setTemplate(DEFAULT_TEMPLATE);
      setOriginalTemplate(DEFAULT_TEMPLATE);
      setDefaultEngine("replicate");
      setOriginalEngine("replicate");
      setAnalysisEngine("anthropic");
      setOriginalAnalysisEngine("anthropic");
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 저장
  const saveTemplate = async () => {
    if (!isModified) return;
    
    // 템플릿 유효성 검사
    if (!template || template.trim().length === 0) {
      setMessage({ type: "error", text: "빈 템플릿은 저장할 수 없습니다." });
      return;
    }
    
    setSaveLoading(true);
    try {
      await window.api.setSetting({ 
        key: "thumbnailPromptTemplate", 
        value: template.trim()
      });
      await window.api.setSetting({ 
        key: "thumbnailDefaultEngine", 
        value: defaultEngine
      });
      await window.api.setSetting({ 
        key: "thumbnailAnalysisEngine", 
        value: analysisEngine
      });
      setOriginalTemplate(template.trim());
      setOriginalEngine(defaultEngine);
      setOriginalAnalysisEngine(analysisEngine);
      setMessage({ type: "success", text: "설정이 성공적으로 저장되었습니다!" });
    } catch (error) {
      console.error("설정 저장 실패:", error);
      setMessage({ 
        type: "error", 
        text: `설정 저장에 실패했습니다: ${error?.message || "알 수 없는 오류"}` 
      });
    } finally {
      setSaveLoading(false);
    }
  };

  // 기본값 복원
  const resetToDefault = () => {
    setTemplate(DEFAULT_TEMPLATE);
    setMessage({ type: "success", text: "기본 템플릿으로 복원되었습니다." });
  };

  // 변수 치환 미리보기
  const getPreview = () => {
    if (!template || template.trim().length === 0) {
      return "템플릿을 입력해주세요...";
    }

    const sampleContent = "긴장감 넘치는 사무실에서 팀장이 직원에게 중요한 발표를 하는 장면";
    const sampleAnalysis = "참고 이미지: 전문적인 비즈니스 환경, 극적인 조명, 감정적 긴장감";
    
    try {
      return template
        .replace(/{content}/g, sampleContent)
        .replace(/{referenceAnalysis}/g, sampleAnalysis);
    } catch (error) {
      console.warn("프리뷰 생성 오류:", error);
      return "프리뷰를 생성하는 중 오류가 발생했습니다.";
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
          <Spinner size="large" />
          <Body1 style={{ marginLeft: tokens.spacingHorizontalM }}>설정을 불러오는 중...</Body1>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>🎨 썸네일 생성 프롬프트 설정</div>
        <Caption1 className={styles.headerDescription}>
          YouTube 썸네일 생성에 사용될 프롬프트 템플릿을 설정합니다.<br />
          변수를 사용하여 동적으로 내용을 치환할 수 있습니다.
        </Caption1>
      </div>

      {/* 메인 설정 카드 */}
      <Card className={styles.settingsCard}>
        <div className={styles.templateSection}>
          {/* 기본 생성 엔진 설정 */}
          <Field style={{ marginBottom: tokens.spacingVerticalL }}>
            <Label weight="semibold" size="large">
              <SettingsRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
              기본 생성 엔진
            </Label>
            <Dropdown
              value={defaultEngine}
              onOptionSelect={async (_, data) => {
                const newEngine = data.optionValue;
                setDefaultEngine(newEngine);
                try {
                  await window.api.setSetting({ 
                    key: "thumbnailDefaultEngine", 
                    value: newEngine
                  });
                  setOriginalEngine(newEngine);
                  setMessage({ type: "success", text: "기본 생성 엔진이 자동 저장되었습니다." });
                } catch (error) {
                  console.error("엔진 설정 저장 실패:", error);
                  setMessage({ type: "error", text: "엔진 설정 저장에 실패했습니다." });
                }
              }}
              style={{ marginTop: tokens.spacingVerticalS }}
            >
              <Option value="replicate">Replicate (고품질)</Option>
              <Option value="gemini">Google Gemini (AI 대화형)</Option>
            </Dropdown>
            <Caption1 style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
              썸네일 생성 시 기본으로 사용할 AI 엔진을 선택합니다.
            </Caption1>
          </Field>

          {/* 이미지 분석 AI 설정 */}
          <Field style={{ marginBottom: tokens.spacingVerticalL }}>
            <Label weight="semibold" size="large">
              <InfoRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
              이미지 분석 AI
            </Label>
            <Dropdown
              value={analysisEngine}
              onOptionSelect={async (_, data) => {
                const newAnalysisEngine = data.optionValue;
                setAnalysisEngine(newAnalysisEngine);
                try {
                  await window.api.setSetting({ 
                    key: "thumbnailAnalysisEngine", 
                    value: newAnalysisEngine
                  });
                  setOriginalAnalysisEngine(newAnalysisEngine);
                  setMessage({ type: "success", text: "이미지 분석 AI가 자동 저장되었습니다." });
                } catch (error) {
                  console.error("분석 AI 설정 저장 실패:", error);
                  setMessage({ type: "error", text: "분석 AI 설정 저장에 실패했습니다." });
                }
              }}
              style={{ marginTop: tokens.spacingVerticalS }}
            >
              <Option value="anthropic">Claude Sonnet 4 (고성능 분석)</Option>
              <Option value="gemini">Google Gemini 2.5 Flash (멀티모달, 권장)</Option>
              <Option value="gemini-pro">Google Gemini 2.5 Pro (고성능)</Option>
              <Option value="gemini-lite">Google Gemini 2.5 Flash-Lite (경제형)</Option>
            </Dropdown>
            <Caption1 style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
              참고 이미지 분석에 사용할 AI 엔진을 선택합니다.
            </Caption1>
          </Field>

          <Divider style={{ marginBottom: tokens.spacingVerticalL }} />

          {/* 템플릿 편집 */}
          <Field>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.spacingVerticalS }}>
              <Label weight="semibold" size="large">
                <SparkleRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
                프롬프트 템플릿
              </Label>
              <div className={styles.templateActions}>
                <Button
                  appearance="outline"
                  icon={<ArrowResetRegular />}
                  onClick={resetToDefault}
                  size="small"
                >
                  기본값 복원
                </Button>
                <Button
                  appearance="primary"
                  icon={saveLoading ? <Spinner size="tiny" /> : <SaveRegular />}
                  onClick={saveTemplate}
                  disabled={!isModified || saveLoading}
                  size="small"
                >
                  {saveLoading ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
            
            <Textarea
              className={styles.templateTextarea}
              value={template}
              onChange={(_, data) => setTemplate(data.value)}
              placeholder="프롬프트 템플릿을 입력하세요..."
              resize="vertical"
            />
          </Field>

          {/* 변수 도움말 */}
          <div className={styles.variableHelp}>
            <Body2 weight="semibold" style={{ display: "flex", alignItems: "center", marginBottom: tokens.spacingVerticalS }}>
              <InfoRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
              사용 가능한 변수
            </Body2>
            <Body2 style={{ marginBottom: tokens.spacingVerticalS }}>템플릿에서 다음 변수들을 사용할 수 있습니다:</Body2>
            <div className={styles.variableList}>
              <Badge appearance="outline" className={styles.variableBadge}>{'{'}content{'}'}</Badge>
              <Caption1>사용자가 입력한 장면 설명</Caption1>
              <Badge appearance="outline" className={styles.variableBadge}>{'{'}referenceAnalysis{'}'}</Badge>
              <Caption1>참고 이미지 분석 결과</Caption1>
            </div>
          </div>

          {/* 상태 메시지 */}
          {message && (
            <div className={`${styles.statusMessage} ${message.type === "success" ? styles.successMessage : styles.errorMessage}`}>
              {message.type === "success" ? <CheckmarkCircleRegular /> : <DismissCircleRegular />}
              <Caption1>{message.text}</Caption1>
            </div>
          )}
        </div>

        <Divider />

        {/* 미리보기 섹션 */}
        <div className={styles.previewSection}>
          <Label weight="semibold" size="medium" style={{ display: "block", marginBottom: tokens.spacingVerticalS }}>
            📋 변수 치환 미리보기
          </Label>
          <Caption1 style={{ marginBottom: tokens.spacingVerticalS }}>
            실제 장면 설명과 참고 이미지 분석이 어떻게 치환되는지 확인할 수 있습니다.
          </Caption1>
          <div className={styles.previewBox}>
            {getPreview()}
          </div>
        </div>

        {/* 안내 정보 */}
        <div className={styles.infoBox}>
          <Body2 weight="semibold" style={{ marginBottom: tokens.spacingVerticalS }}>💡 템플릿 작성 팁</Body2>
          <Body2 style={{ lineHeight: "1.6" }}>
            • <strong>{'{'}content{'}'}</strong> 변수는 사용자가 입력한 장면 설명으로 치환됩니다<br />
            • <strong>{'{'}referenceAnalysis{'}'}</strong> 변수는 업로드된 참고 이미지의 분석 결과로 치환됩니다<br />
            • 협력업체 방식과 동일한 전역 설정 시스템을 사용합니다<br />
            • 설정은 자동으로 저장되며 썸네일 생성기에서 즉시 반영됩니다
          </Body2>
        </div>
      </Card>
    </div>
  );
}

export default function ThumbnailTabWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <ThumbnailTab />
    </ErrorBoundary>
  );
}
