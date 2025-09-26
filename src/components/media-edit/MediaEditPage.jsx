import React, { useState, useEffect } from "react";
import { Text, Button, Card, Divider, Badge, Avatar, Spinner } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import {
  VideoRegular,
  PlayRegular,
  PauseRegular,
  EditRegular,
  ImageRegular,
  WandRegular,
  SettingsRegular,
  DocumentTextRegular,
  ClockRegular,
  FolderOpenRegular,
  ArrowSyncRegular,
  AutoFitWidthRegular,
  CheckmarkCircleRegular,
} from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import { showError, showSuccess } from "../common/GlobalToast";
import { useFileManagement } from "../../hooks/useFileManagement";
import { ensureSceneDefaults } from "../../utils/scenes";
import { assignVideosToScenes, getRecommendedVideosForScene } from "../../services/videoAssignment";

function MediaEditPage() {
  const headerStyles = useHeaderStyles();
  const containerStyles = useContainerStyles();

  // 파일 관리 훅 사용
  const { scenes, setScenes, srtConnected, mp3Connected, handleInsertFromScript, isLoading } = useFileManagement();

  // 편집 관련 상태
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isAssigning, setIsAssigning] = useState(false);

  // 선택된 씨네 정보
  const selectedScene = scenes[selectedSceneIndex] || null;

  // 페이지 로드시 자동으로 프로젝트 파일들 로드
  useEffect(() => {
    if (!srtConnected && !mp3Connected && !isLoading) {
      console.log("[MediaEditPage] 페이지 로드시 자동으로 프로젝트 파일 로드 시도");
      handleInsertFromScript();
    }
  }, [srtConnected, mp3Connected, isLoading, handleInsertFromScript]);

  // 시간 포맷 헬퍼
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 씨네 선택 핸들러
  const handleSceneSelect = (index) => {
    setSelectedSceneIndex(index);
    if (selectedScene) {
      setCurrentTime(selectedScene.start);
    }
  };

  // 자동 영상 할당 핸들러
  const handleAutoAssignVideos = async () => {
    if (scenes.length === 0) {
      showError("할당할 씨네가 없습니다.");
      return;
    }

    setIsAssigning(true);
    try {
      console.log("[자동 할당] 시작:", { sceneCount: scenes.length });

      const assignedScenes = await assignVideosToScenes(scenes, {
        minScore: 0.5, // 최소 50% 유사도
        allowDuplicates: false, // 중복 방지
      });

      console.log("[자동 할당] 완료:", { assignedScenes });

      // 씨네 업데이트
      setScenes(assignedScenes);

      // 할당 결과 확인
      const assignedCount = assignedScenes.filter(scene => scene.asset?.path).length;
      const totalCount = assignedScenes.length;

      if (assignedCount > 0) {
        showSuccess(`${assignedCount}/${totalCount}개 씨네에 영상을 자동으로 할당했습니다.`);
      } else {
        showError("자동으로 할당할 수 있는 영상이 없습니다. 먼저 미디어 다운로드에서 영상을 다운로드해주세요.");
      }
    } catch (error) {
      console.error("[자동 할당] 오류:", error);
      showError(`자동 할당 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsAssigning(false);
    }
  };

  // 메인 그리드 레이아웃 (3영역: 씨네 목록 + 프리뷰 + 편집 도구)
  const mainGrid = {
    display: "grid",
    gridTemplateColumns: "300px 1fr 320px",
    gridTemplateRows: "1fr",
    gap: 24,
    height: "100%",
    minHeight: "600px",
  };

  return (
    <PageErrorBoundary>
      <div className={containerStyles.container}>
        {/* 헤더 */}
        <div className={headerStyles.pageHeader}>
          <div className={headerStyles.pageTitleWithIcon}>
            <VideoRegular />
            편집 및 다듬기
          </div>
          <div className={headerStyles.pageDescription}>
            씨네별로 미디어를 편집하고 교체합니다
          </div>
          <div className={headerStyles.divider} />
        </div>

        {/* 데이터 로드 상태 확인 */}
        {!srtConnected && !mp3Connected && (
          <Card style={{ padding: 20, textAlign: "center", marginBottom: 24 }}>
            <Text size={400} weight="medium" style={{ marginBottom: 8 }}>
              편집할 프로젝트가 없습니다
            </Text>
            <Text size={300} style={{ color: "#666", marginBottom: 16 }}>
              먼저 "미디어 준비" 탭에서 자막과 오디오 파일을 업로드해주세요.
            </Text>
            <Button
              appearance="primary"
              onClick={handleInsertFromScript}
              disabled={isLoading}
            >
              {isLoading ? "파일 로드 중..." : "프로젝트 파일 로드"}
            </Button>
          </Card>
        )}

        {(srtConnected || mp3Connected) && (
          <div style={mainGrid}>
            {/* 좌측: 씨네 목록 */}
            <Card
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <DocumentTextRegular style={{ fontSize: 18 }} />
                  <Text size={400} weight="semibold">
                    씨네 목록
                  </Text>
                  <Badge appearance="filled" size="small">
                    {scenes.length}
                  </Badge>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    appearance="primary"
                    size="small"
                    icon={<AutoFitWidthRegular />}
                    onClick={handleAutoAssignVideos}
                    disabled={isAssigning || scenes.length === 0}
                  >
                    {isAssigning ? "할당 중..." : "자동 할당"}
                  </Button>
                  <Button appearance="subtle" size="small" icon={<ArrowSyncRegular />} />
                </div>
              </div>

              {/* 씨네 목록 스크롤 */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {scenes.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 20 }}>
                    <Text size={300} style={{ color: "#666" }}>
                      씨네가 없습니다
                    </Text>
                  </div>
                ) : (
                  scenes.map((scene, index) => {
                    const isSelected = index === selectedSceneIndex;
                    const sceneWithDefaults = ensureSceneDefaults(scene);
                    const hasMedia = sceneWithDefaults.asset?.path;

                    return (
                      <div
                        key={scene.id}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? '#0078d4' : '#e1dfdd'}`,
                          backgroundColor: isSelected ? '#f3f9ff' : 'transparent',
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => handleSceneSelect(index)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <Avatar
                            size={16}
                            name={`씨네 ${index + 1}`}
                            color={hasMedia ? "colorful" : "neutral"}
                          />
                          <Text size={300} weight="medium">
                            씨네 {index + 1}
                          </Text>
                          <div style={{ flex: 1 }} />
                          <ClockRegular style={{ fontSize: 12 }} />
                          <Text size={200} style={{ color: "#666" }}>
                            {formatTime(scene.start)}
                          </Text>
                        </div>

                        <Text
                          size={200}
                          style={{
                            color: "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {scene.text || "자막 없음"}
                        </Text>

                        {hasMedia && (
                          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                            <Badge appearance="tint" color="success" size="extra-small">
                              <CheckmarkCircleRegular style={{ fontSize: 10, marginRight: 2 }} />
                              {sceneWithDefaults.asset.type === 'image' ? '이미지' : '영상'} 연결됨
                            </Badge>
                            {sceneWithDefaults.asset.keyword && (
                              <Badge appearance="outline" size="extra-small">
                                {sceneWithDefaults.asset.keyword}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* 중앙: 프리뷰 영역 */}
            <Card
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <PlayRegular style={{ fontSize: 18 }} />
                <Text size={400} weight="semibold">
                  씨네 프리뷰
                </Text>
                {selectedScene && (
                  <Badge appearance="tint" color="brand">
                    씨네 {selectedSceneIndex + 1}
                  </Badge>
                )}
              </div>

              {/* 프리뷰 영역 */}
              <div
                style={{
                  flex: 1,
                  backgroundColor: "#000",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 300,
                  position: "relative",
                }}
              >
                {selectedScene ? (
                  <div style={{ textAlign: "center", color: "white" }}>
                    <Text style={{ fontSize: 18, marginBottom: 8, display: "block" }}>
                      🎬 씨네 {selectedSceneIndex + 1}
                    </Text>
                    <Text style={{ fontSize: 14, opacity: 0.8, display: "block" }}>
                      {selectedScene.text}
                    </Text>
                    {selectedScene.asset?.path && (
                      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          <Badge appearance="filled" color="success">
                            <CheckmarkCircleRegular style={{ fontSize: 12, marginRight: 4 }} />
                            {selectedScene.asset.type === 'image' ? '이미지' : '영상'} 연결됨
                          </Badge>
                          {selectedScene.asset.keyword && (
                            <Badge appearance="outline" color="brand">
                              키워드: {selectedScene.asset.keyword}
                            </Badge>
                          )}
                        </div>
                        {selectedScene.asset.resolution && (
                          <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
                            {selectedScene.asset.resolution} · {selectedScene.asset.provider || "unknown"}
                          </Text>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Text style={{ color: "white", fontSize: 16 }}>
                    씨네를 선택해주세요
                  </Text>
                )}
              </div>

              {/* 자막 표시 */}
              {selectedScene && (
                <div
                  style={{
                    padding: 12,
                    backgroundColor: "#f5f5f5",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  <Text size={300}>
                    "{selectedScene.text}"
                  </Text>
                  <div style={{ marginTop: 4 }}>
                    <Text size={200} style={{ color: "#666" }}>
                      {formatTime(selectedScene.start)} - {formatTime(selectedScene.end)}
                      ({(selectedScene.end - selectedScene.start).toFixed(1)}초)
                    </Text>
                  </div>
                </div>
              )}

              {/* 플레이어 컨트롤 */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Button
                  appearance="primary"
                  icon={isPlaying ? <PauseRegular /> : <PlayRegular />}
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={!selectedScene}
                >
                  {isPlaying ? "일시정지" : "재생"}
                </Button>

                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                  <Text size={200}>{formatTime(currentTime)}</Text>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      backgroundColor: "#e1e1e1",
                      borderRadius: 2,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: selectedScene ? `${((currentTime - selectedScene.start) / (selectedScene.end - selectedScene.start)) * 100}%` : "0%",
                        height: "100%",
                        backgroundColor: "#0078d4",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <Text size={200}>
                    {selectedScene ? formatTime(selectedScene.end) : "00:00"}
                  </Text>
                </div>
              </div>
            </Card>

            {/* 우측: 편집 도구 패널 */}
            <Card
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <SettingsRegular style={{ fontSize: 18 }} />
                <Text size={400} weight="semibold">
                  씨네 편집
                </Text>
              </div>

              {selectedScene ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* 현재 미디어 정보 */}
                  <div>
                    <Text size={300} weight="medium" style={{ marginBottom: 8 }}>
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
                          {selectedScene.asset.type === 'image' ? (
                            <ImageRegular style={{ fontSize: 16, color: "#0078d4" }} />
                          ) : (
                            <VideoRegular style={{ fontSize: 16, color: "#0078d4" }} />
                          )}
                          <Text size={200} weight="medium">
                            {selectedScene.asset.type === 'image' ? '이미지' : '영상'} 연결됨
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
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <Badge appearance="outline" size="extra-small">
                              키워드: {selectedScene.asset.keyword}
                            </Badge>
                            {selectedScene.asset.resolution && (
                              <Badge appearance="outline" size="extra-small">
                                {selectedScene.asset.resolution}
                              </Badge>
                            )}
                            {selectedScene.asset.provider && (
                              <Badge appearance="outline" size="extra-small">
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
                        <Text size={200} style={{ color: "#a4262c" }}>
                          연결된 미디어가 없습니다
                        </Text>
                      </div>
                    )}
                  </div>

                  <Divider />

                  {/* 미디어 교체 */}
                  <div>
                    <Text size={300} weight="medium" style={{ marginBottom: 8 }}>
                      미디어 교체
                    </Text>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Button
                        appearance="secondary"
                        size="small"
                        icon={<VideoRegular />}
                      >
                        영상으로 교체
                      </Button>
                      <Button
                        appearance="secondary"
                        size="small"
                        icon={<ImageRegular />}
                      >
                        이미지로 교체
                      </Button>
                      <Button
                        appearance="secondary"
                        size="small"
                        icon={<FolderOpenRegular />}
                      >
                        파일에서 선택
                      </Button>
                    </div>
                  </div>

                  <Divider />

                  {/* 미디어 효과 */}
                  <div>
                    <Text size={300} weight="medium" style={{ marginBottom: 8 }}>
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
                  <Text size={300} style={{ color: "#666" }}>
                    씨네를 선택하면 편집 도구가 표시됩니다
                  </Text>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}

export default MediaEditPage;