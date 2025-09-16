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
import { DEFAULT_SETTINGS, AI_OPTIONS, AI_MODEL_INFO } from "../../../constants/aiModels";

export default function DefaultsTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const api = useApi();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [displayFolder, setDisplayFolder] = useState("");

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

    // 프로젝트 관리에서 저장한 경로 로드
    const loadProjectRootFolder = async () => {
      try {
        const projectRootFolder = await window.api.getSetting("projectRootFolder");
        const defaultProjectName = await window.api.getSetting("defaultProjectName");

        if (projectRootFolder && defaultProjectName) {
          const today = new Date().toISOString().split('T')[0];
          // 경로 정리 (이중 백슬래시 제거)
          const cleanRootFolder = projectRootFolder.replace(/\\+/g, '\\').replace(/\\$/, '');
          const folderPath = `${cleanRootFolder}\\${today}\\${defaultProjectName}`;

          setDisplayFolder(folderPath);
          // videoSaveFolder도 업데이트
          setSettings(prev => ({ ...prev, videoSaveFolder: folderPath }));
        } else {
          setDisplayFolder("프로젝트 관리에서 경로를 설정해주세요");
        }
      } catch (error) {
        console.error("프로젝트 경로 로드 실패:", error);
        setDisplayFolder("프로젝트 경로를 불러올 수 없습니다");
      }
    };

    loadProjectRootFolder();

    // 프로젝트 설정 업데이트 이벤트 리스너
    const handleProjectSettingsUpdate = () => {
      loadProjectRootFolder();
    };

    window.addEventListener('projectSettings:updated', handleProjectSettingsUpdate);

    return () => {
      window.removeEventListener('projectSettings:updated', handleProjectSettingsUpdate);
    };
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

  const openVideoFolder = async () => {
    try {
      const folderPath = displayFolder || settings.videoSaveFolder;
      if (!folderPath) {
        showGlobalToast({
          type: "error",
          text: "폴더 경로가 설정되지 않았습니다.",
        });
        return;
      }

      const result = await api.invoke("shell:openPath", folderPath);
      if (result.success) {
        showGlobalToast({
          type: "success",
          text: "폴더를 열었습니다.",
        });
      } else {
        showGlobalToast({
          type: "error",
          text: result.message || "폴더 열기에 실패했습니다.",
        });
      }
    } catch (error) {
      console.error("폴더 열기 오류:", error);
      showGlobalToast({
        type: "error",
        text: "폴더 열기에 실패했습니다.",
      });
    }
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
            <Field label="영상 저장 폴더" hint="프로젝트 관리에서 설정한 경로 기반으로 자동 생성됩니다.">
              <div style={{ display: "flex", gap: "8px", alignItems: "stretch", maxWidth: "100%" }}>
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: tokens.colorNeutralBackground3,
                    border: `1px solid ${tokens.colorNeutralStroke1}`,
                    borderRadius: tokens.borderRadiusMedium,
                    color: tokens.colorNeutralForeground2,
                    fontFamily: "monospace",
                    fontSize: "13px",
                    width: "220px",
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    cursor: "default"
                  }}
                  title={displayFolder || settings.videoSaveFolder}
                >
                  {displayFolder || settings.videoSaveFolder}
                </div>
                <Button
                  appearance="secondary"
                  icon={<FolderRegular />}
                  onClick={openVideoFolder}
                  disabled={!displayFolder && !settings.videoSaveFolder}
                >
                  폴더 열기
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
          {/* 이미지 생성 설정 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: itemGap, marginBottom: tokens.spacingVerticalL }}>
            <Field label="이미지 생성 모델" hint="썸네일 및 이미지 생성에 사용할 AI 모델입니다.">
              <Dropdown
                value={getDropdownValue(AI_OPTIONS.imageModels, settings.imageModel)}
                selectedOptions={[settings.imageModel]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, imageModel: data.optionValue }))}
              >
                {AI_OPTIONS.imageModels.map((model) => (
                  <Option
                    key={model.value}
                    value={model.value}
                    text={model.text}
                    disabled={model.status === "준비 중"}
                  >
                    {model.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>({model.provider}) - {model.cost}</Caption1>
                    {model.status === "준비 중" && (
                      <Caption1 style={{ color: tokens.colorPaletteDarkOrangeBackground3, marginLeft: "4px" }}>
                        - 준비 중
                      </Caption1>
                    )}
                  </Option>
                ))}
              </Dropdown>
            </Field>

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
          </div>

          {/* 비디오 생성 설정 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: itemGap, marginBottom: tokens.spacingVerticalL }}>
            <Field label="비디오 생성 모델" hint="동영상 생성에 사용할 AI 모델입니다.">
              <Dropdown
                value={getDropdownValue(AI_OPTIONS.videoModels, settings.videoModel)}
                selectedOptions={[settings.videoModel]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, videoModel: data.optionValue }))}
              >
                {AI_OPTIONS.videoModels.map((model) => (
                  <Option key={model.value} value={model.value} disabled={model.status === "준비 중"}>
                    {model.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>({model.provider})</Caption1>
                    <Caption1 style={{ color: tokens.colorNeutralForeground3, marginLeft: "4px" }}>
                      {model.status === "추천" ? ` - ⭐ ${model.status}` : ` - ${model.status}`}
                    </Caption1>
                  </Option>
                ))}
              </Dropdown>
            </Field>

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

          {/* LLM 모델 설정 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: itemGap, maxWidth: "50%" }}>
            <Field label="대본 생성 LLM 모델" hint="대본 생성에 사용할 AI 언어모델입니다.">
              <Dropdown
                value={getDropdownValue(AI_OPTIONS.llmModels, settings.llmModel)}
                selectedOptions={[settings.llmModel]}
                onOptionSelect={(_, data) => setSettings((prev) => ({ ...prev, llmModel: data.optionValue }))}
              >
                {AI_OPTIONS.llmModels.map((model) => (
                  <Option key={model.value} value={model.value}>
                    {model.text} <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>({model.provider} - {model.cost})</Caption1>
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
                {AI_MODEL_INFO.title}
              </Text>
              <Caption1 style={{ color: tokens.colorNeutralForeground3, lineHeight: 1.4 }}>
                {AI_MODEL_INFO.description.map((line, index) => (
                  <span key={index}>
                    {line}
                    {index < AI_MODEL_INFO.description.length - 1 && <br />}
                  </span>
                ))}
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
