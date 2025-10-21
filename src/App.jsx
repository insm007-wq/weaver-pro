import { useCallback, useMemo, useState, useEffect, Suspense, lazy, memo } from "react";
import { makeStyles, shorthands, tokens, Card, CardHeader, Body1, Title1, Title2, Subtitle1, Text, mergeClasses, Button } from "@fluentui/react-components";
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
const MediaDownloadPage = lazy(() => import("./components/media-down/MediaDownloadPage"));
const MediaEditPage = lazy(() => import("./components/media-edit/MediaEditPage"));
const TermsOfService = lazy(() => import("./components/TermsOfService"));

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
  const [isScriptGenerating, setIsScriptGenerating] = useState(false);
  const [isVideoExporting, setIsVideoExporting] = useState(false);
  const [isMediaDownloading, setIsMediaDownloading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(null); // null: 로딩 중, false: 미동의, true: 동의
  const [hasProject, setHasProject] = useState(true); // 프로젝트 존재 여부
  const canOpenWithoutProject = true;
  const styles = useStyles();
  const fontStyles = useFontOverrideStyles();

  // 약관 동의 여부 확인
  useEffect(() => {
    const checkTermsAcceptance = async () => {
      try {
        console.log("🔍 [App.jsx] 약관 동의 여부 확인 중...");
        console.log("🔍 [App.jsx] window.electron:", window.electron);
        console.log("🔍 [App.jsx] window.electron.store:", window.electron?.store);
        const accepted = await window.electron?.store?.getTermsAccepted();
        console.log("🔍 [App.jsx] 약관 동의 상태:", accepted);
        setTermsAccepted(accepted || false);
      } catch (error) {
        console.error("❌ [App.jsx] 약관 동의 여부 확인 실패:", error);
        setTermsAccepted(false);
      }
    };
    checkTermsAcceptance();
  }, []);

  // 프로젝트 존재 여부 확인
  useEffect(() => {
    const checkProjectExists = async () => {
      try {
        const result = await window.api?.invoke?.("project:list");
        if (result?.success) {
          const projects = Array.isArray(result.data?.projects)
            ? result.data.projects
            : Array.isArray(result.projects)
            ? result.projects
            : [];
          // 프로젝트가 1개 이상 존재하면 true
          setHasProject(projects.length > 0);
          console.log("📊 [App.jsx] 프로젝트 존재 여부:", projects.length > 0, `(${projects.length}개)`);
        } else {
          setHasProject(false);
        }
      } catch (error) {
        console.error("❌ [App.jsx] 프로젝트 목록 확인 실패:", error);
        setHasProject(false);
      }
    };

    checkProjectExists();
  }, []);

  // 프로젝트 생성 완료 이벤트 리스너
  useEffect(() => {
    const handleProjectCreated = () => {
      console.log("✅ [App.jsx] 프로젝트 생성됨 - 탭 활성화");
      setHasProject(true);
    };

    window.addEventListener("project:created", handleProjectCreated);
    return () => window.removeEventListener("project:created", handleProjectCreated);
  }, []);

  // 프로젝트 삭제 완료 이벤트 리스너
  useEffect(() => {
    const handleProjectDeleted = async () => {
      console.log("🗑️ [App.jsx] 프로젝트 삭제됨 - hasProject 상태 갱신");
      try {
        const result = await window.api?.invoke?.("project:list");
        if (result?.success) {
          const projects = Array.isArray(result.data?.projects)
            ? result.data.projects
            : Array.isArray(result.projects)
            ? result.projects
            : [];
          setHasProject(projects.length > 0);
          console.log("📊 [App.jsx] 프로젝트 존재 여부 갱신:", projects.length > 0, `(${projects.length}개)`);
        }
      } catch (error) {
        console.error("❌ [App.jsx] 프로젝트 상태 갱신 실패:", error);
        setHasProject(false);
      }
    };

    window.addEventListener("project:deleted", handleProjectDeleted);
    return () => window.removeEventListener("project:deleted", handleProjectDeleted);
  }, []);

  const handleAcceptTerms = async () => {
    try {
      console.log("💾 [App.jsx] 약관 동의 저장 시도...");
      const result = await window.electron?.store?.setTermsAccepted(true);
      console.log("💾 [App.jsx] 약관 동의 저장 결과:", result);
      setTermsAccepted(true);
    } catch (error) {
      console.error("❌ [App.jsx] 약관 동의 저장 실패:", error);
    }
  };

  // 디버깅: 상태 변경 확인
  useEffect(() => {
    console.log("🔴 App.jsx - isScriptGenerating:", isScriptGenerating);
  }, [isScriptGenerating]);

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

  // 미디어 다운로드 페이지로 이동하는 커스텀 이벤트 리스너
  useEffect(() => {
    const handleNavigateToDownload = () => {
      setCurrentPage('draft');
    };

    window.addEventListener('navigate-to-download', handleNavigateToDownload);

    return () => {
      window.removeEventListener('navigate-to-download', handleNavigateToDownload);
    };
  }, []);

  // 영상 완성 페이지로 이동하는 커스텀 이벤트 리스너
  useEffect(() => {
    const handleNavigateToRefine = () => {
      setCurrentPage('refine');
    };

    window.addEventListener('navigate-to-refine', handleNavigateToRefine);

    return () => {
      window.removeEventListener('navigate-to-refine', handleNavigateToRefine);
    };
  }, []);

  // 미디어 준비 페이지로 이동하는 커스텀 이벤트 리스너
  useEffect(() => {
    const handleNavigateToAssemble = () => {
      setCurrentPage('assemble');
    };

    window.addEventListener('navigate-to-assemble', handleNavigateToAssemble);

    return () => {
      window.removeEventListener('navigate-to-assemble', handleNavigateToAssemble);
    };
  }, []);

  // 미디어 다운로드 페이지로 이동하는 커스텀 이벤트 리스너
  useEffect(() => {
    const handleNavigateToDownload = () => {
      setCurrentPage('draft');
    };

    window.addEventListener('navigate-to-download', handleNavigateToDownload);

    return () => {
      window.removeEventListener('navigate-to-download', handleNavigateToDownload);
    };
  }, []);

  // 약관 동의 여부 로딩 중
  if (termsAccepted === null) {
    return <MemoizedLoadingFallback label="초기화 중..." />;
  }

  // 약관 미동의 시 약관 화면 표시
  if (!termsAccepted) {
    return (
      <Suspense fallback={<MemoizedLoadingFallback label="약관 로딩 중..." />}>
        <TermsOfService onAccept={handleAcceptTerms} />
      </Suspense>
    );
  }

  return (
    <div className={mergeClasses(styles.root, fontStyles.globalFont)}>
      <Suspense fallback={<MemoizedLoadingFallback label="헤더 로딩 중..." />}>
        <div className={styles.header}>
          <HeaderBar onOpenSettings={handleOpenSettings} />
        </div>
      </Suspense>

      <div className={styles.body}>
        <Suspense fallback={<MemoizedLoadingFallback />}>
          <Sidebar
            onSelectMenu={handleSelectMenu}
            isScriptGenerating={isScriptGenerating}
            isVideoExporting={isVideoExporting}
            isMediaDownloading={isMediaDownloading}
            hasProject={hasProject}
          />
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
                  <ScriptVoiceGenerator onGeneratingChange={setIsScriptGenerating} />
                </KeepAlivePane>

                {/* MediaPrepEditor는 항상 마운트 상태 유지 (이벤트 리스너 문제 해결) */}
                <div style={{ display: currentPage === "assemble" ? "block" : "none" }}>
                  <MediaPrepEditor />
                </div>

                <KeepAlivePane active={currentPage === "draft"}>
                  <MediaDownloadPage onDownloadingChange={setIsMediaDownloading} />
                </KeepAlivePane>

                <KeepAlivePane active={currentPage === "refine"}>
                  <MediaEditPage
                    isVideoExporting={isVideoExporting}
                    setIsVideoExporting={setIsVideoExporting}
                  />
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

      {/* 프로젝트 없을 때 하단 고정바 */}
      {!hasProject && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 999,
            background: tokens.colorNeutralBackground1,
            borderTop: `2px solid ${tokens.colorPaletteBlueBackground3}`,
            boxShadow: "0 -4px 12px rgba(0,0,0,0.1)",
            transition: "all 0.3s ease",
            animation: "slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) both",
          }}
        >
          {/* 고정바 콘텐츠 */}
          <div
            style={{
              padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: tokens.spacingHorizontalL,
              cursor: "pointer",
            }}
          >
            {/* 왼쪽: 상태 정보 */}
            <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, flex: 1 }}>
              {/* 상태 아이콘 */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: tokens.colorPaletteBlueBackground3,
                  animation: "pulse 2s infinite",
                }}
              />
              {/* 상태 텍스트 (깜빡임 애니메이션) */}
              <Text
                size={300}
                weight="semibold"
                style={{
                  animation: "textBlink 2s ease-in-out infinite"
                }}
              >
                📁 먼저 프로젝트를 생성해주세요!
              </Text>
            </div>

            {/* 오른쪽: 액션 버튼 */}
            <Button
              appearance="primary"
              onClick={() => setCurrentPage("projects")}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: 8,
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                minWidth: "180px",
              }}
            >
              프로젝트 생성하러 가기 →
            </Button>
          </div>
        </div>
      )}

      {/* 전역 토스트 */}
      <GlobalToast />

      {/* 애니메이션 스타일 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
        @keyframes textBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default memo(App);
