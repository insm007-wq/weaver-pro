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
import { DEFAULT_TEMPLATE } from "../../../constants/prompts";
import { handleError, handleApiError } from "@utils";
import { StandardCard, ActionButton, StatusBadge, LoadingSpinner } from "../../common";
import { showGlobalToast } from "../../common/GlobalToast";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";

/**
 * ThumbnailTab 컴포넌트
 *
 * @description
 * YouTube 썸네일 생성을 위한 AI 설정 및 프롬프트 템플릿을 관리하는 컴포넌트입니다.
 * 기본 생성 엔진과 이미지 분석 AI 설정은 드롭다운 변경 시 즉시 저장되고,
 * 프롬프트 템플릿은 저장 버튼을 눌러야 저장됩니다.
 *
 * @features
 * - AI 엔진 설정: 기본 생성 엔진, 이미지 분석 AI 선택
 * - 프롬프트 템플릿: 썸네일 생성용 프롬프트 편집
 * - 자동 저장: 드롭다운 변경 시 즉시 설정 저장
 * - 수동 저장: 프롬프트 템플릿은 저장 버튼으로 저장
 * - 템플릿 변수: {content}, {referenceAnalysis} 지원
 * - 기본값 복원: 프롬프트 템플릿 초기화
 *
 * @ipc_apis
 * ⚙️ 설정 관리 APIs (electron/services/store.js):
 * - window.api.getSetting(key) - 개별 설정값 조회
 * - window.api.setSetting({key, value}) - 개별 설정값 저장
 *
 * @settings_stored
 * settings.json에 저장되는 설정들:
 * - thumbnailPromptTemplate: 썸네일 생성 프롬프트 템플릿
 * - thumbnailDefaultEngine: 기본 생성 엔진 (replicate, gemini)
 * - thumbnailAnalysisEngine: 이미지 분석 AI (anthropic, gemini, gemini-pro, gemini-lite)
 *
 * @template_variables
 * 사용 가능한 템플릿 변수:
 * - {content}: 영상 콘텐츠 내용
 * - {referenceAnalysis}: 참고 이미지 분석 결과
 *
 * @author Weaver Pro Team
 * @version 2.0.0
 */

/* ================= 설정 옵션 상수들 ================= */

/**
 * 기본 썸네일 생성 엔진 옵션
 */
const ENGINE_OPTIONS = [
  { value: "replicate", text: "Replicate", subtext: "(고품질)" },
];

/**
 * 이미지 분석 AI 엔진 옵션
 */
const ANALYSIS_ENGINE_OPTIONS = [
  { value: "anthropic", text: "Claude Sonnet 4", subtext: "(고성능 분석)" },
];

/**
 * 엔진 옵션에서 해당 값의 옵션 객체를 찾는 헬퍼 함수
 * @param {Array} options - 옵션 배열
 * @param {string} value - 찾을 값
 * @returns {Object} 찾은 옵션 객체 또는 첫 번째 옵션
 */
const getEngineOption = (options, value) => options.find((o) => o.value === value) || options[0];

