import React, { useState, useEffect, memo, useCallback } from "react";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import {
  Body2,
  Caption1,
  Textarea,
  Field,
  tokens,
  Text,
  Card,
  Badge,
  Button,
} from "@fluentui/react-components";
import { SaveRegular, ArrowResetRegular, InfoRegular, EditRegular } from "@fluentui/react-icons";
import { DEFAULT_TEMPLATE } from "../../../constants/prompts";
import { handleError } from "@utils";
import { LoadingSpinner } from "../../common";
import { showGlobalToast } from "../../common/GlobalToast";
import { useContainerStyles, useCardStyles } from "../../../styles/commonStyles";

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

function ThumbnailTab() {
  // Fluent UI 스타일 훅
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();

  // 프롬프트 템플릿 상태
  const [template, setTemplate] = useState("");
  const [originalTemplate, setOriginalTemplate] = useState("");


  // UI 상태
  const [isModified, setIsModified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  /* ============ 초기화 및 상태 관리 ============ */

  /**
   * 컴포넌트 마운트 시 설정 로드
   */
  useEffect(() => {
    loadTemplate();
  }, []);

  /**
   * 프롬프트 템플릿 수정 감지
   */
  useEffect(() => {
    setIsModified(template !== originalTemplate);
  }, [template, originalTemplate]);

  /**
   * 썸네일 설정들을 로드하는 함수
   * 템플릿, 기본 엔진, 분석 엔진 설정을 settings.json에서 가져옴
   */
  const loadTemplate = async () => {
    setLoading(true);
    try {
      const savedTemplate = await window.api.getSetting("thumbnailPromptTemplate");
      const templateToUse = savedTemplate || DEFAULT_TEMPLATE;

      setTemplate(templateToUse);
      setOriginalTemplate(templateToUse);
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
          padding: tokens.spacingHorizontalXXL,
        }}
      >
        {/* 프롬프트 템플릿 편집 */}
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
                minHeight: "400px",
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
