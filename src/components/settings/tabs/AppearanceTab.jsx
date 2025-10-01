import React from "react";
import {
  Text,
  Card,
} from "@fluentui/react-components";
import { useContainerStyles, useSettingsStyles } from "../../../styles/commonStyles";


export default function AppearanceTab() {
  const containerStyles = useContainerStyles();
  const settingsStyles = useSettingsStyles();

  return (
    <div className={containerStyles.container}>
      {/* Placeholder Content */}
      <Card className={settingsStyles.placeholderCard}>
        <Text className={settingsStyles.placeholderText}>
          [외관] 탭의 내용은 추후 구현 예정입니다.
        </Text>
      </Card>
    </div>
  );
}