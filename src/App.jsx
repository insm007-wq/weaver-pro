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
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] text-gray-800">
      <Suspense fallback={<Spinner label="Loading header..." />}>
        <HeaderBar onOpenSettings={handleOpenSettings} />
      </Suspense>

      <div className="flex flex-1">
        <main className="flex-1 p-10 overflow-auto">
          <Suspense fallback={<Spinner />}>
            {/* 프로젝트 필요 시 초기화 페이지만 예외 처리 */}
            {!projectName && !canOpenWithoutProject ? (
              <ProjectInit onCreate={handleCreateProject} />
            ) : (
              <>
                <KeepAlivePane active={currentPage === null}>
                  {/* 기본 대시(초기 상태) */}
                  <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl">
                    <h1 className="text-2xl font-bold mb-4">
                      {projectName || "Content Weaver Pro"}
                    </h1>
                    <div className="bg-gray-100 p-4 rounded">
                      <p className="text-sm text-gray-700">
                        시작하려면 오른쪽 사이드바에서 메뉴를 선택하세요.
                      </p>
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

        <Suspense fallback={<Spinner label="Loading sidebar..." />}>
          <Sidebar onSelectMenu={handleSelectMenu} />
        </Suspense>
      </div>
    </div>
  );
}
