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

/** ✅ 프로젝트 없이도 열 수 있는 페이지 (재생성 방지) */
const ALLOW_WITHOUT_PROJECT = new Set(["thumbnail", "settings", "script"]);

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

  /** ✅ 초기 화면/접근 가능 여부 계산 메모 */
  const canOpenWithoutProject = useMemo(
    () => ALLOW_WITHOUT_PROJECT.has(currentPage),
    [currentPage]
  );

  /** ✅ 메인 콘텐츠 분기: 조기 리턴으로 단순화 */
  const mainContent = useMemo(() => {
    // 프로젝트가 없고, 화이트리스트가 아니면 초기 프로젝트 생성 화면
    if (!projectName && !canOpenWithoutProject) {
      return <ProjectInit onCreate={handleCreateProject} />;
    }

    // 페이지 라우팅
    switch (currentPage) {
      case "thumbnail":
        return <ThumbnailGenerator />;

      case "script":
        return <ScriptVoiceGenerator />;

      case "draft":
        // 프로젝트 있어야 의미 있음
        if (!projectName) return null;
        return (
          <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">{projectName}</h1>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm text-gray-700">
                <code>CachedPromise&lt;DocumentContent&gt;</code>, document
                content would be a <code>LazyD.property Couch</code>.
              </p>
            </div>
          </div>
        );

      case "settings":
        // ⬅️ 설정을 “전체 화면 페이지”로 렌더
        return <SettingsPage onBack={() => setCurrentPage(null)} />;

      default:
        // 기본 대시 카드 (프로젝트 있는 경우만)
        if (!projectName) return null;
        return (
          <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">{projectName}</h1>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm text-gray-700">
                <code>CachedPromise&lt;DocumentContent&gt;</code>, document
                content would be a <code>LazyD.property Couch</code>.
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
