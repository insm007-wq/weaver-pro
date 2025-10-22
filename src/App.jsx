import { useCallback, useMemo, useState, useEffect, Suspense, lazy, memo, useRef } from "react";
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

  // 이벤트 리스너 등록 여부 추적 (중복 방지)
  const eventListenersRef = useRef({});

  const canOpenWithoutProject = true;
  const styles = useStyles();
  const fontStyles = useFontOverrideStyles();

  // 약관 동의 여부 확인
  useEffect(() => {
    const checkTermsAcceptance = async () => {
      try {
        console.log("🔍 [App.jsx] 약관 동의 여부 확인 중...");

        if (!window.electron?.store?.getTermsAccepted) {
          console.warn("⚠️ [App.jsx] window.electron.store.getTermsAccepted를 사용할 수 없습니다");
          setTermsAccepted(false);
          return;
        }

        const accepted = await window.electron.store.getTermsAccepted();
        console.log("✅ [App.jsx] 약관 동의 상태:", accepted);
        setTermsAccepted(accepted === true ? true : false);
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
        if (!window.api?.invoke) {
          console.warn("⚠️ [App.jsx] window.api.invoke를 사용할 수 없습니다");
          setHasProject(false);
          return;
        }

        const result = await window.api.invoke("project:list");

        if (result?.success) {
          const projects = Array.isArray(result.data?.projects)
            ? result.data.projects
            : Array.isArray(result.projects)
            ? result.projects
            : [];
          setHasProject(projects.length > 0);
          console.log("📊 [App.jsx] 프로젝트 존재 여부:", projects.length > 0, `(${projects.length}개)`);
        } else {
          console.warn("⚠️ [App.jsx] 프로젝트 목록 조회 실패:", result?.error);
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
        if (!window.api?.invoke) {
          console.warn("⚠️ [App.jsx] window.api.invoke를 사용할 수 없습니다");
          setHasProject(false);
          return;
        }

        const result = await window.api.invoke("project:list");

        if (result?.success) {
          const projects = Array.isArray(result.data?.projects)
            ? result.data.projects
            : Array.isArray(result.projects)
            ? result.projects
            : [];
          setHasProject(projects.length > 0);
          console.log("📊 [App.jsx] 프로젝트 존재 여부 갱신:", projects.length > 0, `(${projects.length}개)`);
        } else {
          console.warn("⚠️ [App.jsx] 프로젝트 목록 갱신 실패:", result?.error);
          setHasProject(false);
        }
      } catch (error) {
        console.error("❌ [App.jsx] 프로젝트 상태 갱신 실패:", error);
        setHasProject(false);
      }
    };

    if (eventListenersRef.current["project:deleted"]) {
      return; // 이미 등록됨
    }

    window.addEventListener("project:deleted", handleProjectDeleted);
    eventListenersRef.current["project:deleted"] = true;

    return () => {
      window.removeEventListener("project:deleted", handleProjectDeleted);
      delete eventListenersRef.current["project:deleted"];
    };
  }, []);

  const handleAcceptTerms = useCallback(async () => {
    try {
      console.log("💾 [App.jsx] 약관 동의 저장 시도...");

      if (!window.electron?.store?.setTermsAccepted) {
        console.error("❌ [App.jsx] window.electron.store.setTermsAccepted를 사용할 수 없습니다");
        return;
      }

      await window.electron.store.setTermsAccepted(true);
      console.log("✅ [App.jsx] 약관 동의 저장 완료");
      setTermsAccepted(true);
    } catch (error) {
      console.error("❌ [App.jsx] 약관 동의 저장 실패:", error);
    }
  }, []);


  // 콜백 함수들 (메모이제이션으로 자식 컴포넌트 불필요한 리렌더링 방지)
  const handleCreateProject = useCallback((name) => {
    setProjectName(name);
    setCurrentPage("script");
  }, []);

  const handleSelectMenu = useCallback((key) => {
    setCurrentPage(key);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setCurrentPage("settings");
  }, []);

  // 메모이제이션된 계산값들
  const shouldShowProjectInit = useMemo(() => 
    !projectName && !canOpenWithoutProject, 
    [projectName, canOpenWithoutProject]
  );

  const isHomePage = useMemo(() => currentPage === null, [currentPage]);

  // 파일 다운로드 이벤트 리스너
  useEffect(() => {
    if (eventListenersRef.current["onFileDownloaded"]) {
      return; // 이미 등록됨
    }

    if (!window.__autoPlaceQueue) {
      window.__autoPlaceQueue = [];
    }

    let unsubscribe;
    try {
      if (window.api?.onFileDownloaded) {
        unsubscribe = window.api.onFileDownloaded((payload) => {
          try {
            if (payload?.path) {
              window.__autoPlaceQueue.push(payload);
            }
          } catch (error) {
            console.error("❌ [App.jsx] 파일 다운로드 큐 추가 실패:", error);
          }
        });
        eventListenersRef.current["onFileDownloaded"] = true;
      }
    } catch (error) {
      console.error("❌ [App.jsx] 파일 다운로드 리스너 등록 실패:", error);
    }

    return () => {
      try {
        if (unsubscribe) {
          unsubscribe();
          delete eventListenersRef.current["onFileDownloaded"];
        }
      } catch (error) {
        console.error("❌ [App.jsx] 파일 다운로드 리스너 제거 실패:", error);
      }
    };
  }, []);

  // 페이지 네비게이션 이벤트 리스너 (통합 관리)
  useEffect(() => {
    const navigationEventMap = {
      'navigate-to-download': 'draft',
      'navigate-to-refine': 'refine',
      'navigate-to-assemble': 'assemble',
    };

    const handlers = {};

    // 이벤트 리스너 등록
    Object.entries(navigationEventMap).forEach(([eventName, pageKey]) => {
      handlers[eventName] = () => {
        setCurrentPage(pageKey);
      };
      window.addEventListener(eventName, handlers[eventName]);
      eventListenersRef.current[eventName] = true;
    });

    // 정리 함수
    return () => {
      Object.entries(navigationEventMap).forEach(([eventName]) => {
        if (eventListenersRef.current[eventName]) {
          window.removeEventListener(eventName, handlers[eventName]);
          delete eventListenersRef.current[eventName];
        }
      });
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
      {/* 헤더 영역 - 독립적인 Suspense */}
      <Suspense fallback={<div className={styles.header} />}>
        <div className={styles.header}>
          <HeaderBar onOpenSettings={handleOpenSettings} />
        </div>
      </Suspense>

      <div className={styles.body}>
        {/* 사이드바 - 독립적인 Suspense */}
        <Suspense fallback={<div style={{ width: "240px" }} />}>
          <Sidebar
            onSelectMenu={handleSelectMenu}
            isScriptGenerating={isScriptGenerating}
            isVideoExporting={isVideoExporting}
            isMediaDownloading={isMediaDownloading}
            hasProject={hasProject}
          />
        </Suspense>

        {/* 메인 컨텐츠 영역 */}
        <main className={styles.main}>
          <Suspense fallback={<MemoizedLoadingFallback />}>
            {shouldShowProjectInit ? (
              <ProjectInit onCreate={handleCreateProject} />
            ) : (
              <>
                {/* 홈 페이지 - KeepAlivePane으로 상태 보존 */}
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

                {/* 썸네일 생성기 페이지 - KeepAlivePane 유지 */}
                <KeepAlivePane active={currentPage === "thumbnail"}>
                  <ThumbnailGenerator />
                </KeepAlivePane>

                {/* 대본/음성 생성 페이지 - KeepAlivePane 유지 */}
                <KeepAlivePane active={currentPage === "script"}>
                  <ScriptVoiceGenerator onGeneratingChange={setIsScriptGenerating} />
                </KeepAlivePane>

                {/* MediaPrepEditor는 항상 마운트 상태 유지 (이벤트 리스너 문제 해결) */}
                <div style={{ display: currentPage === "assemble" ? "block" : "none" }}>
                  <MediaPrepEditor />
                </div>

                {/* MediaDownloadPage는 항상 마운트 상태 유지 (이벤트 리스너 문제 해결) */}
                <div style={{ display: currentPage === "draft" ? "block" : "none" }}>
                  <MediaDownloadPage onDownloadingChange={setIsMediaDownloading} />
                </div>

                {/* MediaEditPage는 항상 마운트 상태 유지 (이벤트 리스너 문제 해결) */}
                <div style={{ display: currentPage === "refine" ? "block" : "none" }}>
                  <MediaEditPage
                    isVideoExporting={isVideoExporting}
                    setIsVideoExporting={setIsVideoExporting}
                  />
                </div>


                {/* 설정 페이지 - KeepAlivePane 유지 (상태 보존) */}
                <KeepAlivePane active={currentPage === "settings"}>
                  <SettingsPage onBack={() => setCurrentPage(null)} />
                </KeepAlivePane>

                {/* 프로젝트 관리 페이지 - KeepAlivePane 유지 (상태 보존) */}
                <KeepAlivePane active={currentPage === "projects"}>
                  <ProjectManager />
                </KeepAlivePane>
              </>
            )}
          </Suspense>
        </main>
      </div>

      {/* 프로젝트 없을 때 하단 고정바 - 프로젝트 생성 유도 */}
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
            {/* 상태 정보 */}
            <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM, flex: 1 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: tokens.colorPaletteBlueBackground3,
                  animation: "pulse 2s infinite",
                }}
              />
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

            {/* 액션 버튼 */}
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
