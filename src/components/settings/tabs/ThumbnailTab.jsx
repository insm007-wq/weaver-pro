import React, { useEffect, useState, memo, useCallback } from "react";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { 
  Body2, 
  Caption1, 
  Textarea, 
  Field, 
  Label, 
  Dropdown, 
  Option, 
  Divider, 
  tokens
} from "@fluentui/react-components";
import { SaveRegular, ArrowResetRegular, InfoRegular } from "@fluentui/react-icons";
import { DEFAULT_TEMPLATE } from "../../scriptgen/constants";
import { StandardCard, SettingsHeader, ActionButton, StatusBadge, LoadingSpinner } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";

function ThumbnailTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  // 상태
  const [template, setTemplate] = useState("");
  const [originalTemplate, setOriginalTemplate] = useState("");
  const [defaultEngine, setDefaultEngine] = useState("replicate");
  const [originalEngine, setOriginalEngine] = useState("replicate");
  const [analysisEngine, setAnalysisEngine] = useState("gemini-pro");
  const [originalAnalysisEngine, setOriginalAnalysisEngine] = useState("gemini-pro");
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
    setIsModified(template !== originalTemplate || defaultEngine !== originalEngine || analysisEngine !== originalAnalysisEngine);
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
      const analysisEngineToUse = savedAnalysisEngine || "gemini-pro";

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
        text: "템플릿을 불러오는데 실패했습니다. 기본 템플릿을 사용합니다.",
      });
      setTemplate(DEFAULT_TEMPLATE);
      setOriginalTemplate(DEFAULT_TEMPLATE);
      setDefaultEngine("replicate");
      setOriginalEngine("replicate");
      setAnalysisEngine("gemini-pro");
      setOriginalAnalysisEngine("gemini-pro");
    } finally {
      setLoading(false);
    }
  };

  // 템플릿 저장
  const saveTemplate = useCallback(async () => {
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
        value: template.trim(),
      });
      await window.api.setSetting({
        key: "thumbnailDefaultEngine",
        value: defaultEngine,
      });
      await window.api.setSetting({
        key: "thumbnailAnalysisEngine",
        value: analysisEngine,
      });
      setOriginalTemplate(template.trim());
      setOriginalEngine(defaultEngine);
      setOriginalAnalysisEngine(analysisEngine);
      setMessage({ type: "success", text: "설정이 성공적으로 저장되었습니다!" });
    } catch (error) {
      console.error("설정 저장 실패:", error);
      setMessage({
        type: "error",
        text: `설정 저장에 실패했습니다: ${error?.message || "알 수 없는 오류"}`,
      });
    } finally {
      setSaveLoading(false);
    }
  }, [isModified, template, defaultEngine, analysisEngine]);

  // 기본값 복원
  const resetToDefault = useCallback(() => {
    setTemplate(DEFAULT_TEMPLATE);
    setMessage({ type: "success", text: "기본 템플릿으로 복원되었습니다." });
  }, []);

  if (loading) {
    return (
      <div className={containerStyles.container}>
        <LoadingSpinner size="large" message="설정을 불러오는 중..." centered />
      </div>
    );
  }

  return (
    <div className={containerStyles.container}>
      {/* 헤더 */}
      <SettingsHeader
        icon="🎨"
        title="썸네일 생성 프롬프트 설정"
        description={
          <>
            YouTube 썸네일 생성에 사용될 프롬프트 템플릿을 설정합니다.
            <br />변수를 사용하여 동적으로 내용을 치환할 수 있습니다.
          </>
        }
      />

      {/* 메인 설정 */}
      <StandardCard className={cardStyles.settingsCard}>
        {/* 기본 생성 엔진 설정 */}
        <Field style={{ marginBottom: "24px" }}>
          <Label weight="semibold" size="large">
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
                  value: newEngine,
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
                  value: newAnalysisEngine,
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
              프롬프트 템플릿
            </Label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <ActionButton variant="outline" icon={<ArrowResetRegular />} onClick={resetToDefault} size="small">
                기본값 복원
              </ActionButton>
              <ActionButton
                variant="primary"
                icon={<SaveRegular />}
                onClick={saveTemplate}
                disabled={!isModified}
                loading={saveLoading}
                loadingText="저장 중..."
                size="small"
              >
                저장
              </ActionButton>
            </div>
          </div>

          <Textarea
            style={{
              fontFamily: "monospace",
              fontSize: "14px",
              lineHeight: "1.4",
              minHeight: "300px",
            }}
            value={template}
            onChange={(_, data) => setTemplate(data.value)}
            placeholder="프롬프트 템플릿을 입력하세요..."
            resize="vertical"
          />
        </Field>

        {/* 변수 도움말 */}
        <StandardCard variant="default" size="compact" style={{ marginTop: "8px" }}>
          <Body2 weight="semibold" style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
            <InfoRegular style={{ marginRight: "4px" }} />
            사용 가능한 변수
          </Body2>
          <Body2 style={{ marginBottom: "12px" }}>템플릿에서 다음 변수들을 사용할 수 있습니다:</Body2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 4px", marginTop: "12px" }}>
            <StatusBadge status="info" style={{ fontFamily: "monospace", fontSize: "11px" }}>
              {"{"}content{"}"}
            </StatusBadge>
            <Caption1>사용자가 입력한 장면 설명</Caption1>
            <StatusBadge status="info" style={{ fontFamily: "monospace", fontSize: "11px" }}>
              {"{"}referenceAnalysis{"}"}
            </StatusBadge>
            <Caption1>참고 이미지 분석 결과</Caption1>
          </div>
        </StandardCard>

        {/* 상태 메시지 */}
        {message && (
          <div style={{ marginTop: "8px" }}>
            <StatusBadge status={message.type === "success" ? "success" : "error"} showIcon size="medium">
              {message.text}
            </StatusBadge>
          </div>
        )}
      </StandardCard>
    </div>
  );
}

const MemoizedThumbnailTab = memo(ThumbnailTab);

export default function ThumbnailTabWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <MemoizedThumbnailTab />
    </ErrorBoundary>
  );
}
