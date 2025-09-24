import React, { useMemo, useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import {
  tokens,
  Card,
  CardHeader,
  Body1,
  Body2,
  Title3,
  Caption1,
  Button,
  TabList,
  Tab,
  Divider,
  Badge,
  Spinner,
} from "@fluentui/react-components";
import {
  StandardCard,
  PrimaryButton,
  StatusBadge
} from "../common";
import {
  Target24Regular,
  Settings24Regular,
  Video24Regular,
} from "@fluentui/react-icons";


// Utils
import { parseSrtToScenes } from "../../utils/parseSrt";
import { getSetting, readTextAny, getMp3DurationSafe } from "../../utils/ipcSafe";
import { runAutoMatch } from "../../utils/autoMatchEngine";
import { clampSelectedIndex } from "../../utils/sceneIndex";
import { handleError } from "@utils";
import { useFluentTheme } from "../providers/FluentThemeProvider";
import {
  useContainerStyles,
  useHeaderStyles,
  useCardStyles,
  useLayoutStyles
} from "../../styles/commonStyles";

export default function AssembleEditor() {
  const { platform, isDark } = useFluentTheme();
  const containerStyles = useContainerStyles();
  const headerStyles = useHeaderStyles();
  const cardStyles = useCardStyles();
  const layoutStyles = useLayoutStyles();

  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  // State management
  const [selectedTab, setSelectedTab] = useState("prepare");
  const [scenes, setScenes] = useState([]);
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [assets, setAssets] = useState([]);
  const [autoMatch, setAutoMatch] = useState(true);
  const [autoOpts, setAutoOpts] = useState({
    emptyOnly: true,
    byKeywords: true,
    byOrder: true,
    overwrite: false,
  });
  const [autoStats, setAutoStats] = useState(null);
  const [srtConnected, setSrtConnected] = useState(false);
  const [mp3Connected, setMp3Connected] = useState(false);
  const [audioDur, setAudioDur] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Computed values
  const totalDur = useMemo(
    () => (scenes.length ? (Number(scenes[scenes.length - 1].end) || 0) - (Number(scenes[0].start) || 0) : 0),
    [scenes]
  );

  const selectScene = (i) => setSelectedSceneIdx(i);
  const addAssets = (items) => setAssets((prev) => [...prev, ...items]);

  // Scene index safety
  useEffect(() => {
    setSelectedSceneIdx((old) => clampSelectedIndex(scenes, old));
  }, [scenes]);

  // Development helper
  useEffect(() => {
    window.__scenes = scenes;
    window.__autoStats = autoStats;
  }, [scenes, autoStats]);

  // SRT loading and parsing
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const srtPath = await getSetting("paths.srt");
        if (!srtPath) return;
        const raw = await readTextAny(srtPath);
        if (cancelled) return;
        const parsed = parseSrtToScenes(raw || "");
        if (!cancelled && parsed.length) {
          setScenes(parsed);
          setSelectedSceneIdx(0);
          setSrtConnected(true);
          console.log("[assemble] SRT scenes:", parsed.length);
        }
      } catch (e) {
        if (!cancelled) {
          const { message } = handleError(e, "assemble_srt_loading", {
            metadata: { action: "load_srt", cancelled }
          });
          console.warn("SRT loading failed:", message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [srtConnected]);

  // MP3 duration query
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mp3Connected === false) {
          console.log("[assemble] MP3 connection cleared, skipping load");
          setAudioDur(0);
          return;
        }

        const mp3Path = await getSetting("paths.mp3");
        if (!mp3Path) {
          console.log("[assemble] No MP3 path found");
          setAudioDur(0);
          return;
        }

        const dur = await getMp3DurationSafe(mp3Path);
        if (!cancelled && dur) {
          setAudioDur(Number(dur));
          setMp3Connected(true);
          console.log("[assemble] MP3 duration:", dur);
        }
      } catch (e) {
        if (!cancelled) {
          const { message } = handleError(e, "assemble_audio_loading", {
            metadata: { action: "load_audio_duration", cancelled }
          });
          console.warn("MP3 duration query failed:", message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mp3Connected]);

  // Auto assignment engine
  const runAutoAssign = useCallback(() => {
    if (!autoMatch) return;
    setScenes((prev) => {
      const { scenes: next, stats } = runAutoMatch({ scenes: prev, assets, opts: autoOpts });
      setAutoStats(stats);
      return next;
    });
  }, [assets, autoMatch, autoOpts]);

  useEffect(() => {
    runAutoAssign();
  }, [runAutoAssign]);

  useEffect(() => {
    if (!autoMatch) return;
    setScenes((prev) => {
      const { scenes: next, stats } = runAutoMatch({ scenes: prev, assets, opts: autoOpts });
      setAutoStats(stats);
      return next;
    });
  }, [scenes.length, autoMatch, assets, autoOpts]);

  // Tab change handler
  const onTabSelect = (event, data) => {
    setSelectedTab(data.value);
  };

  // Container style with platform-specific enhancements
  const containerStyle = {
    ...(fixedWidthPx && {
      width: `${fixedWidthPx}px`,
      minWidth: `${fixedWidthPx}px`,
      maxWidth: `${fixedWidthPx}px`,
      flex: `0 0 ${fixedWidthPx}px`,
    }),
  };

  return (
    <div className={containerStyles.container} style={{ overflowX: "hidden", maxWidth: "100vw" }} ref={containerRef}>
      {/* 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <Target24Regular />
          영상 구성
        </div>
        <div className={headerStyles.pageDescription}>SRT 파일과 오디오를 결합하여 완성된 영상을 만드세요</div>
        <div className={headerStyles.divider} />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={layoutStyles.centerFlex} style={{ minHeight: "300px" }}>
          <div className={layoutStyles.verticalStack}>
            <Spinner size="large" />
            <Body1>프로젝트를 불러오는 중...</Body1>
          </div>
        </div>
      )}

      {/* Top Status Bar */}
      {!isLoading && (
        <StandardCard style={{ marginBottom: tokens.spacingVerticalL }}>
          <div className={layoutStyles.horizontalStack} style={{ justifyContent: "space-between" }}>
            <div className={layoutStyles.horizontalStack}>
              {/* File Status */}
              <div className={layoutStyles.horizontalStack}>
                <StatusBadge
                  variant={srtConnected ? "success" : "subtle"}
                  text={`SRT ${srtConnected ? "연결됨" : "미연결"}`}
                />
                <StatusBadge
                  variant={mp3Connected ? "success" : "subtle"}
                  text={`MP3 ${mp3Connected ? "연결됨" : "미연결"}`}
                />
              </div>

              {/* Mode Toggle */}
              <div className={layoutStyles.horizontalStack}>
                <Body2>모드:</Body2>
                <Button
                  appearance={autoMatch ? "primary" : "outline"}
                  size="small"
                  onClick={() => setAutoMatch(!autoMatch)}
                >
                  {autoMatch ? "자동" : "수동"}
                </Button>
              </div>
            </div>

            {/* Render Button */}
            <PrimaryButton
              disabled={!srtConnected || !mp3Connected || scenes.length === 0}
            >
              🎬 영상 렌더링
            </PrimaryButton>
          </div>
        </StandardCard>
      )}

      {/* 2-Tab Structure */}
      {!isLoading && (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 300px)" }}>
          <TabList selectedValue={selectedTab} onTabSelect={onTabSelect}>
            <Tab value="prepare" icon={<Settings24Regular />}>
              준비
            </Tab>
            <Tab value="edit" icon={<Video24Regular />}>
              편집
            </Tab>
          </TabList>

          <Divider style={{ margin: `${tokens.spacingVerticalM} 0` }} />

          {/* Tab Content */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {selectedTab === "prepare" && (
              <div>
                {/* Tab 1: 준비 - 2열 구조 */}
              <div className={layoutStyles.gridTwo} style={{ height: "100%" }}>
                {/* 좌측 - 파일 관리 */}
                <StandardCard>
                  <Title3 style={{ marginBottom: tokens.spacingVerticalS }}>파일 관리</Title3>
                  <Body2 style={{ color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalM }}>
                    SRT와 MP3 파일을 연결하세요
                  </Body2>

                  <div className={layoutStyles.verticalStack}>
                    <PrimaryButton size="large" style={{ height: "48px" }}>
                      📄 대본에서 가져오기
                    </PrimaryButton>

                    <div className={layoutStyles.gridTwo}>
                      <Button appearance="outline" size="medium">
                        📁 SRT 선택
                      </Button>
                      <Button appearance="outline" size="medium">
                        🎵 MP3 선택
                      </Button>
                    </div>

                    {/* File Status Display */}
                    <StandardCard style={{
                      backgroundColor: tokens.colorNeutralBackground2,
                      padding: tokens.spacingVerticalM
                    }}>
                      <Body2 style={{ fontWeight: 600, marginBottom: tokens.spacingVerticalS }}>
                        연결 상태
                      </Body2>
                      <div className={layoutStyles.verticalStack} style={{ gap: tokens.spacingVerticalXS }}>
                        <Body2>SRT: {srtConnected ? "✅ 연결됨" : "❌ 미연결"}</Body2>
                        <Body2>MP3: {mp3Connected ? "✅ 연결됨" : "❌ 미연결"}</Body2>
                        <Body2>씬 수: {scenes.length}개</Body2>
                        {audioDur > 0 && (
                          <Body2>오디오 길이: {audioDur.toFixed(1)}초</Body2>
                        )}
                      </div>
                    </StandardCard>
                  </div>
                </StandardCard>

                {/* 우측 - AI 키워드 & 소스 */}
                <StandardCard>
                  <Title3 style={{ marginBottom: tokens.spacingVerticalS }}>AI 키워드 & 소스</Title3>
                  <Body2 style={{ color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalM }}>
                    키워드를 추출하고 영상을 다운로드하세요
                  </Body2>

                  {/* AI Keywords Section */}
                  <div className={layoutStyles.verticalStack}>
                    <div>
                      <Body2 style={{ fontWeight: 600, marginBottom: tokens.spacingVerticalS }}>
                        AI 키워드 추출
                      </Body2>
                      <PrimaryButton
                        size="large"
                        style={{ width: "100%", height: "48px" }}
                        disabled={!srtConnected}
                      >
                        🤖 키워드 추출 시작
                      </PrimaryButton>
                    </div>

                    {/* Video Sources */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <Body2 style={{ fontWeight: 600, marginBottom: tokens.spacingVerticalS }}>
                        영상 소스 ({assets.length}개)
                      </Body2>
                      <div style={{
                        flex: 1,
                        border: `1px dashed ${tokens.colorNeutralStroke2}`,
                        borderRadius: tokens.borderRadiusMedium,
                        padding: tokens.spacingVerticalM,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "300px",
                        backgroundColor: tokens.colorNeutralBackground1
                      }}>
                        {assets.length > 0 ? (
                          <div style={{ textAlign: "center" }}>
                            <Body1 style={{ color: tokens.colorBrandForeground1, fontWeight: 600 }}>
                              ✅ {assets.length}개 영상 준비완료
                            </Body1>
                            <Body2 style={{ color: tokens.colorNeutralForeground2, marginTop: tokens.spacingVerticalXS }}>
                              편집 탭에서 배치하세요
                            </Body2>
                          </div>
                        ) : (
                          <div style={{ textAlign: "center" }}>
                            <Body2 style={{ color: tokens.colorNeutralForeground3 }}>
                              키워드 추출 후 영상이 표시됩니다
                            </Body2>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </StandardCard>
              </div>
              </div>
            )}

            {selectedTab === "edit" && (
              <div>
                {/* Tab 2: 편집 - 상하 구조 (70:30) */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                gap: tokens.spacingVerticalM
              }}>
                {/* 상단 - 메인 편집 영역 (70%) */}
                <div style={{
                  flex: "0 0 70%",
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr 1fr",
                  gap: tokens.spacingHorizontalM
                }}>
                  {/* 씬 리스트 */}
                  <StandardCard>
                    <Title3 style={{ marginBottom: tokens.spacingVerticalS }}>씬 리스트</Title3>
                    <Body2 style={{ color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalM }}>
                      총 {totalDur.toFixed(1)}초
                    </Body2>
                    <div style={{
                      height: "300px",
                      overflowY: "auto",
                      border: `1px solid ${tokens.colorNeutralStroke2}`,
                      borderRadius: tokens.borderRadiusMedium,
                      padding: tokens.spacingVerticalS
                    }}>
                      {scenes.length > 0 ? (
                        scenes.map((scene, index) => (
                          <div
                            key={index}
                            style={{
                              padding: tokens.spacingVerticalS,
                              marginBottom: tokens.spacingVerticalXS,
                              backgroundColor: index === selectedSceneIdx
                                ? tokens.colorBrandBackground2
                                : tokens.colorNeutralBackground2,
                              borderRadius: tokens.borderRadiusMedium,
                              cursor: "pointer"
                            }}
                            onClick={() => setSelectedSceneIdx(index)}
                          >
                            <Body2 style={{ fontWeight: 600 }}>씬 {index + 1}</Body2>
                            <Caption1>{scene.text?.substring(0, 50)}...</Caption1>
                          </div>
                        ))
                      ) : (
                        <Body2 style={{ color: tokens.colorNeutralForeground3, textAlign: "center", marginTop: "100px" }}>
                          SRT 파일을 연결하세요
                        </Body2>
                      )}
                    </div>
                  </StandardCard>

                  {/* 타임라인 뷰 */}
                  <StandardCard>
                    <Title3 style={{ marginBottom: tokens.spacingVerticalS }}>타임라인</Title3>
                    <div style={{
                      height: "350px",
                      border: `1px solid ${tokens.colorNeutralStroke2}`,
                      borderRadius: tokens.borderRadiusMedium,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: tokens.colorNeutralBackground1
                    }}>
                      <Body2 style={{ color: tokens.colorNeutralForeground3 }}>
                        타임라인이 여기에 표시됩니다
                      </Body2>
                    </div>
                  </StandardCard>

                  {/* 속성 패널 */}
                  <StandardCard>
                    <Title3 style={{ marginBottom: tokens.spacingVerticalS }}>속성</Title3>
                    <div className={layoutStyles.verticalStack}>
                      <Button appearance="outline" size="small">
                        🎥 영상 교체
                      </Button>
                      <Button appearance="outline" size="small">
                        ✨ Ken Burns
                      </Button>
                      <Button appearance="outline" size="small">
                        🔄 전환효과
                      </Button>
                    </div>
                  </StandardCard>
                </div>

                {/* 하단 - 미리보기 & 렌더링 (30%) */}
                <div style={{
                  flex: "0 0 30%",
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: tokens.spacingHorizontalM
                }}>
                  {/* 미리보기 */}
                  <StandardCard>
                    <Title3 style={{ marginBottom: tokens.spacingVerticalS }}>미리보기</Title3>
                    <div style={{
                      aspectRatio: "16/9",
                      backgroundColor: tokens.colorNeutralBackground6,
                      borderRadius: tokens.borderRadiusMedium,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${tokens.colorNeutralStroke2}`
                    }}>
                      <Body2 style={{ color: tokens.colorNeutralForeground3 }}>
                        영상 미리보기
                      </Body2>
                    </div>
                  </StandardCard>

                  {/* 렌더링 설정 */}
                  <StandardCard>
                    <Title3 style={{ marginBottom: tokens.spacingVerticalS }}>렌더링</Title3>
                    <div className={layoutStyles.verticalStack}>
                      <Button appearance="outline" size="small">
                        📐 해상도
                      </Button>
                      <Button appearance="outline" size="small">
                        💾 출력 경로
                      </Button>
                      <PrimaryButton
                        disabled={!srtConnected || !mp3Connected}
                      >
                        🎬 렌더링 시작
                      </PrimaryButton>
                    </div>
                  </StandardCard>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}