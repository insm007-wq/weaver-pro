import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Body1,
  Body2,
  Title2,
  Title3,
  Field,
  Input,
  Slider,
  Button,
  Switch,
  Card,
  CardHeader,
  Dropdown,
  Option,
  ColorPicker,
  Divider,
  MessageBar,
  MessageBarBody,
  Badge,
  tokens,
} from "@fluentui/react-components";
import {
  TextFontRegular,
  ColorRegular,
  TextAlignLeftRegular,
  TextAlignCenterRegular,
  TextAlignRightRegular,
  EyeRegular,
  DocumentTextRegular,
  PositionToFrontRegular,
  PlayRegular,
} from "@fluentui/react-icons";
import { ErrorBoundary } from "../../common/ErrorBoundary";
import { SettingsHeader, FormSection, LoadingSpinner } from "../../common";
import { useContainerStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { showGlobalToast } from "../../common/GlobalToast";
import { handleError } from "@utils";

/**
 * SubtitleTab 컴포넌트
 *
 * @description
 * 영상 자막의 스타일, 위치, 색상, 애니메이션 효과를 설정하는 컴포넌트입니다.
 * 모든 설정은 settings.json에 저장되며, 실시간 미리보기를 제공합니다.
 *
 * @features
 * - 텍스트 스타일: 폰트, 크기, 굵기, 간격 설정
 * - 위치 및 정렬: 수직/수평 위치, 여백, 세밀한 위치 조정
 * - 색상 및 효과: 텍스트/배경/테두리/그림자 색상 및 투명도
 * - 애니메이션: 페이드, 슬라이드, 스케일, 타이핑 효과
 * - 실시간 미리보기: 16:9 비율의 대형 미리보기 화면
 * - 설정 저장/복원: settings.json 기반 저장, 기본값 즉시 복원
 *
 * @ipc_apis
 * ⚙️ 설정 관리 APIs (electron/services/store.js):
 * - window.api.getSetting(key) - 개별 설정값 조회
 * - window.api.setSetting({key, value}) - 개별 설정값 저장
 *
 * @settings_stored
 * settings.json에 저장되는 설정:
 * - subtitleSettings: 모든 자막 설정을 포함한 객체
 *   - fontFamily, fontSize, fontWeight, lineHeight, letterSpacing
 *   - textColor, backgroundColor, backgroundOpacity, outlineColor, etc.
 *   - position, horizontalAlign, verticalPadding, horizontalPadding
 *   - animation, animationDuration, displayDuration
 *   - useBackground, useOutline, useShadow, autoWrap, maxLines
 *
 * @preview_system
 * 실시간 미리보기 기능:
 * - 실제 영상 크기 (1920x1080px) 미리보기
 * - 그라디언트 배경으로 다양한 색상 대비 테스트
 * - 사용자 설정값이 그대로 적용되어 실제 영상과 동일하게 표시
 * - 모든 설정 변경사항 즉시 반영
 * - 스크롤로 전체 영역 확인 가능
 *
 * @author Weaver Pro Team
 * @version 2.0.0
 */

// 폰트 옵션
const FONT_FAMILIES = [
  { key: "noto-sans", text: "Noto Sans KR (권장)", preview: "한글 자막 테스트" },
  { key: "malgun-gothic", text: "맑은 고딕", preview: "한글 자막 테스트" },
  { key: "apple-sd-gothic", text: "Apple SD Gothic Neo", preview: "한글 자막 테스트" },
  { key: "nanumgothic", text: "나눔고딕", preview: "한글 자막 테스트" },
  { key: "arial", text: "Arial", preview: "English Subtitle" },
  { key: "helvetica", text: "Helvetica", preview: "English Subtitle" },
  { key: "roboto", text: "Roboto", preview: "English Subtitle" },
];

// 정렬 옵션
const TEXT_ALIGNS = [
  { key: "left", text: "좌측 정렬", icon: <TextAlignLeftRegular /> },
  { key: "center", text: "중앙 정렬", icon: <TextAlignCenterRegular /> },
  { key: "right", text: "우측 정렬", icon: <TextAlignRightRegular /> },
];

// 위치 옵션
const POSITIONS = [
  { key: "bottom", text: "하단" },
  { key: "center", text: "중앙" },
  { key: "top", text: "상단" },
];

// 애니메이션 옵션
const ANIMATIONS = [
  { key: "none", text: "없음" },
  { key: "fade", text: "페이드 인/아웃" },
  { key: "slide-up", text: "아래에서 위로" },
  { key: "slide-down", text: "위에서 아래로" },
  { key: "scale", text: "크기 변화" },
  { key: "typewriter", text: "타이핑 효과" },
];

// 화면 비율 설정 (16:9 고정 - 유튜브 전용)
const PREVIEW_RATIO = {
  actualWidth: 1920,
  actualHeight: 1080,
  previewWidth: 800,
  previewHeight: 450,
};

function SubtitleTab() {
  const containerStyles = useContainerStyles();
  const settingsStyles = useSettingsStyles();
  const previewRef = useRef(null);

  // 기본 자막 설정 (유튜브 표준 스타일)
  const defaultSettings = {
    // 자막 사용 여부
    enableSubtitles: true, // ✅ 자막 사용 (기본값)

    // 기본 텍스트 설정
    fontFamily: "noto-sans", // 산세리프 굵은 폰트
    fontSize: 52, // ✅ 유튜브 표준: 48~60px (1920x1080 기준)
    fontWeight: 700, // ✅ 더 굵게 (유튜브 자막은 매우 굵음)
    lineHeight: 1.3, // 줄 간격 약간 좁게
    letterSpacing: 0,

    // 색상 설정 (유튜브 표준)
    textColor: "#FFFFFF", // ✅ 흰색 텍스트
    backgroundColor: "#000000", // ✅ 검은색 배경
    backgroundOpacity: 75, // ✅ 75% 불투명 (유튜브 기본값)
    outlineColor: "#000000", // ✅ 검은색 외곽선
    outlineWidth: 3, // ✅ 외곽선 3px (더 두껍게)
    shadowColor: "#000000",
    shadowOffset: 0, // ✅ 그림자 없음 (유튜브는 외곽선만 사용)
    shadowBlur: 0,

    // 위치 및 정렬 (유튜브 표준)
    position: "bottom", // ✅ 하단
    horizontalAlign: "center", // ✅ 중앙 정렬
    verticalPadding: 60, // ✅ 하단 여백 60px
    horizontalPadding: 24,
    maxWidth: 90, // ✅ 화면 너비의 90% (더 넓게)
    finePositionOffset: 0,

    // 배경 및 테두리
    useBackground: true, // ✅ 배경 박스 사용
    backgroundRadius: 4, // ✅ 모서리 둥글기 작게
    useOutline: true, // ✅ 외곽선 사용 (두껍게)
    useShadow: false, // ✅ 그림자 사용 안 함

    // 애니메이션
    animation: "fade",
    animationDuration: 0.3,
    displayDuration: 3.0,

    // 고급 설정
    autoWrap: true,
    maxLines: 2, // ✅ 최대 2줄
    wordBreak: "keep-all",
    enableRichText: false,
  };

  // 자막 설정 상태
  const [subtitleSettings, setSubtitleSettings] = useState(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);

  /**
   * 컴포넌트 마운트 시 저장된 설정 불러오기
   * settings.json에서 subtitleSettings 키로 저장된 설정을 로드
   */
  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * 자막 설정을 settings.json에서 로드하는 함수
   */
  const loadSettings = async () => {
    setLoading(true);
    try {
      const savedSettings = await window.api.getSetting("subtitleSettings");
      const settingsToUse = savedSettings ? { ...defaultSettings, ...savedSettings } : defaultSettings;

      setSubtitleSettings(settingsToUse);
      setOriginalSettings(settingsToUse);
    } catch (error) {
      const { message } = handleError(error, "subtitle_settings_load", {
        metadata: { action: "load_settings" },
      });
      console.error("자막 설정 로드 실패:", message);
      showGlobalToast({
        type: "error",
        text: "자막 설정을 불러오는데 실패했습니다. 기본 설정을 사용합니다.",
      });
      setSubtitleSettings(defaultSettings);
      setOriginalSettings(defaultSettings);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 설정 업데이트 헬퍼 함수
   * @param {string} key - 업데이트할 설정 키
   * @param {any} value - 새로운 설정 값
   */
  const updateSetting = useCallback((key, value) => {
    setSubtitleSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 미리보기 텍스트 생성
  const generatePreviewStyle = () => ({
    fontFamily: getFontFamily(subtitleSettings.fontFamily),
    fontSize: `${subtitleSettings.fontSize}px`,
    fontWeight: subtitleSettings.fontWeight,
    lineHeight: subtitleSettings.lineHeight,
    letterSpacing: `${subtitleSettings.letterSpacing}px`,
    color: subtitleSettings.textColor,
    backgroundColor: subtitleSettings.useBackground
      ? `${subtitleSettings.backgroundColor}${Math.round(subtitleSettings.backgroundOpacity * 2.55)
          .toString(16)
          .padStart(2, "0")}`
      : "transparent",
    border: subtitleSettings.useOutline ? `${subtitleSettings.outlineWidth}px solid ${subtitleSettings.outlineColor}` : "none",
    borderRadius: `${subtitleSettings.backgroundRadius}px`,
    textShadow: subtitleSettings.useShadow
      ? `${subtitleSettings.shadowOffset}px ${subtitleSettings.shadowOffset}px ${subtitleSettings.shadowBlur}px ${subtitleSettings.shadowColor}`
      : "none",
    textAlign: subtitleSettings.horizontalAlign,
    maxWidth: `${subtitleSettings.maxWidth}%`,
    padding: `${subtitleSettings.verticalPadding}px ${subtitleSettings.horizontalPadding}px`,
    wordBreak: subtitleSettings.wordBreak === "break-all" ? "break-all" : "normal",
    whiteSpace: subtitleSettings.autoWrap ? "normal" : "nowrap",
  });

  const getFontFamily = (key) => {
    const fontMap = {
      "noto-sans": "'Noto Sans KR', sans-serif",
      "malgun-gothic": "'Malgun Gothic', sans-serif",
      "apple-sd-gothic": "'Apple SD Gothic Neo', sans-serif",
      nanumgothic: "'NanumGothic', sans-serif",
      arial: "Arial, sans-serif",
      helvetica: "Helvetica, sans-serif",
      roboto: "Roboto, sans-serif",
    };
    return fontMap[key] || fontMap["noto-sans"];
  };

  /**
   * 자막 설정을 settings.json에 저장하는 함수
   */
  const saveSettings = useCallback(async () => {
    setSaveLoading(true);
    try {
      await window.api.setSetting({
        key: "subtitleSettings",
        value: subtitleSettings,
      });

      setOriginalSettings(subtitleSettings);

      // 설정 변경 이벤트 발생
      window.dispatchEvent(new CustomEvent("settingsChanged"));

      showGlobalToast({
        type: "success",
        text: "자막 설정이 성공적으로 저장되었습니다! 🎉",
      });
    } catch (error) {
      const { message } = handleError(error, "subtitle_settings_save", {
        metadata: { action: "save_settings", settingsCount: Object.keys(subtitleSettings).length },
      });
      console.error("자막 설정 저장 실패:", message);
      showGlobalToast({
        type: "error",
        text: `자막 설정 저장에 실패했습니다: ${message}`,
      });
    } finally {
      setSaveLoading(false);
    }
  }, [subtitleSettings]);

  /**
   * 설정을 기본값으로 초기화하고 즉시 저장하는 함수
   * ThumbnailTab과 동일한 패턴으로 초기화 후 바로 저장
   */
  const resetSettings = useCallback(async () => {
    setSubtitleSettings(defaultSettings);

    try {
      await window.api.setSetting({
        key: "subtitleSettings",
        value: defaultSettings,
      });
      setOriginalSettings(defaultSettings);

      // 설정 변경 이벤트 발생
      window.dispatchEvent(new CustomEvent("settingsChanged"));

      showGlobalToast({
        type: "success",
        text: "자막 설정이 기본값으로 초기화되고 저장되었습니다! 🎉",
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
        <LoadingSpinner size="large" message="자막 설정을 불러오는 중..." centered />
      </div>
    );
  }

  // 미리보기 크기 및 스케일 계산 (16:9 고정)
  const previewWidth = PREVIEW_RATIO.previewWidth;
  const previewHeight = PREVIEW_RATIO.previewHeight;
  const scale = PREVIEW_RATIO.previewWidth / PREVIEW_RATIO.actualWidth; // 축소 비율
  const centerTopPosition = previewHeight / 2; // 중앙 위치는 높이의 50%

  return (
    <div className={containerStyles.container}>
      {/* 대형 미리보기 화면 */}
      <Card style={{ marginBottom: "32px" }}>
        {/* 메인 미리보기 (16:9 비율) */}
        <div style={{ padding: "20px", display: "flex", justifyContent: "center" }}>
          <div
            ref={previewRef}
            style={{
              width: `${previewWidth}px`,
              height: `${previewHeight}px`,
              background: "linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #667eea 100%)",
              borderRadius: "8px",
              position: "relative",
              display: "flex",
              alignItems:
                subtitleSettings.position === "center" ? "center" : subtitleSettings.position === "top" ? "flex-start" : "flex-end",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
            }}
          >
            {/* 자막 - enableSubtitles가 true일 때만 표시 */}
            {subtitleSettings.enableSubtitles && (
              <div
                style={{
                  fontFamily: getFontFamily(subtitleSettings.fontFamily),
                  fontWeight: subtitleSettings.fontWeight,
                  color: subtitleSettings.textColor,
                  backgroundColor: subtitleSettings.useBackground
                    ? `${subtitleSettings.backgroundColor}${Math.round(subtitleSettings.backgroundOpacity * 2.55)
                        .toString(16)
                        .padStart(2, "0")}`
                    : "transparent",
                  textAlign: subtitleSettings.horizontalAlign,
                  maxWidth: `${subtitleSettings.maxWidth}%`,
                  wordBreak: subtitleSettings.wordBreak === "break-all" ? "break-all" : "normal",
                  whiteSpace: subtitleSettings.autoWrap ? "normal" : "nowrap",
                  position: "absolute",
                  bottom:
                    subtitleSettings.position === "bottom"
                      ? `${(subtitleSettings.verticalPadding - (subtitleSettings.finePositionOffset || 0)) * scale}px`
                      : "auto",
                  top:
                    subtitleSettings.position === "top"
                      ? `${(subtitleSettings.verticalPadding + (subtitleSettings.finePositionOffset || 0)) * scale}px`
                      : subtitleSettings.position === "center"
                      ? `${centerTopPosition + (subtitleSettings.finePositionOffset || 0) * scale}px`
                      : "auto",
                  left: "50%",
                  transform: subtitleSettings.position === "center" ? "translate(-50%, -50%)" : "translateX(-50%)",
                  fontSize: `${subtitleSettings.fontSize * scale}px`,
                  lineHeight: subtitleSettings.lineHeight,
                  letterSpacing: `${subtitleSettings.letterSpacing * scale}px`,
                  padding: `${subtitleSettings.verticalPadding * scale}px ${subtitleSettings.horizontalPadding * scale}px`,
                  borderRadius: `${subtitleSettings.backgroundRadius * scale}px`,
                  border: subtitleSettings.useOutline
                    ? `${subtitleSettings.outlineWidth * scale}px solid ${subtitleSettings.outlineColor}`
                    : "none",
                  textShadow: subtitleSettings.useShadow
                    ? `${subtitleSettings.shadowOffset * scale}px ${subtitleSettings.shadowOffset * scale}px ${subtitleSettings.shadowBlur * scale}px ${subtitleSettings.shadowColor}`
                    : "none",
                }}
              >
                안녕하세요! 웨이버 프로입니다.
                <br />이 영상에서는 AI로 콘텐츠를 제작하는 방법을 알아보겠습니다.
              </div>
            )}

            {/* 자막 꺼짐 안내 */}
            {!subtitleSettings.enableSubtitles && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  color: "rgba(255, 255, 255, 0.7)",
                  fontSize: "16px",
                  fontWeight: 500,
                  textAlign: "center",
                  padding: "12px 24px",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  borderRadius: "8px",
                }}
              >
                자막이 비활성화되었습니다
              </div>
            )}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* 위치 및 정렬 설정 */}
        <FormSection title="위치 및 정렬" icon={<PositionToFrontRegular />}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <Switch
              checked={subtitleSettings.enableSubtitles}
              onChange={(_, data) => updateSetting("enableSubtitles", data.checked)}
              label="자막 사용"
            />
          </div>

          <Field label="수직 위치">
            <Dropdown
              value={POSITIONS.find((p) => p.key === subtitleSettings.position)?.text}
              selectedOptions={[subtitleSettings.position]}
              onOptionSelect={(_, data) => updateSetting("position", data.optionValue)}
              disabled={!subtitleSettings.enableSubtitles}
            >
              {POSITIONS.map((pos) => (
                <Option key={pos.key} value={pos.key}>
                  {pos.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label="수평 정렬">
            <Dropdown
              value={TEXT_ALIGNS.find((a) => a.key === subtitleSettings.horizontalAlign)?.text}
              selectedOptions={[subtitleSettings.horizontalAlign]}
              onOptionSelect={(_, data) => updateSetting("horizontalAlign", data.optionValue)}
              disabled={!subtitleSettings.enableSubtitles}
            >
              {TEXT_ALIGNS.map((align) => (
                <Option key={align.key} value={align.key} text={align.text}>
                  {align.icon} {align.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label={`세밀한 위치 조정: ${subtitleSettings.finePositionOffset || 0}px`}>
            <Slider
              value={subtitleSettings.finePositionOffset || 0}
              onChange={(_, data) => updateSetting("finePositionOffset", data.value)}
              min={-50}
              max={50}
              step={2}
              disabled={!subtitleSettings.enableSubtitles}
            />
            <div style={{ fontSize: "12px", color: "rgba(0,0,0,0.6)", marginTop: "4px" }}>음수 값: 더 위로, 양수 값: 더 아래로</div>
          </Field>
        </FormSection>

        {/* 텍스트 스타일 설정 */}
        <FormSection title="텍스트 스타일" icon={<TextFontRegular />}>
          <Field label="폰트">
            <Dropdown
              value={FONT_FAMILIES.find((f) => f.key === subtitleSettings.fontFamily)?.text}
              selectedOptions={[subtitleSettings.fontFamily]}
              onOptionSelect={(_, data) => updateSetting("fontFamily", data.optionValue)}
              disabled={!subtitleSettings.enableSubtitles}
            >
              {FONT_FAMILIES.map((font) => (
                <Option key={font.key} value={font.key}>
                  {font.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label={`폰트 크기: ${subtitleSettings.fontSize}px`}>
            <Slider
              value={subtitleSettings.fontSize}
              onChange={(_, data) => updateSetting("fontSize", data.value)}
              min={12}
              max={72}
              step={2}
              disabled={!subtitleSettings.enableSubtitles}
            />
          </Field>

          <Field label={`굵기: ${subtitleSettings.fontWeight}`}>
            <Slider
              value={subtitleSettings.fontWeight}
              onChange={(_, data) => updateSetting("fontWeight", data.value)}
              min={100}
              max={900}
              step={100}
              disabled={!subtitleSettings.enableSubtitles}
            />
          </Field>

          <Field label={`줄 간격: ${subtitleSettings.lineHeight.toFixed(1)}`}>
            <Slider
              value={subtitleSettings.lineHeight}
              onChange={(_, data) => updateSetting("lineHeight", data.value)}
              min={1.0}
              max={2.0}
              step={0.1}
              disabled={!subtitleSettings.enableSubtitles}
            />
          </Field>

          <Field label={`글자 간격: ${subtitleSettings.letterSpacing}px`}>
            <Slider
              value={subtitleSettings.letterSpacing}
              onChange={(_, data) => updateSetting("letterSpacing", data.value)}
              min={-2}
              max={5}
              step={0.5}
              disabled={!subtitleSettings.enableSubtitles}
            />
          </Field>
        </FormSection>

        {/* 색상 설정 */}
        <FormSection title="색상 및 효과" icon={<ColorRegular />}>
          <Field label="텍스트 색상">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  border: "2px solid #ccc",
                  backgroundColor: subtitleSettings.textColor,
                  position: "relative",
                  cursor: subtitleSettings.enableSubtitles ? "pointer" : "not-allowed",
                  overflow: "hidden",
                  opacity: subtitleSettings.enableSubtitles ? 1 : 0.5,
                }}
              >
                <input
                  type="color"
                  value={subtitleSettings.textColor}
                  onChange={(e) => updateSetting("textColor", e.target.value)}
                  disabled={!subtitleSettings.enableSubtitles}
                  style={{
                    position: "absolute",
                    top: "0",
                    left: "0",
                    width: "100%",
                    height: "100%",
                    opacity: "0",
                    cursor: subtitleSettings.enableSubtitles ? "pointer" : "not-allowed",
                    border: "none",
                    outline: "none",
                  }}
                />
              </div>
              <Input
                value={subtitleSettings.textColor}
                onChange={(_, data) => updateSetting("textColor", data.value)}
                style={{ width: "100px" }}
                disabled={!subtitleSettings.enableSubtitles}
              />
            </div>
          </Field>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.useBackground}
              onChange={(_, data) => updateSetting("useBackground", data.checked)}
              label="배경 사용"
              disabled={!subtitleSettings.enableSubtitles}
            />
          </div>

          {subtitleSettings.useBackground && (
            <>
              <Field label="배경 색상">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      border: "2px solid #ccc",
                      backgroundColor: subtitleSettings.backgroundColor,
                      position: "relative",
                      cursor: subtitleSettings.enableSubtitles ? "pointer" : "not-allowed",
                      overflow: "hidden",
                      opacity: subtitleSettings.enableSubtitles ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="color"
                      value={subtitleSettings.backgroundColor}
                      onChange={(e) => updateSetting("backgroundColor", e.target.value)}
                      disabled={!subtitleSettings.enableSubtitles}
                      style={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        width: "100%",
                        height: "100%",
                        opacity: "0",
                        cursor: subtitleSettings.enableSubtitles ? "pointer" : "not-allowed",
                        border: "none",
                        outline: "none",
                      }}
                    />
                  </div>
                  <Input
                    value={subtitleSettings.backgroundColor}
                    onChange={(_, data) => updateSetting("backgroundColor", data.value)}
                    style={{ width: "100px" }}
                    disabled={!subtitleSettings.enableSubtitles}
                  />
                </div>
              </Field>

              <Field label={`배경 투명도: ${subtitleSettings.backgroundOpacity}%`}>
                <Slider
                  value={subtitleSettings.backgroundOpacity}
                  onChange={(_, data) => updateSetting("backgroundOpacity", data.value)}
                  min={0}
                  max={100}
                  step={5}
                  disabled={!subtitleSettings.enableSubtitles}
                />
              </Field>

              <Field label={`모서리 둥글기: ${subtitleSettings.backgroundRadius}px`}>
                <Slider
                  value={subtitleSettings.backgroundRadius}
                  onChange={(_, data) => updateSetting("backgroundRadius", data.value)}
                  min={0}
                  max={20}
                  step={1}
                  disabled={!subtitleSettings.enableSubtitles}
                />
              </Field>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.useOutline}
              onChange={(_, data) => updateSetting("useOutline", data.checked)}
              label="테두리 사용"
              disabled={!subtitleSettings.enableSubtitles}
            />
          </div>

          {subtitleSettings.useOutline && (
            <>
              <Field label="테두리 색상">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      border: "2px solid #ccc",
                      backgroundColor: subtitleSettings.outlineColor,
                      position: "relative",
                      cursor: subtitleSettings.enableSubtitles ? "pointer" : "not-allowed",
                      overflow: "hidden",
                      opacity: subtitleSettings.enableSubtitles ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="color"
                      value={subtitleSettings.outlineColor}
                      onChange={(e) => updateSetting("outlineColor", e.target.value)}
                      disabled={!subtitleSettings.enableSubtitles}
                      style={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        width: "100%",
                        height: "100%",
                        opacity: "0",
                        cursor: subtitleSettings.enableSubtitles ? "pointer" : "not-allowed",
                        border: "none",
                        outline: "none",
                      }}
                    />
                  </div>
                  <Input
                    value={subtitleSettings.outlineColor}
                    onChange={(_, data) => updateSetting("outlineColor", data.value)}
                    style={{ width: "100px" }}
                    disabled={!subtitleSettings.enableSubtitles}
                  />
                </div>
              </Field>

              <Field label={`테두리 두께: ${subtitleSettings.outlineWidth}px`}>
                <Slider
                  value={subtitleSettings.outlineWidth}
                  onChange={(_, data) => updateSetting("outlineWidth", data.value)}
                  min={0}
                  max={5}
                  step={1}
                  disabled={!subtitleSettings.enableSubtitles}
                />
              </Field>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.useShadow}
              onChange={(_, data) => updateSetting("useShadow", data.checked)}
              label="그림자 사용"
              disabled={!subtitleSettings.enableSubtitles}
            />
          </div>

          {subtitleSettings.useShadow && (
            <>
              <Field label={`그림자 거리: ${subtitleSettings.shadowOffset}px`}>
                <Slider
                  value={subtitleSettings.shadowOffset}
                  onChange={(_, data) => updateSetting("shadowOffset", data.value)}
                  min={0}
                  max={10}
                  step={1}
                  disabled={!subtitleSettings.enableSubtitles}
                />
              </Field>

              <Field label={`그림자 흐림: ${subtitleSettings.shadowBlur}px`}>
                <Slider
                  value={subtitleSettings.shadowBlur}
                  onChange={(_, data) => updateSetting("shadowBlur", data.value)}
                  min={0}
                  max={20}
                  step={1}
                  disabled={!subtitleSettings.enableSubtitles}
                />
              </Field>
            </>
          )}
        </FormSection>

        {/* 애니메이션 및 타이밍 */}
        <FormSection title="애니메이션 및 타이밍" icon={<PlayRegular />}>
          <Field label="애니메이션 효과">
            <Dropdown
              value={ANIMATIONS.find((a) => a.key === subtitleSettings.animation)?.text}
              selectedOptions={[subtitleSettings.animation]}
              onOptionSelect={(_, data) => updateSetting("animation", data.optionValue)}
              disabled={!subtitleSettings.enableSubtitles}
            >
              {ANIMATIONS.map((anim) => (
                <Option key={anim.key} value={anim.key}>
                  {anim.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label={`애니메이션 속도: ${subtitleSettings.animationDuration.toFixed(1)}초`}>
            <Slider
              value={subtitleSettings.animationDuration}
              onChange={(_, data) => updateSetting("animationDuration", data.value)}
              min={0.1}
              max={2.0}
              step={0.1}
              disabled={!subtitleSettings.enableSubtitles}
            />
          </Field>

          <Field label={`표시 시간: ${subtitleSettings.displayDuration.toFixed(1)}초`}>
            <Slider
              value={subtitleSettings.displayDuration}
              onChange={(_, data) => updateSetting("displayDuration", data.value)}
              min={1.0}
              max={10.0}
              step={0.5}
              disabled={!subtitleSettings.enableSubtitles}
            />
          </Field>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.autoWrap}
              onChange={(_, data) => updateSetting("autoWrap", data.checked)}
              label="자동 줄바꿈"
              disabled={!subtitleSettings.enableSubtitles}
            />
          </div>

          <Field label={`최대 줄 수: ${subtitleSettings.maxLines}`}>
            <Slider
              value={subtitleSettings.maxLines}
              onChange={(_, data) => updateSetting("maxLines", data.value)}
              min={1}
              max={5}
              step={1}
              disabled={!subtitleSettings.enableSubtitles}
            />
          </Field>
        </FormSection>
      </div>

      {/* 하단 액션 버튼 */}
      <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
        <Button
          appearance="primary"
          onClick={saveSettings}
          disabled={saveLoading}
        >
          {saveLoading ? "저장 중..." : "설정 저장"}
        </Button>
        <Button
          appearance="secondary"
          onClick={resetSettings}
        >
          기본값으로 초기화
        </Button>
      </div>

      <MessageBar style={{ marginTop: "16px" }}>
        <MessageBarBody>
          자막 설정은 새로 생성되는 영상에만 적용됩니다. 기존 영상의 자막을 변경하려면 영상을 다시 생성해야 합니다.
        </MessageBarBody>
      </MessageBar>
    </div>
  );
}

const MemoizedSubtitleTab = React.memo(SubtitleTab);

export default function SubtitleTabWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <MemoizedSubtitleTab />
    </ErrorBoundary>
  );
}
