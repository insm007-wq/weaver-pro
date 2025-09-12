import React, { useState, useRef } from "react";
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
import { SettingsHeader, FormSection } from "../../common";
import { useContainerStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { showGlobalToast } from "../../common/GlobalToast";

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

export default function SubtitleTab() {
  const containerStyles = useContainerStyles();
  const settingsStyles = useSettingsStyles();
  const previewRef = useRef(null);

  // 기본 자막 설정
  const defaultSettings = {
    // 기본 텍스트 설정
    fontFamily: "noto-sans",
    fontSize: 24,
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: 0,

    // 색상 설정
    textColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 80,
    outlineColor: "#000000",
    outlineWidth: 2,
    shadowColor: "#000000",
    shadowOffset: 2,
    shadowBlur: 4,

    // 위치 및 정렬
    position: "bottom",
    horizontalAlign: "center",
    verticalPadding: 40,
    horizontalPadding: 20,
    maxWidth: 80, // 화면 너비의 %
    finePositionOffset: 0, // 세밀한 위치 조정 (-50 ~ +50)

    // 배경 및 테두리
    useBackground: true,
    backgroundRadius: 8,
    useOutline: true,
    useShadow: true,

    // 애니메이션
    animation: "fade",
    animationDuration: 0.3,
    displayDuration: 3.0,

    // 고급 설정
    autoWrap: true,
    maxLines: 2,
    wordBreak: "keep-all",
    enableRichText: false,
  };

  // 자막 설정 상태
  const [subtitleSettings, setSubtitleSettings] = useState(defaultSettings);

  // 컴포넌트 마운트 시 저장된 설정 불러오기
  React.useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("subtitleSettings");
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSubtitleSettings({ ...defaultSettings, ...parsedSettings });
      }
    } catch (error) {
      console.error("저장된 자막 설정 로드 실패:", error);
    }
  }, []);

  // 설정 업데이트 헬퍼
  const updateSetting = (key, value) => {
    setSubtitleSettings((prev) => ({ ...prev, [key]: value }));
  };

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

  // 설정 저장
  const saveSettings = async () => {
    console.log("saveSettings 함수 호출됨");
    console.log("현재 자막 설정:", subtitleSettings);

    try {
      // API로 자막 설정 저장 (향후 구현될 API)
      // const result = await api.invoke('settings:saveSubtitleSettings', subtitleSettings);

      // 현재는 localStorage에 저장
      localStorage.setItem("subtitleSettings", JSON.stringify(subtitleSettings));
      console.log("localStorage에 저장 완료");

      showGlobalToast({
        type: "success",
        text: "자막 설정이 저장되었습니다! 🎉",
      });
    } catch (error) {
      console.error("자막 설정 저장 실패:", error);
      showGlobalToast({
        type: "error",
        text: "자막 설정 저장에 실패했습니다.",
      });
    }
  };

  // 설정 초기화
  const resetSettings = () => {
    setSubtitleSettings(defaultSettings);
    // localStorage에서도 제거
    localStorage.removeItem("subtitleSettings");
    showGlobalToast({
      type: "success",
      text: "자막 설정이 기본값으로 초기화되었습니다!",
    });
  };

  return (
    <div className={containerStyles.container}>
      {/* 대형 미리보기 화면 */}
      <Card style={{ marginBottom: "32px" }}>
        <CardHeader header={<Title2>🎬 실제 영상 미리보기</Title2>} description="실제 영상에서 자막이 어떻게 표시되는지 확인하세요" />

        {/* 메인 미리보기 (16:9 비율) */}
        <div style={{ padding: "20px" }}>
          <div
            ref={previewRef}
            style={{
              width: "100%",
              height: "360px", // 훨씬 큰 미리보기 화면
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
            {/* 자막 */}
            <div
              style={{
                ...generatePreviewStyle(),
                position: "absolute",
                bottom:
                  subtitleSettings.position === "bottom"
                    ? `${
                        Math.round(subtitleSettings.verticalPadding * 0.25) - Math.round((subtitleSettings.finePositionOffset || 0) * 0.25)
                      }px`
                    : "auto",
                top:
                  subtitleSettings.position === "top"
                    ? `${
                        Math.round(subtitleSettings.verticalPadding * 0.25) + Math.round((subtitleSettings.finePositionOffset || 0) * 0.25)
                      }px`
                    : subtitleSettings.position === "center"
                    ? `${180 + Math.round((subtitleSettings.finePositionOffset || 0) * 0.25)}px`
                    : "auto",
                left: "50%",
                transform: subtitleSettings.position === "center" ? "translate(-50%, -50%)" : "translateX(-50%)",
                fontSize: `${Math.round(subtitleSettings.fontSize * 0.38)}px`, // 실제 비례에 맞는 크기
                lineHeight: subtitleSettings.lineHeight,
                maxWidth: `${subtitleSettings.maxWidth}%`,
                padding: `${Math.round(subtitleSettings.verticalPadding * 0.12)}px ${Math.round(
                  subtitleSettings.horizontalPadding * 0.25
                )}px`,
                borderRadius: `${Math.round(subtitleSettings.backgroundRadius * 0.25)}px`,
                border: subtitleSettings.useOutline
                  ? `${Math.max(1, Math.round(subtitleSettings.outlineWidth * 0.25))}px solid ${subtitleSettings.outlineColor}`
                  : "none",
                textShadow: subtitleSettings.useShadow
                  ? `${Math.round(subtitleSettings.shadowOffset * 0.25)}px ${Math.round(
                      subtitleSettings.shadowOffset * 0.25
                    )}px ${Math.round(subtitleSettings.shadowBlur * 0.25)}px ${subtitleSettings.shadowColor}`
                  : "none",
              }}
            >
              안녕하세요! 웨이버 프로입니다.
              <br />이 영상에서는 AI로 콘텐츠를 제작하는 방법을 알아보겠습니다.
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* 위치 및 정렬 설정 */}
        <FormSection title="위치 및 정렬" icon={<PositionToFrontRegular />}>
          <Field label="수직 위치">
            <Dropdown
              value={POSITIONS.find((p) => p.key === subtitleSettings.position)?.text}
              selectedOptions={[subtitleSettings.position]}
              onOptionSelect={(_, data) => updateSetting("position", data.optionValue)}
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
            >
              {TEXT_ALIGNS.map((align) => (
                <Option key={align.key} value={align.key}>
                  {align.icon} {align.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          <Field label={`최대 너비: ${subtitleSettings.maxWidth}%`}>
            <Slider
              value={subtitleSettings.maxWidth}
              onChange={(_, data) => updateSetting("maxWidth", data.value)}
              min={30}
              max={100}
              step={5}
            />
          </Field>

          <Field label={`세로 여백: ${subtitleSettings.verticalPadding}px`}>
            <Slider
              value={subtitleSettings.verticalPadding}
              onChange={(_, data) => updateSetting("verticalPadding", data.value)}
              min={10}
              max={100}
              step={5}
            />
          </Field>

          <Field label={`세밀한 위치 조정: ${subtitleSettings.finePositionOffset || 0}px`}>
            <Slider
              value={subtitleSettings.finePositionOffset || 0}
              onChange={(_, data) => updateSetting("finePositionOffset", data.value)}
              min={-50}
              max={50}
              step={2}
            />
            <div style={{ fontSize: "12px", color: "rgba(0,0,0,0.6)", marginTop: "4px" }}>음수 값: 더 위로, 양수 값: 더 아래로</div>
          </Field>

          <Field label={`가로 여백: ${subtitleSettings.horizontalPadding}px`}>
            <Slider
              value={subtitleSettings.horizontalPadding}
              onChange={(_, data) => updateSetting("horizontalPadding", data.value)}
              min={5}
              max={50}
              step={5}
            />
          </Field>
        </FormSection>

        {/* 텍스트 스타일 설정 */}
        <FormSection title="텍스트 스타일" icon={<TextFontRegular />}>
          <Field label="폰트">
            <Dropdown
              value={FONT_FAMILIES.find((f) => f.key === subtitleSettings.fontFamily)?.text}
              selectedOptions={[subtitleSettings.fontFamily]}
              onOptionSelect={(_, data) => updateSetting("fontFamily", data.optionValue)}
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
            />
          </Field>

          <Field label={`굵기: ${subtitleSettings.fontWeight}`}>
            <Slider
              value={subtitleSettings.fontWeight}
              onChange={(_, data) => updateSetting("fontWeight", data.value)}
              min={100}
              max={900}
              step={100}
            />
          </Field>

          <Field label={`줄 간격: ${subtitleSettings.lineHeight.toFixed(1)}`}>
            <Slider
              value={subtitleSettings.lineHeight}
              onChange={(_, data) => updateSetting("lineHeight", data.value)}
              min={1.0}
              max={2.0}
              step={0.1}
            />
          </Field>

          <Field label={`글자 간격: ${subtitleSettings.letterSpacing}px`}>
            <Slider
              value={subtitleSettings.letterSpacing}
              onChange={(_, data) => updateSetting("letterSpacing", data.value)}
              min={-2}
              max={5}
              step={0.5}
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
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <input
                  type="color"
                  value={subtitleSettings.textColor}
                  onChange={(e) => updateSetting("textColor", e.target.value)}
                  style={{
                    position: "absolute",
                    top: "0",
                    left: "0",
                    width: "100%",
                    height: "100%",
                    opacity: "0",
                    cursor: "pointer",
                    border: "none",
                    outline: "none",
                  }}
                />
              </div>
              <Input
                value={subtitleSettings.textColor}
                onChange={(_, data) => updateSetting("textColor", data.value)}
                style={{ width: "100px" }}
              />
            </div>
          </Field>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.useBackground}
              onChange={(_, data) => updateSetting("useBackground", data.checked)}
              label="배경 사용"
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
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                  >
                    <input
                      type="color"
                      value={subtitleSettings.backgroundColor}
                      onChange={(e) => updateSetting("backgroundColor", e.target.value)}
                      style={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        width: "100%",
                        height: "100%",
                        opacity: "0",
                        cursor: "pointer",
                        border: "none",
                        outline: "none",
                      }}
                    />
                  </div>
                  <Input
                    value={subtitleSettings.backgroundColor}
                    onChange={(_, data) => updateSetting("backgroundColor", data.value)}
                    style={{ width: "100px" }}
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
                />
              </Field>

              <Field label={`모서리 둥글기: ${subtitleSettings.backgroundRadius}px`}>
                <Slider
                  value={subtitleSettings.backgroundRadius}
                  onChange={(_, data) => updateSetting("backgroundRadius", data.value)}
                  min={0}
                  max={20}
                  step={1}
                />
              </Field>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.useOutline}
              onChange={(_, data) => updateSetting("useOutline", data.checked)}
              label="테두리 사용"
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
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                  >
                    <input
                      type="color"
                      value={subtitleSettings.outlineColor}
                      onChange={(e) => updateSetting("outlineColor", e.target.value)}
                      style={{
                        position: "absolute",
                        top: "0",
                        left: "0",
                        width: "100%",
                        height: "100%",
                        opacity: "0",
                        cursor: "pointer",
                        border: "none",
                        outline: "none",
                      }}
                    />
                  </div>
                  <Input
                    value={subtitleSettings.outlineColor}
                    onChange={(_, data) => updateSetting("outlineColor", data.value)}
                    style={{ width: "100px" }}
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
                />
              </Field>
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.useShadow}
              onChange={(_, data) => updateSetting("useShadow", data.checked)}
              label="그림자 사용"
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
                />
              </Field>

              <Field label={`그림자 흐림: ${subtitleSettings.shadowBlur}px`}>
                <Slider
                  value={subtitleSettings.shadowBlur}
                  onChange={(_, data) => updateSetting("shadowBlur", data.value)}
                  min={0}
                  max={20}
                  step={1}
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
            />
          </Field>

          <Field label={`표시 시간: ${subtitleSettings.displayDuration.toFixed(1)}초`}>
            <Slider
              value={subtitleSettings.displayDuration}
              onChange={(_, data) => updateSetting("displayDuration", data.value)}
              min={1.0}
              max={10.0}
              step={0.5}
            />
          </Field>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Switch
              checked={subtitleSettings.autoWrap}
              onChange={(_, data) => updateSetting("autoWrap", data.checked)}
              label="자동 줄바꿈"
            />
          </div>

          <Field label={`최대 줄 수: ${subtitleSettings.maxLines}`}>
            <Slider
              value={subtitleSettings.maxLines}
              onChange={(_, data) => updateSetting("maxLines", data.value)}
              min={1}
              max={5}
              step={1}
            />
          </Field>
        </FormSection>
      </div>

      {/* 하단 액션 버튼 */}
      <div style={{ display: "flex", gap: "16px", marginTop: "24px" }}>
        <Button
          appearance="primary"
          onClick={() => {
            console.log("설정 저장 버튼 클릭됨");
            saveSettings();
          }}
        >
          설정 저장
        </Button>
        <Button
          appearance="secondary"
          onClick={() => {
            console.log("초기화 버튼 클릭됨");
            resetSettings();
          }}
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
