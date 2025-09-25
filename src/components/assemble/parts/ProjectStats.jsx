import React from "react";
import { tokens, Body2, Caption1, Card, CardFooter } from "@fluentui/react-components";
import { CheckmarkCircle20Filled, PlugDisconnected20Regular } from "@fluentui/react-icons";

/**
 * 프로젝트 통계 정보를 표시하는 컴포넌트
 */
const ProjectStats = ({ srtConnected, mp3Connected, scenesCount, totalDuration }) => {
  const StatItem = ({ label, value, icon, color, isLast }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: tokens.spacingVerticalXXS,
        flex: "1 1 100px",
        padding: tokens.spacingVerticalXS,
        borderRight: isLast ? "none" : `1px solid ${tokens.colorNeutralStroke2}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {icon}
        <Caption1 style={{ fontWeight: "600", color: tokens.colorNeutralForeground2 }}>{label}</Caption1>
      </div>
      <Body2
        style={{
          fontWeight: "700",
          color: color || tokens.colorNeutralForeground1,
        }}
      >
        {value}
      </Body2>
    </div>
  );

  return (
    <Card
      style={{
        padding: "12px 16px",
        borderRadius: "16px",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        height: "fit-content",
      }}
    >
      <CardFooter
        style={{
          borderTop: "none",
          padding: tokens.spacingVerticalS,
          backgroundColor: tokens.colorNeutralBackground2,
          display: "flex",
          justifyContent: "space-around",
          gap: tokens.spacingHorizontalS,
        }}
      >
        <StatItem
          label="SRT 자막 파일"
          value={srtConnected ? "완료" : "미연결"}
          color={srtConnected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
          icon={
            srtConnected ? (
              <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} />
            ) : (
              <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />
            )
          }
        />
        <StatItem
          label="MP3 파일"
          value={mp3Connected ? "완료" : "미연결"}
          color={mp3Connected ? tokens.colorPaletteLightGreenForeground1 : tokens.colorNeutralForeground3}
          icon={
            mp3Connected ? (
              <CheckmarkCircle20Filled color={tokens.colorPaletteLightGreenForeground1} />
            ) : (
              <PlugDisconnected20Regular color={tokens.colorNeutralForeground3} />
            )
          }
        />
        <StatItem
          label="씬 수"
          value={`${scenesCount}개`}
          color={scenesCount > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
        />
        <StatItem
          label="총 영상 길이"
          value={scenesCount > 0 ? `${totalDuration.toFixed(1)}초` : "0초"}
          color={scenesCount > 0 ? tokens.colorBrandForeground1 : tokens.colorNeutralForeground3}
          isLast={true}
        />
      </CardFooter>
    </Card>
  );
};

export default ProjectStats;
