// src/components/assemble/tabs/CanvaSessionTab.jsx
import React, { useState, useEffect } from "react";
import { Button, Input, List, Card, Avatar, Space, Tag, Modal, message, Progress, Checkbox } from "antd";
import { PlayCircleOutlined, DownloadOutlined, SearchOutlined, LoginOutlined, CheckCircleOutlined, ExperimentOutlined } from "@ant-design/icons";

const { ipcRenderer } = window.electron || {};

const CanvaSessionTab = () => {
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

  // 세션 상태 확인
  useEffect(() => {
    checkSessionStatus();
  }, []);

  const checkSessionStatus = async () => {
    try {
      const result = await ipcRenderer.invoke("canva:session:status");
      setSessionActive(result.active);
      setSessionDebug(result.debug || {});
      
      if (result.active) {
        console.log("✅ 세션 활성:", result);
      }
    } catch (error) {
      console.error("세션 상태 확인 실패:", error);
    }
  };

  // 로그인 프로세스
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      // 1. 로그인 창 열기
      const initResult = await ipcRenderer.invoke("canva:session:init");
      
      if (initResult.success) {
        message.info(initResult.message);
        
        // 로그인 확인 모달 표시
        Modal.confirm({
          title: "로그인 확인",
          content: "브라우저에서 로그인을 완료하셨나요?",
          okText: "네, 로그인했습니다",
          cancelText: "아직입니다",
          onOk: async () => {
            // 2. 로그인 확인
            const confirmResult = await ipcRenderer.invoke("canva:session:confirmLogin");
            
            if (confirmResult.success) {
              setSessionActive(true);
              message.success(confirmResult.message);
              // 세션 상태 다시 확인
              await checkSessionStatus();
            } else {
              message.error(confirmResult.message);
            }
          },
        });
      } else {
        message.error(initResult.message);
      }
    } catch (error) {
      message.error("로그인 실패: " + error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 비디오 검색
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      message.warning("검색어를 입력해주세요");
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
        message.success(`${result.videos.length}개의 영상을 찾았습니다`);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error("검색 에러:", error);
      message.error("검색 실패: " + (error.message || "알 수 없는 오류"));
    } finally {
      setIsSearching(false);
    }
  };

  // 비디오 선택 토글
  const toggleVideoSelection = (videoId) => {
    setSelectedVideos((prev) => {
      if (prev.includes(videoId)) {
        return prev.filter((id) => id !== videoId);
      } else {
        return [...prev, videoId];
      }
    });
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedVideos.length === videoList.length) {
      setSelectedVideos([]);
    } else {
      setSelectedVideos(videoList.map((v) => v.id));
    }
  };

  // 선택한 비디오 다운로드
  const handleDownload = async () => {
    if (selectedVideos.length === 0) {
      message.warning("다운로드할 영상을 선택해주세요");
      return;
    }

    setIsDownloading(true);
    const downloadDir = `C:\\ContentWeaver\\${new Date().toISOString().split("T")[0]}\\${searchKeyword}`;
    
    message.info(`${selectedVideos.length}개 영상 다운로드 시작`);

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
          message.success(`다운로드 완료: ${fileName}`);
        } else {
          setDownloadProgress((prev) => ({
            ...prev,
            [videoId]: { status: "failed", percent: 0 },
          }));
          message.error(`다운로드 실패: ${video.title}`);
        }
      } catch (error) {
        console.error("다운로드 오류:", error);
        setDownloadProgress((prev) => ({
          ...prev,
          [videoId]: { status: "failed", percent: 0 },
        }));
      }
    }

    setIsDownloading(false);
    message.success("모든 다운로드 완료!");
  };

  // 테스트 다운로드 (임의 영상)
  const handleTestDownload = async () => {
    setIsTestDownloading(true);
    
    try {
      message.info("테스트 다운로드 시작 - 임의의 인기 영상을 검색 중입니다...");
      
      const result = await ipcRenderer.invoke("canva:session:testDownload");
      
      if (result.success) {
        message.success({
          content: (
            <div>
              <div>{result.message}</div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                경로: {result.filePath}
              </div>
              <div style={{ fontSize: "12px", color: "#666" }}>
                크기: {Math.round(result.size / (1024 * 1024))}MB
              </div>
            </div>
          ),
          duration: 10,
        });
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error("테스트 다운로드 에러:", error);
      message.error("테스트 다운로드 실패: " + (error.message || "알 수 없는 오류"));
    } finally {
      setIsTestDownloading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      {/* 세션 상태 표시 */}
      <Card style={{ marginBottom: 20 }}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space>
            <Tag color={sessionActive ? "green" : "red"}>
              {sessionActive ? "세션 활성" : "세션 비활성"}
            </Tag>
            {!sessionActive && (
              <Button
                type="primary"
                icon={<LoginOutlined />}
                loading={isLoggingIn}
                onClick={handleLogin}
              >
                캔바 로그인
              </Button>
            )}
          </Space>
          
          {/* 디버그 정보 */}
          {sessionActive && sessionDebug && (
            <Space>
              <Tag>쿠키: {sessionDebug.cookieLength > 0 ? "✅" : "❌"}</Tag>
              <Tag>헤더: {Object.keys(sessionDebug.canvaHeaders || {}).length}개</Tag>
              <Tag>DocType: {sessionDebug.videoDocTypeId ? "✅" : "❌"}</Tag>
              <Button
                type="dashed"
                icon={<ExperimentOutlined />}
                loading={isTestDownloading}
                onClick={handleTestDownload}
                size="small"
              >
                테스트 다운로드
              </Button>
            </Space>
          )}
        </Space>
      </Card>

      {/* 검색 영역 */}
      {sessionActive && (
        <Card title="영상 검색" style={{ marginBottom: 20 }}>
          <Space style={{ width: "100%" }} direction="vertical">
            <Space style={{ width: "100%" }}>
              <Input
                placeholder="검색어 입력 (예: nature, business)"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onPressEnter={handleSearch}
                style={{ width: 300 }}
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                loading={isSearching}
                onClick={handleSearch}
              >
                검색
              </Button>
            </Space>

            {videoList.length > 0 && (
              <Space>
                <Checkbox
                  checked={selectedVideos.length === videoList.length}
                  indeterminate={selectedVideos.length > 0 && selectedVideos.length < videoList.length}
                  onChange={handleSelectAll}
                >
                  전체 선택 ({selectedVideos.length}/{videoList.length})
                </Checkbox>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={isDownloading}
                  onClick={handleDownload}
                  disabled={selectedVideos.length === 0}
                >
                  선택한 영상 다운로드 ({selectedVideos.length}개)
                </Button>
              </Space>
            )}
          </Space>
        </Card>
      )}

      {/* 영상 목록 */}
      {videoList.length > 0 && (
        <Card title={`검색 결과: "${searchKeyword}" (${videoList.length}개)`}>
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 5, xxl: 6 }}
            dataSource={videoList}
            renderItem={(video) => {
              const isSelected = selectedVideos.includes(video.id);
              const progress = downloadProgress[video.id];

              return (
                <List.Item>
                  <Card
                    hoverable
                    style={{
                      border: isSelected ? "2px solid #1890ff" : "1px solid #f0f0f0",
                      position: "relative",
                    }}
                    cover={
                      <div style={{ position: "relative", paddingTop: "56.25%" }}>
                        <img
                          alt={video.title}
                          src={video.thumbnailUrl || "/api/placeholder/320/180"}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                        {video.videoUrl && (
                          <PlayCircleOutlined
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              fontSize: 48,
                              color: "white",
                              opacity: 0.8,
                            }}
                          />
                        )}
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleVideoSelection(video.id)}
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            background: "white",
                            borderRadius: 4,
                            padding: 4,
                          }}
                        />
                      </div>
                    }
                  >
                    <Card.Meta
                      title={
                        <div style={{ fontSize: 12, height: 40, overflow: "hidden" }}>
                          {video.title || "제목 없음"}
                        </div>
                      }
                      description={
                        progress ? (
                          <div>
                            {progress.status === "downloading" && (
                              <Progress percent={progress.percent} size="small" />
                            )}
                            {progress.status === "completed" && (
                              <Tag color="success">
                                <CheckCircleOutlined /> 완료
                              </Tag>
                            )}
                            {progress.status === "failed" && (
                              <Tag color="error">실패</Tag>
                            )}
                          </div>
                        ) : (
                          <Tag>{video.id}</Tag>
                        )
                      }
                    />
                  </Card>
                </List.Item>
              );
            }}
          />
        </Card>
      )}
    </div>
  );
};

export default CanvaSessionTab;