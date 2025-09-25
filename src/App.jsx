import { useCallback, useMemo, useState, useEffect, Suspense, lazy, memo } from "react";
import { makeStyles, shorthands, tokens, Card, CardHeader, Body1, Title1, Title2, Subtitle1, Text, mergeClasses } from "@fluentui/react-components";
import KeepAlivePane from "./components/common/KeepAlivePane";
import { LoadingSpinner, GlobalToast } from "./components/common";
import { useFontOverrideStyles } from "./styles/commonStyles";

const Sidebar = lazy(() => import("./components/Sidebar"));
const ProjectInit = lazy(() => import("./components/ProjectInit"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const ProjectManager = lazy(() => import("./components/ProjectManager"));
const HeaderBar = lazy(() => import("./components/HeaderBar"));
const ThumbnailGenerator = lazy(() => import("./components/ThumbnailGenerator/ThumbnailGenerator"));
const ScriptVoiceGenerator = lazy(() => import("./components/scriptgen/ScriptVoiceGenerator"));
const MediaPrepEditor = lazy(() => import("./components/media-prep/MediaPrepEditor"));
const DraftExportPage = lazy(() => import("./components/draftexport/DraftExportPage"));
const RefineEditor = lazy(() => import("./components/refine/RefineEditor"));
const FinalizePage = lazy(() => import("./components/finalize/FinalizePage"));

const useStyles = makeStyles({
  root: {
    display: "flex",
    minHeight: "100vh",
    flexDirection: "column",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke1),
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalXXL),
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  loadingContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.padding(tokens.spacingVerticalXXXL),
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  welcomeCard: {
    maxWidth: "800px",
    ...shorthands.margin("0", "auto"),
    animation: "fadeIn 0.3s ease-out",
  },
  welcomeHeader: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalL),
  },
  logoBox: {
    width: "48px",
    height: "48px",
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackground}, ${tokens.colorBrandBackground2})`,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: tokens.fontSizeBase600,
    boxShadow: tokens.shadow16,
  },
  gridContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    ...shorthands.gap(tokens.spacingHorizontalL),
    marginTop: tokens.spacingVerticalL,
  },
  featureCard: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  quickStartCard: {
    backgroundColor: tokens.colorBrandBackground2,
    ...shorthands.borderColor(tokens.colorBrandStroke1),
  },
  newFeatureCard: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    ...shorthands.borderColor(tokens.colorPaletteGreenBorder2),
  },
});

const MemoizedLoadingFallback = memo(function LoadingFallback({ label = "로딩 중..." }) {
  const styles = useStyles();
  return (
    <LoadingSpinner size="medium" message={label} centered />
  );
});

function App() {
  const [projectName, setProjectName] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const canOpenWithoutProject = true;
  const styles = useStyles();
  const fontStyles = useFontOverrideStyles();

  const handleCreateProject = useCallback((name) => {
    setProjectName(name);
    setCurrentPage("script");
  }, []);
  
  const handleSelectMenu = useCallback((key) => setCurrentPage(key), []);
  const handleOpenSettings = useCallback(() => setCurrentPage("settings"), []);

  // 메모이제이션된 계산값들
  const shouldShowProjectInit = useMemo(() => 
    !projectName && !canOpenWithoutProject, 
    [projectName, canOpenWithoutProject]
  );

  const isHomePage = useMemo(() => currentPage === null, [currentPage]);

  useEffect(() => {
    if (!window.__autoPlaceQueue) window.__autoPlaceQueue = [];
    const off = window.api?.onFileDownloaded?.((payload) => {
      try {
        if (payload?.path) window.__autoPlaceQueue.push(payload);
      } catch {}
    });
    return () => {
      try {
        off && off();
      } catch {}
    };
  }, []);

  return (
    <div className={mergeClasses(styles.root, fontStyles.globalFont)}>
      <Suspense fallback={<MemoizedLoadingFallback label="헤더 로딩 중..." />}>
        <div className={styles.header}>
          <HeaderBar onOpenSettings={handleOpenSettings} />
        </div>
      </Suspense>

      <div className={styles.body}>
        <Suspense fallback={<MemoizedLoadingFallback />}>
          <Sidebar onSelectMenu={handleSelectMenu} />
        </Suspense>

        <main className={styles.main}>
          <Suspense fallback={<MemoizedLoadingFallback />}>
            {shouldShowProjectInit ? (
              <ProjectInit onCreate={handleCreateProject} />
            ) : (
              <>
                <KeepAlivePane active={isHomePage}>
                  <Card className={styles.welcomeCard}>
                    <CardHeader
                      header={
                        <div className={styles.welcomeHeader}>
                          <div className={styles.logoBox}>🎥</div>
                          <div>
                            <Title2>{projectName || "Weaver Pro"}</Title2>
                            <Subtitle1>AI 기반 영상 제작 솔루션에 오신 것을 환영합니다</Subtitle1>
                          </div>
                        </div>
                      }
                    />

                    <div className={styles.gridContainer}>
                      <div className={mergeClasses(styles.featureCard, styles.quickStartCard)}>
                        <Text as="h3" weight="semibold" size={500}>
                          🎯 빠른 시작
                        </Text>
                        <Body1>왼쪽 사이드바에서 원하는 기능을 선택하여 시작하세요.</Body1>
                      </div>

                      <div className={mergeClasses(styles.featureCard, styles.newFeatureCard)}>
                        <Text as="h3" weight="semibold" size={500}>
                          ⚡ 새로운 기능
                        </Text>
                        <Body1>최신 AI 모델과 향상된 사용자 경험을 체험해보세요.</Body1>
                      </div>
                    </div>
                  </Card>
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "thumbnail"}>
                  <ThumbnailGenerator />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "script"}>
                  <ScriptVoiceGenerator />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "assemble"}>
                  <MediaPrepEditor />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "draft"}>
                  <DraftExportPage />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "refine"}>
                  <RefineEditor />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "finalize"}>
                  <FinalizePage />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "settings"}>
                  <SettingsPage onBack={() => setCurrentPage(null)} />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "projects"}>
                  <ProjectManager />
                </KeepAlivePane>
              </>
            )}
          </Suspense>
        </main>
      </div>
      
      {/* 전역 토스트 */}
      <GlobalToast />
    </div>
  );
}

export default memo(App);
