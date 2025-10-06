import React, { useState, useEffect } from "react";
import { Text, Button, Card, Divider, Badge, Spinner, ProgressBar } from "@fluentui/react-components";
import {
  SettingsRegular,
  VideoRegular,
  ImageRegular,
  ArrowExportRegular,
} from "@fluentui/react-icons";
import { showSuccess, showError, showInfo } from "../../common/GlobalToast";

function SceneEditor({ selectedScene, scenes }) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [audioDurations, setAudioDurations] = useState({});

  // FFmpeg 진행률 이벤트 리스너
  useEffect(() => {
    const handleProgress = (progress) => {
      setExportProgress(progress);
    };

    if (window.api?.on) {
      window.api.on("ffmpeg:progress", handleProgress);
    }

    return () => {
      if (window.api?.off) {
        window.api.off("ffmpeg:progress", handleProgress);
      }
    };
  }, []);

  // 오디오 파일 길이 로드
  useEffect(() => {
    const loadAudioDurations = async () => {
      if (!scenes || scenes.length === 0) return;

      try {
        const filePaths = scenes.map(scene => scene.audioPath).filter(Boolean);

        if (filePaths.length === 0) return;

        const result = await window.api?.invoke("audio:getDurations", { filePaths });

        if (result?.success && result?.results) {
          const durationsMap = {};
          result.results.forEach((item, index) => {
            if (item.success && item.duration) {
              // audioPath로 매핑
              const audioPath = filePaths[index];
              durationsMap[audioPath] = item.duration;
            }
          });
          setAudioDurations(durationsMap);
        }
      } catch (error) {
        console.error("오디오 길이 로드 실패:", error);
      }
    };

    loadAudioDurations();
  }, [scenes]);

  // 프로젝트 통계 계산
  const getProjectStats = () => {
    if (!scenes || scenes.length === 0) {
      return {
        totalScenes: 0,
        completedScenes: 0,
        missingMedia: 0,
        missingAudio: 0,
        estimatedDuration: 0
      };
    }

    let completedScenes = 0;
    let missingMedia = 0;
    let missingAudio = 0;
    let estimatedDuration = 0;

    scenes.forEach(scene => {
      const hasMedia = scene.asset?.path;
      const hasAudio = scene.audioPath;

      if (hasMedia && hasAudio) {
        completedScenes++;
      }
      if (!hasMedia) {
        missingMedia++;
      }
      if (!hasAudio) {
        missingAudio++;
      }

      // 예상 길이 계산: 실제 오디오 파일 길이 사용
      if (scene.audioPath && audioDurations[scene.audioPath]) {
        estimatedDuration += audioDurations[scene.audioPath];
      } else if (scene.start !== undefined && scene.end !== undefined && scene.end > scene.start) {
        // 오디오 길이를 못 가져온 경우 SRT 시간으로 fallback
        estimatedDuration += (scene.end - scene.start);
      } else {
        // 둘 다 없으면 기본 3초
        estimatedDuration += 3;
      }
    });

    return {
      totalScenes: scenes.length,
      completedScenes,
      missingMedia,
      missingAudio,
      estimatedDuration
    };
  };

  const stats = getProjectStats();

  // 전체 프로젝트 내보내기
  const handleExportProject = async () => {
    if (!scenes || scenes.length === 0) {
      showError("내보낼 씬이 없습니다.");
      return;
    }

    // 모든 씬에 미디어와 오디오가 있는지 확인
    const incompleteScenesCount = scenes.filter(scene => !scene.asset?.path || !scene.audioPath).length;
    if (incompleteScenesCount > 0) {
      showError(`${incompleteScenesCount}개 씬에 미디어 또는 오디오가 없습니다. 모든 씬을 완성해주세요.`);
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    showInfo("영상 내보내기를 시작합니다...");

    try {
      const result = await window.api?.exportVideo?.(scenes);

      if (result?.success) {
        showSuccess(`영상이 성공적으로 내보내졌습니다!\n경로: ${result.outputPath}`);
      } else {
        showError(result?.error || "영상 내보내기에 실패했습니다.");
      }
    } catch (error) {
      console.error("영상 내보내기 오류:", error);
      showError("영상 내보내기 중 오류가 발생했습니다.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

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

      {/* 프로젝트 내보내기 (항상 표시) */}
      <div>
        <Text size={400} weight="medium" style={{ marginBottom: 12, fontSize: "15px" }}>
          프로젝트 내보내기
        </Text>

        {/* 프로젝트 정보 */}
        <div style={{
          padding: 12,
          backgroundColor: "#fafafa",
          borderRadius: 8,
          border: "1px solid #e0e0e0",
          marginBottom: 12
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={200} style={{ color: "#666" }}>총 씬</Text>
              <Text size={200} weight="semibold">{stats.totalScenes}개</Text>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={200} style={{ color: "#666" }}>완성된 씬</Text>
              <Text size={200} weight="semibold" style={{ color: stats.completedScenes === stats.totalScenes ? "#0f7b0f" : "#d13438" }}>
                {stats.completedScenes}/{stats.totalScenes}
              </Text>
            </div>
            {stats.missingMedia > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text size={200} style={{ color: "#d13438" }}>미디어 없음</Text>
                <Text size={200} weight="semibold" style={{ color: "#d13438" }}>{stats.missingMedia}개</Text>
              </div>
            )}
            {stats.missingAudio > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Text size={200} style={{ color: "#d13438" }}>오디오 없음</Text>
                <Text size={200} weight="semibold" style={{ color: "#d13438" }}>{stats.missingAudio}개</Text>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Text size={200} style={{ color: "#666" }}>예상 길이</Text>
              <Text size={200} weight="semibold">
                {Math.floor(stats.estimatedDuration / 60)}분 {Math.floor(stats.estimatedDuration % 60)}초
              </Text>
            </div>
          </div>
        </div>

        {isExporting ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
            backgroundColor: "#f3f9ff",
            borderRadius: 8,
            border: "1px solid #b3d6fc"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Spinner size="small" />
              <Text size={300} weight="medium">영상을 생성하는 중...</Text>
            </div>
            <ProgressBar value={exportProgress / 100} />
            <Text size={200} style={{ color: "#666", textAlign: "center" }}>
              {exportProgress}% 완료
            </Text>
          </div>
        ) : (
          <Button
            appearance="primary"
            icon={<ArrowExportRegular />}
            onClick={handleExportProject}
            disabled={!scenes || scenes.length === 0}
            style={{ width: "100%" }}
          >
            프로젝트 내보내기
          </Button>
        )}

        <Text size={200} style={{ color: "#666", marginTop: 8, display: "block" }}>
          모든 씬을 하나의 영상으로 합성합니다
        </Text>
      </div>

      {selectedScene && (
        <>
          <Divider />

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
        </div>
        </>
      )}

      {!selectedScene && (
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