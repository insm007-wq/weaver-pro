import React, { useState, useEffect, useRef, useMemo } from "react";
import { Text, Button, Card } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import { VideoRegular } from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import { useFileManagement } from "../../hooks/useFileManagement";
import { assignPrioritizedMediaToMissingScenes } from "../../services/videoAssignment";
import { showSuccess, showInfo } from "../common/GlobalToast";

// 최적화된 컴포넌트들 import
import SceneList from "./parts/SceneList";
import VideoPreview from "./parts/VideoPreview";
import SceneEditor from "./parts/SceneEditor";

function MediaEditPage({ isVideoExporting, setIsVideoExporting }) {
  const headerStyles = useHeaderStyles();
  const containerStyles = useContainerStyles();

  // 파일 관리 훅 사용
  const {
    scenes,
    setScenes,
    srtConnected,
    setSrtConnected,
    mp3Connected,
    setMp3Connected,
    handleInsertFromScript,
    isLoading
  } = useFileManagement();

  // 최소 상태 관리
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [projectTtsSettings, setProjectTtsSettings] = useState(null);

  // 비디오 ref
  const videoRef = useRef(null);
  const hasTriedLoadRef = useRef(false);
  const hasAutoAssignedRef = useRef(false);

  // 선택된 씬 정보 (useMemo로 제대로 추적)
  const selectedScene = useMemo(() => {
    return scenes[selectedSceneIndex] || null;
  }, [scenes, selectedSceneIndex]);

  // 씬 선택 시 로그 (디버깅용)
  useEffect(() => {
    if (selectedScene && !selectedScene.audioPath) {
      console.warn(`[MediaEditPage] 씬 ${selectedSceneIndex + 1} audioPath 없음`);
    }
  }, [selectedScene, selectedSceneIndex]);

  // 프로젝트 TTS 설정 로드
  useEffect(() => {
    const loadProjectTtsSettings = async () => {
      try {
        // 먼저 프로젝트에서 시도
        const result = await window.api.invoke("project:current");

        if (result?.success && result?.project?.ttsSettings) {
          setProjectTtsSettings(result.project.ttsSettings);
        } else {
          // 프로젝트에 없으면 전역 설정 확인 (fallback)
          try {
            const globalSettings = await window.api.invoke("settings:get", "lastUsedTtsSettings");

            if (globalSettings) {
              setProjectTtsSettings(globalSettings);
            }
          } catch (globalError) {
            console.warn("⚠️ 전역 TTS 설정 로드 실패:", globalError);
          }
        }
      } catch (error) {
        console.error("❌ TTS 설정 로드 오류:", error);
      }
    };

    loadProjectTtsSettings();
  }, []);

  // 페이지 로드시 자동으로 프로젝트 파일들 로드 (한 번만)
  useEffect(() => {
    if (!hasTriedLoadRef.current) {
      hasTriedLoadRef.current = true;
      const timer = setTimeout(() => {
        if (!srtConnected && !mp3Connected && !isLoading) {
          // 자동 로드: isAutoLoad=true (에러 메시지 없음)
          handleInsertFromScript(true);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 파일 로드 후 자동 미디어 할당 (영상 → 사진 → AI 이미지)
  useEffect(() => {
    const autoAssignMedia = async () => {
      // 조건 체크: 파일이 로드되고, 씬이 있고, 아직 자동 할당하지 않았고, 로딩 중이 아님
      if (
        srtConnected &&
        scenes.length > 0 &&
        !hasAutoAssignedRef.current &&
        !isLoading
      ) {
        hasAutoAssignedRef.current = true;

        // 미디어가 없는 씬이 있는지 확인
        const missingScenes = scenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

        if (missingScenes.length > 0) {
          showInfo(`미디어를 자동으로 할당하는 중... (${missingScenes.length}개 씬)`);

          try {
            // 1. extractedKeywords 가져오기
            const extractedKeywords = await window.api.getSetting("extractedKeywords");
            const keywordsArray = Array.isArray(extractedKeywords) ? extractedKeywords : [];

            // 2. 씬에 키워드 할당 (순서대로 1:1 매칭)
            const scenesWithKeywords = scenes.map((scene, index) => {
              // 이미 키워드가 있으면 유지, 없으면 extractedKeywords에서 순서대로 할당
              if (scene.keyword) {
                return scene;
              }

              const keyword = keywordsArray[index % keywordsArray.length]; // 순환 할당
              return {
                ...scene,
                keyword: keyword || null,
              };
            });

            setScenes(scenesWithKeywords);

            // 3. 키워드가 할당된 씬으로 미디어 자동 할당
            const assignedScenes = await assignPrioritizedMediaToMissingScenes(scenesWithKeywords, {
              minScore: 0.1,
              allowDuplicates: false,
            });

            setScenes(assignedScenes);

            const assignedCount = assignedScenes.filter(s => s.asset?.path).length;
            const totalCount = assignedScenes.length;

            showSuccess(`자동 할당 완료! ${assignedCount}/${totalCount}개 씬에 미디어가 할당되었습니다.`);
          } catch (error) {
            console.error("[자동 할당] 오류:", error);
            // 오류가 발생해도 조용히 넘어감 (사용자가 수동으로 할당 가능)
          }
        }
      }
    };

    autoAssignMedia();
  }, [srtConnected, scenes, isLoading, setScenes]);

  // 미디어 다운로드 완료 후 자동 할당 재트리거
  useEffect(() => {
    const handleMediaDownloadCompleted = async () => {
      // 페이지가 로드되어 있고, 파일이 연결되어 있으면 자동 할당 재실행
      if (srtConnected && scenes.length > 0 && !isLoading) {
        // 플래그 리셋하여 자동 할당 다시 실행
        hasAutoAssignedRef.current = false;

        // 미디어가 없는 씬이 있는지 확인
        const missingScenes = scenes.filter(scene => !scene.asset?.path && scene.text && scene.text.trim().length > 0);

        if (missingScenes.length > 0) {
          showInfo(`미디어를 자동으로 할당하는 중... (${missingScenes.length}개 씬)`);

          try {
            // ✅ 0. videoSaveFolder 설정 검증 (exe 환경에서 경로 설정 보장)
            const videoSaveFolder = await window.api.getSetting("videoSaveFolder");
            if (!videoSaveFolder || typeof videoSaveFolder !== 'string' || videoSaveFolder.trim() === '') {
              console.warn("[자동 할당] videoSaveFolder 설정이 없음. 설정을 다시 확인합니다.");
              // 설정이 없으면 미디어 할당을 진행할 수 없음
              showInfo("미디어 폴더 설정이 필요합니다. 설정 > 기본 설정에서 영상 저장 폴더를 지정해주세요.");
              return;
            }
            console.log(`✅ [자동 할당] videoSaveFolder 확인됨: ${videoSaveFolder}`);

            // 1. extractedKeywords 가져오기
            const extractedKeywords = await window.api.getSetting("extractedKeywords");
            const keywordsArray = Array.isArray(extractedKeywords) ? extractedKeywords : [];

            // 2. 씬에 키워드 할당 (순서대로 1:1 매칭)
            const scenesWithKeywords = scenes.map((scene, index) => {
              // 이미 키워드가 있으면 유지, 없으면 extractedKeywords에서 순서대로 할당
              if (scene.keyword) {
                return scene;
              }

              const keyword = keywordsArray[index % keywordsArray.length]; // 순환 할당
              return {
                ...scene,
                keyword: keyword || null,
              };
            });

            setScenes(scenesWithKeywords);

            // 3. 키워드가 할당된 씬으로 미디어 자동 할당
            const assignedScenes = await assignPrioritizedMediaToMissingScenes(scenesWithKeywords, {
              minScore: 0.1,
              allowDuplicates: false,
            });

            setScenes(assignedScenes);

            const assignedCount = assignedScenes.filter(s => s.asset?.path).length;
            const totalCount = assignedScenes.length;

            showSuccess(`자동 할당 완료! ${assignedCount}/${totalCount}개 씬에 미디어가 할당되었습니다.`);
          } catch (error) {
            console.error("[자동 할당] 오류:", error);
            // 오류가 발생해도 조용히 넘어감 (사용자가 수동으로 할당 가능)
          }
        }
      }
    };

    window.addEventListener("media-download-completed", handleMediaDownloadCompleted);

    return () => {
      window.removeEventListener("media-download-completed", handleMediaDownloadCompleted);
    };
  }, [srtConnected, scenes, isLoading, setScenes]);

  // 편집 페이지 초기화 이벤트 리스너
  useEffect(() => {
    const handleResetMediaEdit = () => {
      // 씬 및 UI 상태 초기화
      setScenes([]);
      setSelectedSceneIndex(0);
      setVideoUrl(null);

      // 파일 연결 상태 초기화
      setSrtConnected(false);
      setMp3Connected(false);

      // 파일 로드 시도 플래그 초기화 (다시 자동 로드 시도하지 않도록)
      hasTriedLoadRef.current = false;
      hasAutoAssignedRef.current = false;
    };

    window.addEventListener("reset-media-edit", handleResetMediaEdit);

    return () => {
      window.removeEventListener("reset-media-edit", handleResetMediaEdit);
    };
  }, [setScenes, setSrtConnected, setMp3Connected]);

  // 자동 파일 로드 이벤트 리스너 (다음 단계 버튼에서 발생)
  useEffect(() => {
    const handleAutoLoadProjectFiles = async () => {
      console.log("[MediaEditPage] auto-load-project-files 이벤트 수신");

      // 플래그 리셋하여 자동 로드 강제 실행
      hasTriedLoadRef.current = false;
      hasAutoAssignedRef.current = false;

      // 즉시 파일 로드 (setTimeout 제거하여 경합 제거)
      if (!srtConnected && !mp3Connected && !isLoading) {
        console.log("[MediaEditPage] 자동으로 파일 불러오는 중...");
        // 자동 로드: isAutoLoad=true (에러 메시지 없음)
        handleInsertFromScript(true);
      }
    };

    window.addEventListener("auto-load-project-files", handleAutoLoadProjectFiles);

    return () => {
      window.removeEventListener("auto-load-project-files", handleAutoLoadProjectFiles);
    };
  }, [srtConnected, mp3Connected, isLoading, handleInsertFromScript]);

  // 선택된 씬의 미디어 URL 로드 (비디오 및 이미지 모두 지원)
  useEffect(() => {
    const loadMediaUrl = async () => {
      if (selectedScene?.asset?.path) {
        try {
          const url = await window.api?.videoPathToUrl?.(selectedScene.asset.path);
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
    gap: 24,
    alignItems: "flex-start",
    height: "calc(100vh - 200px)",
  };

  // 우측 영역 레이아웃
  const rightPanelGrid = {
    display: "flex",
    flexDirection: "column",
    gap: 24,
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
          <Card
            style={{
              padding: "32px 24px",
              textAlign: "center",
              marginBottom: 24,
              background: "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)",
              border: "1px solid #667eea30"
            }}
          >
            <div style={{ marginBottom: 16, fontSize: 48 }}>🎬</div>
            <Text size={500} weight="semibold" style={{ marginBottom: 12, display: "block" }}>
              영상 편집 준비 완료!
            </Text>
            <Text size={300} style={{ color: "#666", marginBottom: 20, lineHeight: 1.6, display: "block" }}>
              프로젝트 파일을 불러와서 씬별로 미디어를 편집하고<br />
              최종 영상으로 완성해보세요
            </Text>
            <Button
              appearance="primary"
              size="large"
              onClick={handleInsertFromScript}
              disabled={isLoading}
              style={{
                padding: "12px 32px",
                fontSize: "15px",
                fontWeight: 600
              }}
            >
              {isLoading ? "📂 파일 불러오는 중..." : "📂 프로젝트 파일 불러오기"}
            </Button>
          </Card>
        )}

        {(srtConnected || mp3Connected) && (
          <div style={mainGrid}>
            {/* 좌측: 씬 목록 컴포넌트 (스크롤 가능) */}
            <div style={{ height: "100%", overflowY: "auto" }}>
              <SceneList
                scenes={scenes}
                setScenes={setScenes}
                selectedSceneIndex={selectedSceneIndex}
                onSceneSelect={handleSceneSelect}
                projectTtsSettings={projectTtsSettings}
                isVideoExporting={isVideoExporting}
              />
            </div>

            {/* 우측: 프리뷰 + 편집 도구 영역 (고정) */}
            <div style={rightPanelGrid}>
              <VideoPreview
                ref={videoRef}
                selectedScene={selectedScene}
                selectedSceneIndex={selectedSceneIndex}
                videoUrl={videoUrl}
              />

              {/* 편집 도구 컴포넌트 */}
              <SceneEditor
                scenes={scenes}
                onSceneSelect={handleSceneSelect}
                isVideoExporting={isVideoExporting}
                setIsVideoExporting={setIsVideoExporting}
              />
            </div>
          </div>
        )}
      </div>
    </PageErrorBoundary>
  );
}

export default MediaEditPage;