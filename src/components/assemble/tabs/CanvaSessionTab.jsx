// src/components/assemble/tabs/CanvaSessionTab.jsx
// Fluent UI v9 Migration - Native Session-based Canva Download UI
import React, { useState, useEffect } from "react";
import {
  makeStyles,
  tokens,
  Button,
  Input,
  Card,
  CardHeader,
  CardPreview,
  CardFooter,
  Body1,
  Body2,
  Caption1,
  Title3,
  Badge,
  ProgressBar,
  Field,
  Checkbox,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Spinner,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  mergeClasses,
} from "@fluentui/react-components";
import {
  Play24Regular,
  Download24Regular,
  Search24Regular,
  SignIn24Regular,
  CheckmarkCircle24Regular,
  Beaker24Regular,
  Person24Regular,
  Key24Regular,
  Database24Regular,
} from "@fluentui/react-icons";

const { ipcRenderer } = window.electron || {};

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },

  sessionCard: {
    padding: tokens.spacingVerticalL,
  },

  sessionStatus: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
  },

  debugInfo: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },

  searchCard: {
    padding: tokens.spacingVerticalL,
  },

  searchControls: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    alignItems: "flex-end",
    marginBottom: tokens.spacingVerticalM,
  },

  searchField: {
    flex: 1,
  },

  selectionControls: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
  },

  videoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalL,
  },

  videoCard: {
    cursor: "pointer",
    transition: "all 0.2s ease",
    position: "relative",
    
    ":hover": {
      transform: "translateY(-2px)",
      boxShadow: tokens.shadow16,
    },
  },

  selectedVideoCard: {
    outline: `2px solid ${tokens.colorBrandBackground}`,
    outlineOffset: "2px",
  },

  videoThumbnail: {
    position: "relative",
    paddingTop: "56.25%", // 16:9 aspect ratio
    overflow: "hidden",
    borderRadius: `${tokens.borderRadiusMedium} ${tokens.borderRadiusMedium} 0 0`,
  },

  thumbnailImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  playIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    fontSize: "48px",
    color: "white",
    opacity: 0.8,
    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
  },

  videoCheckbox: {
    position: "absolute",
    top: tokens.spacingVerticalS,
    right: tokens.spacingHorizontalS,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalXS,
  },

  videoInfo: {
    padding: tokens.spacingVerticalM,
    minHeight: "80px",
  },

  videoTitle: {
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    marginBottom: tokens.spacingVerticalXS,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
  },

  progressContainer: {
    marginTop: tokens.spacingVerticalXS,
  },

  loadingSpinner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },

  emptyState: {
    textAlign: "center",
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
});

