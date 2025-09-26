import React, { useState, useEffect } from "react";
import { Text, Button, Card, Spinner, ProgressBar, Badge, Avatar, Divider } from "@fluentui/react-components";
import { useHeaderStyles, useContainerStyles } from "../../styles/commonStyles";
import { RocketRegular, VideoRegular, ImageRegular, ArrowDownloadRegular, CheckmarkCircleRegular, HistoryRegular, DocumentRegular } from "@fluentui/react-icons";
import { PageErrorBoundary } from "../common/ErrorBoundary";

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
      // 실제로는 IPC로 JSON 파일 로드
      if (window?.api?.loadKeywords) {
        const data = await window.api.loadKeywords();
        setKeywords(data.keywords || []);
      } else {
        // 개발 시 Mock 데이터
        const mockKeywords = [
          "비즈니스", "기술", "혁신", "성장", "미래",
          "사람들", "회의", "협력", "창의성", "성공",
          "데이터", "분석", "전략", "마케팅", "브랜드"
        ];
        setKeywords(mockKeywords);
      }
      setKeywordsLoaded(true);
    } catch (error) {
      console.error("키워드 로드 실패:", error);
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
    if (selectedKeywords.size === 0) return;

    setIsDownloading(true);
    setDownloadProgress({});
    setDownloadedVideos([]);

    const keywordArray = Array.from(selectedKeywords);

    // 시뮬레이션 - 실제로는 IPC로 백엔드 서비스 호출
    for (let i = 0; i < keywordArray.length; i++) {
      const keyword = keywordArray[i];

      // 진행률 업데이트
      setDownloadProgress(prev => ({
        ...prev,
        [keyword]: { status: 'downloading', progress: 0 }
      }));

      // 다운로드 시뮬레이션
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setDownloadProgress(prev => ({
          ...prev,
          [keyword]: { status: 'downloading', progress }
        }));
      }

      // 완료 처리
      setDownloadProgress(prev => ({
        ...prev,
        [keyword]: { status: 'completed', progress: 100 }
      }));

      // 다운로드된 영상 추가 (시뮬레이션)
      setDownloadedVideos(prev => [...prev, {
        keyword,
        provider: selectedProvider,
        filename: `${keyword}_${selectedProvider}_${Date.now()}.mp4`,
        thumbnail: `https://via.placeholder.com/160x90/6366f1/white?text=${keyword}`,
        size: Math.floor(Math.random() * 50 + 10) + "MB"
      }]);
    }

    setIsDownloading(false);
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