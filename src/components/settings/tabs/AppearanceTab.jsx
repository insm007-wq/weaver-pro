import React from "react";
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Card,
  Caption1,
} from "@fluentui/react-components";

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

  placeholderCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalXXL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
    textAlign: "center",
  },

  placeholderText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase400,
  },
});

export default function AppearanceTab() {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>🎨 테마 및 UI 설정</div>
        <Caption1 className={styles.headerDescription}>
          애플리케이션의 테마와 사용자 인터페이스를 설정합니다.<br />
          다크 모드, 색상 테마, 크기 등을 조정하여 최적의 사용 환경을 만드세요.
        </Caption1>
      </div>

      {/* Placeholder Content */}
      <Card className={styles.placeholderCard}>
        <Text className={styles.placeholderText}>
          [외관] 탭의 내용은 추후 구현 예정입니다.
        </Text>
      </Card>
    </div>
  );
}