import React, { useState, useEffect } from "react";
import { Text, Button, Dropdown, Option, Field, Input, Card, Caption1, Label, tokens, Divider } from "@fluentui/react-components";
import {
  FolderRegular,
  InfoRegular,
  SaveRegular,
  ArrowResetRegular,
  VideoRegular,
  ImageRegular,
  PuzzlePieceRegular,
  RocketRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { showGlobalToast } from "../../common/GlobalToast";
import { useApi } from "../../../hooks/useApi";

// 기본 설정을 더 명확하게 정의합니다.
const DEFAULT_SETTINGS = {
  videoSaveFolder: "C:\\weaverPro\\",
  defaultResolution: "1080p",
  imageModel: "flux-dev",
  videoModel: "veo-3",
  imageResolution: "1024x1024",
  videoQuality: "1080p",
};

// AI 모델 관련 옵션을 구조화하여 관리합니다.
const AI_OPTIONS = {
  imageModels: [
    { value: "flux-dev", text: "Flux Dev (고품질)", cost: "35원/장" },
    { value: "flux-schnell", text: "Flux Schnell (속도 우선)", cost: "15원/장" },
    { value: "dall-e-3", text: "DALL-E 3 (고품질)", cost: "별도 요금" },
    { value: "midjourney", text: "Midjourney (예술적)", cost: "별도 요금" },
    { value: "stable-diffusion", text: "Stable Diffusion", cost: "무료" },
  ],
  imageResolutions: [
    { value: "512x512", text: "512x512", speed: "빠름" },
    { value: "1024x1024", text: "1024x1024", speed: "표준" },
    { value: "1536x1536", text: "1536x1536", speed: "고화질" },
    { value: "2048x2048", text: "2048x2048", speed: "최고화질" },
  ],
  videoModels: [
    { value: "veo-3", text: "Google Veo 3", length: "8초", status: "추천" },
    { value: "kling", text: "Kling AI", length: "5초", status: "준비 중" },
    { value: "runway", text: "Runway ML", length: "4초", status: "준비 중" },
    { value: "pika", text: "Pika Labs", length: "3초", status: "준비 중" },
    { value: "stable-video", text: "Stable Video", length: "4초", status: "무료" },
  ],
  videoQualities: [
    { value: "720p", text: "720p", speed: "빠름" },
    { value: "1080p", text: "1080p", speed: "표준" },
    { value: "4k", text: "4K", speed: "느림" },
  ],
};

export default function DefaultsTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const api = useApi();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem("defaultSettings");
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings((prevSettings) => ({ ...prevSettings, ...parsedSettings }));
      }
    } catch (error) {
      console.error("기본 설정 로드 실패:", error);
    }
  }, []);

  const saveSettings = async () => {
    try {
      localStorage.setItem("defaultSettings", JSON.stringify(settings));
      showGlobalToast({
        type: "success",
        text: "기본 설정이 저장되었습니다! 🎉",
      });
    } catch (error) {
      console.error("기본 설정 저장 실패:", error);
      showGlobalToast({
        type: "error",
        text: "기본 설정 저장에 실패했습니다.",
      });
    }
  };

  const selectFolder = async () => {
    try {
      console.log("폴더 선택 시작...");
      const result = await api.invoke("dialog:selectFolder");
      console.log("폴더 선택 결과:", result);

      if (result && result.success && result.data && !result.data.canceled && result.data.filePaths && result.data.filePaths.length > 0) {
        console.log("선택된 폴더:", result.data.filePaths[0]);
        setSettings((prev) => ({ ...prev, videoSaveFolder: result.data.filePaths[0] }));
        showGlobalToast({
          type: "success",
          text: "폴더가 선택되었습니다!",
        });
      } else {
        console.log("폴더 선택이 취소되었습니다.");
        showGlobalToast({
          type: "info",
          text: "폴더 선택이 취소되었습니다.",
        });
      }
    } catch (error) {
      console.error("폴더 선택 실패:", error);
      showGlobalToast({
        type: "error",
        text: "폴더 선택에 실패했습니다.",
      });
    }
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem("defaultSettings");
    showGlobalToast({
      type: "success",
      text: "기본 설정이 초기화되었습니다!",
    });
  };

  // 스타일 관련 상수
  const sectionGap = tokens.spacingVerticalXXL;
  const itemGap = tokens.spacingHorizontalXL;
  const gridTemplate = "minmax(300px, 1fr) 1fr";

  // 드롭다운 현재 값 매핑 헬퍼 함수
  const getDropdownValue = (options, currentValue) => {
    const selected = options.find((opt) => opt.value === currentValue);
    return selected ? selected.text : "선택해주세요";
  };

  return (
    <div className={containerStyles.container}>
      <SettingsHeader
        icon={<SettingsRegular />}
        title="기본 설정"
        description="애플리케이션의 기본 동작을 설정하고, AI 모델 및 출력 품질을 구성합니다."
      />

      <Card className={cardStyles.settingsCard} style={{ padding: sectionGap }}>
        {/* 일반 설정 섹션 */}
        <div style={{ marginBottom: sectionGap }}>
          <Text
            size={500}
            weight="semibold"
            style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: tokens.spacingVerticalM }}
          >
            <VideoRegular /> 일반 설정
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: itemGap }}>
            <Field label="영상 저장 폴더" hint="생성된 영상 파일이 저장될 경로입니다.">
              <div className={settingsStyles.folderSection}>
                <Input
                  className={settingsStyles.folderInput}
                  value={settings.videoSaveFolder}
                  onChange={(_, data) => setSettings((prev) => ({ ...prev, videoSaveFolder: data.value }))}
                  contentBefore={<FolderRegular />}
                />
                <Button appearance="secondary" onClick={selectFolder}>
                  폴더 선택
                </Button>
              </div>
            </Field>

            <Field label="기본 해상도" hint="새로 생성되는 영상의 기본 해상도입니다.">
              <Dropdown
                value={
                  settings.defaultResolution === "1080p"
                    ? "1920x1080 (Full HD)"
                    : settings.defaultResolution === "720p"
                    ? "1280x720 (HD)"
                    : "3840x2160 (4K)"
                }
                selectedOptions={[settings.defaultResolution]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, defaultResolution: data.optionValue }))}
              >
                <Option value="1080p">1920x1080 (Full HD)</Option>
                <Option value="720p">1280x720 (HD)</Option>
                <Option value="4k">3840x2160 (4K)</Option>
              </Dropdown>
            </Field>
          </div>
        </div>

        <Divider />

        {/* AI 모델 설정 섹션 */}
        <div style={{ marginTop: sectionGap }}>
          <Text
            size={500}
            weight="semibold"
            style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: tokens.spacingVerticalM }}
          >
            <PuzzlePieceRegular /> AI 모델 설정
          </Text>
          <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: itemGap }}>
            {/* 이미지 생성 모델 */}
            <Field label="이미지 생성 모델" hint="썸네일 및 이미지 생성에 사용할 AI 모델입니다.">
              <Dropdown
                value={getDropdownValue(AI_OPTIONS.imageModels, settings.imageModel)}
                selectedOptions={[settings.imageModel]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, imageModel: data.optionValue }))}
              >
                {AI_OPTIONS.imageModels.map((model) => (
                  <Option key={model.value} value={model.value} text={model.text}>
                    {model.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>({model.cost})</Caption1>
                  </Option>
                ))}
              </Dropdown>
            </Field>

            {/* 비디오 생성 모델 */}
            <Field label="비디오 생성 모델" hint="동영상 생성에 사용할 AI 모델입니다.">
              <Dropdown
                value={getDropdownValue(AI_OPTIONS.videoModels, settings.videoModel)}
                selectedOptions={[settings.videoModel]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, videoModel: data.optionValue }))}
              >
                {AI_OPTIONS.videoModels.map((model) => (
                  <Option key={model.value} value={model.value} disabled={model.status === "준비 중"}>
                    {model.text}{" "}
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      ({model.status === "추천" ? `⭐ ${model.status}` : model.status})
                    </Caption1>
                  </Option>
                ))}
              </Dropdown>
            </Field>

            {/* 이미지 생성 해상도 */}
            <Field label="이미지 생성 해상도" hint="생성될 이미지의 기본 해상도입니다.">
              <Dropdown
                value={getDropdownValue(AI_OPTIONS.imageResolutions, settings.imageResolution)}
                selectedOptions={[settings.imageResolution]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, imageResolution: data.optionValue }))}
              >
                {AI_OPTIONS.imageResolutions.map((res) => (
                  <Option key={res.value} value={res.value}>
                    {res.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>({res.speed})</Caption1>
                  </Option>
                ))}
              </Dropdown>
            </Field>

            {/* 비디오 생성 품질 */}
            <Field label="비디오 생성 품질" hint="생성될 비디오의 기본 품질입니다.">
              <Dropdown
                value={getDropdownValue(AI_OPTIONS.videoQualities, settings.videoQuality)}
                selectedOptions={[settings.videoQuality]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, videoQuality: data.optionValue }))}
              >
                {AI_OPTIONS.videoQualities.map((quality) => (
                  <Option key={quality.value} value={quality.value}>
                    {quality.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>({quality.speed})</Caption1>
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>

          <div className={settingsStyles.infoBox} style={{ marginTop: tokens.spacingVerticalXL }}>
            <div className={settingsStyles.infoIcon}>
              <InfoRegular />
            </div>
            <div className={settingsStyles.infoContent}>
              <Text size={300} weight="semibold" style={{ marginBottom: tokens.spacingVerticalS }}>
                AI 모델 관련 참고 사항
              </Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3, lineHeight: 1.4 }}>
                프레임레이트: **24fps** 고정
                <br />
                영상 길이: 모델별 제한 (Veo 3: 8초, Kling: 5초)
                <br />
                오디오 생성: AI 모델에 따라 지원 여부 상이
              </Caption1>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div style={{ display: "flex", gap: "16px", marginTop: "40px", padding: "0 16px 16px 16px" }}>
          <Button appearance="primary" icon={<SaveRegular />} onClick={saveSettings}>
            설정 저장
          </Button>
          <Button appearance="secondary" icon={<ArrowResetRegular />} onClick={resetSettings}>
            기본값으로 초기화
          </Button>
        </div>
      </Card>
    </div>
  );
}
