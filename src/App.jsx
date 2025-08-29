// src/App.jsx
import { useCallback, useMemo, useState, Suspense, lazy } from "react";

// ✅ 코드 스플리팅: 초기 로드 가벼움
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
// ⬇️ 영상 구성(Assemble)
const AssembleEditor = lazy(() =>
  import("./components/assemble/AssembleEditor")
);
// ⬇️ 초안 내보내기(Draft Export)
const DraftExportPage = lazy(() =>
  import("./components/draftexport/DraftExportPage")
);
// ⬇️ 편집 및 다듬기(Refine)
const RefineEditor = lazy(() => import("./components/refine/RefineEditor"));
// ⬇️ 최종 완성(Finalize) ★ 추가
const FinalizePage = lazy(() => import("./components/finalize/FinalizePage"));

/** ✅ 공용 스피너 */
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

  /** ✅ 프로젝트 생성 → 즉시 script로 이동 */
  const handleCreateProject = useCallback((name) => {
    setProjectName(name);
    setCurrentPage("script");
  }, []);

  /** ✅ 핸들러 메모이즈(불필요한 재렌더 감소) */
  const handleSelectMenu = useCallback((key) => {
    setCurrentPage(key);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setCurrentPage("settings");
  }, []);

  /** ✅ 모든 페이지를 프로젝트 없이도 열 수 있게 고정 허용 */
  const canOpenWithoutProject = true;

  /** ✅ 메인 콘텐츠 분기 */
  const mainContent = useMemo(() => {
    if (!projectName && !canOpenWithoutProject) {
      return <ProjectInit onCreate={handleCreateProject} />;
    }

    switch (currentPage) {
      case "thumbnail":
        return <ThumbnailGenerator />;

      case "script":
        return <ScriptVoiceGenerator />;

      case "assemble":
        return <AssembleEditor />;

      case "draft":
        return <DraftExportPage />;

      case "refine":
        return <RefineEditor />;

      case "finalize":
        return <FinalizePage />;

      case "settings":
        return <SettingsPage onBack={() => setCurrentPage(null)} />;

      default:
        // 기본 대시 카드 (프로젝트 없어도 표시)
        return (
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
        );
    }
  }, [projectName, canOpenWithoutProject, currentPage, handleCreateProject]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] text-gray-800">
      {/* ▲ 헤더 */}
      <Suspense fallback={<Spinner label="Loading header..." />}>
        <HeaderBar onOpenSettings={handleOpenSettings} />
      </Suspense>

      {/* ▼ 본문 + 사이드바 */}
      <div className="flex flex-1">
        {/* ✅ 중앙정렬 제거: 페이지가 꽉 차게 교체 렌더 */}
        <main className="flex-1 p-10 overflow-auto">
          <Suspense fallback={<Spinner />}>{mainContent}</Suspense>
        </main>

        {/* 오른쪽 사이드바 */}
        <Suspense fallback={<Spinner label="Loading sidebar..." />}>
          <Sidebar onSelectMenu={handleSelectMenu} />
        </Suspense>
      </div>
    </div>
  );
}
