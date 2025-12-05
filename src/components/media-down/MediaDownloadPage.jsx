import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Text, Button, Card, Spinner, ProgressBar, Badge, Avatar, Divider, Slider, Dropdown, Option } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import {
  RocketRegular,
  VideoRegular,
  ImageRegular,
  ArrowDownloadRegular,
  CheckmarkCircleRegular,
  SettingsRegular,
  InfoRegular,
  ArrowClockwiseRegular,
  DismissCircle24Regular,
} from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import { showError, showSuccess } from "../common/GlobalToast";
import BottomFixedBar from "../common/BottomFixedBar";
import { tokens } from "@fluentui/react-components";
import { MODE_CONFIGS } from "../../constants/modeConstants";

// 로컬 이미지 캐시
const imageCache = new Map();

// 썸네일 이미지 컴포넌트 (로컬 파일 → base64 변환)
const ThumbnailImage = React.memo(({ src, alt, style, fallbackText = "IMAGE" }) => {
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadImage() {
      if (!src || typeof src !== "string") {
        if (mounted) {
          setLoading(false);
          setFailed(true);
        }
        return;
      }

      // HTTP/HTTPS URL
      if (/^https?:\/\//i.test(src)) {
        if (mounted) {
          setImgSrc(src);
          setLoading(false);
        }
        return;
      }

      // data: URL
      if (/^data:/i.test(src)) {
        if (mounted) {
          setImgSrc(src);
          setLoading(false);
        }
        return;
      }

      // 캐시 확인
      if (imageCache.has(src)) {
        if (mounted) {
          setImgSrc(imageCache.get(src));
          setLoading(false);
        }
        return;
      }

      // 로컬 파일 → base64
      try {
        const result = await window.api.readBinary(src);
        if (result?.ok && result?.data && mounted) {
          const dataUrl = `data:${result.mime || "image/jpeg"};base64,${result.data}`;
          imageCache.set(src, dataUrl);
          setImgSrc(dataUrl);
        } else {
          if (mounted) setFailed(true);
        }
      } catch (error) {
        console.error("[ThumbnailImage] 이미지 로드 실패:", error);
        if (mounted) setFailed(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadImage();

    return () => {
      mounted = false;
    };
  }, [src]);

  if (loading) {
    return (
      <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0f0f0" }}>
        <Spinner size="tiny" />
      </div>
    );
  }

  if (failed || !imgSrc) {
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#6366f1",
          color: "white",
          fontSize: 10,
          fontWeight: "bold",
        }}
      >
        {fallbackText}
      </div>
    );
  }

  return <img src={imgSrc} alt={alt} style={style} onError={() => setFailed(true)} />;
});

