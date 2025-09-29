import React from "react";
import { Text, Button, Card, Divider, Badge } from "@fluentui/react-components";
import {
  SettingsRegular,
  VideoRegular,
  ImageRegular,
} from "@fluentui/react-icons";

function SceneEditor({ selectedScene }) {
  return (
    <Card
      style={{
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        flex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SettingsRegular style={{ fontSize: 18 }} />
        <Text size={400} weight="semibold">
          씬 편집
        </Text>
      </div>

      {selectedScene ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 현재 미디어 정보 */}
          <div>
            <Text size={400} weight="medium" style={{ marginBottom: 12, fontSize: "15px" }}>
              현재 미디어
            </Text>
            {selectedScene.asset?.path ? (
              <div
                style={{
                  padding: 12,
                  backgroundColor: "#f3f9ff",
                  borderRadius: 8,
                  border: "1px solid #b3d6fc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  {selectedScene.asset.type === "image" ? (
                    <ImageRegular style={{ fontSize: 16, color: "#0078d4" }} />
                  ) : (
                    <VideoRegular style={{ fontSize: 16, color: "#0078d4" }} />
                  )}
                  <Text size={200} weight="medium">
                    {selectedScene.asset.type === "image" ? "이미지" : "영상"} 연결됨
                  </Text>
                </div>
                <Text
                  size={200}
                  style={{
                    color: "#666",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: 4,
                  }}
                >
                  {selectedScene.asset.filename || selectedScene.asset.path}
                </Text>
                {selectedScene.asset.keyword && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <Badge appearance="outline" size="small">
                      키워드: {selectedScene.asset.keyword}
                    </Badge>
                    {selectedScene.asset.resolution && (
                      <Badge appearance="outline" size="small">
                        {selectedScene.asset.resolution}
                      </Badge>
                    )}
                    {selectedScene.asset.provider && (
                      <Badge appearance="outline" size="small">
                        {selectedScene.asset.provider}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: 12,
                  backgroundColor: "#fdf6f6",
                  borderRadius: 8,
                  border: "1px solid #f1b2b2",
                  textAlign: "center",
                }}
              >
                <Text size={300} style={{ color: "#a4262c", fontSize: "13px" }}>
                  연결된 미디어가 없습니다
                </Text>
              </div>
            )}
          </div>

          <Divider />

          {/* 미디어 효과 */}
          <div>
            <Text size={400} weight="medium" style={{ marginBottom: 12, fontSize: "15px" }}>
              미디어 효과
            </Text>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button appearance="secondary" size="small">
                켄번스 효과
              </Button>
              <Button appearance="secondary" size="small">
                필터 적용
              </Button>
              <Button appearance="secondary" size="small">
                크기 조정
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 20 }}>
          <Text size={400} style={{ color: "#666", fontSize: "14px" }}>
            씬를 선택하면 편집 도구가 표시됩니다
          </Text>
        </div>
      )}
    </Card>
  );
}

export default SceneEditor;