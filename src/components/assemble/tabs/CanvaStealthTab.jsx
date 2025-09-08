// src/components/assemble/tabs/CanvaStealthTab.jsx
import React, { useState, useEffect } from "react";
import { Button, Input, Card, Space, Tag, Modal, message, Progress, Select, Divider, Alert, List, Statistic, Row, Col } from "antd";
import { 
  RobotOutlined, 
  LoginOutlined, 
  DownloadOutlined, 
  SearchOutlined, 
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  ReloadOutlined
} from "@ant-design/icons";

// 디버깅: API 구조 확인
console.log('🔍 window.api:', window.api);
console.log('🔍 window.electron:', window.electron);

// 임시 해결책: window.api와 window.electron 모두 지원
const electronAPI = window.electron || {};
const apiAccess = window.api || {};
const { canva, video, ipcRenderer } = electronAPI;

// Fallback: window.api.invoke 사용
const safeInvoke = (channel, payload) => {
  if (canva?.stealth && channel.startsWith('canva:stealth:')) {
    const method = channel.replace('canva:stealth:', '');
    return canva.stealth[method] ? canva.stealth[method](payload) : null;
  } else if (video && channel.startsWith('video:')) {
    const method = channel.replace('video:', '').replace(/([A-Z])/g, (match, p1) => p1.toLowerCase());
    return video[method] ? video[method](payload) : null;
  } else if (ipcRenderer?.invoke) {
    return ipcRenderer.invoke(channel, payload);
  } else if (apiAccess.invoke) {
    return apiAccess.invoke(channel, payload);
  }
  throw new Error('No IPC method available');
};
const { Option } = Select;
const { TextArea } = Input;

