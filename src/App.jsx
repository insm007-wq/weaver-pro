// src/App.jsx (중요 부분만; 전체 파일 교체해도 됨)
import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  Suspense,
  lazy,
} from "react";
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

function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center p-10 text-sm text-slate-600">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}

export default function App() {
  const [projectName, setProjectName] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);
  const canOpenWithoutProject = true;

  const handleCreateProject = useCallback((name) => {
    setProjectName(name);
    setCurrentPage("script");
  }, []);
  const handleSelectMenu = useCallback((key) => setCurrentPage(key), []);
  const handleOpenSettings = useCallback(() => setCurrentPage("settings"), []);

  // 다운로드 큐(이전과 동일)
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
    <div className="flex min-h-screen flex-col bg-neutral-25">
      <Suspense fallback={<Spinner label="Loading header..." />}>
        <HeaderBar onOpenSettings={handleOpenSettings} />
      </Suspense>

      <div className="flex flex-1">
        <Suspense fallback={<Spinner />}>
          <Sidebar onSelectMenu={handleSelectMenu} />
        </Suspense>
        
        <main className="flex-1 p-8 overflow-auto">
          <Suspense fallback={<Spinner />}>
            {/* 프로젝트 필요 시 초기화 페이지만 예외 처리 */}
            {!projectName && !canOpenWithoutProject ? (
              <ProjectInit onCreate={handleCreateProject} />
            ) : (
              <>
                <KeepAlivePane active={currentPage === null}>
                  {/* 기본 대시(초기 상태) */}
                  <div className="card max-w-3xl animate-fade-in">
                    <div className="card-header">
                      <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center text-white text-xl">
                          🎥
                        </div>
                        {projectName || "Content Weaver Pro"}
                      </h1>
                      <p className="text-neutral-500 mt-2">
                        AI 기반 영상 제작 솔루션에 오신 것을 환영합니다
                      </p>
                    </div>
                    
                    <div className="card-body">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                          <h3 className="font-semibold text-primary-900 mb-2">🎯 빠른 시작</h3>
                          <p className="text-sm text-primary-700">
                            왼쪽 사이드바에서 원하는 기능을 선택하여 시작하세요.
                          </p>
                        </div>
                        
                        <div className="p-4 bg-secondary-50 rounded-lg border border-secondary-200">
                          <h3 className="font-semibold text-secondary-900 mb-2">⚡ 새로운 기능</h3>
                          <p className="text-sm text-secondary-700">
                            최신 AI 모델과 향상된 사용자 경험을 체험해보세요.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
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
