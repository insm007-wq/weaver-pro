// src/components/assemble/AssembleEditor.jsx
// Fluent UI v9 Migration - Modern, Native Cross-Platform UI
import React, { useMemo, useState, useRef, useLayoutEffect, useEffect, useCallback } from "react";
import {
  makeStyles,
  tokens,
  Card,
  CardHeader,
  CardPreview,
  Body1,
  Body2,
  Title3,
  Caption1,
  Button,
  TabList,
  Tab,
  SelectTabEvent,
  SelectTabData,
  Divider,
  Badge,
  Spinner,
} from "@fluentui/react-components";
import { StandardCard, ActionButton, StatusBadge } from "../common";
import {
  Settings24Regular,
  Video24Regular,
  TextBulletListLtr24Regular,
  CompositeTarget24Regular,
  Play24Regular,
  Apps24Regular,
  LockClosed24Regular,
  PersonAvailable24Regular,
} from "@fluentui/react-icons";

// Components
import KeywordsTab from "./tabs/KeywordsTab.jsx";
import ArrangeTab from "./tabs/ArrangeTab.jsx";
import ReviewTab from "./tabs/ReviewTab.jsx";
import SetupTab from "./tabs/SetupTab.jsx";
import CanvaTab from "./tabs/CanvaTab";
// import CanvaStealthTab from "./tabs/CanvaStealthTab"; // Temporarily disabled due to Ant Design dependency
import CanvaSessionTab from "./tabs/CanvaSessionTab";
import KeepAlivePane from "../common/KeepAlivePane";

// Utils
import { parseSrtToScenes } from "../../utils/parseSrt";
import { getSetting, readTextAny, getMp3DurationSafe } from "../../utils/ipcSafe";
import { runAutoMatch } from "../../utils/autoMatchEngine";
import { clampSelectedIndex } from "../../utils/sceneIndex";
import { useFluentTheme } from "../providers/FluentThemeProvider";

// Styles using Fluent Design tokens
const useStyles = makeStyles({
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: tokens.spacingVerticalXXL,
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow64,
    minHeight: "90vh",
    position: "relative",
    ...({
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }),
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },

  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground1,
  },

  headerStats: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },

  statsBadge: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
  },

  tabContainer: {
    marginBottom: tokens.spacingVerticalXL,
  },

  tabContent: {
    marginTop: tokens.spacingVerticalL,
    minHeight: "500px",
  },

  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "300px",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },

  // Platform-specific enhancements
  windowsContainer: {
    background: "rgba(243, 242, 241, 0.85)",
    backdropFilter: "blur(30px)",
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },

  macosContainer: {
    background: "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(30px)",
    border: `1px solid rgba(0, 0, 0, 0.1)`,
  },

  darkWindowsContainer: {
    background: "rgba(32, 31, 30, 0.85)",
  },

  darkMacosContainer: {
    background: "rgba(30, 30, 30, 0.8)",
  },
});

export default function AssembleEditor() {
  const styles = useStyles();
  const { platform, isDark } = useFluentTheme();
  
  // Container reference for responsive design
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  // State management
  const [selectedTab, setSelectedTab] = useState("setup");
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
        if (!cancelled) console.warn("SRT loading failed:", e);
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
        if (!cancelled) console.warn("MP3 duration query failed:", e);
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

  const getContainerClass = () => {
    let className = styles.container;
    
    if (platform === 'windows') {
      className += ` ${isDark ? styles.darkWindowsContainer : styles.windowsContainer}`;
    } else if (platform === 'macos') {
      className += ` ${isDark ? styles.darkMacosContainer : styles.macosContainer}`;
    }
    
    return className;
  };

  return (
    <div ref={containerRef} className={getContainerClass()} style={containerStyle}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <CompositeTarget24Regular />
          <Title3>영상 구성</Title3>
        </div>
        <div className={styles.headerStats}>
          <Badge className={styles.statsBadge} size="medium">
            총 {totalDur.toFixed(1)}초
          </Badge>
          {audioDur > 0 && (
            <Badge appearance="outline" size="medium">
              오디오 {audioDur.toFixed(1)}초
            </Badge>
          )}
          <Badge appearance="tint" size="medium">
            {scenes.length}개 씬
          </Badge>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className={styles.loadingContainer}>
          <Spinner size="large" />
          <Body1>프로젝트를 불러오는 중...</Body1>
        </div>
      )}

      {/* Tabs */}
      {!isLoading && (
        <div className={styles.tabContainer}>
          <TabList selectedValue={selectedTab} onTabSelect={onTabSelect}>
            <Tab value="setup" icon={<Settings24Regular />}>
              셋업
            </Tab>
            <Tab value="canva" icon={<Video24Regular />}>
              캔바 다운로드
            </Tab>
            <Tab value="canva-stealth" icon={<LockClosed24Regular />}>
              스텔스 캔바
            </Tab>
            <Tab value="canva-session" icon={<PersonAvailable24Regular />}>
              세션 캔바
            </Tab>
            <Tab value="keywords" icon={<TextBulletListLtr24Regular />}>
              키워드 & 소스
            </Tab>
            <Tab value="arrange" icon={<Apps24Regular />}>
              배치 & 타임라인
            </Tab>
            <Tab value="review" icon={<Play24Regular />}>
              미리보기 & 자막
            </Tab>
          </TabList>

          <Divider style={{ margin: `${tokens.spacingVerticalL} 0` }} />

          {/* Tab Content */}
          <div className={styles.tabContent}>
            <KeepAlivePane active={selectedTab === "setup"}>
              <SetupTab
                srtConnected={srtConnected}
                mp3Connected={mp3Connected}
                setSrtConnected={setSrtConnected}
                setMp3Connected={setMp3Connected}
                autoMatch={autoMatch}
                setAutoMatch={setAutoMatch}
                autoOpts={autoOpts}
                setAutoOpts={setAutoOpts}
              />
            </KeepAlivePane>

            <KeepAlivePane active={selectedTab === "canva"}>
              <CanvaTab addAssets={addAssets} />
            </KeepAlivePane>

            <KeepAlivePane active={selectedTab === "canva-stealth"}>
              {/* <CanvaStealthTab addAssets={addAssets} /> */}
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>Canva Stealth 기능은 현재 업데이트 중입니다.</p>
                <p>임시로 Canva Session 탭을 사용해주세요.</p>
              </div>
            </KeepAlivePane>

            <KeepAlivePane active={selectedTab === "canva-session"}>
              <CanvaSessionTab addAssets={addAssets} />
            </KeepAlivePane>

            <KeepAlivePane active={selectedTab === "keywords"}>
              <KeywordsTab assets={assets} addAssets={addAssets} autoMatch={autoMatch} />
            </KeepAlivePane>

            <KeepAlivePane active={selectedTab === "arrange"}>
              <ArrangeTab
                scenes={scenes}
                onChangeScenes={setScenes}
                selectedSceneIdx={selectedSceneIdx}
                onChangeSelectedScene={setSelectedSceneIdx}
              />
            </KeepAlivePane>

            <KeepAlivePane active={selectedTab === "review"}>
              <ReviewTab 
                scenes={scenes} 
                selectedSceneIdx={selectedSceneIdx} 
                srtConnected={srtConnected} 
                mp3Connected={mp3Connected} 
              />
            </KeepAlivePane>
          </div>
        </div>
      )}
    </div>
  );
}