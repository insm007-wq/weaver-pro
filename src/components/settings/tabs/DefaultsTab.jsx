import React, { useState, useEffect } from "react";
import {
  Text,
  Button,
  Dropdown,
  Option,
  Field,
  Input,
  Card,
  Caption1,
  Label,
} from "@fluentui/react-components";
import {
  FolderRegular,
  InfoRegular,
  SaveRegular,
  ArrowResetRegular,
} from "@fluentui/react-icons";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";
import { showGlobalToast } from "../../common/GlobalToast";
import { useApi } from "../../../hooks/useApi";


export default function DefaultsTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const api = useApi();

  // 기본 설정 상태
  const [settings, setSettings] = useState({
    videoSaveFolder: "C:\\weaverPro\\",
    defaultResolution: "1080p", 
    imageModel: "flux-dev",
    videoModel: "veo-3",
    imageResolution: "1024x1024",
    videoQuality: "1080p"
  });

  // 컴포넌트 마운트 시 저장된 설정 불러오기
  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('defaultSettings');
      if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prevSettings => ({ ...prevSettings, ...parsedSettings }));
      }
    } catch (error) {
      console.error('기본 설정 로드 실패:', error);
    }
  }, []);

  // 설정 저장
  const saveSettings = async () => {
    try {
      localStorage.setItem('defaultSettings', JSON.stringify(settings));
      showGlobalToast({ 
        type: 'success', 
        text: '기본 설정이 저장되었습니다! 🎉' 
      });
    } catch (error) {
      console.error('기본 설정 저장 실패:', error);
      showGlobalToast({ 
        type: 'error', 
        text: '기본 설정 저장에 실패했습니다.' 
      });
    }
  };

  // 폴더 선택
  const selectFolder = async () => {
    try {
      console.log('폴더 선택 시작...');
      // Electron의 dialog API를 사용하여 폴더 선택
      const result = await api.invoke('dialog:selectFolder');
      console.log('폴더 선택 결과:', result);
      
      if (result && result.success && result.data && !result.data.canceled && result.data.filePaths && result.data.filePaths.length > 0) {
        console.log('선택된 폴더:', result.data.filePaths[0]);
        setSettings(prev => ({ ...prev, videoSaveFolder: result.data.filePaths[0] }));
        showGlobalToast({ 
          type: 'success', 
          text: '폴더가 선택되었습니다!' 
        });
      } else {
        console.log('폴더 선택이 취소되었습니다.');
        showGlobalToast({ 
          type: 'info', 
          text: '폴더 선택이 취소되었습니다.' 
        });
      }
    } catch (error) {
      console.error('폴더 선택 실패:', error);
      showGlobalToast({ 
        type: 'error', 
        text: '폴더 선택에 실패했습니다.' 
      });
    }
  };

  // 설정 초기화
  const resetSettings = () => {
    const defaultSettings = {
      videoSaveFolder: "C:\\weaverPro\\",
      defaultResolution: "1080p", 
      imageModel: "flux-dev",
      videoModel: "veo-3",
      imageResolution: "1024x1024",
      videoQuality: "1080p"
    };
    setSettings(defaultSettings);
    localStorage.removeItem('defaultSettings');
    showGlobalToast({ 
      type: 'success', 
      text: '기본 설정이 초기화되었습니다!' 
    });
  };

  return (
    <div className={containerStyles.container}>
      {/* Header */}
      <SettingsHeader
        icon="⚙️"
        title="기본 설정 및 환경 구성"
        description={
          <>
            애플리케이션의 기본 동작을 설정합니다.
            <br />영상 저장 위치, 해상도, 생성 모델 등을 구성할 수 있습니다.
          </>
        }
      />

      {/* Main Settings Card */}
      <Card className={cardStyles.settingsCard}>
        <div className={settingsStyles.settingsGrid}>
          {/* 영상 저장 폴더 */}
          <Field label="🎥 영상 저장 폴더" hint="생성된 영상 파일이 저장될 경로입니다.">
            <div className={settingsStyles.folderSection}>
              <Input
                className={settingsStyles.folderInput}
                value={settings.videoSaveFolder}
                onChange={(_, data) => setSettings(prev => ({ ...prev, videoSaveFolder: data.value }))}
                contentBefore={<FolderRegular />}
              />
              <Button appearance="secondary" onClick={selectFolder}>폴더 선택</Button>
            </div>
          </Field>

          {/* 기본 해상도 */}
          <Field label="📐 기본 해상도" hint="새로 생성되는 영상의 기본 해상도입니다.">
            <Dropdown
              value={settings.defaultResolution === "1080p" ? "1920x1080 (Full HD)" : 
                    settings.defaultResolution === "720p" ? "1280x720 (HD)" : 
                    "3840x2160 (4K)"}
              selectedOptions={[settings.defaultResolution]}
              onOptionSelect={(_, data) => setSettings(prev => ({ ...prev, defaultResolution: data.optionValue }))}
            >
              <Option value="1080p">1920x1080 (Full HD)</Option>
              <Option value="720p">1280x720 (HD)</Option>
              <Option value="4k">3840x2160 (4K)</Option>
            </Dropdown>
          </Field>

          {/* 이미지 생성 모델 */}
          <Field label="🧠 이미지 생성 모델" hint="썸네일 및 이미지 생성에 사용할 AI 모델입니다.">
            <Dropdown
              value={settings.imageModel === "flux-dev" ? "Flux Dev (고품질, 35원)" : 
                    settings.imageModel === "flux-schnell" ? "Flux Schnell (속도 우선)" :
                    settings.imageModel === "dall-e-3" ? "DALL-E 3 (OpenAI, 고품질)" :
                    settings.imageModel === "midjourney" ? "Midjourney (예술적)" :
                    "Stable Diffusion (무료)"}
              selectedOptions={[settings.imageModel]}
              onOptionSelect={(_, data) => setSettings(prev => ({ ...prev, imageModel: data.optionValue }))}
            >
              <Option value="flux-dev">Flux Dev (고품질, 35원)</Option>
              <Option value="flux-schnell">Flux Schnell (속도 우선)</Option>
              <Option value="dall-e-3">DALL-E 3 (OpenAI, 고품질)</Option>
              <Option value="midjourney">Midjourney (예술적)</Option>
              <Option value="stable-diffusion">Stable Diffusion (무료)</Option>
            </Dropdown>
          </Field>

          {/* 이미지 해상도 */}
          <Field label="📏 이미지 생성 해상도" hint="생성될 이미지의 기본 해상도입니다.">
            <Dropdown
              value={settings.imageResolution === "512x512" ? "512x512 (빠름)" :
                    settings.imageResolution === "1024x1024" ? "1024x1024 (표준)" :
                    settings.imageResolution === "1536x1536" ? "1536x1536 (고화질)" :
                    "2048x2048 (최고화질)"}
              selectedOptions={[settings.imageResolution]}
              onOptionSelect={(_, data) => setSettings(prev => ({ ...prev, imageResolution: data.optionValue }))}
            >
              <Option value="512x512">512x512 (빠름)</Option>
              <Option value="1024x1024">1024x1024 (표준)</Option>
              <Option value="1536x1536">1536x1536 (고화질)</Option>
              <Option value="2048x2048">2048x2048 (최고화질)</Option>
            </Dropdown>
          </Field>

          {/* 비디오 생성 모델 */}
          <Field label="🎬 비디오 생성 모델" hint="동영상 생성에 사용할 AI 모델입니다.">
            <Dropdown
              value={settings.videoModel === "veo-3" ? "Google Veo 3 (추천, 8초)" :
                    settings.videoModel === "kling" ? "Kling AI (5초)" :
                    settings.videoModel === "runway" ? "Runway ML (4초)" :
                    settings.videoModel === "pika" ? "Pika Labs (3초)" :
                    "Stable Video (무료, 4초)"}
              selectedOptions={[settings.videoModel]}
              onOptionSelect={(_, data) => setSettings(prev => ({ ...prev, videoModel: data.optionValue }))}
            >
              <Option value="veo-3">Google Veo 3 (추천, 8초)</Option>
              <Option value="kling" disabled>Kling AI (5초) - 준비 중</Option>
              <Option value="runway" disabled>Runway ML (4초) - 준비 중</Option>
              <Option value="pika" disabled>Pika Labs (3초) - 준비 중</Option>
              <Option value="stable-video" disabled>Stable Video (무료, 4초) - 준비 중</Option>
            </Dropdown>
          </Field>

          {/* 비디오 품질 */}
          <Field label="🎥 비디오 생성 품질" hint="생성될 비디오의 기본 품질입니다.">
            <Dropdown
              value={settings.videoQuality === "720p" ? "720p (빠름)" :
                    settings.videoQuality === "1080p" ? "1080p (표준)" :
                    "4K (최고품질, 느림)"}
              selectedOptions={[settings.videoQuality]}
              onOptionSelect={(_, data) => setSettings(prev => ({ ...prev, videoQuality: data.optionValue }))}
            >
              <Option value="720p">720p (빠름)</Option>
              <Option value="1080p">1080p (표준)</Option>
              <Option value="4k">4K (최고품질, 느림)</Option>
            </Dropdown>
          </Field>

          {/* 정보 박스 */}
          <div className={settingsStyles.infoBox}>
            <div className={settingsStyles.infoIcon}>
              <InfoRegular />
            </div>
            <div className={settingsStyles.infoContent}>
              <div className={settingsStyles.infoTitle}>AI 생성 설정</div>
              <div className={settingsStyles.infoText}>
                프레임레이트: <strong>24fps</strong> 고정<br />
                영상 길이: 모델별 제한 (Veo 3: 8초, Kling: 5초)<br />
                오디오 생성: 자동 (Veo 3 모델 지원)
              </div>
            </div>
          </div>
        </div>

        {/* 하단 액션 버튼 */}
        <div style={{ display: "flex", gap: "16px", marginTop: "24px", padding: "0 16px 16px 16px" }}>
          <Button 
            appearance="primary" 
            icon={<SaveRegular />}
            onClick={saveSettings}
          >
            설정 저장
          </Button>
          <Button 
            appearance="secondary" 
            icon={<ArrowResetRegular />}
            onClick={resetSettings}
          >
            기본값으로 초기화
          </Button>
        </div>
      </Card>
    </div>
  );
}