const CanvaSessionTab = () => {
  const styles = useStyles();
  
  const [sessionActive, setSessionActive] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [videoList, setVideoList] = useState([]);
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [sessionDebug, setSessionDebug] = useState({});
  const [isTestDownloading, setIsTestDownloading] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // Session status check
  useEffect(() => {
    checkSessionStatus();
  }, []);

  const checkSessionStatus = async () => {
    try {
      const result = await ipcRenderer.invoke("canva:session:status");
      setSessionActive(result.active);
      setSessionDebug(result.debug || {});
      
      if (result.active) {
        console.log("✅ Session active:", result);
      }
    } catch (error) {
      console.error("Session status check failed:", error);
    }
  };

  // Login process
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      // 1. Open login window
      const initResult = await ipcRenderer.invoke("canva:session:init");
      
      if (initResult.success) {
        setShowLoginDialog(true);
      } else {
        // Show error message
      }
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const confirmLogin = async () => {
    try {
      // 2. Confirm login
      const confirmResult = await ipcRenderer.invoke("canva:session:confirmLogin");
      
      if (confirmResult.success) {
        setSessionActive(true);
        setShowLoginDialog(false);
        await checkSessionStatus();
      }
    } catch (error) {
      console.error("Login confirmation failed:", error);
    }
  };

  // Video search
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      return;
    }

    setIsSearching(true);
    setVideoList([]);
    setSelectedVideos([]);

    try {
      const result = await ipcRenderer.invoke("canva:session:search", {
        keyword: searchKeyword,
        limit: 50,
      });

      if (result.success) {
        setVideoList(result.videos);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Video selection toggle
  const toggleVideoSelection = (videoId) => {
    setSelectedVideos((prev) => {
      if (prev.includes(videoId)) {
        return prev.filter((id) => id !== videoId);
      } else {
        return [...prev, videoId];
      }
    });
  };

  // Select all toggle
  const handleSelectAll = () => {
    if (selectedVideos.length === videoList.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos(videoList.map((v) => v.id));
    }
  };

  // Download selected videos
  const handleDownload = async () => {
    if (selectedVideos.length === 0) {
      return;
    }

    setIsDownloading(true);
    const downloadDir = `C:\\ContentWeaver\\${new Date().toISOString().split("T")[0]}\\${searchKeyword}`;

    for (let i = 0; i < selectedVideos.length; i++) {
      const videoId = selectedVideos[i];
      const video = videoList.find((v) => v.id === videoId);
      
      if (!video) continue;

      try {
        setDownloadProgress((prev) => ({
          ...prev,
          [videoId]: { status: "downloading", percent: 0 },
        }));

        const fileName = `${searchKeyword}_${i + 1}_${videoId}.mp4`;
        const outputPath = `${downloadDir}\\${fileName}`;

        const result = await ipcRenderer.invoke("canva:session:download", {
          videoId: video.id,
          videoUrl: video.videoUrl,
          outputPath: outputPath,
        });

        if (result.success) {
          setDownloadProgress((prev) => ({
            ...prev,
            [videoId]: { status: "completed", percent: 100 },
          }));
        } else {
          setDownloadProgress((prev) => ({
            ...prev,
            [videoId]: { status: "failed", percent: 0 },
          }));
        }
      } catch (error) {
        console.error("Download error:", error);
        setDownloadProgress((prev) => ({
          ...prev,
          [videoId]: { status: "failed", percent: 0 },
        }));
      }
    }

    setIsDownloading(false);
  };

  // Test download
  const handleTestDownload = async () => {
    setIsTestDownloading(true);
    
    try {
      const result = await ipcRenderer.invoke("canva:session:testDownload");
      
      if (result.success) {
        // Show success message
      }
    } catch (error) {
      console.error("Test download error:", error);
    } finally {
      setIsTestDownloading(false);
    }
  };

  const getStatusBadge = () => {
    if (sessionActive) {
      return (
        <Badge appearance="tint" color="brand" icon={<CheckmarkCircle24Regular />}>
          세션 활성
        </Badge>
      );
    }
    return (
      <Badge appearance="outline" color="danger">
        세션 비활성
      </Badge>
    );
  };

  return (
    <div className={styles.container}>
      {/* Session Status Card */}
      <Card className={styles.sessionCard}>
        <CardHeader
          header={<Title3>세션 상태</Title3>}
          description="캔바 로그인 세션 관리"
        />
        <CardPreview>
          <div className={styles.sessionStatus}>
            {getStatusBadge()}
            {!sessionActive && (
              <Button
                appearance="primary"
                icon={<SignIn24Regular />}
                disabled={isLoggingIn}
                onClick={handleLogin}
              >
                {isLoggingIn ? <Spinner size="tiny" /> : null}
                캔바 로그인
              </Button>
            )}
          </div>
          
          {/* Debug Info */}
          {sessionActive && sessionDebug && (
            <div className={styles.debugInfo}>
              <Badge 
                appearance="outline" 
                icon={<Key24Regular />}
                color={sessionDebug.cookieLength > 0 ? "success" : "danger"}
              >
                쿠키: {sessionDebug.cookieLength > 0 ? "✅" : "❌"}
              </Badge>
              <Badge 
                appearance="outline" 
                icon={<Database24Regular />}
                color={Object.keys(sessionDebug.canvaHeaders || {}).length > 0 ? "success" : "danger"}
              >
                헤더: {Object.keys(sessionDebug.canvaHeaders || {}).length}개
              </Badge>
              <Badge 
                appearance="outline" 
                icon={<Person24Regular />}
                color={sessionDebug.videoDocTypeId ? "success" : "danger"}
              >
                DocType: {sessionDebug.videoDocTypeId ? "✅" : "❌"}
              </Badge>
              <Button
                appearance="subtle"
                icon={<Beaker24Regular />}
                disabled={isTestDownloading}
                onClick={handleTestDownload}
                size="small"
              >
                {isTestDownloading ? <Spinner size="tiny" /> : null}
                테스트 다운로드
              </Button>
            </div>
          )}
        </CardPreview>
      </Card>

      {/* Search Card */}
      {sessionActive && (
        <Card className={styles.searchCard}>
          <CardHeader
            header={<Title3>영상 검색</Title3>}
            description="키워드로 영상을 검색하고 선택적으로 다운로드"
          />
          <CardPreview>
            <div className={styles.searchControls}>
              <Field label="검색어" className={styles.searchField}>
                <Input
                  placeholder="검색어 입력 (예: nature, business)"
                  value={searchKeyword}
                  onChange={(e, data) => setSearchKeyword(data.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </Field>
              <Button
                appearance="primary"
                icon={<Search24Regular />}
                disabled={isSearching || !searchKeyword.trim()}
                onClick={handleSearch}
              >
                {isSearching ? <Spinner size="tiny" /> : null}
                검색
              </Button>
            </div>

            {videoList.length > 0 && (
              <div className={styles.selectionControls}>
                <Checkbox
                  checked={selectedVideos.length === videoList.length}
                  indeterminate={selectedVideos.length > 0 && selectedVideos.length < videoList.length}
                  onChange={handleSelectAll}
                  label={`전체 선택 (${selectedVideos.length}/${videoList.length})`}
                />
                <Button
                  appearance="primary"
                  icon={<Download24Regular />}
                  disabled={isDownloading || selectedVideos.length === 0}
                  onClick={handleDownload}
                >
                  {isDownloading ? <Spinner size="tiny" /> : null}
                  선택한 영상 다운로드 ({selectedVideos.length}개)
                </Button>
              </div>
            )}
          </CardPreview>
        </Card>
      )}

      {/* Video Grid */}
      {videoList.length > 0 && (
        <Card>
          <CardHeader
            header={<Title3>검색 결과: "{searchKeyword}" ({videoList.length}개)</Title3>}
          />
          <CardPreview>
            <div className={styles.videoGrid}>
              {videoList.map((video) => {
                const isSelected = selectedVideos.includes(video.id);
                const progress = downloadProgress[video.id];

                return (
                  <Card
                    key={video.id}
                    className={mergeClasses(
                      styles.videoCard,
                      isSelected && styles.selectedVideoCard
                    )}
                    onClick={() => toggleVideoSelection(video.id)}
                  >
                    <div className={styles.videoThumbnail}>
                      <img
                        src={video.thumbnailUrl || "/api/placeholder/320/180"}
                        alt={video.title}
                        className={styles.thumbnailImage}
                      />
                      {video.videoUrl && (
                        <Play24Regular className={styles.playIcon} />
                      )}
                      <div className={styles.videoCheckbox}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleVideoSelection(video.id)}
                        />
                      </div>
                    </div>
                    
                    <div className={styles.videoInfo}>
                      <Body2 className={styles.videoTitle}>
                        {video.title || "제목 없음"}
                      </Body2>
                      <Caption1>ID: {video.id}</Caption1>
                      
                      {progress && (
                        <div className={styles.progressContainer}>
                          {progress.status === "downloading" && (
                            <ProgressBar value={progress.percent} />
                          )}
                          {progress.status === "completed" && (
                            <Badge appearance="tint" color="success" icon={<CheckmarkCircle24Regular />}>
                              완료
                            </Badge>
                          )}
                          {progress.status === "failed" && (
                            <Badge appearance="tint" color="danger">
                              실패
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </CardPreview>
        </Card>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className={styles.loadingSpinner}>
          <Spinner size="large" />
          <Body1>영상을 검색하는 중...</Body1>
        </div>
      )}

      {/* Empty State */}
      {!isSearching && videoList.length === 0 && searchKeyword && (
        <div className={styles.emptyState}>
          <Body1>검색 결과가 없습니다</Body1>
          <Caption1>다른 키워드로 검색해보세요</Caption1>
        </div>
      )}

      {/* Login Confirmation Dialog */}
      <Dialog open={showLoginDialog}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>로그인 확인</DialogTitle>
            <DialogContent>
              <Body1>브라우저에서 로그인을 완료하셨나요?</Body1>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowLoginDialog(false)}>
                아직입니다
              </Button>
              <Button appearance="primary" onClick={confirmLogin}>
                네, 로그인했습니다
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
};

export default CanvaSessionTab;