import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  Suspense,
  lazy,
} from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Card,
  CardHeader,
  Body1,
  Title1,
  Subtitle1,
  Spinner,
  Text,
} from "@fluentui/react-components";
import KeepAlivePane from "./components/common/KeepAlivePane";

const Sidebar = lazy(() => import("./components/Sidebar"));
const ProjectInit = lazy(() => import("./components/ProjectInit"));
const SettingsPage = lazy(() => import("./components/SettingsPage"));
const HeaderBar = lazy(() => import("./components/HeaderBar"));
const ThumbnailGenerator = lazy(() =>
  import("./components/ThumbnailGenerator")
);
const ScriptVoiceGenerator = lazy(() =>
  import("./components/scriptgen/ScriptVoiceGenerator")
);
const AssembleEditor = lazy(() =>
  import("./components/assemble/AssembleEditor")
);
const DraftExportPage = lazy(() =>
  import("./components/draftexport/DraftExportPage")
);
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

function LoadingSpinner({ label = "로딩 중..." }) {
  const styles = useStyles();
  return (
    <div className={styles.loadingContainer}>
      <Spinner size="medium" label={label} />
    </div>
  );
}

export default function App() {
  const [projectName, setProjectName] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const canOpenWithoutProject = true;
  const styles = useStyles();

  const handleCreateProject = useCallback((name) => {
    setProjectName(name);
    setCurrentPage("script");
  }, []);
  const handleSelectMenu = useCallback((key) => setCurrentPage(key), []);
  const handleOpenSettings = useCallback(() => setCurrentPage("settings"), []);

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
    <div className={styles.root}>
      <Suspense fallback={<LoadingSpinner label="헤더 로딩 중..." />}>
        <div className={styles.header}>
          <HeaderBar onOpenSettings={handleOpenSettings} />
        </div>
      </Suspense>

      <div className={styles.body}>
        <Suspense fallback={<LoadingSpinner />}>
          <Sidebar onSelectMenu={handleSelectMenu} />
        </Suspense>
        
        <main className={styles.main}>
          <Suspense fallback={<LoadingSpinner />}>
            {!projectName && !canOpenWithoutProject ? (
              <ProjectInit onCreate={handleCreateProject} />
            ) : (
              <>
                <KeepAlivePane active={currentPage === null}>
                  <Card className={styles.welcomeCard}>
                    <CardHeader
                      header={
                        <div className={styles.welcomeHeader}>
                          <div className={styles.logoBox}>
                            🎥
                          </div>
                          <div>
                            <Title1>{projectName || "Content Weaver Pro"}</Title1>
                            <Subtitle1>
                              AI 기반 영상 제작 솔루션에 오신 것을 환영합니다
                            </Subtitle1>
                          </div>
                        </div>
                      }
                    />
                    
                    <div className={styles.gridContainer}>
                      <div className={`${styles.featureCard} ${styles.quickStartCard}`}>
                        <Text as="h3" weight="semibold" size={500}>🎯 빠른 시작</Text>
                        <Body1>
                          왼쪽 사이드바에서 원하는 기능을 선택하여 시작하세요.
                        </Body1>
                      </div>
                      
                      <div className={`${styles.featureCard} ${styles.newFeatureCard}`}>
                        <Text as="h3" weight="semibold" size={500}>⚡ 새로운 기능</Text>
                        <Body1>
                          최신 AI 모델과 향상된 사용자 경험을 체험해보세요.
                        </Body1>
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
                  <AssembleEditor />
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
              </>
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}