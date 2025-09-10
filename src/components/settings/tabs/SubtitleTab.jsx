import React from "react";
import {
  Text,
  Card,
} from "@fluentui/react-components";
import { SettingsHeader } from "../../common";
import { useContainerStyles, useSettingsStyles } from "../../../styles/commonStyles";


export default function SubtitleTab() {
  const containerStyles = useContainerStyles();
  const settingsStyles = useSettingsStyles();

  return (
    <div className={containerStyles.container}>
      {/* Header */}
      <SettingsHeader
        icon="📝"
        title="자막 및 텍스트 설정"
        description={
          <>
            영상에 표시되는 자막의 모양과 위치를 설정합니다.
            <br />폰트, 색상, 크기, 위치 등을 조정하여 최적의 가독성을 확보하세요.
          </>
        }
      />

      {/* Placeholder Content */}
      <Card className={settingsStyles.placeholderCard}>
        <Text className={settingsStyles.placeholderText}>
          [자막] 탭의 내용은 추후 구현 예정입니다.
        </Text>
      </Card>
    </div>
  );
}