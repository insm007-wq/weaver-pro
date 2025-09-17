import React, { useState, useEffect } from "react";
import { Text, Button, Dropdown, Option, Field, Input, Card, Caption1, Label, tokens, Divider } from "@fluentui/react-components";
import {
  FolderRegular,
  InfoRegular,
  SaveRegular,
  ArrowResetRegular,
  VideoRegular,
  PuzzlePieceRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { showGlobalToast } from "../../common/GlobalToast";
import { useApi } from "../../../hooks/useApi";
import { DEFAULT_SETTINGS, AI_OPTIONS, AI_MODEL_INFO } from "../../../constants/aiModels";

/**
 * DefaultsTab 컴포넌트
 *
 * @description
 * 애플리케이션의 기본 설정을 관리하는 탭 컴포넌트입니다.
 * AI 모델, 해상도, 품질 설정 및 영상 저장 폴더를 구성하고
 * 모든 설정을 전역 설정 파일(settings.json)에 저장합니다.
 *
 * @features
 * - 일반 설정: 영상 저장 폴더, 기본 해상도
 * - AI 모델 설정: 이미지/비디오 생성 모델, LLM 모델
 * - 설정 저장/로드: 전역 설정 파일 기반
 * - 설정 초기화: 기본값으로 복원
 * - 폴더 열기: 영상 저장 폴더 빠른 접근
 *
 * @ipc_apis
 * ⚙️ 설정 관리 APIs (electron/services/store.js):
 * - window.api.getSetting(key) - 개별 설정값 조회
 * - window.api.setSetting({key, value}) - 개별 설정값 저장
 *
 * 📂 파일/폴더 APIs (electron/ipc/file-pickers.js):
 * - shell:openPath - 폴더/파일 열기 (line 48)
 *
 * @settings_stored
 * 다음 설정들이 settings.json에 저장됨:
 * - defaultResolution: 기본 해상도 (1080p, 720p, 4k)
 * - imageModel: 이미지 생성 모델 (sdxl, dalle3, etc.)
 * - imageResolution: 이미지 해상도 (1024x1024, etc.)
 * - videoModel: 비디오 생성 모델 (veo-3, runway, etc.)
 * - videoQuality: 비디오 품질 (1080p, 720p, 4k)
 * - llmModel: LLM 모델 (anthropic, openai, etc.)
 * - videoSaveFolder: 영상 저장 폴더
 * - projectRootFolder: 프로젝트 루트 폴더 (자동 추출)
 * - defaultProjectName: 기본 프로젝트 이름 (자동 추출)
 *
 * @author Weaver Pro Team
 * @version 2.0.0
 */

export default function DefaultsTab() {
  // Fluent UI 스타일 훅
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const api = useApi();

  // 상태 관리
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [displayFolder, setDisplayFolder] = useState("");

  /**
   * 컴포넌트 마운트 시 초기 데이터 로드
   */
  useEffect(() => {
    /**
     * 전역 설정에서 모든 기본 설정들을 로드하는 함수
     * settings.json에서 AI 모델, 해상도, 품질 설정들을 읽어옴
     */
    const loadAllSettings = async () => {
      try {
        const settingsToLoad = ["defaultResolution", "imageModel", "imageResolution", "videoModel", "videoQuality", "llmModel"];

        const loadedSettings = {};
        for (const key of settingsToLoad) {
          try {
            const value = await window.api.getSetting(key);
            if (value !== null && value !== undefined) {
              loadedSettings[key] = value;
            }
          } catch (error) {
            console.warn(`설정 로드 실패: ${key}`, error);
          }
        }

        if (Object.keys(loadedSettings).length > 0) {
          setSettings((prevSettings) => ({ ...prevSettings, ...loadedSettings }));
        }
      } catch (error) {
        console.error("기본 설정 로드 실패:", error);
      }
    };

    loadAllSettings();

    /**
     * 프로젝트 관리에서 저장한 경로를 로드하여 영상 저장 폴더 설정
     * projectRootFolder + defaultProjectName 형태로 구성
     */
    const loadProjectRootFolder = async () => {
      try {
        const projectRootFolder = await window.api.getSetting("projectRootFolder");
        const defaultProjectName = await window.api.getSetting("defaultProjectName");

        if (projectRootFolder && defaultProjectName) {
          // 경로 정리 (이중 백슬래시 제거)
          const cleanRootFolder = projectRootFolder.replace(/\\+/g, "\\").replace(/\\$/, "");
          const folderPath = `${cleanRootFolder}\\${defaultProjectName}`;

          setDisplayFolder(folderPath);
          // videoSaveFolder도 업데이트
          setSettings((prev) => ({ ...prev, videoSaveFolder: folderPath }));
        } else {
          setDisplayFolder("프로젝트 관리에서 경로를 설정해주세요");
        }
      } catch (error) {
        console.error("프로젝트 경로 로드 실패:", error);
        setDisplayFolder("프로젝트 경로를 불러올 수 없습니다");
      }
    };

    loadProjectRootFolder();

    /**
     * 프로젝트 설정 업데이트 이벤트 리스너
     * 프로젝트 관리에서 설정이 변경되면 자동으로 영상 저장 폴더 업데이트
     */
    const handleProjectSettingsUpdate = () => {
      loadProjectRootFolder();
    };

    window.addEventListener("projectSettings:updated", handleProjectSettingsUpdate);

    return () => {
      window.removeEventListener("projectSettings:updated", handleProjectSettingsUpdate);
    };
  }, []);

  /**
   * 모든 기본 설정을 전역 설정 파일(settings.json)에 저장
   * AI 모델 설정 + 프로젝트 경로 정보 동시 저장
   */
  const saveSettings = async () => {
    try {
      // 기본 설정들을 전역 설정에 저장
      const settingsToSave = [
        "defaultResolution",
        "imageModel",
        "imageResolution",
        "videoModel",
        "videoQuality",
        "llmModel",
        "videoSaveFolder",
      ];

      for (const key of settingsToSave) {
        if (settings[key] !== undefined && settings[key] !== null) {
          try {
            await window.api.setSetting({
              key: key,
              value: settings[key],
            });
            console.log(`설정 저장: ${key} = ${settings[key]}`);
          } catch (error) {
            console.warn(`설정 저장 실패: ${key}`, error);
          }
        }
      }

      // videoSaveFolder 경로에서 프로젝트 정보 자동 추출 및 저장
      if (settings.videoSaveFolder) {
        try {
          const folderParts = settings.videoSaveFolder.split("\\");
          if (folderParts.length > 1) {
            const projectName = folderParts[folderParts.length - 1]; // 마지막 폴더명 (프로젝트명)
            const rootFolder = folderParts.slice(0, -1).join("\\") + "\\"; // 루트 폴더

            await window.api.setSetting({
              key: "projectRootFolder",
              value: rootFolder,
            });
            await window.api.setSetting({
              key: "defaultProjectName",
              value: projectName,
            });

            console.log(`프로젝트 정보 저장: projectRootFolder=${rootFolder}, defaultProjectName=${projectName}`);
          }
        } catch (projectError) {
          console.warn("프로젝트 정보 저장 실패:", projectError);
        }
      }

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

  /**
   * 폴더 선택 대화상자를 열어 영상 저장 폴더 변경
   * 사용자가 직접 폴더를 선택할 수 있는 기능 (현재 미사용)
   */
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

  /**
   * 모든 기본 설정을 초기값으로 복원
   * UI 상태와 전역 설정 파일 모두 초기화
   */
  const resetSettings = async () => {
    try {
      setSettings(DEFAULT_SETTINGS);

      // 전역 설정에서도 기본값으로 초기화
      const settingsToReset = [
        "defaultResolution",
        "imageModel",
        "imageResolution",
        "videoModel",
        "videoQuality",
        "llmModel",
        "videoSaveFolder",
      ];

      for (const key of settingsToReset) {
        if (DEFAULT_SETTINGS[key] !== undefined) {
          try {
            await window.api.setSetting({
              key: key,
              value: DEFAULT_SETTINGS[key],
            });
          } catch (error) {
            console.warn(`설정 초기화 실패: ${key}`, error);
          }
        }
      }

      showGlobalToast({
        type: "success",
        text: "기본 설정이 초기화되고 저장되었습니다! 🎉",
      });
    } catch (error) {
      console.error("설정 초기화 실패:", error);
      showGlobalToast({
        type: "error",
        text: "설정 초기화에 실패했습니다.",
      });
    }
  };

  /**
   * 영상 저장 폴더를 시스템 파일 탐색기로 열기
   * shell:openPath API를 사용하여 폴더 열기
   */
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

  // UI 레이아웃을 위한 스타일 상수
  const sectionGap = tokens.spacingVerticalXXL;
  const itemGap = tokens.spacingHorizontalXL;
  const gridTemplate = "minmax(300px, 1fr) 1fr";

  /**
   * 드롭다운 현재 값 매핑 헬퍼 함수
   * 설정값에 해당하는 표시 텍스트를 찾아 반환
   * @param {Array} options - 드롭다운 옵션 배열
   * @param {string} currentValue - 현재 설정값
   * @returns {string} 표시할 텍스트
   */
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
                    cursor: "default",
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
                  <Option key={model.value} value={model.value} text={model.text} disabled={model.status === "준비 중"}>
                    {model.text}{" "}
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      ({model.provider}) - {model.cost}
                    </Caption1>
                    {model.status === "준비 중" && (
                      <Caption1 style={{ color: tokens.colorPaletteDarkOrangeBackground3, marginLeft: "4px" }}>- 준비 중</Caption1>
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
                    {model.text}{" "}
                    <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      ({model.provider} - {model.cost})
                    </Caption1>
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
