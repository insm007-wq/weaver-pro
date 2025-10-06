import React, { useState, useEffect, useRef } from "react";
import { Text, Button, Card } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import { VideoRegular } from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import { useFileManagement } from "../../hooks/useFileManagement";

// 최적화된 컴포넌트들 import
import SceneList from "./parts/SceneList";
import VideoPreview from "./parts/VideoPreview";
import SceneEditor from "./parts/SceneEditor";

function MediaEditPage() {
  const headerStyles = useHeaderStyles();
  const containerStyles = useContainerStyles();

  // 파일 관리 훅 사용
  const { scenes, setScenes, srtConnected, mp3Connected, handleInsertFromScript, isLoading } = useFileManagement();

  // 최소 상태 관리
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);

  // 비디오 ref
  const videoRef = useRef(null);
  const hasTriedLoadRef = useRef(false);

  // 선택된 씬 정보
  const selectedScene = scenes[selectedSceneIndex] || null;

  // 디버깅: 선택된 씬의 audioPath 확인
  useEffect(() => {
    if (selectedScene) {
      console.log("[MediaEditPage] 선택된 씬:", {
        index: selectedSceneIndex,
        text: selectedScene.text,
        audioPath: selectedScene.audioPath,
        hasAudioPath: !!selectedScene.audioPath
      });
    }
  }, [selectedScene, selectedSceneIndex]);

  // 페이지 로드시 자동으로 프로젝트 파일들 로드 (한 번만)
  useEffect(() => {
    if (!hasTriedLoadRef.current) {
      hasTriedLoadRef.current = true;
      const timer = setTimeout(() => {
        if (!srtConnected && !mp3Connected && !isLoading) {
          console.log("[MediaEditPage] 페이지 로드시 자동으로 프로젝트 파일 로드 시도");
          handleInsertFromScript();
        }
      }, 100);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택된 씬의 미디어 URL 로드 (비디오 및 이미지 모두 지원)
  useEffect(() => {
    const loadMediaUrl = async () => {
      if (selectedScene?.asset?.path) {
        try {
          console.log("[미디어 로드] 시도:", selectedScene.asset.path, selectedScene.asset.type);
          const url = await window.api?.videoPathToUrl?.(selectedScene.asset.path);
          console.log("[미디어 로드] 생성된 URL:", url);
          if (url) {
            setVideoUrl(url);
          } else {
            setVideoUrl(null);
          }
        } catch (error) {
          console.error("[미디어 로드] 실패:", error);
          setVideoUrl(null);
        }
      } else {
        setVideoUrl(null);
      }
    };

    loadMediaUrl();
  }, [selectedScene?.asset?.path]);

  // 씬 선택 핸들러 (간소화)
  const handleSceneSelect = (index) => {
    setSelectedSceneIndex(index);
  };

  // 메인 그리드 레이아웃
  const mainGrid = {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr",
    gridTemplateRows: "1fr",
    gap: 24,
    height: "100%",
    minHeight: "600px",
  };

  // 우측 영역 레이아웃
  const rightPanelGrid = {
    display: "flex",
    flexDirection: "column",
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
          <div className={headerStyles.pageDescription}>씬별로 미디어를 편집하고 교체합니다</div>
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
            <Button appearance="primary" onClick={handleInsertFromScript} disabled={isLoading}>
              {isLoading ? "파일 로드 중..." : "프로젝트 파일 로드"}
            </Button>
          </Card>
        )}

        {(srtConnected || mp3Connected) && (
          <div style={mainGrid}>
            {/* 좌측: 씬 목록 컴포넌트 (자체 상태 관리) */}
            <SceneList
              scenes={scenes}
              setScenes={setScenes}
              selectedSceneIndex={selectedSceneIndex}
              onSceneSelect={handleSceneSelect}
            />

            {/* 우측: 프리뷰 + 편집 도구 영역 */}
            <div style={rightPanelGrid}>
              {/* 프리뷰 컴포넌트 (자체 상태 관리) */}
              <VideoPreview
                ref={videoRef}
                selectedScene={selectedScene}
                selectedSceneIndex={selectedSceneIndex}
                videoUrl={videoUrl}
              />

              {/* 편집 도구 컴포넌트 */}
              <SceneEditor selectedScene={selectedScene} />
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}

export default MediaEditPage;