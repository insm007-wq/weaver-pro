import React, { useState, useEffect } from "react";
import { Text, Button, Card, Spinner, ProgressBar, Badge, Avatar, Divider } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import { RocketRegular, VideoRegular, ImageRegular, ArrowDownloadRegular, CheckmarkCircleRegular, HistoryRegular, DocumentRegular } from "@fluentui/react-icons";
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
  const [downloadHistory, setDownloadHistory] = useState([]);
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
        const { keyword, status, progress, filename, error } = progressData;

        setDownloadProgress(prev => ({
          ...prev,
          [keyword]: {
            status,
            progress: progress || 0,
            filename,
            error
          }
        }));

        // 완료된 영상을 결과에 추가
        if (status === 'completed' && filename) {
          setDownloadedVideos(prev => [
            ...prev.filter(v => v.keyword !== keyword), // 중복 제거
            {
              keyword,
              provider: selectedProvider,
              filename,
              thumbnail: `https://via.placeholder.com/160x90/6366f1/white?text=${encodeURIComponent(keyword)}`,
              size: "다운로드됨", // 실제 크기는 나중에 추가 가능
              success: true
            }
          ]);
        } else if (status === 'failed') {
          setDownloadedVideos(prev => [
            ...prev.filter(v => v.keyword !== keyword), // 중복 제거
            {
              keyword,
              provider: selectedProvider,
              filename: filename || `${keyword}_failed`,
              thumbnail: `https://via.placeholder.com/160x90/dc2626/white?text=Error`,
              size: "실패",
              success: false,
              error
            }
          ]);
        }
      };

      // 진행률 리스너 등록
      const unsubscribe = window.api.onVideoDownloadProgress(progressHandler);

      // 실제 영상 다운로드 시작
      const result = await window.api.downloadVideosByKeywords({
        keywords: keywordArray,
        provider: selectedProvider
      });

      // 진행률 리스너 해제
      unsubscribe();

      if (result.success) {
        console.log(`[영상 다운로드] 완료: ${result.summary.success}/${result.summary.total}개 성공`);

        // 다운로드 히스토리에 추가
        const historyEntry = {
          timestamp: new Date().toISOString(),
          provider: selectedProvider,
          keywords: keywordArray,
          results: result.results,
          summary: result.summary
        };
        setDownloadHistory(prev => [historyEntry, ...prev.slice(0, 9)]); // 최근 10개만 유지

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
                        <Text size={300}>{keyword}</Text>
                        <Text size={200} style={{ color: "#666" }}>
                          {progress?.status === 'completed' ? '완료' : `${progress?.progress || 0}%`}
                        </Text>
                      </div>
                      <ProgressBar
                        value={progress?.progress || 0}
                        max={100}
                        style={{ width: "100%" }}
                      />
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
                  <div key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px",
                    border: "1px solid #e5e5e5",
                    borderRadius: "8px",
                    backgroundColor: "#f9f9f9"
                  }}>
                    <img
                      src={video.thumbnail}
                      alt={video.keyword}
                      style={{
                        width: "60px",
                        height: "34px",
                        borderRadius: "4px",
                        objectFit: "cover"
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <Text size={200} weight="medium">{video.keyword}</Text>
                      <Text size={100} style={{ color: "#666" }}>
                        {video.provider} • {video.size}
                      </Text>
                    </div>
                    <Button size="small" appearance="subtle">
                      열기
                    </Button>
                  </div>
                ))}
              </div>

              <Divider style={{ margin: "12px 0" }} />

              <div style={{ display: "flex", gap: "8px" }}>
                <Button appearance="primary" size="small" style={{ flex: 1 }}>
                  모든 파일 열기
                </Button>
                <Button appearance="secondary" size="small" style={{ flex: 1 }}>
                  새로 시작
                </Button>
              </div>
            </Card>
          )}

          {/* 다운로드 히스토리 */}
          <Card style={{ padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <HistoryRegular style={{ fontSize: "18px" }} />
              <Text size={400} weight="semibold">다운로드 기록</Text>
              <Badge appearance="filled" size="small">
                {downloadHistory.length}
              </Badge>
            </div>

            {downloadHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                <Text size={300} style={{ color: "#666" }}>
                  아직 다운로드 기록이 없습니다
                </Text>
              </div>
            ) : (
              <>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "200px",
                  overflowY: "auto"
                }}>
                  {downloadHistory.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "8px 12px",
                        border: "1px solid #e5e5e5",
                        borderRadius: "6px",
                        backgroundColor: "#fafafa"
                      }}
                    >
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#107c10" }}></div>
                      <div style={{ flex: 1 }}>
                        <Text size={200}>{item.keyword}</Text>
                        <Text size={100} style={{ color: "#666" }}>
                          {item.provider} • {item.date}
                        </Text>
                      </div>
                    </div>
                  ))}
                </div>
                {downloadHistory.length > 5 && (
                  <Text size={100} style={{ color: "#666", textAlign: "center", marginTop: "8px" }}>
                    +{downloadHistory.length - 5}개 더
                  </Text>
                )}
              </>
            )}
          </Card>

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