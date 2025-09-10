import React from "react";
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
  VideoRegular,
  SettingsRegular,
  InfoRegular,
} from "@fluentui/react-icons";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";


export default function DefaultsTab() {
  const containerStyles = useContainerStyles();
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

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
                defaultValue="C:\\tmplav"
                contentBefore={<FolderRegular />}
              />
              <Button appearance="secondary">폴더 선택</Button>
            </div>
          </Field>

          {/* 기본 해상도 */}
          <Field label="📐 기본 해상도" hint="새로 생성되는 영상의 기본 해상도입니다.">
            <Dropdown
              defaultValue="1920x1080 (Full HD)"
              defaultSelectedOptions={["1080p"]}
            >
              <Option value="1080p">1920x1080 (Full HD)</Option>
              <Option value="720p">1280x720 (HD)</Option>
              <Option value="4k">3840x2160 (4K)</Option>
            </Dropdown>
          </Field>

          {/* 이미지 생성 모델 */}
          <Field label="🧠 이미지 생성 모델" hint="썸네일 및 이미지 생성에 사용할 AI 모델입니다.">
            <Dropdown
              defaultValue="Flux Dev (고품질, 35원)"
              defaultSelectedOptions={["flux-dev"]}
            >
              <Option value="flux-dev">Flux Dev (고품질, 35원)</Option>
              <Option value="flux-schnell">Flux Schnell (속도 우선)</Option>
            </Dropdown>
          </Field>

          {/* 정보 박스 */}
          <div className={settingsStyles.infoBox}>
            <div className={settingsStyles.infoIcon}>
              <InfoRegular />
            </div>
            <div className={settingsStyles.infoContent}>
              <div className={settingsStyles.infoTitle}>영상 설정</div>
              <div className={settingsStyles.infoText}>
                프레임레이트: <strong>24fps</strong> 고정<br />
                영상 길이: 프로젝트 생성 시 설정
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}