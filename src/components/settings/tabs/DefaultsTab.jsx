import React from "react";
import {
  makeStyles,
  tokens,
  shorthands,
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

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalL),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
    maxWidth: "1200px",
    margin: "0 auto",
  },

  header: {
    textAlign: "center",
    marginBottom: tokens.spacingVerticalL,
  },

  headerTitle: {
    background: `linear-gradient(135deg, ${tokens.colorBrandForeground1} 0%, ${tokens.colorPaletteBlueForeground2} 100%)`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: "1.4",
    wordBreak: "keep-all",
  },

  headerDescription: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    maxWidth: "600px",
    margin: "0 auto",
    lineHeight: "1.5",
  },

  settingsCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
  },

  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    ...shorthands.gap(tokens.spacingVerticalL),
  },

  folderSection: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalS),
    alignItems: "flex-end",
  },

  folderInput: {
    flex: 1,
  },

  infoBox: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
    display: "flex",
    alignItems: "flex-start",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },

  infoIcon: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorBrandForeground1,
    width: "32px",
    height: "32px",
    ...shorthands.borderRadius("50%"),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  infoContent: {
    flex: 1,
  },

  infoTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXS,
  },

  infoText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: "1.5",
  },
});

export default function DefaultsTab() {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>⚙️ 기본 설정 및 환경 구성</div>
        <Caption1 className={styles.headerDescription}>
          애플리케이션의 기본 동작을 설정합니다.<br />
          영상 저장 위치, 해상도, 생성 모델 등을 구성할 수 있습니다.
        </Caption1>
      </div>

      {/* Main Settings Card */}
      <Card className={styles.settingsCard}>
        <div className={styles.settingsGrid}>
          {/* 영상 저장 폴더 */}
          <Field label="🎥 영상 저장 폴더" hint="생성된 영상 파일이 저장될 경로입니다.">
            <div className={styles.folderSection}>
              <Input
                className={styles.folderInput}
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
          <div className={styles.infoBox}>
            <div className={styles.infoIcon}>
              <InfoRegular />
            </div>
            <div className={styles.infoContent}>
              <div className={styles.infoTitle}>영상 설정</div>
              <div className={styles.infoText}>
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