function MediaDownloadPage({ onDownloadingChange }) {
  const headerStyles = useHeaderStyles();
  const containerStyles = useContainerStyles();

  // 상태
  const [keywords, setKeywords] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState(new Set());
  const [selectedProvider, setSelectedProvider] = useState("pexels");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadedVideos, setDownloadedVideos] = useState([]);
  const [downloadOptions, setDownloadOptions] = useState({
    videosPerKeyword: 2,
    maxFileSize: 20,
    minResolution: "1080p",
    aspectRatio: "16:9",
  });
  const [keywordsLoaded, setKeywordsLoaded] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [completedVideosCount, setCompletedVideosCount] = useState(0);
  const [showButtonHint, setShowButtonHint] = useState(true);

  // Refs
  const cancelledRef = useRef(false);
  const progressListenerRef = useRef(null);
  const downloadStartTimeRef = useRef(null);
  const totalVideosRef = useRef(0);
  const countdownIntervalRef = useRef(null);
  const isTimeEstimatedRef = useRef(false);

  // 남은 시간을 "1분 20초" 형식으로 변환 (초 단위)
  const formatRemainingTime = (seconds) => {
    if (typeof seconds !== "number" || seconds <= 0) return "";

    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);

    if (min > 0) {
      return `${min}분 ${sec}초`;
    }
    return `${sec}초`;
  };


  // 타이머 정리 헬퍼
  const clearCountdownTimer = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // 다운로드 상태 초기화
  const resetDownloadState = useCallback(() => {
    setIsDownloading(false);
    downloadStartTimeRef.current = null;
    totalVideosRef.current = 0;
    isTimeEstimatedRef.current = false;
    setEstimatedTimeRemaining(null);
    setCompletedVideosCount(0);
    clearCountdownTimer();
  }, [clearCountdownTimer]);

  // 키워드 로드
  const loadKeywordsFromJSON = useCallback(async (showToast = false) => {
    try {
      setKeywordsLoaded(false);
      const extractedKeywords = await window.api.getSetting("extractedKeywords");
      const keywordsArray = Array.isArray(extractedKeywords) ? extractedKeywords : [];

      setKeywords(keywordsArray);

      // 전체 선택
      if (keywordsArray.length > 0) {
        setSelectedKeywords(new Set(keywordsArray));
      }

      setKeywordsLoaded(true);
      if (showToast) {
        showSuccess(`키워드 ${keywordsArray.length}개 새로고침 완료`);
      }
    } catch (e) {
      console.error("키워드 로드 실패:", e);
      setKeywords([]);
      setKeywordsLoaded(true);
      if (showToast) {
        showError("키워드 새로고침 실패");
      }
    }
  }, []);

  // 다운로드 히스토리 로드
  const loadDownloadHistory = useCallback(async () => {
    try {
      if (window?.api?.loadDownloadHistory) {
        await window.api.loadDownloadHistory();
      }
    } catch (e) {
      console.error("다운로드 히스토리 로드 실패:", e);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    // 프로그램 시작 시 다운로드 목록 초기화
    setDownloadedVideos([]);
    setDownloadProgress({});
    resetDownloadState();

    loadKeywordsFromJSON();
    loadDownloadHistory();

    const handleSettingsChanged = (payload) => {
      if (payload?.key === "extractedKeywords") {
        loadKeywordsFromJSON();
      }
    };

    const handleFocus = () => {
      loadKeywordsFromJSON();
    };

    if (window.api?.on) {
      window.api.on("settings:changed", handleSettingsChanged);
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      if (window.api?.off) {
        window.api.off("settings:changed", handleSettingsChanged);
      }
      window.removeEventListener("focus", handleFocus);
      clearCountdownTimer();
    };
  }, [loadKeywordsFromJSON, loadDownloadHistory, clearCountdownTimer, resetDownloadState]);

  // 다운로드 상태 변경을 부모에게 알림
  useEffect(() => {
    if (onDownloadingChange) {
      onDownloadingChange(isDownloading);
    }
  }, [isDownloading, onDownloadingChange]);

  // 초기화 이벤트
  useEffect(() => {
    const handleResetMediaDownload = async () => {
      setKeywords([]);
      setSelectedKeywords(new Set());
      setDownloadedVideos([]);
      setDownloadProgress({});
      setKeywordsLoaded(true);
      setCompletedVideosCount(0);
      resetDownloadState();

      try {
        if (window.api?.setSetting) {
          await window.api.setSetting({ key: "extractedKeywords", value: [] });
        }
        window.dispatchEvent(new CustomEvent("reset-keyword-extraction"));
      } catch (error) {
        console.error("초기화 실패:", error);
        showError("초기화 중 오류 발생");
      }
    };

    window.addEventListener("reset-media-download", handleResetMediaDownload);

    return () => {
      window.removeEventListener("reset-media-download", handleResetMediaDownload);
    };
  }, [resetDownloadState]);

  // 키워드 토글
  const toggleKeyword = useCallback((k) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  }, []);

  // 전체 선택/해제
  const selectAllKeywords = useCallback(() => {
    setSelectedKeywords((prev) => (prev.size === keywords.length ? new Set() : new Set(keywords)));
  }, [keywords]);

  // 다운로드 시작
  const startDownload = useCallback(async () => {
    if (selectedKeywords.size === 0) {
      return showError("다운로드할 키워드를 선택해주세요.");
    }
    if (keywords.length === 0) {
      return showError("추출된 키워드가 없습니다.");
    }

    // video, images 폴더 비우기
    try {
      // ✅ 1단계: 설정에서 경로 가져오기
      let videoSaveFolder = await window.api.getSetting("videoSaveFolder");

      // ✅ 2단계: 설정이 없으면 프로젝트에서 경로 복구 (exe 환경 IPC 타이밍 이슈 해결)
      if (!videoSaveFolder) {
        console.warn("[startDownload] videoSaveFolder 설정이 없음. 프로젝트에서 복구 중...");
        const currentProjectId = await window.api.getSetting("currentProjectId");
        if (currentProjectId) {
          const projects = await window.api.getSetting("projects");
          if (Array.isArray(projects)) {
            const currentProject = projects.find(p => p.id === currentProjectId);
            if (currentProject && currentProject.paths && currentProject.paths.root) {
              videoSaveFolder = currentProject.paths.root;
              console.log(`✅ [startDownload] 프로젝트 경로 복구: ${videoSaveFolder}`);
            }
          }
        }
      }

      if (videoSaveFolder) {
        await Promise.all([
          window.api.invoke("files:clearDirectory", { dirPath: `${videoSaveFolder}/video` }),
          window.api.invoke("files:clearDirectory", { dirPath: `${videoSaveFolder}/images` }),
        ]);
      }
    } catch (error) {
      console.error("폴더 비우기 실패:", error);
    }

    setIsDownloading(true);
    cancelledRef.current = false;
    setDownloadProgress({});
    setDownloadedVideos([]);
    downloadStartTimeRef.current = Date.now();
    setCompletedVideosCount(0);
    isTimeEstimatedRef.current = false;

    clearCountdownTimer();

    const keywordArray = Array.from(selectedKeywords);
    totalVideosRef.current = keywordArray.length * downloadOptions.videosPerKeyword;

    const initialEstimate = totalVideosRef.current * 5;
    setEstimatedTimeRemaining(initialEstimate);

    countdownIntervalRef.current = setInterval(() => {
      setEstimatedTimeRemaining((prev) => {
        if (prev === null || prev <= 0) return 0;
        return Math.max(0, prev - 1);
      });
    }, 1000);

    try {
      const onProgress = (p) => {
        if (cancelledRef.current) return;

        const { keyword, status, progress, filename, error, videoIndex, totalVideos, videoSuffix } = p;

        // 완료 시 카운트 증가 및 시간 예측
        if (status === "completed" && filename) {
          setCompletedVideosCount((prev) => {
            const newCount = prev + 1;

            if (!isTimeEstimatedRef.current && newCount >= 1 && downloadStartTimeRef.current && totalVideosRef.current > 0) {
              const elapsedTime = (Date.now() - downloadStartTimeRef.current) / 1000;
              const timePerVideo = elapsedTime / newCount;
              const remainingVideos = totalVideosRef.current - newCount;
              const estimatedRemaining = Math.max(0, remainingVideos * timePerVideo);

              setEstimatedTimeRemaining(estimatedRemaining);
              isTimeEstimatedRef.current = true;
            }

            return newCount;
          });
        }

        // 진행 상황 업데이트
        setDownloadProgress((prev) => ({
          ...prev,
          [keyword]: {
            status,
            progress: progress || 0,
            filename,
            error,
            videoIndex,
            totalVideos,
            currentVideo: videoSuffix ? `${keyword}${videoSuffix}` : keyword,
            mediaType: p.mediaType,
            step: p.step,
          },
        }));

        // 완료된 비디오 추가
        if (status === "completed" && filename) {
          const uniqueKey = `${keyword}_${videoIndex || 1}`;
          setDownloadedVideos((prev) => [
            ...prev.filter((v) => v.uniqueKey !== uniqueKey),
            {
              keyword: videoSuffix ? `${keyword}${videoSuffix}` : keyword,
              uniqueKey,
              provider: p.provider || selectedProvider,
              filename,
              thumbnail: p.thumbnail || `https://via.placeholder.com/160x90/6366f1/white?text=${encodeURIComponent(keyword)}`,
              success: true,
              width: p.width || 0,
              height: p.height || 0,
              size: p.size || 0,
              quality: p.quality || "",
              originalFilename: p.originalFilename || filename,
              mediaType: p.mediaType,
            },
          ]);
        } else if (status === "failed") {
          const uniqueKey = `${keyword}_${videoIndex || 1}`;
          setDownloadedVideos((prev) => [
            ...prev.filter((v) => v.uniqueKey !== uniqueKey),
            {
              keyword: videoSuffix ? `${keyword}${videoSuffix}` : keyword,
              uniqueKey,
              provider: p.provider || selectedProvider,
              filename: filename || `${keyword}_failed`,
              thumbnail: `https://via.placeholder.com/160x90/dc2626/white?text=Error`,
              success: false,
              error,
              width: p.width || 0,
              height: p.height || 0,
              size: p.size || 0,
              quality: p.quality || "",
              mediaType: p.mediaType,
            },
          ]);
        }
      };

      const off = window.api.onVideoDownloadProgress(onProgress);
      progressListenerRef.current = off;

      const result = await window.api.downloadVideosByKeywords({
        keywords: keywordArray,
        provider: selectedProvider,
        options: downloadOptions,
      });

      if (off) off();
      progressListenerRef.current = null;

      if (!cancelledRef.current) {
        if (result.success) {
          showSuccess(`다운로드 완료: ${result.summary.success}/${result.summary.total}개 성공`);
          // 미디어 다운로드 완료 이벤트 발생 (영상 완성 탭에서 자동 할당 트리거)
          window.dispatchEvent(new CustomEvent("media-download-completed"));
        } else {
          showError(`다운로드 실패: ${result.error}`);
        }
      }
    } catch (e) {
      console.error("다운로드 오류:", e);
      showError(`다운로드 중 오류 발생: ${e.message}`);
    } finally {
      resetDownloadState();
    }
  }, [selectedKeywords, keywords, downloadOptions, selectedProvider, clearCountdownTimer, resetDownloadState]);

  // 다운로드 취소
  const cancelDownload = useCallback(async () => {
    cancelledRef.current = true;
    resetDownloadState();

    // 진행 상태 및 다운로드된 데이터 초기화
    setDownloadProgress({});
    setDownloadedVideos([]);

    if (progressListenerRef.current) {
      progressListenerRef.current();
      progressListenerRef.current = null;
    }

    try {
      if (window.api?.cancelVideoDownload) {
        await window.api.cancelVideoDownload();
      }
      // 토스트 제거 - 대본 취소와 일관성 유지
    } catch (error) {
      console.error("취소 실패:", error);
      showError("취소 중 오류가 발생했습니다.");
    }
  }, [resetDownloadState]);

  // 메모이제이션된 값
  const resolutionText = useMemo(() => {
    const map = {
      "480p": "480p (SD)",
      "720p": "720p (HD)",
      "1080p": "1080p (FHD)",
      "1440p": "1440p (QHD)",
    };
    return map[downloadOptions.minResolution] || "1080p (FHD)";
  }, [downloadOptions.minResolution]);

  const aspectRatioText = useMemo(() => {
    const map = {
      any: "제한 없음",
      "16:9": "16:9 (와이드)",
      "4:3": "4:3 (일반)",
      "1:1": "1:1 (정사각형)",
      "9:16": "9:16 (세로)",
    };
    return map[downloadOptions.aspectRatio] || "제한 없음";
  }, [downloadOptions.aspectRatio]);

  const totalVideosToDownload = useMemo(
    () => selectedKeywords.size * downloadOptions.videosPerKeyword,
    [selectedKeywords.size, downloadOptions.videosPerKeyword]
  );

  const downloadProgressPercent = useMemo(
    () => Math.round((completedVideosCount / totalVideosToDownload) * 100) || 0,
    [completedVideosCount, totalVideosToDownload]
  );

  return (
    <div className={containerStyles.container}>
      {/* 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <RocketRegular />
          미디어 다운로드
        </div>
        <div className={headerStyles.pageDescription}>추출된 키워드를 기반으로 영상을 다운로드 합니다</div>
        <div className={headerStyles.divider} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateAreas: `
          "keywords options"
        `,
          gap: 24,
          maxWidth: "1200px",
          width: "100%",
        }}
      >
        {/* 키워드 선택 */}
        <Card style={{ padding: 20, gridArea: "keywords", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <VideoRegular style={{ fontSize: 18 }} />
              <Text size={400} weight="semibold">
                키워드 선택
              </Text>
              <Badge appearance="filled" size="small">
                {selectedKeywords.size}/{keywords.length}
              </Badge>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button appearance="subtle" size="small" onClick={() => loadKeywordsFromJSON(true)} disabled={isDownloading}>
                <ArrowClockwiseRegular style={{ fontSize: 16 }} />
              </Button>
              <Button appearance="subtle" size="small" onClick={selectAllKeywords} disabled={isDownloading}>
                {selectedKeywords.size === keywords.length ? "전체 해제" : "전체 선택"}
              </Button>
              <Button appearance="subtle" size="small" onClick={() => window.dispatchEvent(new CustomEvent("reset-media-download"))} disabled={isDownloading}>
                초기화
              </Button>
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 8,
                maxHeight: 300,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {!keywordsLoaded ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 20 }}>
                  <Spinner size="small" style={{ marginBottom: 8 }} />
                  <Text size={300}>키워드를 불러오는 중...</Text>
                </div>
              ) : keywords.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 20 }}>
                  <Text size={300} style={{ color: "#666" }}>
                    추출된 키워드가 없습니다.
                    <br />
                    먼저 미디어 준비에서 키워드를 추출해주세요.
                  </Text>
                </div>
              ) : (
                keywords.map((k) => {
                  const isSelected = selectedKeywords.has(k);
                  return (
                    <Badge
                      key={k}
                      appearance={isSelected ? "filled" : "outline"}
                      style={{
                        cursor: "pointer",
                        padding: "8px 12px",
                        textAlign: "center",
                        backgroundColor: isSelected ? "#e6f4ff" : "transparent",
                        color: isSelected ? "#0078d4" : "#666",
                        borderColor: isSelected ? "#91caff" : "#e0e0e0",
                        fontWeight: isSelected ? 600 : 500,
                      }}
                      onClick={() => toggleKeyword(k)}
                    >
                      {k}
                    </Badge>
                  );
                })
              )}
            </div>
          </div>

          <div style={{ marginTop: "auto" }}>
            <Divider style={{ margin: "16px 0" }} />

            {!isDownloading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <style>
                  {`
                    @keyframes buttonPulse {
                      0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 2px 12px rgba(0, 120, 212, 0.3);
                      }
                      50% {
                        transform: scale(1.03);
                        box-shadow: 0 4px 16px rgba(0, 120, 212, 0.4);
                      }
                    }
                    .download-button-pulse {
                      animation: buttonPulse 2s ease-in-out 3;
                      background: linear-gradient(120deg, #0078d4 0%, #4a90e2 100%) !important;
                      border: none !important;
                      box-shadow: 0 2px 12px rgba(0, 120, 212, 0.25);
                      transition: all 0.3s ease;
                    }
                    .download-button-pulse:hover {
                      transform: translateY(-1px);
                      box-shadow: 0 4px 16px rgba(0, 120, 212, 0.35);
                    }
                  `}
                </style>
                <Button
                  appearance="primary"
                  size="large"
                  disabled={selectedKeywords.size === 0}
                  onClick={() => {
                    setShowButtonHint(false);
                    startDownload();
                  }}
                  className={selectedKeywords.size > 0 && showButtonHint ? "download-button-pulse" : ""}
                  style={{
                    width: "100%",
                    ...(selectedKeywords.size > 0 && showButtonHint ? {
                      background: "linear-gradient(120deg, #0078d4 0%, #4a90e2 100%)",
                      border: "none",
                      boxShadow: "0 2px 12px rgba(0, 120, 212, 0.25)"
                    } : {})
                  }}
                >
                  <ArrowDownloadRegular style={{ marginRight: 8 }} />
                  {`${selectedKeywords.size}개 키워드로 다운로드`}
                </Button>
                {selectedKeywords.size > 0 && showButtonHint && (
                  <Text
                    size={200}
                    style={{
                      textAlign: "center",
                      color: "#0078d4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      fontWeight: 500,
                    }}
                  >
                    👆 준비 완료! 클릭하여 다운로드를 시작하세요
                  </Text>
                )}
              </div>
            ) : (
              <Button
                appearance="secondary"
                size="large"
                onClick={cancelDownload}
                style={{
                  width: "100%",
                }}
              >
                ⏹ 다운로드 중지
              </Button>
            )}
          </div>
        </Card>

        {/* 다운로드 옵션 */}
        <Card style={{ padding: 20, gridArea: "options", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <SettingsRegular style={{ fontSize: 18 }} />
            <Text size={400} weight="semibold">
              다운로드 옵션
            </Text>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {/* 영상 개수 */}
            <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0,1fr)", alignItems: "center", columnGap: 12 }}>
              <Text size={300} weight="medium">
                영상 개수
              </Text>
              <div style={{ minWidth: 0, width: "100%" }}>
                <Slider
                  min={1}
                  max={3}
                  step={1}
                  value={downloadOptions.videosPerKeyword}
                  onChange={(_, d) => setDownloadOptions((p) => ({ ...p, videosPerKeyword: d.value }))}
                  style={{ width: "100%" }}
                  disabled={isDownloading}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginTop: 4 }}>
                  <span>1개</span>
                  <span style={{ color: "#0078d4", fontSize: 13, fontWeight: 500 }}>현재: {downloadOptions.videosPerKeyword}개</span>
                  <span>3개</span>
                </div>
              </div>
            </div>

            {/* 최대 파일 크기 */}
            <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0,1fr)", alignItems: "center", columnGap: 12 }}>
              <Text size={300} weight="medium">
                최대 파일 크기
              </Text>
              <div style={{ minWidth: 0, width: "100%" }}>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={downloadOptions.maxFileSize}
                  onChange={(_, d) => setDownloadOptions((p) => ({ ...p, maxFileSize: d.value }))}
                  style={{ width: "100%" }}
                  disabled={isDownloading}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginTop: 4 }}>
                  <span>1MB</span>
                  <span style={{ color: "#0078d4", fontSize: 13, fontWeight: 500 }}>현재: {downloadOptions.maxFileSize}MB</span>
                  <span>20MB</span>
                </div>
              </div>
            </div>

            {/* 해상도 */}
            <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0,1fr)", alignItems: "center", columnGap: 12 }}>
              <Text size={300} weight="medium">
                해상도 선택
              </Text>
              <div style={{ minWidth: 0, width: "100%" }}>
                <Dropdown
                  value={resolutionText}
                  onOptionSelect={(_, data) => setDownloadOptions((p) => ({ ...p, minResolution: data.optionValue }))}
                  style={{ width: "100%" }}
                  disabled={isDownloading}
                >
                  <Option value="480p">480p (SD)</Option>
                  <Option value="720p">720p (HD)</Option>
                  <Option value="1080p">1080p (FHD)</Option>
                  <Option value="1440p">1440p (QHD)</Option>
                </Dropdown>
                {/* 자동 설정 안내 */}
                <Text size={100} style={{ color: "#9ca3af", marginTop: 4, display: "block" }}>
                  * 영상 모드 변경 시 자동으로 추천값이 설정됩니다
                </Text>
              </div>
            </div>

            {/* 화면 비율 */}
            <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0,1fr)", alignItems: "center", columnGap: 12 }}>
              <Text size={300} weight="medium">
                화면 비율
              </Text>
              <div style={{ minWidth: 0, width: "100%" }}>
                <Dropdown
                  value={aspectRatioText}
                  onOptionSelect={(_, data) => setDownloadOptions((p) => ({ ...p, aspectRatio: data.optionValue }))}
                  style={{ width: "100%" }}
                  disabled={isDownloading}
                >
                  <Option value="any">제한 없음</Option>
                  <Option value="16:9">16:9 (와이드)</Option>
                  <Option value="4:3">4:3 (일반)</Option>
                  <Option value="1:1">1:1 (정사각형)</Option>
                  <Option value="9:16">9:16 (세로)</Option>
                </Dropdown>
                {/* 자동 설정 안내 */}
                <Text size={100} style={{ color: "#9ca3af", marginTop: 4, display: "block" }}>
                  * 영상 모드 변경 시 자동으로 추천값이 설정됩니다
                </Text>
              </div>
            </div>

            {/* 요약 */}
            <Divider style={{ margin: "8px 0" }} />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 10,
                padding: 12,
                border: "1px solid #eef1f6",
                background: "#f8fafc",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <InfoRegular style={{ fontSize: 16, color: "#5e6ad2" }} />
                <Text size={200} weight="semibold">
                  <span style={{ color: "#0078d4" }}>현재</span> 선택 요약
                </Text>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Badge appearance="tint" color="brand">
                  해상도 {resolutionText}
                </Badge>
                <Badge appearance="tint" color="brand">
                  비율 {aspectRatioText}
                </Badge>
                <Badge appearance="tint" color="brand">
                  개수 {downloadOptions.videosPerKeyword}개
                </Badge>
                <Badge appearance="tint" color="brand">
                  최대 {downloadOptions.maxFileSize}MB
                </Badge>
              </div>
              <Text size={100} style={{ color: "#7a869a" }}>
                팁: 10-20MB가 품질과 속도의 최적 균형입니다.
              </Text>
            </div>
          </div>
        </Card>
      </div>

      {/* 하단 고정 바 */}
      {(isDownloading || downloadedVideos.length > 0) && (
        <BottomFixedBar
          isComplete={!isDownloading && downloadedVideos.length > 0}
          isLoading={isDownloading}
          statusText={
            isDownloading
              ? `📥 미디어 다운로드 중... (${completedVideosCount}/${totalVideosToDownload})`
              : `✅ 다운로드 완료 (${downloadedVideos.length}개)`
          }
          remainingTimeText={
            isDownloading && estimatedTimeRemaining !== null
              ? estimatedTimeRemaining <= 0
                ? "(남은 시간: 거의 완료...)"
                : `(남은 시간: ${formatRemainingTime(estimatedTimeRemaining)})`
              : ""
          }
          progress={downloadProgressPercent}
          nextStepButton={
            !isDownloading && downloadedVideos.length > 0
              ? {
                  text: "➡️ 다음 단계: 영상 완성",
                  eventName: "navigate-to-refine",
                  onClick: async () => {
                    try {
                      console.log("🔄 영상 편집으로 이동 시작 - 프로젝트 설정 동기화 대기 중...");

                      // ✅ ResultsSidebar와 동일한 대기 로직: IPC 채널 동기화 대기 (50ms)
                      await new Promise(resolve => setTimeout(resolve, 50));

                      console.log("✅ 설정 동기화 완료 - auto-load-project-files 이벤트 발생");

                      // 페이지 전환 전에 이벤트 먼저 발생 (타이밍 경합 제거)
                      window.dispatchEvent(new CustomEvent("auto-load-project-files"));
                    } catch (error) {
                      console.error("자동 로드 이벤트 발생 실패:", error);
                    }
                  }
                }
              : undefined
          }
          expandedContent={
            isDownloading ? (
              // 진행 중
              <div style={{ padding: "12px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {Array.from(selectedKeywords).map((k) => {
                    const progress = downloadProgress[k];
                    return (
                      <div
                        key={k}
                        style={{
                          padding: 12,
                          background: tokens.colorNeutralBackground1,
                          border: `1px solid ${tokens.colorNeutralStroke1}`,
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Text size={300}>{k}</Text>
                              {progress?.mediaType && progress?.step && (
                                <Badge
                                  appearance="tint"
                                  size="small"
                                  color={
                                    progress.mediaType === "video"
                                      ? "brand"
                                      : progress.mediaType === "photo"
                                      ? "success"
                                      : progress.mediaType === "ai"
                                      ? "warning"
                                      : "informative"
                                  }
                                >
                                  {progress.mediaType === "video"
                                    ? "📹 영상"
                                    : progress.mediaType === "photo"
                                    ? "📷 사진"
                                    : progress.mediaType === "ai"
                                    ? "🎨 AI"
                                    : progress.mediaType}
                                </Badge>
                              )}
                            </div>
                            {progress?.totalVideos > 1 && (
                              <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 2, display: "block" }}>
                                {progress.currentVideo} ({progress.videoIndex || 1}/{progress.totalVideos})
                              </Text>
                            )}
                            {progress?.status === "searching" && progress?.mediaType && progress?.step && (
                              <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 2, display: "block" }}>
                                {progress.mediaType === "video"
                                  ? "영상 검색 중..."
                                  : progress.mediaType === "photo"
                                  ? "사진 검색 중 (영상 실패)"
                                  : progress.mediaType === "ai"
                                  ? "AI 이미지 생성 준비 중 (사진 실패)"
                                  : "검색 중..."}
                              </Text>
                            )}
                            {progress?.status === "downloading" && progress?.mediaType && (
                              <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 2, display: "block" }}>
                                {progress.mediaType === "video"
                                  ? "영상 다운로드 중..."
                                  : progress.mediaType === "photo"
                                  ? "사진 다운로드 중..."
                                  : "다운로드 중..."}
                              </Text>
                            )}
                            {progress?.status === "generating" && progress?.mediaType === "ai" && (
                              <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 2, display: "block" }}>
                                AI 이미지 생성 중 (영상/사진 없음)
                              </Text>
                            )}
                          </div>
                          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                            {progress?.status === "completed"
                              ? "완료"
                              : progress?.status === "failed"
                              ? "실패"
                              : `${progress?.progress || 0}%`}
                          </Text>
                        </div>
                        <ProgressBar value={progress?.progress || 0} max={100} />
                        {progress?.error && (
                          <Text size={200} style={{ color: tokens.colorPaletteRedForeground1, marginTop: 4, display: "block" }}>
                            오류: {progress.error}
                          </Text>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // 완료
              downloadedVideos.length > 0 && (
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {downloadedVideos.map((video, i) => (
                      <div
                        key={video.uniqueKey || i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                          background: tokens.colorNeutralBackground1,
                          border: `1px solid ${tokens.colorNeutralStroke1}`,
                          borderRadius: 8,
                        }}
                      >
                        <ThumbnailImage
                          src={video.thumbnail}
                          alt={video.keyword}
                          style={{
                            width: 60,
                            height: 34,
                            borderRadius: 4,
                            objectFit: "cover",
                            border: `1px solid ${tokens.colorNeutralStroke1}`,
                          }}
                          fallbackText={video.success ? "IMAGE" : "ERROR"}
                        />

                        <div style={{ flex: 1 }}>
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: video.error ? 4 : 0, flexWrap: "wrap" }}
                          >
                            <Text size={200} weight="medium" style={{ minWidth: 80 }}>
                              {video.keyword}
                            </Text>
                            {video.mediaType && (
                              <Badge
                                appearance="tint"
                                size="small"
                                color={
                                  video.mediaType === "video"
                                    ? "brand"
                                    : video.mediaType === "photo"
                                    ? "success"
                                    : video.mediaType === "ai"
                                    ? "warning"
                                    : "informative"
                                }
                              >
                                {video.mediaType === "video"
                                  ? "📹 영상"
                                  : video.mediaType === "photo"
                                  ? "📷 사진"
                                  : video.mediaType === "ai"
                                  ? "🎨 AI"
                                  : video.mediaType}
                              </Badge>
                            )}
                            <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                              {video.width && video.height ? `${video.width}×${video.height}` : "해상도불명"}
                            </Text>
                          </div>
                          {video.error && (
                            <Text size={100} style={{ color: tokens.colorPaletteRedForeground1 }}>
                              오류: {video.error}
                            </Text>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {video.success ? (
                            <CheckmarkCircleRegular style={{ fontSize: 16, color: tokens.colorPaletteGreenForeground1 }} />
                          ) : (
                            <Badge appearance="filled" color="danger" size="small">
                              실패
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Divider style={{ margin: "12px 0" }} />

                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <Button
                      appearance="primary"
                      size="medium"
                      onClick={async () => {
                        try {
                          const videoSaveFolder = await window.api.getSetting("videoSaveFolder");
                          if (videoSaveFolder) {
                            await window.electron.shell.openPath(`${videoSaveFolder}/video`);
                          }
                        } catch (e) {
                          console.error("폴더 열기 실패:", e);
                        }
                      }}
                    >
                      다운로드 폴더 열기
                    </Button>
                  </div>
                </div>
              )
            )
          }
          onClose={() => setDownloadedVideos([])}
        />
      )}
    </div>
  );
}

export default function MediaDownloadPageWithBoundary({ onDownloadingChange }) {
  return (
    <PageErrorBoundary>
      <MediaDownloadPage onDownloadingChange={onDownloadingChange} />
    </PageErrorBoundary>
  );
}
