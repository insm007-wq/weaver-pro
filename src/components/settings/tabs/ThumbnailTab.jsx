import React, { useState, useEffect, memo, useCallback } from "react";
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
  tokens,
  Text,
  Card,
  Badge,
  Button,
} from "@fluentui/react-components";
import { SaveRegular, ArrowResetRegular, InfoRegular, PuzzlePieceRegular, EditRegular } from "@fluentui/react-icons";
import { DEFAULT_TEMPLATE } from "../../scriptgen/constants";
import { handleError, handleApiError } from "@utils";
import { StandardCard, SettingsHeader, ActionButton, StatusBadge, LoadingSpinner } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";

// helper functions for options
const ENGINE_OPTIONS = [
  { value: "replicate", text: "Replicate", subtext: "(고품질)" },
  { value: "gemini", text: "Google Gemini", subtext: "(AI 대화형)" },
];

const ANALYSIS_ENGINE_OPTIONS = [
  { value: "anthropic", text: "Claude Sonnet 4", subtext: "(고성능 분석)" },
  { value: "gemini", text: "Google Gemini 2.5 Flash", subtext: "(멀티모달, 권장)" },
  { value: "gemini-pro", text: "Google Gemini 2.5 Pro", subtext: "(고성능)" },
  { value: "gemini-lite", text: "Google Gemini 2.5 Flash-Lite", subtext: "(경제형)" },
];

const getEngineOption = (options, value) => options.find((o) => o.value === value) || options[0];

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
  const [loading, setLoading] = useState(true);
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
      const { message } = handleError(error, "thumbnail_settings_load", {
        metadata: { action: "load_template" },
      });
      console.error("템플릿 로드 실패:", message);
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
      const { message } = handleError(error, "thumbnail_settings_save", {
        metadata: { action: "save_settings", hasTemplate: !!template.trim() },
      });
      console.error("설정 저장 실패:", message);
      setMessage({
        type: "error",
        text: `설정 저장에 실패했습니다: ${message}`,
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
            <br />
            변수를 사용하여 동적으로 내용을 치환할 수 있습니다.
          </>
        }
      />

      {/* 메인 설정 */}
      <Card
        className={cardStyles.settingsCard}
        style={{
          boxShadow: tokens.shadow16,
          borderRadius: 16,
          padding: `0 ${tokens.spacingHorizontalXXL}`,
          paddingTop: tokens.spacingVerticalXXL,
          paddingBottom: tokens.spacingVerticalXXL,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: tokens.spacingHorizontalXXL,
        }}
      >
        {/* AI 엔진 설정 */}
        <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <PuzzlePieceRegular style={{ color: tokens.colorPaletteBlueForeground1 }} />
            <Text weight="semibold" size={500}>
              AI 엔진 설정
            </Text>
          </div>
          <Field style={{ marginBottom: tokens.spacingVerticalM }}>
            <Label weight="semibold" size="large">
              기본 생성 엔진
            </Label>
            <Dropdown
              value={getEngineOption(ENGINE_OPTIONS, defaultEngine).text}
              selectedOptions={[defaultEngine]}
              onOptionSelect={(_, data) => setDefaultEngine(data.optionValue)}
              style={{ marginTop: tokens.spacingVerticalS }}
            >
              {ENGINE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{o.subtext}</Caption1>
                </Option>
              ))}
            </Dropdown>
            <Caption1 style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
              썸네일 생성 시 기본으로 사용할 AI 엔진을 선택합니다.
            </Caption1>
          </Field>

          <Field>
            <Label weight="semibold" size="large">
              이미지 분석 AI
            </Label>
            <Dropdown
              value={getEngineOption(ANALYSIS_ENGINE_OPTIONS, analysisEngine).text}
              selectedOptions={[analysisEngine]}
              onOptionSelect={(_, data) => setAnalysisEngine(data.optionValue)}
              style={{ marginTop: tokens.spacingVerticalS }}
            >
              {ANALYSIS_ENGINE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{o.subtext}</Caption1>
                </Option>
              ))}
            </Dropdown>
            <Caption1 style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
              참고 이미지 분석에 사용할 AI 엔진을 선택합니다.
            </Caption1>
          </Field>
          {/* 상태 메시지 */}
          {message && (
            <div style={{ marginTop: tokens.spacingVerticalL }}>
              <StatusBadge status={message.type === "success" ? "success" : "error"} showIcon size="medium">
                {message.text}
              </StatusBadge>
            </div>
          )}
        </div>

        {/* 템플릿 편집 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: tokens.spacingVerticalM }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <EditRegular style={{ color: tokens.colorPalettePurpleForeground1 }} />
              <Text weight="semibold" size={500}>
                프롬프트 템플릿
              </Text>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Button appearance="secondary" icon={<ArrowResetRegular />} onClick={resetToDefault} size="small">
                기본값 복원
              </Button>
              <Button
                appearance="primary"
                icon={saveLoading ? <LoadingSpinner size="tiny" /> : <SaveRegular />}
                onClick={saveTemplate}
                disabled={!isModified || saveLoading}
                size="small"
              >
                저장
              </Button>
            </div>
          </div>
          <Field style={{ flex: 1, marginBottom: 0 }}>
            <Textarea
              style={{
                fontFamily: "monospace",
                fontSize: "14px",
                lineHeight: "1.4",
                minHeight: "300px",
                height: "100%",
              }}
              value={template}
              onChange={(_, data) => setTemplate(data.value)}
              placeholder="프롬프트 템플릿을 입력하세요..."
              resize="vertical"
            />
          </Field>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: tokens.spacingVerticalS,
              gap: tokens.spacingHorizontalM,
              flexWrap: "wrap",
            }}
          >
            <Body2 weight="semibold" style={{ display: "flex", alignItems: "center", marginRight: "4px" }}>
              <InfoRegular style={{ marginRight: "4px" }} />
              사용 가능한 변수:
            </Body2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 4px" }}>
              <Badge appearance="outline" size="small" style={{ fontFamily: "monospace" }}>
                {"{"}content{"}"}
              </Badge>
              <Badge appearance="outline" size="small" style={{ fontFamily: "monospace" }}>
                {"{"}referenceAnalysis{"}"}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
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
