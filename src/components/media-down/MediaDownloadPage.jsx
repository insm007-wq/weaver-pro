import React, { useState, useEffect } from "react";
import { Text, Button, Card, Spinner, ProgressBar, Badge, Avatar, Divider, Slider, Dropdown, Option } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import { RocketRegular, VideoRegular, ImageRegular, ArrowDownloadRegular, CheckmarkCircleRegular, HistoryRegular, DocumentRegular, SettingsRegular } from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";
import { showError, showSuccess } from "../common/GlobalToast";

/**
 * 미디어 다운로드 페이지
 * - 키워드 기반 Pexels/Pixabay 영상 다운로드
 * - 다운로드 진행상황 및 결과 표시
 */
function MediaDownloadPage() {
  const headerStyles = useHeaderStyles();
  const containerStyles = useContainerStyles();

  // 상태 관리
  const [keywords, setKeywords] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState(new Set());
  const [selectedProvider, setSelectedProvider] = useState("pexels"); // pexels, pixabay
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadedVideos, setDownloadedVideos] = useState([]);
  // 다운로드 옵션 (고화질 기준)
  const [downloadOptions, setDownloadOptions] = useState({
    videosPerKeyword: 1, // 키워드당 영상 개수
    maxFileSize: 20, // 20MB (1080p 영상 기준으로 증가)
    minResolution: "1080p", // 1080p FHD (선명한 고화질)
    aspectRatio: "16:9" // 16:9 와이드 (유튜브 표준 비율)
  });
  const [keywordsLoaded, setKeywordsLoaded] = useState(false);

  // 키워드 JSON에서 로드
  useEffect(() => {
    loadKeywordsFromJSON();
    loadDownloadHistory();
  }, []);

  const loadKeywordsFromJSON = async () => {
    try {
      // settings.json에서 추출된 키워드 로드
      const extractedKeywords = await window.api.getSetting("extractedKeywords");

      if (extractedKeywords && Array.isArray(extractedKeywords) && extractedKeywords.length > 0) {
        console.log(`[미디어 다운로드] settings.json에서 ${extractedKeywords.length}개 키워드 로드됨`);
        setKeywords(extractedKeywords);
      } else {
        console.log("[미디어 다운로드] 추출된 키워드가 없습니다. 미디어 준비에서 키워드를 먼저 추출해주세요.");
        // 키워드가 없을 때 안내 메시지용 빈 배열
        setKeywords([]);
      }
      setKeywordsLoaded(true);
    } catch (error) {
      console.error("키워드 로드 실패:", error);
      setKeywords([]);
      setKeywordsLoaded(true);
    }
  };

  const loadDownloadHistory = async () => {
    try {
      // 실제로는 다운로드 히스토리 JSON 로드
      if (window?.api?.loadDownloadHistory) {
        const history = await window.api.loadDownloadHistory();
        setDownloadHistory(history || []);
      } else {
        // Mock 히스토리 데이터
        const mockHistory = [
          {
            id: 1,
            date: "2024-01-15",
            keyword: "비즈니스",
            provider: "pexels",
            status: "완료",
            filename: "business_pexels_001.mp4",
            size: "25MB"
          },
          {
            id: 2,
            date: "2024-01-15",
            keyword: "기술",
            provider: "pixabay",
            status: "완료",
            filename: "technology_pixabay_002.mp4",
            size: "18MB"
          }
        ];
        setDownloadHistory(mockHistory);
      }
    } catch (error) {
      console.error("다운로드 히스토리 로드 실패:", error);
    }
  };

  // 키워드 선택 토글
  const toggleKeyword = (keyword) => {
    const newSelected = new Set(selectedKeywords);
    if (newSelected.has(keyword)) {
      newSelected.delete(keyword);
    } else {
      newSelected.add(keyword);
    }
    setSelectedKeywords(newSelected);
  };

  // 전체 선택/해제
  const selectAllKeywords = () => {
    if (selectedKeywords.size === keywords.length) {
      setSelectedKeywords(new Set());
    } else {
      setSelectedKeywords(new Set(keywords));
    }
  };

  // 다운로드 시작
  const startDownload = async () => {
    if (selectedKeywords.size === 0) {
      showError("다운로드할 키워드를 선택해주세요.");
      return;
    }

    if (keywords.length === 0) {
      showError("추출된 키워드가 없습니다. 먼저 미디어 준비에서 키워드를 추출해주세요.");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({});
    setDownloadedVideos([]);

    const keywordArray = Array.from(selectedKeywords);

    try {
      // 진행률 리스너 등록
      const progressHandler = (progressData) => {
        const { keyword, status, progress, filename, error, videoIndex, totalVideos, videoSuffix } = progressData;

        // 진행률 키를 원본 키워드로 통일
        const progressKey = keyword;
        setDownloadProgress(prev => ({
          ...prev,
          [progressKey]: {
            status,
            progress: progress || 0,
            filename,
            error,
            videoIndex,
            totalVideos,
            currentVideo: videoSuffix ? `${keyword}${videoSuffix}` : keyword
          }
        }));

        // 완료된 영상을 결과에 추가 (각 영상별로 개별 항목 생성)
        if (status === 'completed' && filename) {
          const displayKeyword = videoSuffix ? `${keyword}${videoSuffix}` : keyword;
          const uniqueKey = `${keyword}_${videoIndex || 1}`;

          setDownloadedVideos(prev => [
            ...prev.filter(v => v.uniqueKey !== uniqueKey), // 중복 제거
            {
              keyword: displayKeyword,
              uniqueKey,
              provider: selectedProvider,
              filename,
              thumbnail: progressData.thumbnail || `https://via.placeholder.com/160x90/6366f1/white?text=${encodeURIComponent(keyword)}`,
              success: true,
              // progressData에서 직접 필요한 필드들만 추출
              width: progressData.width || 0,
              height: progressData.height || 0,
              size: progressData.size || 0,
              quality: progressData.quality || '',
              originalFilename: progressData.originalFilename || filename
            }
          ]);
        } else if (status === 'failed') {
          const displayKeyword = videoSuffix ? `${keyword}${videoSuffix}` : keyword;
          const uniqueKey = `${keyword}_${videoIndex || 1}`;

          setDownloadedVideos(prev => [
            ...prev.filter(v => v.uniqueKey !== uniqueKey), // 중복 제거
            {
              keyword: displayKeyword,
              uniqueKey,
              provider: selectedProvider,
              filename: filename || `${keyword}_failed`,
              thumbnail: `https://via.placeholder.com/160x90/dc2626/white?text=Error`,
              success: false,
              error,
              width: progressData.width || 0,
              height: progressData.height || 0,
              size: progressData.size || 0,
              quality: progressData.quality || ''
            }
          ]);
        }
      };

      // 진행률 리스너 등록
      const unsubscribe = window.api.onVideoDownloadProgress(progressHandler);

      // 실제 영상 다운로드 시작
      const result = await window.api.downloadVideosByKeywords({
        keywords: keywordArray,
        provider: selectedProvider,
        options: downloadOptions
      });

      // 진행률 리스너 해제
      unsubscribe();

      if (result.success) {
        console.log(`[영상 다운로드] 완료: ${result.summary.success}/${result.summary.total}개 성공`);
        showSuccess(`영상 다운로드 완료: ${result.summary.success}/${result.summary.total}개 성공`);
      } else {
        console.error("[영상 다운로드] 전체 실패:", result.error);
        showError(`영상 다운로드 실패: ${result.error}`);
      }

    } catch (error) {
      console.error("[영상 다운로드] 예외 발생:", error);
      showError(`영상 다운로드 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className={containerStyles.container}>
      {/* 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <RocketRegular />
          미디어 다운로드
        </div>
        <div className={headerStyles.pageDescription}>
          추출된 키워드를 기반으로 Pexels, Pixabay에서 영상을 다운로드합니다
        </div>
        <div className={headerStyles.divider} />
      </div>

      {/* 2단 레이아웃: 설정 및 키워드 | 진행상황 및 결과 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", maxWidth: "1200px" }}>

        {/* 왼쪽: 키워드 선택 및 설정 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* 제공자 선택 */}
          <Card style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <ImageRegular style={{ fontSize: "18px" }} />
              <Text size={400} weight="semibold">다운로드 소스</Text>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <Button
                appearance={selectedProvider === "pexels" ? "primary" : "secondary"}
                onClick={() => setSelectedProvider("pexels")}
                style={{ flex: 1 }}
              >
                <Avatar
                  name="Pexels"
                  size={20}
                  style={{ marginRight: "8px", backgroundColor: "#05A081" }}
                />
                Pexels
              </Button>
              <Button
                appearance={selectedProvider === "pixabay" ? "primary" : "secondary"}
                onClick={() => setSelectedProvider("pixabay")}
                style={{ flex: 1 }}
              >
                <Avatar
                  name="Pixabay"
                  size={20}
                  style={{ marginRight: "8px", backgroundColor: "#02BE6E" }}
                />
                Pixabay
              </Button>
            </div>
          </Card>

          {/* 다운로드 옵션 */}
          <Card style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <SettingsRegular style={{ fontSize: "18px" }} />
              <Text size={400} weight="semibold">다운로드 옵션</Text>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* 키워드당 영상 개수 */}
              <div>
                <Text size={300} weight="medium" style={{ marginBottom: "8px" }}>
                  키워드당 영상 개수: {downloadOptions.videosPerKeyword}개
                </Text>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={downloadOptions.videosPerKeyword}
                  onChange={(_, data) => setDownloadOptions(prev => ({
                    ...prev,
                    videosPerKeyword: data.value
                  }))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  <span>1개</span>
                  <span>5개</span>
                </div>
              </div>

              {/* 최대 파일 크기 */}
              <div>
                <Text size={300} weight="medium" style={{ marginBottom: "8px" }}>
                  최대 파일 크기: {downloadOptions.maxFileSize}MB
                </Text>
                <Slider
                  min={1}
                  max={20}
                  step={1}
                  value={downloadOptions.maxFileSize}
                  onChange={(_, data) => setDownloadOptions(prev => ({
                    ...prev,
                    maxFileSize: data.value
                  }))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#666", marginTop: "4px" }}>
                  <span>1MB</span>
                  <span>20MB</span>
                </div>
              </div>

              {/* 해상도 선택 */}
              <div>
                <Text size={300} weight="medium" style={{ marginBottom: "8px" }}>해상도 선택</Text>
                <Dropdown
                  value={
                    downloadOptions.minResolution === "480p" ? "480p (SD)" :
                    downloadOptions.minResolution === "720p" ? "720p (HD)" :
                    downloadOptions.minResolution === "1080p" ? "1080p (FHD)" :
                    downloadOptions.minResolution === "1440p" ? "1440p (QHD)" : "1080p (FHD)"
                  }
                  onOptionSelect={(_, data) => setDownloadOptions(prev => ({
                    ...prev,
                    minResolution: data.optionValue
                  }))}
                  style={{ width: "100%" }}
                >
                  <Option value="480p">480p (SD)</Option>
                  <Option value="720p">720p (HD)</Option>
                  <Option value="1080p">1080p (FHD)</Option>
                  <Option value="1440p">1440p (QHD)</Option>
                </Dropdown>
              </div>

              {/* 화면 비율 및 크기 옵션 */}
              <div>
                <Text size={300} weight="medium" style={{ marginBottom: "8px" }}>화면 비율</Text>
                <Dropdown
                  value={
                    downloadOptions.aspectRatio === "any" ? "제한 없음" :
                    downloadOptions.aspectRatio === "16:9" ? "16:9 (와이드)" :
                    downloadOptions.aspectRatio === "4:3" ? "4:3 (일반)" :
                    downloadOptions.aspectRatio === "1:1" ? "1:1 (정사각형)" :
                    downloadOptions.aspectRatio === "9:16" ? "9:16 (세로)" : "제한 없음"
                  }
                  onOptionSelect={(_, data) => setDownloadOptions(prev => ({
                    ...prev,
                    aspectRatio: data.optionValue
                  }))}
                  style={{ width: "100%", marginBottom: "16px" }}
                >
                  <Option value="any">제한 없음</Option>
                  <Option value="16:9">16:9 (와이드)</Option>
                  <Option value="4:3">4:3 (일반)</Option>
                  <Option value="1:1">1:1 (정사각형)</Option>
                  <Option value="9:16">9:16 (세로)</Option>
                </Dropdown>
              </div>
            </div>
          </Card>

          {/* 키워드 선택 */}
          <Card style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <VideoRegular style={{ fontSize: "18px" }} />
                <Text size={400} weight="semibold">키워드 선택</Text>
                <Badge appearance="filled" size="small">
                  {selectedKeywords.size}/{keywords.length}
                </Badge>
              </div>
              <Button
                appearance="subtle"
                size="small"
                onClick={selectAllKeywords}
              >
                {selectedKeywords.size === keywords.length ? "전체 해제" : "전체 선택"}
              </Button>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "8px",
              maxHeight: "300px",
              overflowY: "auto"
            }}>
              {!keywordsLoaded ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px" }}>
                  <Spinner size="small" style={{ marginBottom: "8px" }} />
                  <Text size={300}>키워드를 불러오는 중...</Text>
                </div>
              ) : keywords.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "20px" }}>
                  <Text size={300} style={{ color: "#666" }}>
                    추출된 키워드가 없습니다.<br />
                    먼저 미디어 준비에서 키워드를 추출해주세요.
                  </Text>
                </div>
              ) : (
                keywords.map(keyword => (
                  <Badge
                    key={keyword}
                    appearance={selectedKeywords.has(keyword) ? "filled" : "outline"}
                    style={{
                      cursor: "pointer",
                      padding: "8px 12px",
                      textAlign: "center",
                      transition: "all 0.2s ease"
                    }}
                    onClick={() => toggleKeyword(keyword)}
                  >
                    {keyword}
                  </Badge>
                ))
              )}
            </div>

            <Divider style={{ margin: "16px 0" }} />

            <Button
              appearance="primary"
              size="large"
              disabled={selectedKeywords.size === 0 || isDownloading}
              onClick={startDownload}
              style={{ width: "100%" }}
            >
              <ArrowDownloadRegular style={{ marginRight: "8px" }} />
              {isDownloading ? "다운로드 중..." : `${selectedKeywords.size}개 키워드로 다운로드`}
            </Button>
          </Card>
        </div>

        {/* 오른쪽: 진행상황 및 결과 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* 다운로드 진행상황 */}
          {isDownloading && (
            <Card style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <Spinner size="small" />
                <Text size={400} weight="semibold">다운로드 진행상황</Text>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Array.from(selectedKeywords).map(keyword => {
                  const progress = downloadProgress[keyword];
                  return (
                    <div key={keyword} style={{ padding: "12px", border: "1px solid #e5e5e5", borderRadius: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <div>
                          <Text size={300}>{keyword}</Text>
                          {progress?.totalVideos > 1 && (
                            <Text size={200} style={{ color: "#666", marginTop: "2px" }}>
                              {progress.currentVideo} ({progress.videoIndex || 1}/{progress.totalVideos})
                            </Text>
                          )}
                        </div>
                        <Text size={200} style={{ color: "#666" }}>
                          {progress?.status === 'completed' ? '완료' :
                           progress?.status === 'failed' ? '실패' :
                           `${progress?.progress || 0}%`}
                        </Text>
                      </div>
                      <ProgressBar
                        value={progress?.progress || 0}
                        max={100}
                        style={{ width: "100%" }}
                      />
                      {progress?.error && (
                        <Text size={200} style={{ color: "#d13438", marginTop: "4px" }}>
                          오류: {progress.error}
                        </Text>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 다운로드 결과 */}
          {downloadedVideos.length > 0 && (
            <Card style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <CheckmarkCircleRegular style={{ fontSize: "18px", color: "#107c10" }} />
                <Text size={400} weight="semibold">다운로드 완료</Text>
                <Badge appearance="filled" color="success" size="small">
                  {downloadedVideos.length}개
                </Badge>
              </div>

              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                maxHeight: "300px",
                overflowY: "auto"
              }}>
                {downloadedVideos.map((video, index) => (
                  <div key={video.uniqueKey || index} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "8px",
                    backgroundColor: "#f9f9f9"
                  }}>
                    {video.success && video.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt={video.keyword}
                        style={{
                          width: "60px",
                          height: "34px",
                          borderRadius: "4px",
                          objectFit: "cover",
                          border: "1px solid #e5e5e5"
                        }}
                        onError={(e) => {
                          // 썸네일 로드 실패 시 폴백
                          e.target.style.display = 'none';
                          e.target.nextElementSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      width: "60px",
                      height: "34px",
                      borderRadius: "4px",
                      backgroundColor: video.success ? "#6366f1" : "#dc2626",
                      display: video.success && video.thumbnail ? "none" : "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: "12px",
                      fontWeight: "bold"
                    }}>
                      {video.success ? "VIDEO" : "ERROR"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        marginBottom: video.error ? "4px" : "0"
                      }}>
                        <Text size={200} weight="medium" style={{ minWidth: "80px" }}>
                          {video.keyword}
                        </Text>
                        <Text size={100} style={{ color: "#666", minWidth: "60px" }}>
                          {video.provider}
                        </Text>
                        <Text size={100} style={{ color: "#666" }}>
                          {video.width && video.height ? `${video.width}×${video.height}` : '해상도불명'}
                        </Text>
                      </div>
                      {video.error && (
                        <Text size={100} style={{ color: "#d13438" }}>
                          오류: {video.error}
                        </Text>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {video.success ? (
                        <CheckmarkCircleRegular style={{ fontSize: "16px", color: "#107c10" }} />
                      ) : (
                        <Badge appearance="filled" color="danger" size="small">실패</Badge>
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
                    } catch (error) {
                      console.error("폴더 열기 실패:", error);
                    }
                  }}
                >
                  다운로드 폴더 열기
                </Button>
              </div>
            </Card>
          )}

          {/* 초기 상태 안내 */}
          {!isDownloading && downloadedVideos.length === 0 && (
            <Card style={{ padding: "30px", textAlign: "center" }}>
              <VideoRegular style={{ fontSize: "42px", color: "#666", marginBottom: "12px" }} />
              <Text size={300} weight="medium" style={{ marginBottom: "6px" }}>
                키워드를 선택하고 다운로드를 시작하세요
              </Text>
              <Text size={200} style={{ color: "#666" }}>
                {selectedProvider === "pexels" ? "Pexels" : "Pixabay"}에서<br />관련 영상을 자동으로 다운로드합니다
              </Text>
            </Card>
          )}
        </div>
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