function ThumbnailTab() {
  // Fluent UI 스타일 훅
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  // 프롬프트 템플릿 상태
  const [template, setTemplate] = useState("");
  const [originalTemplate, setOriginalTemplate] = useState("");

  // 엔진 설정 상태
  const [defaultEngine, setDefaultEngine] = useState("replicate");
  const [originalEngine, setOriginalEngine] = useState("replicate");
  const [analysisEngine, setAnalysisEngine] = useState("anthropic");
  const [originalAnalysisEngine, setOriginalAnalysisEngine] = useState("anthropic");

  // UI 상태
  const [isModified, setIsModified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [message, setMessage] = useState(null);

  /* ============ 초기화 및 상태 관리 ============ */

  /**
   * 컴포넌트 마운트 시 설정 로드
   */
  useEffect(() => {
    loadTemplate();
  }, []);

  /**
   * 프롬프트 템플릿 수정 감지 (엔진 설정 제외)
   * 엔진 설정은 드롭다운 변경 시 즉시 저장되므로 수정 상태에서 제외
   */
  useEffect(() => {
    setIsModified(template !== originalTemplate);
  }, [template, originalTemplate]);

  /**
   * 상태 메시지 자동 숨김 (3초 후)
   */
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  /**
   * 썸네일 설정들을 로드하는 함수
   * 템플릿, 기본 엔진, 분석 엔진 설정을 settings.json에서 가져옴
   */
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
      const { message } = handleError(error, "thumbnail_settings_load", {
        metadata: { action: "load_template" },
      });
      console.error("템플릿 로드 실패:", message);
      showGlobalToast({
        type: "error",
        text: "템플릿을 불러오는데 실패했습니다. 기본 템플릿을 사용합니다.",
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

  /**
   * 프롬프트 템플릿만 저장하는 함수
   * 템플릿이 수정된 경우에만 저장 실행
   */
  const saveTemplate = useCallback(async () => {
    if (!isModified) return;

    // 템플릿 유효성 검사
    if (!template || template.trim().length === 0) {
      showGlobalToast({
        type: "error",
        text: "빈 템플릿은 저장할 수 없습니다.",
      });
      return;
    }

    setSaveLoading(true);
    try {
      await window.api.setSetting({
        key: "thumbnailPromptTemplate",
        value: template.trim(),
      });

      setOriginalTemplate(template.trim());
      showGlobalToast({
        type: "success",
        text: "프롬프트 템플릿이 성공적으로 저장되었습니다! 🎉",
      });
    } catch (error) {
      const { message } = handleError(error, "thumbnail_settings_save", {
        metadata: { action: "save_template", hasTemplate: !!template.trim() },
      });
      console.error("템플릿 저장 실패:", message);
      showGlobalToast({
        type: "error",
        text: `템플릿 저장에 실패했습니다: ${message}`,
      });
    } finally {
      setSaveLoading(false);
    }
  }, [isModified, template]);

  /**
   * 프롬프트 템플릿을 기본값으로 복원 후 즉시 저장
   */
  const resetToDefault = useCallback(async () => {
    setTemplate(DEFAULT_TEMPLATE);

    try {
      await window.api.setSetting({
        key: "thumbnailPromptTemplate",
        value: DEFAULT_TEMPLATE,
      });
      setOriginalTemplate(DEFAULT_TEMPLATE);
      showGlobalToast({
        type: "success",
        text: "기본 템플릿으로 복원되고 저장되었습니다! 🎉",
      });
    } catch (error) {
      console.error("기본값 저장 실패:", error);
      showGlobalToast({
        type: "error",
        text: "기본값 저장에 실패했습니다.",
      });
    }
  }, []);

  /* ============ 엔진 설정 자동 저장 함수들 ============ */

  /**
   * 기본 생성 엔진 변경 시 즉시 저장
   * @param {string} newEngine - 새로 선택된 엔진
   */
  const handleEngineChange = useCallback(async (newEngine) => {
    setDefaultEngine(newEngine);

    try {
      await window.api.setSetting({
        key: "thumbnailDefaultEngine",
        value: newEngine,
      });
      setOriginalEngine(newEngine);
      showGlobalToast({
        type: "success",
        text: "기본 생성 엔진이 저장되었습니다.",
      });
    } catch (error) {
      console.error("엔진 설정 저장 실패:", error);
      showGlobalToast({
        type: "error",
        text: "엔진 설정 저장에 실패했습니다.",
      });
      // 실패 시 원래 값으로 되돌리기
      setDefaultEngine(originalEngine);
    }
  }, [originalEngine]);

  /**
   * 이미지 분석 AI 변경 시 즉시 저장
   * @param {string} newEngine - 새로 선택된 분석 엔진
   */
  const handleAnalysisEngineChange = useCallback(async (newEngine) => {
    setAnalysisEngine(newEngine);

    try {
      await window.api.setSetting({
        key: "thumbnailAnalysisEngine",
        value: newEngine,
      });
      setOriginalAnalysisEngine(newEngine);
      showGlobalToast({
        type: "success",
        text: "이미지 분석 AI가 저장되었습니다.",
      });
    } catch (error) {
      console.error("분석 엔진 설정 저장 실패:", error);
      showGlobalToast({
        type: "error",
        text: "분석 엔진 설정 저장에 실패했습니다.",
      });
      // 실패 시 원래 값으로 되돌리기
      setAnalysisEngine(originalAnalysisEngine);
    }
  }, [originalAnalysisEngine]);

  if (loading) {
    return (
      <div className={containerStyles.container}>
        <LoadingSpinner size="large" message="설정을 불러오는 중..." centered />
      </div>
    );
  }

  return (
    <div className={containerStyles.container}>
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
              onOptionSelect={(_, data) => handleEngineChange(data.optionValue)}
              style={{ marginTop: tokens.spacingVerticalS }}
            >
              {ENGINE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value} text={`${o.text} ${o.subtext}`}>
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
              onOptionSelect={(_, data) => handleAnalysisEngineChange(data.optionValue)}
              style={{ marginTop: tokens.spacingVerticalS }}
            >
              {ANALYSIS_ENGINE_OPTIONS.map((o) => (
                <Option key={o.value} value={o.value} text={`${o.text} ${o.subtext}`}>
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