const CanvaStealthTab = () => {
  const [sessionActive, setSessionActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // 자동 다운로드 설정
  const [keywords, setKeywords] = useState("business\nnature\ntechnology\nmodern\nabstract");
  const [targetTotal, setTargetTotal] = useState(80);
  const [downloadProgress, setDownloadProgress] = useState(null);
  
  // 단일 키워드 다운로드
  const [singleKeyword, setSingleKeyword] = useState("");
  const [singleCount, setSingleCount] = useState(10);
  
  // 세션 정보
  const [sessionStatus, setSessionStatus] = useState({});
  const [videoStats, setVideoStats] = useState({});

  // 세션 상태 확인
  useEffect(() => {
    checkSessionStatus();
    checkVideoStats();
  }, []);

  const checkSessionStatus = async () => {
    try {
      const result = await safeInvoke("canva:stealth:status");
      setSessionActive(result.active || false);
      setSessionStatus(result);
      
      console.log("Stealth 세션 상태:", result);
    } catch (error) {
      console.error("세션 상태 확인 실패:", error);
    }
  };

  const checkVideoStats = async () => {
    try {
      const result = await safeInvoke("video:getStats");
      if (result.success) {
        setVideoStats(result.stats);
      }
    } catch (error) {
      console.error("비디오 통계 확인 실패:", error);
    }
  };

  // 스텔스 브라우저 초기화
  const handleInit = async () => {
    setIsInitializing(true);
    try {
      console.log('🚀 브라우저 초기화 시작...');
      const result = await safeInvoke("canva:stealth:init");
      
      if (result.success) {
        message.success("스텔스 브라우저가 열렸습니다. 브라우저에서 로그인을 완료해주세요.");
        
        // 로그인 확인 모달
        Modal.info({
          title: "로그인 진행",
          content: (
            <div>
              <p>🤖 스텔스 모드로 Chrome이 열렸습니다.</p>
              <p>📝 브라우저에서 Canva 로그인을 완료한 후 아래 버튼을 클릭하세요.</p>
              <Alert 
                message="스텔스 기능" 
                description="자동화 탐지를 우회하고 실제 사용자와 동일하게 동작합니다."
                type="info" 
                showIcon 
                style={{ marginTop: 12 }}
              />
            </div>
          ),
          width: 500,
          onOk: () => {
            handleConfirmLogin();
          },
          okText: "로그인 완료 확인"
        });
      } else {
        message.error(result.message || "초기화 실패");
      }
    } catch (error) {
      console.error("초기화 실패:", error);
      message.error("브라우저 초기화에 실패했습니다.");
    }
    setIsInitializing(false);
  };

  // 로그인 확인 및 세션 활성화
  const handleConfirmLogin = async () => {
    setIsConfirming(true);
    try {
      const result = await canva.stealth.confirm();
      
      if (result.success) {
        message.success("✅ 로그인 성공! 세션이 활성화되었습니다.");
        setSessionActive(true);
        setSessionStatus(result);
        await checkSessionStatus();
      } else {
        message.warning(result.message || "로그인이 완료되지 않았습니다.");
      }
    } catch (error) {
      console.error("로그인 확인 실패:", error);
      message.error("로그인 확인에 실패했습니다.");
    }
    setIsConfirming(false);
  };

  // 단일 키워드 다운로드
  const handleSingleDownload = async () => {
    if (!singleKeyword.trim()) {
      message.warning("키워드를 입력해주세요.");
      return;
    }

    setIsDownloading(true);
    try {
      const result = await canva.stealth.download({
        keyword: singleKeyword,
        targetCount: singleCount
      });

      if (result.success) {
        message.success(`✅ "${singleKeyword}" ${result.downloadedCount}개 다운로드 완료`);
        await checkVideoStats();
      } else {
        message.error(result.message || "다운로드 실패");
      }
    } catch (error) {
      console.error("다운로드 실패:", error);
      message.error("다운로드에 실패했습니다.");
    }
    setIsDownloading(false);
  };

  // 다중 키워드 자동 다운로드
  const handleAutoRun = async () => {
    const keywordList = keywords.split('\n').map(k => k.trim()).filter(k => k);
    
    if (keywordList.length === 0) {
      message.warning("키워드를 입력해주세요.");
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: targetTotal });
    
    try {
      const result = await canva.stealth.autoRun({
        keywords: keywordList,
        targetTotal: targetTotal
      });

      if (result.success) {
        message.success(`🎉 자동 다운로드 완료! ${result.totalDownloaded}/${result.targetTotal}개 다운로드`);
        setDownloadProgress(null);
        await checkVideoStats();
        
        // 결과 상세 정보 표시
        Modal.info({
          title: "다운로드 완료",
          content: (
            <div>
              <p><strong>총 다운로드:</strong> {result.totalDownloaded}개</p>
              <p><strong>목표:</strong> {result.targetTotal}개</p>
              <p><strong>저장 위치:</strong> {result.downloadDir}</p>
              <Divider />
              <div>
                <strong>키워드별 결과:</strong>
                <List
                  size="small"
                  dataSource={result.results}
                  renderItem={item => (
                    <List.Item>
                      <span>{item.keyword}: </span>
                      {item.success ? 
                        <Tag color="green">{item.downloadedCount}개 완료</Tag> : 
                        <Tag color="red">실패</Tag>
                      }
                    </List.Item>
                  )}
                />
              </div>
            </div>
          ),
          width: 600
        });
      } else {
        message.error(result.message || "자동 다운로드 실패");
        setDownloadProgress(null);
      }
    } catch (error) {
      console.error("자동 다운로드 실패:", error);
      message.error("자동 다운로드에 실패했습니다.");
      setDownloadProgress(null);
    }
    setIsDownloading(false);
  };

  // 세션 종료
  const handleCleanup = async () => {
    try {
      const result = await canva.stealth.cleanup();
      if (result.success) {
        message.info("세션을 종료했습니다.");
        setSessionActive(false);
        setSessionStatus({});
      }
    } catch (error) {
      console.error("세션 종료 실패:", error);
    }
  };

  // 비디오 폴더 열기
  const handleOpenVideoFolder = async () => {
    try {
      const pathResult = await video.getPaths();
      if (pathResult.success) {
        await window.electron.shell.openPath(pathResult.paths.downloadedCanva);
      }
    } catch (error) {
      console.error("폴더 열기 실패:", error);
      message.error("폴더를 열 수 없습니다.");
    }
  };

  // 비디오 캐시 새로고침
  const handleRefreshVideos = async () => {
    try {
      await video.refreshCanva();
      await checkVideoStats();
      message.success("비디오 목록을 새로고침했습니다.");
    } catch (error) {
      console.error("새로고침 실패:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <Card title={
        <Space>
          <EyeInvisibleOutlined />
          <span>Canva 스텔스 다운로더</span>
          <Tag color="purple">puppeteer + stealth</Tag>
        </Space>
      }>
        <Alert
          message="스텔스 자동화"
          description="puppeteer-extra + stealth 플러그인으로 자동화 탐지를 우회하고, CDP 네트워크 모니터링으로 고화질 비디오를 직접 다운로드합니다."
          type="info"
          showIcon
          className="mb-4"
        />
        
        {/* 세션 상태 */}
        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Statistic 
              title="세션 상태" 
              value={sessionActive ? "활성" : "비활성"} 
              valueStyle={{ color: sessionActive ? '#3f8600' : '#cf1322' }}
              prefix={sessionActive ? <CheckCircleOutlined /> : <LoginOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="헤더 수집" 
              value={sessionStatus.headersCount || 0}
              suffix="개"
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="중복 방지" 
              value={sessionStatus.duplicateTracker?.ids || 0}
              suffix="개 추적"
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="다운로드 비디오" 
              value={videoStats.canva || 0}
              suffix="개"
            />
          </Col>
        </Row>

        {/* 로그인 버튼 */}
        <Space>
          {!sessionActive ? (
            <Button
              type="primary"
              icon={<RobotOutlined />}
              loading={isInitializing}
              onClick={handleInit}
              size="large"
            >
              스텔스 브라우저 시작
            </Button>
          ) : (
            <Button
              icon={<CheckCircleOutlined />}
              disabled
              size="large"
            >
              세션 활성화됨
            </Button>
          )}
          
          {sessionActive && (
            <Button
              icon={<DeleteOutlined />}
              onClick={handleCleanup}
              danger
            >
              세션 종료
            </Button>
          )}

          <Button
            icon={<ReloadOutlined />}
            onClick={checkSessionStatus}
          >
            상태 새로고침
          </Button>
        </Space>
      </Card>

      {/* 다운로드 섹션 */}
      {sessionActive && (
        <>
          {/* 단일 키워드 다운로드 */}
          <Card title={<Space><SearchOutlined />단일 키워드 다운로드</Space>}>
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Input
                  placeholder="검색 키워드 입력"
                  value={singleKeyword}
                  onChange={(e) => setSingleKeyword(e.target.value)}
                  onPressEnter={handleSingleDownload}
                />
              </Col>
              <Col span={4}>
                <Select
                  value={singleCount}
                  onChange={setSingleCount}
                  style={{ width: '100%' }}
                >
                  <Option value={5}>5개</Option>
                  <Option value={10}>10개</Option>
                  <Option value={20}>20개</Option>
                  <Option value={50}>50개</Option>
                </Select>
              </Col>
              <Col span={4}>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={isDownloading}
                  onClick={handleSingleDownload}
                  block
                >
                  다운로드
                </Button>
              </Col>
            </Row>
          </Card>

          {/* 다중 키워드 자동 다운로드 */}
          <Card title={<Space><ThunderboltOutlined />자동 일괄 다운로드</Space>}>
            <Row gutter={16}>
              <Col span={12}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">키워드 목록 (줄바꿈으로 구분)</label>
                  <TextArea
                    rows={6}
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="business&#10;nature&#10;technology&#10;modern&#10;abstract"
                  />
                </div>
              </Col>
              <Col span={6}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">총 목표 개수</label>
                  <Select
                    value={targetTotal}
                    onChange={setTargetTotal}
                    style={{ width: '100%' }}
                  >
                    <Option value={20}>20개</Option>
                    <Option value={50}>50개</Option>
                    <Option value={80}>80개</Option>
                    <Option value={100}>100개</Option>
                    <Option value={200}>200개</Option>
                  </Select>
                </div>
                
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  loading={isDownloading}
                  onClick={handleAutoRun}
                  size="large"
                  block
                  danger
                >
                  자동 실행
                </Button>
              </Col>
              <Col span={6}>
                <div className="space-y-2">
                  <Statistic title="키워드 수" value={keywords.split('\n').filter(k => k.trim()).length} />
                  <Statistic title="키워드당 평균" value={Math.ceil(targetTotal / Math.max(1, keywords.split('\n').filter(k => k.trim()).length))} />
                </div>
              </Col>
            </Row>

            {downloadProgress && (
              <div className="mt-4">
                <Progress
                  percent={Math.round((downloadProgress.current / downloadProgress.total) * 100)}
                  status="active"
                  format={() => `${downloadProgress.current} / ${downloadProgress.total}`}
                />
              </div>
            )}
          </Card>

          {/* 비디오 관리 */}
          <Card title={<Space><VideoCameraOutlined />다운로드된 비디오 관리</Space>}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic title="총 비디오" value={videoStats.total || 0} suffix="개" />
              </Col>
              <Col span={6}>
                <Statistic title="Canva 비디오" value={videoStats.canva || 0} suffix="개" />
              </Col>
              <Col span={6}>
                <Statistic title="총 크기" value={videoStats.totalSizeMB || 0} suffix="MB" />
              </Col>
              <Col span={6}>
                <Statistic title="키워드 종류" value={videoStats.uniqueKeywords || 0} suffix="개" />
              </Col>
            </Row>

            <div className="mt-4">
              <Space>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenVideoFolder}
                >
                  폴더 열기
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRefreshVideos}
                >
                  목록 새로고침
                </Button>
              </Space>
            </div>

            {videoStats.keywords && videoStats.keywords.length > 0 && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-2">수집된 키워드:</label>
                <Space wrap>
                  {videoStats.keywords.map(keyword => (
                    <Tag key={keyword} color="blue">{keyword}</Tag>
                  ))}
                </Space>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default CanvaStealthTab;