import React, { useState, useEffect, useRef } from "react";
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
  const [videoUrl, setVideoUrl] = useState(null);

  // 비디오 ref
  const videoRef = useRef(null);

  // 선택된 씬 정보
  const selectedScene = scenes[selectedSceneIndex] || null;

  // 페이지 로드시 자동으로 프로젝트 파일들 로드
  useEffect(() => {
    if (!srtConnected && !mp3Connected && !isLoading) {
      console.log("[MediaEditPage] 페이지 로드시 자동으로 프로젝트 파일 로드 시도");
      handleInsertFromScript();
    }
  }, [srtConnected, mp3Connected, isLoading, handleInsertFromScript]);

  // 선택된 씬의 영상 URL 로드
  useEffect(() => {
    const loadVideoUrl = async () => {
      if (selectedScene?.asset?.path && selectedScene.asset.type === 'video') {
        try {
          console.log("[영상 로드] 시도:", selectedScene.asset.path);
          const url = await window.api?.videoPathToUrl?.(selectedScene.asset.path);
          console.log("[영상 로드] 생성된 URL:", url);
          if (url) {
            setVideoUrl(url);
          } else {
            setVideoUrl(null);
            setIsPlaying(false);
          }
        } catch (error) {
          console.error("[영상 로드] 실패:", error);
          setVideoUrl(null);
          setIsPlaying(false);
        }
      } else {
        setVideoUrl(null);
        setIsPlaying(false);
      }
    };

    loadVideoUrl();

    // 클린업: 이전 비디오 URL 해제
    return () => {
      if (videoUrl && selectedScene?.asset?.path) {
        window.api?.revokeVideoUrl?.(selectedScene.asset.path);
      }
    };
  }, [selectedScene?.asset?.path]);

  // 비디오 URL이 변경되면 자동 재생
  useEffect(() => {
    if (videoUrl && videoRef.current) {
      const video = videoRef.current;

      const handleLoadedData = () => {
        console.log("[비디오 재생] 자동 재생 시작");
        video.play().then(() => {
          setIsPlaying(true);
        }).catch((error) => {
          console.error("[비디오 재생] 자동 재생 실패:", error);
          setIsPlaying(false);
        });
      };

      // 비디오가 이미 로드되었다면 바로 재생
      if (video.readyState >= 2) {
        handleLoadedData();
      } else {
        // 아직 로드되지 않았다면 로드 이벤트를 기다림
        video.addEventListener('loadeddata', handleLoadedData, { once: true });
      }

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
      };
    }
  }, [videoUrl]);

  // 시간 포맷 헬퍼
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 씬 선택 핸들러
  const handleSceneSelect = (index) => {
    setSelectedSceneIndex(index);
    if (selectedScene) {
      setCurrentTime(selectedScene.start);
    }
  };

  // 비디오 재생/일시정지 토글
  const handleVideoToggle = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      if (video.paused) {
        video.play().then(() => {
          setIsPlaying(true);
        }).catch((error) => {
          console.error("[비디오 재생] 재생 실패:", error);
        });
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }
  };

  // 자동 영상 할당 핸들러
  const handleAutoAssignVideos = async () => {
    if (scenes.length === 0) {
      showError("할당할 씬가 없습니다.");
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

      // 할당 결과 디버깅
      console.log("[자동 할당] 할당 전 scenes:", scenes);
      console.log("[자동 할당] 할당 후 assignedScenes:", assignedScenes);

      // 씬 업데이트
      setScenes(assignedScenes);

      // 할당 결과 확인
      const assignedCount = assignedScenes.filter(scene => scene.asset?.path).length;
      const totalCount = assignedScenes.length;

      console.log("[자동 할당] 할당된 씬 수:", assignedCount, "/", totalCount);

      // 할당된 씬들의 상세 정보 출력
      assignedScenes.forEach((scene, index) => {
        if (scene.asset?.path) {
          console.log(`[자동 할당] 씬 ${index + 1}:`, {
            text: scene.text,
            asset: scene.asset
          });
        }
      });

      if (assignedCount > 0) {
        showSuccess(`${assignedCount}/${totalCount}개 씬에 영상을 자동으로 할당했습니다.`);
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

  // 메인 그리드 레이아웃 (2영역: 씬 목록 + 프리뷰/편집 영역)
  const mainGrid = {
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gridTemplateRows: "1fr",
    gap: 24,
    height: "100%",
    minHeight: "600px",
  };

  // 우측 영역 레이아웃 (프리뷰 + 편집 도구)
  const rightPanelGrid = {
    display: "grid",
    gridTemplateRows: "2fr 1fr",
    gap: 24,
    height: "100%",
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
            씬별로 미디어를 편집하고 교체합니다
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
            {/* 좌측: 씬 목록 */}
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
                    씬 목록
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

              {/* 씬 목록 스크롤 */}
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
                      씬가 없습니다
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
                            size={20}
                            name={`씬 ${index + 1}`}
                            color={hasMedia ? "colorful" : "neutral"}
                          />
                          <Text size={300} weight="medium" style={{ fontSize: "14px" }}>
                            씬 {index + 1}
                          </Text>
                          <div style={{ flex: 1 }} />
                          <ClockRegular style={{ fontSize: 12 }} />
                          <Text size={200} style={{ color: "#666" }}>
                            {formatTime(scene.start)}
                          </Text>
                        </div>

                        <Text
                          size={300}
                          style={{
                            color: "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontSize: "13px",
                          }}
                        >
                          {scene.text || "자막 없음"}
                        </Text>

                        {hasMedia && (
                          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                            <Badge appearance="tint" color="success" size="small">
                              <CheckmarkCircleRegular style={{ fontSize: 12, marginRight: 3 }} />
                              {sceneWithDefaults.asset.type === 'image' ? '이미지' : '영상'} 연결됨
                            </Badge>
                            {sceneWithDefaults.asset.keyword && (
                              <Badge appearance="outline" size="small" style={{ fontSize: '12px' }}>
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

            {/* 우측: 프리뷰 + 편집 도구 영역 */}
            <div style={rightPanelGrid}>
              {/* 프리뷰 영역 */}
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
                  씬 프리뷰
                </Text>
                {selectedScene && (
                  <Badge appearance="tint" color="brand">
                    씬 {selectedSceneIndex + 1}
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
                  overflow: "hidden",
                }}
              >
                {selectedScene ? (
                  videoUrl && selectedScene.asset?.type === 'video' ? (
                    // 실제 비디오 표시
                    <video
                      ref={videoRef}
                      key={videoUrl}
                      src={videoUrl}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                      controls={false}
                      autoPlay={false}
                      muted
                      playsInline
                      onClick={handleVideoToggle}
                      onError={(e) => {
                        console.error("[비디오 재생] 오류:", e);
                        console.error("[비디오 재생] 비디오 URL:", videoUrl);
                      }}
                      onLoadedData={() => {
                        console.log("[비디오 재생] 로드됨:", videoUrl);
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                    />
                  ) : (
                    // 텍스트 기반 프리뷰 (비디오가 없거나 이미지인 경우)
                    <div style={{ textAlign: "center", color: "white", padding: 20 }}>
                      <Text style={{ fontSize: 20, marginBottom: 12, display: "block" }}>
                        🎬 씬 {selectedSceneIndex + 1}
                      </Text>
                      <Text style={{ fontSize: 16, opacity: 0.9, display: "block", lineHeight: "1.4" }}>
                        {selectedScene.text}
                      </Text>
                      {selectedScene.asset?.path ? (
                        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                            <Badge appearance="filled" color="success" size="medium">
                              <CheckmarkCircleRegular style={{ fontSize: 14, marginRight: 6 }} />
                              {selectedScene.asset.type === 'image' ? '이미지' : '영상'} 연결됨
                            </Badge>
                            {selectedScene.asset.keyword && (
                              <Badge appearance="outline" color="brand" size="medium">
                                키워드: {selectedScene.asset.keyword}
                              </Badge>
                            )}
                          </div>
                          {selectedScene.asset.resolution && (
                            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
                              {selectedScene.asset.resolution} · {selectedScene.asset.provider || "unknown"}
                            </Text>
                          )}
                          {selectedScene.asset.type === 'video' && !videoUrl && (
                            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
                              영상 로딩 중...
                            </Text>
                          )}
                        </div>
                      ) : (
                        <div style={{ marginTop: 16 }}>
                          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
                            연결된 미디어가 없습니다
                          </Text>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <Text style={{ color: "white", fontSize: 16 }}>
                    씬를 선택해주세요
                  </Text>
                )}
              </div>

              {/* 자막 표시 */}
              {selectedScene && (
                <div
                  style={{
                    padding: 16,
                    backgroundColor: "#f5f5f5",
                    borderRadius: 8,
                    textAlign: "center",
                  }}
                >
                  <Text size={400} style={{ fontSize: "15px", lineHeight: "1.5" }}>
                    "{selectedScene.text}"
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Text size={300} style={{ color: "#666", fontSize: "13px" }}>
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
                  onClick={handleVideoToggle}
                  disabled={!selectedScene || !videoUrl}
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

              {/* 편집 도구 패널 */}
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

                  {/* 미디어 교체 */}
                  <div>
                    <Text size={400} weight="medium" style={{ marginBottom: 12, fontSize: "15px" }}>
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
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}

export default MediaEditPage;