import React from "react";
import {
  Text,
  Card,
  Caption1,
} from "@fluentui/react-components";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useSettingsStyles } from "../../../styles/commonStyles";


export default function AppearanceTab() {
  const containerStyles = useContainerStyles();
  const settingsStyles = useSettingsStyles();

  return (
    <div className={containerStyles.container}>
      {/* Header */}
      <SettingsHeader
        icon="🎨"
        title="테마 및 UI 설정"
        description={
          <>
            애플리케이션의 테마와 사용자 인터페이스를 설정합니다.
            <br />다크 모드, 색상 테마, 크기 등을 조정하여 최적의 사용 환경을 만드세요.
          </>
        }
      />

      {/* Placeholder Content */}
      <Card className={settingsStyles.placeholderCard}>
        <Text className={settingsStyles.placeholderText}>
          [외관] 탭의 내용은 추후 구현 예정입니다.
        </Text>
      </Card>
    </div>
  );
}