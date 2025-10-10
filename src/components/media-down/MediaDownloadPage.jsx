import React, { useState, useEffect, useRef } from "react";
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
  VideoClip24Regular,
  DismissCircle24Regular,
} from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import { showError, showSuccess } from "../common/GlobalToast";

/** URL/로컬 경로 모두 img에 표시 가능하게 */
function toImgSrc(src) {
  if (!src || typeof src !== "string") return null;
  if (/^https?:\/\//i.test(src)) return src;
  const normalized = src.replace(/\\/g, "/");
  return `file://${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

function MediaDownloadPage() {
  const headerStyles = useHeaderStyles();
  const containerStyles = useContainerStyles();

  // ===== 상태 (기존 유지)
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
  const [downloadCancelled, setDownloadCancelled] = useState(false);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  const [completedVideosCount, setCompletedVideosCount] = useState(0);
  const cancelledRef = useRef(false);
  const progressListenerRef = useRef(null);
  const downloadStartTimeRef = useRef(null);
  const totalVideosRef = useRef(0);
  const countdownIntervalRef = useRef(null);
  const isTimeEstimatedRef = useRef(false); // 시간 예측 완료 여부

  // ===== 초기 로드 및 설정 변경 감지
  useEffect(() => {
    loadKeywordsFromJSON();
    loadDownloadHistory();

    // 설정 변경 이벤트 리스너 추가
    const handleSettingsChanged = (payload) => {
      if (payload?.key === "extractedKeywords") {
        console.log("[미디어 다운로드] 키워드 설정 변경 감지, 새로고침 중...");
        loadKeywordsFromJSON();
      }
    };

    // 설정 변경 이벤트 구독
    if (window.api?.on) {
      window.api.on("settings:changed", handleSettingsChanged);
    }

    // 페이지 포커스 시 키워드 새로고침
    const handleFocus = () => {
      console.log("[미디어 다운로드] 페이지 포커스, 키워드 새로고침");
      loadKeywordsFromJSON();
    };

    window.addEventListener("focus", handleFocus);

    // 클린업
    return () => {
      if (window.api?.off) {
        window.api.off("settings:changed", handleSettingsChanged);
      }
      window.removeEventListener("focus", handleFocus);

      // 카운트다운 타이머 정리
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // ===== 초기화 이벤트 리스너
  useEffect(() => {
    const handleResetMediaDownload = () => {
      console.log("🔄 미디어 다운로드 페이지 초기화");
      setKeywords([]);
      setSelectedKeywords(new Set());
      setDownloadedVideos([]);
      setDownloadProgress({});
      setKeywordsLoaded(true); // true로 설정하여 로딩 메시지 숨김
      setIsDownloading(false);
      setCompletedVideosCount(0);
    };

    window.addEventListener("reset-media-download", handleResetMediaDownload);

    return () => {
      window.removeEventListener("reset-media-download", handleResetMediaDownload);
    };
  }, []);

  const loadKeywordsFromJSON = async () => {
    try {
      const extractedKeywords = await window.api.getSetting("extractedKeywords");
      setKeywords(Array.isArray(extractedKeywords) ? extractedKeywords : []);
      setKeywordsLoaded(true);
    } catch (e) {
      console.error(e);
      setKeywords([]);
      setKeywordsLoaded(true);
    }
  };
  const loadDownloadHistory = async () => {
    try {
      if (window?.api?.loadDownloadHistory) {
        await window.api.loadDownloadHistory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ===== 선택/토글 (기존 유지)
  const toggleKeyword = (k) => {
    const next = new Set(selectedKeywords);
    next.has(k) ? next.delete(k) : next.add(k);
    setSelectedKeywords(next);
  };
  const selectAllKeywords = () => {
    if (selectedKeywords.size === keywords.length) setSelectedKeywords(new Set());
    else setSelectedKeywords(new Set(keywords));
  };

  // ===== 다운로드 (기존 유지)
  const startDownload = async () => {
    if (selectedKeywords.size === 0) return showError("다운로드할 키워드를 선택해주세요.");
    if (keywords.length === 0) return showError("추출된 키워드가 없습니다. 먼저 미디어 준비에서 키워드를 추출해주세요.");

    setIsDownloading(true);
    setDownloadCancelled(false);
    cancelledRef.current = false;
    setDownloadProgress({});
    setDownloadedVideos([]);
    downloadStartTimeRef.current = Date.now();
    setCompletedVideosCount(0);
    isTimeEstimatedRef.current = false;

    // 기존 카운트다운 타이머 정리
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const keywordArray = Array.from(selectedKeywords);
    // 전체 다운로드할 비디오 개수 계산
    totalVideosRef.current = keywordArray.length * downloadOptions.videosPerKeyword;

    // 초기 예상 시간 설정 (비디오당 평균 5초로 가정)
    const initialEstimate = totalVideosRef.current * 5;
    setEstimatedTimeRemaining(initialEstimate);

    // 초기 카운트다운 시작
    countdownIntervalRef.current = setInterval(() => {
      setEstimatedTimeRemaining(prev => {
        if (prev === null || prev <= 0) {
          return 0;
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);

    try {
      const onProgress = (p) => {
        // 취소된 경우 프로그레스 업데이트 무시
        if (cancelledRef.current) return;

        const { keyword, status, progress, filename, error, videoIndex, totalVideos, videoSuffix } = p;

        // 비디오 완료 시 카운트 증가
        if (status === "completed" && filename) {
          setCompletedVideosCount(prev => {
            const newCount = prev + 1;

            // 처음 1개 비디오 완료 후 정확한 시간으로 업데이트 (한 번만)
            if (!isTimeEstimatedRef.current && newCount >= 1 && downloadStartTimeRef.current && totalVideosRef.current > 0) {
              const elapsedTime = (Date.now() - downloadStartTimeRef.current) / 1000; // 초 단위
              const timePerVideo = elapsedTime / newCount;
              const remainingVideos = totalVideosRef.current - newCount;
              const estimatedRemaining = Math.max(0, remainingVideos * timePerVideo);

              // 정확한 시간으로 업데이트
              setEstimatedTimeRemaining(estimatedRemaining);
              isTimeEstimatedRef.current = true;

              console.log(`[시간 예측] 첫 ${newCount}개 완료, 비디오당 ${timePerVideo.toFixed(1)}초, 남은 시간: ${estimatedRemaining.toFixed(0)}초`);
            }

            return newCount;
          });
        }

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
          },
        }));

        if (status === "completed" && filename) {
          const uniqueKey = `${keyword}_${videoIndex || 1}`;
          const thumbnailSrc = toImgSrc(p.thumbnail);

          setDownloadedVideos((prev) => [
            ...prev.filter((v) => v.uniqueKey !== uniqueKey),
            {
              keyword: videoSuffix ? `${keyword}${videoSuffix}` : keyword,
              uniqueKey,
              provider: selectedProvider,
              filename,
              thumbnail: thumbnailSrc || `https://via.placeholder.com/160x90/6366f1/white?text=${encodeURIComponent(keyword)}`,
              success: true,
              width: p.width || 0,
              height: p.height || 0,
              size: p.size || 0,
              quality: p.quality || "",
              originalFilename: p.originalFilename || filename,
            },
          ]);
        } else if (status === "failed") {
          const uniqueKey = `${keyword}_${videoIndex || 1}`;
          setDownloadedVideos((prev) => [
            ...prev.filter((v) => v.uniqueKey !== uniqueKey),
            {
              keyword: videoSuffix ? `${keyword}${videoSuffix}` : keyword,
              uniqueKey,
              provider: selectedProvider,
              filename: filename || `${keyword}_failed`,
              thumbnail: `https://via.placeholder.com/160x90/dc2626/white?text=Error`,
              success: false,
              error,
              width: p.width || 0,
              height: p.height || 0,
              size: p.size || 0,
              quality: p.quality || "",
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

      // 취소되지 않은 경우에만 성공/실패 메시지 표시
      if (!cancelledRef.current) {
        if (result.success) showSuccess(`영상 다운로드 완료: ${result.summary.success}/${result.summary.total}개 성공`);
        else showError(`영상 다운로드 실패: ${result.error}`);
      }
    } catch (e) {
      console.error(e);
      showError(`영상 다운로드 중 오류가 발생했습니다: ${e.message}`);
    } finally {
      setIsDownloading(false);
      setDownloadCancelled(false);
      downloadStartTimeRef.current = null;
      totalVideosRef.current = 0;
      isTimeEstimatedRef.current = false;
      setEstimatedTimeRemaining(null);
      setCompletedVideosCount(0);

      // 카운트다운 타이머 정리
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  };

  // ===== 다운로드 취소
  const cancelDownload = async () => {
    cancelledRef.current = true;
    setDownloadCancelled(true);
    setIsDownloading(false);
    downloadStartTimeRef.current = null;
    totalVideosRef.current = 0;
    isTimeEstimatedRef.current = false;
    setEstimatedTimeRemaining(null);
    setCompletedVideosCount(0);

    // 카운트다운 타이머 정리
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // 프로그레스 리스너 즉시 제거
    if (progressListenerRef.current) {
      progressListenerRef.current();
      progressListenerRef.current = null;
    }

    // 백엔드에 취소 요청
    try {
      if (window.api?.cancelVideoDownload) {
        await window.api.cancelVideoDownload();
        console.log("[취소] 백엔드에 취소 요청 완료");
      }
      showSuccess("다운로드가 취소되었습니다.");
    } catch (error) {
      console.error("[취소] 실패:", error);
      showError("다운로드 취소 중 오류가 발생했습니다.");
    }
  };

  // ===== 레이아웃 (5:5)
  const grid = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateRows: "auto auto auto",
    gridTemplateAreas: `
      "source options"
      "keywords options"
      "bottom bottom"
    `,
    gap: 24,
    maxWidth: "1200px",
    width: "100%",
  };

  // 옵션 카드 내부 그리드(라벨/컨트롤 2열)
  // ▶ 오른쪽 칼럼에 minWidth:0 반드시! (슬라이더 트랙이 절반만 보이는 문제 해결)
  const row = {
    display: "grid",
    gridTemplateColumns: "140px minmax(0,1fr)",
    alignItems: "center",
    columnGap: 12,
    rowGap: 8,
  };
  const col = { minWidth: 0, width: "100%" }; // 슬라이더/드롭다운 래퍼
  const smallHint = { fontSize: 12, color: "#666" };

  // 드롭다운 표시 텍스트
  const resText =
    downloadOptions.minResolution === "480p"
      ? "480p (SD)"
      : downloadOptions.minResolution === "720p"
      ? "720p (HD)"
      : downloadOptions.minResolution === "1080p"
      ? "1080p (FHD)"
      : downloadOptions.minResolution === "1440p"
      ? "1440p (QHD)"
      : "1080p (FHD)";
  const ratioText =
    downloadOptions.aspectRatio === "any"
      ? "제한 없음"
      : downloadOptions.aspectRatio === "16:9"
      ? "16:9 (와이드)"
      : downloadOptions.aspectRatio === "4:3"
      ? "4:3 (일반)"
      : downloadOptions.aspectRatio === "1:1"
      ? "1:1 (정사각형)"
      : downloadOptions.aspectRatio === "9:16"
      ? "9:16 (세로)"
      : "제한 없음";

  return (
    <div className={containerStyles.container}>
      {/* 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <RocketRegular />
          미디어 다운로드
        </div>
        <div className={headerStyles.pageDescription}>추출된 키워드를 기반으로 Pexels, Pixabay에서 영상을 다운로드합니다</div>
        <div className={headerStyles.divider} />
      </div>

      <div style={grid}>
        {/* 좌상: 소스 — 높이 고정 */}
        <Card
          style={{
            padding: 20,
            gridArea: "source",
            minHeight: 180,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ImageRegular style={{ fontSize: 18 }} />
            <Text size={400} weight="semibold">
              다운로드 소스
            </Text>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Button
              size="large"
              appearance={selectedProvider === "pexels" ? "primary" : "secondary"}
              onClick={() => setSelectedProvider("pexels")}
              style={{ flex: 1, whiteSpace: "nowrap" }}
            >
              <Avatar name="Pexels" size={20} style={{ marginRight: 8, backgroundColor: "#05A081" }} />
              Pexels
            </Button>
            <Button
              size="large"
              appearance={selectedProvider === "pixabay" ? "primary" : "secondary"}
              onClick={() => setSelectedProvider("pixabay")}
              style={{ flex: 1, whiteSpace: "nowrap" }}
            >
              <Avatar name="Pixabay" size={20} style={{ marginRight: 8, backgroundColor: "#02BE6E" }} />
              Pixabay
            </Button>
          </div>

          {/* 소스 설명 */}
          <div
            style={{
              padding: 12,
              backgroundColor: "#f8fafc",
              borderRadius: 8,
              border: "1px solid #eef1f6",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <InfoRegular style={{ fontSize: 16, color: "#5e6ad2" }} />
              <Text size={300} weight="semibold">
                {selectedProvider === "pexels" ? "Pexels" : "Pixabay"} 특징
              </Text>
            </div>
            <Text size={200} style={{ color: "#7a869a", lineHeight: 1.5 }}>
              {selectedProvider === "pexels"
                ? "• 고품질 프리미엄 영상 제공\n• 다양한 해상도 및 포맷 지원\n• 빠른 다운로드 속도"
                : "• 방대한 무료 영상 라이브러리\n• 다국어 검색 지원\n• 다양한 카테고리 제공"}
            </Text>
          </div>
        </Card>

        {/* 좌중: 키워드 */}
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
              <Button appearance="subtle" size="small" onClick={loadKeywordsFromJSON}>
                <ArrowClockwiseRegular style={{ fontSize: 16 }} />
              </Button>
              <Button appearance="subtle" size="small" onClick={selectAllKeywords}>
                {selectedKeywords.size === keywords.length ? "전체 해제" : "전체 선택"}
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

            {isDownloading ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 16,
                backgroundColor: "#f8f8f8",
                borderRadius: 8,
                border: "1px solid #e0e0e0"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 4
                }}>
                  <Text size={300} weight="semibold">다운로드 진행 중</Text>
                  {estimatedTimeRemaining !== null && (
                    <Badge appearance="filled" color="informative" size="small">
                      {estimatedTimeRemaining <= 0
                        ? "거의 완료 중..."
                        : estimatedTimeRemaining >= 3600
                        ? `${Math.floor(estimatedTimeRemaining / 3600)}시간 ${Math.floor((estimatedTimeRemaining % 3600) / 60)}분 남음`
                        : `${Math.floor(estimatedTimeRemaining / 60)}분 ${Math.floor(estimatedTimeRemaining % 60)}초 남음`}
                    </Badge>
                  )}
                </div>
                <Button
                  appearance="secondary"
                  size="medium"
                  onClick={cancelDownload}
                  style={{ width: "100%" }}
                >
                  <DismissCircle24Regular style={{ marginRight: 8 }} />
                  다운로드 취소
                </Button>
              </div>
            ) : (
              <Button
                appearance="primary"
                size="large"
                disabled={selectedKeywords.size === 0}
                onClick={startDownload}
                style={{ width: "100%" }}
              >
                <ArrowDownloadRegular style={{ marginRight: 8 }} />
                {`${selectedKeywords.size}개 키워드로 다운로드`}
              </Button>
            )}
          </div>
        </Card>

        {/* 우상: 옵션 — 슬라이더/드롭다운 100% 폭 */}
        <Card style={{ padding: 20, gridArea: "options", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <SettingsRegular style={{ fontSize: 18 }} />
            <Text size={400} weight="semibold">
              다운로드 옵션
            </Text>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            {/* 1) 영상 개수 */}
            <div style={row}>
              <Text size={300} weight="medium">
                영상 개수
              </Text>
              <div style={col}>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={downloadOptions.videosPerKeyword}
                  onChange={(_, d) => setDownloadOptions((p) => ({ ...p, videosPerKeyword: d.value }))}
                  style={{ width: "100%" }} // ✅ 트랙 전체폭
                />
                <div style={{ display: "flex", justifyContent: "space-between", ...smallHint, marginTop: 4 }}>
                  <span>1개</span>
                  <span style={{ color: "#0078d4", fontSize: 13, fontWeight: 500 }}>현재: {downloadOptions.videosPerKeyword}개</span>
                  <span>5개</span>
                </div>
              </div>
            </div>

            {/* 2) 최대 파일 크기 */}
            <div style={row}>
              <Text size={300} weight="medium">
                최대 파일 크기
              </Text>
              <div style={col}>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={downloadOptions.maxFileSize}
                  onChange={(_, d) => setDownloadOptions((p) => ({ ...p, maxFileSize: d.value }))}
                  style={{ width: "100%" }} // ✅ 트랙 전체폭
                />
                <div style={{ display: "flex", justifyContent: "space-between", ...smallHint, marginTop: 4 }}>
                  <span>1MB</span>
                  <span style={{ color: "#0078d4", fontSize: 13, fontWeight: 500 }}>현재: {downloadOptions.maxFileSize}MB</span>
                  <span>20MB</span>
                </div>
              </div>
            </div>

            {/* 3) 해상도 */}
            <div style={row}>
              <Text size={300} weight="medium">
                해상도 선택
              </Text>
              <div style={col}>
                <Dropdown
                  value={
                    downloadOptions.minResolution === "480p"
                      ? "480p (SD)"
                      : downloadOptions.minResolution === "720p"
                      ? "720p (HD)"
                      : downloadOptions.minResolution === "1080p"
                      ? "1080p (FHD)"
                      : downloadOptions.minResolution === "1440p"
                      ? "1440p (QHD)"
                      : "1080p (FHD)"
                  }
                  onOptionSelect={(_, data) => setDownloadOptions((p) => ({ ...p, minResolution: data.optionValue }))}
                  style={{ width: "100%" }} // ✅ 100% 폭
                >
                  <Option value="480p">480p (SD)</Option>
                  <Option value="720p">720p (HD)</Option>
                  <Option value="1080p">1080p (FHD)</Option>
                  <Option value="1440p">1440p (QHD)</Option>
                </Dropdown>
              </div>
            </div>

            {/* 4) 화면 비율 */}
            <div style={row}>
              <Text size={300} weight="medium">
                화면 비율
              </Text>
              <div style={col}>
                <Dropdown
                  value={
                    downloadOptions.aspectRatio === "any"
                      ? "제한 없음"
                      : downloadOptions.aspectRatio === "16:9"
                      ? "16:9 (와이드)"
                      : downloadOptions.aspectRatio === "4:3"
                      ? "4:3 (일반)"
                      : downloadOptions.aspectRatio === "1:1"
                      ? "1:1 (정사각형)"
                      : downloadOptions.aspectRatio === "9:16"
                      ? "9:16 (세로)"
                      : "제한 없음"
                  }
                  onOptionSelect={(_, data) => setDownloadOptions((p) => ({ ...p, aspectRatio: data.optionValue }))}
                  style={{ width: "100%" }} // ✅ 100% 폭
                >
                  <Option value="any">제한 없음</Option>
                  <Option value="16:9">16:9 (와이드)</Option>
                  <Option value="4:3">4:3 (일반)</Option>
                  <Option value="1:1">1:1 (정사각형)</Option>
                  <Option value="9:16">9:16 (세로)</Option>
                </Dropdown>
              </div>
            </div>

            {/* 요약/가이드 (읽기 전용) */}
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
                  해상도 {resText}
                </Badge>
                <Badge appearance="tint" color="brand">
                  비율 {ratioText}
                </Badge>
                <Badge appearance="tint" color="brand">
                  개수 {downloadOptions.videosPerKeyword}개
                </Badge>
                <Badge appearance="tint" color="brand">
                  최대 {downloadOptions.maxFileSize}MB
                </Badge>
              </div>
              <Text size={100} style={{ color: "#7a869a" }}>
                팁: 1080p + 16:9는 대부분의 가로형 콘텐츠에 적합하고, 용량은 10–20MB가 품질·속도 균형이 좋아요.
              </Text>
            </div>

          </div>

          {/* 영상 완성 이동 버튼 */}
          <div style={{ marginTop: "auto" }}>
            <Divider style={{ margin: "16px 0" }} />
            <Button
              appearance="primary"
              size="large"
              icon={<VideoClip24Regular />}
              disabled={isDownloading || downloadedVideos.length === 0}
              onClick={() => {
                const event = new CustomEvent("navigate-to-refine");
                window.dispatchEvent(event);
              }}
              style={{ width: "100%" }}
            >
              영상 완성으로 이동
            </Button>
          </div>
        </Card>

        {/* 하단: 진행/결과 (기존 유지) */}
        <Card style={{ padding: 20, gridArea: "bottom" }}>
          {isDownloading && (
            <div style={{ marginBottom: downloadedVideos.length > 0 ? 16 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Spinner size="small" />
                  <Text size={400} weight="semibold">
                    다운로드 진행상황
                  </Text>
                  <Badge appearance="filled" color="informative" size="small">
                    {completedVideosCount}/{totalVideosRef.current}
                  </Badge>
                </div>
                {estimatedTimeRemaining !== null && (
                  <Text size={200} style={{ color: "#666" }}>
                    {estimatedTimeRemaining <= 0
                      ? "거의 완료 중..."
                      : estimatedTimeRemaining >= 3600
                      ? `남은 시간: 약 ${Math.floor(estimatedTimeRemaining / 3600)}시간 ${Math.floor((estimatedTimeRemaining % 3600) / 60)}분`
                      : `남은 시간: 약 ${Math.floor(estimatedTimeRemaining / 60)}분 ${Math.floor(estimatedTimeRemaining % 60)}초`}
                  </Text>
                )}
              </div>
              {totalVideosRef.current > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <ProgressBar
                    value={completedVideosCount}
                    max={totalVideosRef.current}
                    thickness="medium"
                  />
                  <Text size={200} style={{ color: "#666", marginTop: 4, textAlign: "center", display: "block" }}>
                    전체 진행률: {Math.round((completedVideosCount / totalVideosRef.current) * 100)}%
                  </Text>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto" }}>
                {Array.from(selectedKeywords).map((k) => {
                  const progress = downloadProgress[k];
                  return (
                    <div key={k} style={{ padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <Text size={300}>{k}</Text>
                          {progress?.totalVideos > 1 && (
                            <Text size={200} style={{ color: "#666", marginTop: 2 }}>
                              {progress.currentVideo} ({progress.videoIndex || 1}/{progress.totalVideos})
                            </Text>
                          )}
                        </div>
                        <Text size={200} style={{ color: "#666" }}>
                          {progress?.status === "completed" ? "완료" : progress?.status === "failed" ? "실패" : `${progress?.progress || 0}%`}
                        </Text>
                      </div>
                      <ProgressBar value={progress?.progress || 0} max={100} />
                      {progress?.error && (
                        <Text size={200} style={{ color: "#d13438", marginTop: 4 }}>
                          오류: {progress.error}
                        </Text>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {downloadedVideos.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <CheckmarkCircleRegular style={{ fontSize: 18, color: "#107c10" }} />
                <Text size={400} weight="semibold">
                  다운로드 완료
                </Text>
                <Badge appearance="filled" color="success" size="small">
                  {downloadedVideos.length}개
                </Badge>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto" }}>
                {downloadedVideos.map((video, i) => {
                  const imgSrc = toImgSrc(video.thumbnail);
                  return (
                    <div
                      key={video.uniqueKey || i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: 12,
                        border: "1px solid #e5e5e5",
                        borderRadius: 8,
                        backgroundColor: "#f9f9f9",
                      }}
                    >
                      {video.success && imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={video.keyword}
                          style={{ width: 60, height: 34, borderRadius: 4, objectFit: "cover", border: "1px solid #e5e5e5" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.nextElementSibling.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        style={{
                          width: 60,
                          height: 34,
                          borderRadius: 4,
                          backgroundColor: video.success ? "#6366f1" : "#dc2626",
                          display: video.success && imgSrc ? "none" : "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        {video.success ? "VIDEO" : "ERROR"}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: video.error ? 4 : 0 }}>
                          <Text size={200} weight="medium" style={{ minWidth: 80 }}>
                            {video.keyword}
                          </Text>
                          <Text size={100} style={{ color: "#666", minWidth: 60 }}>
                            {video.provider}
                          </Text>
                          <Text size={100} style={{ color: "#666" }}>
                            {video.width && video.height ? `${video.width}×${video.height}` : "해상도불명"}
                          </Text>
                        </div>
                        {video.error && (
                          <Text size={100} style={{ color: "#d13438" }}>
                            오류: {video.error}
                          </Text>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {video.success ? (
                          <CheckmarkCircleRegular style={{ fontSize: 16, color: "#107c10" }} />
                        ) : (
                          <Badge appearance="filled" color="danger" size="small">
                            실패
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Divider style={{ margin: "12px 0" }} />

              <div style={{ display: "flex", justifyContent: "center" }}>
                <Button
                  appearance="primary"
                  size="medium"
                  onClick={async () => {
                    try {
                      const videoSaveFolder = await window.api.getSetting("videoSaveFolder");
                      if (videoSaveFolder) await window.electron.shell.openPath(`${videoSaveFolder}/video`);
                    } catch (e) {
                      console.error("폴더 열기 실패:", e);
                    }
                  }}
                >
                  다운로드 폴더 열기
                </Button>
              </div>
            </div>
          )}

          {!isDownloading && downloadedVideos.length === 0 && (
            <div style={{ textAlign: "center", padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <Text size={300} weight="medium" style={{ marginBottom: 4, display: "block" }}>
                키워드를 선택하고 다운로드를 시작하세요
              </Text>
              <Text size={200} style={{ color: "#666", display: "block", marginTop: 4 }}>
                Pixabay에서 관련 영상을 자동으로 다운로드합니다
              </Text>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function MediaDownloadPageWithBoundary() {
  return (
    <PageErrorBoundary>
      <MediaDownloadPage />
    </PageErrorBoundary>
  );
}
