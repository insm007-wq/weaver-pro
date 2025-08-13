import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ProjectInit from "./components/ProjectInit";
import SettingsDialog from "./components/SettngsDialog";
import HeaderBar from "./components/HeaderBar";
import ThumbnailGenerator from "./components/ThumbnailGenerator";
import ScriptVoiceGenerator from "./components/ScriptVoiceGenerator";

export default function App() {
  const [projectName, setProjectName] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);

  const handleCreateProject = (name) => {
    setProjectName(name);
    setCurrentPage("script");
  };

  // 프로젝트 없이도 열 수 있는 페이지 화이트리스트
  const ALLOW_WITHOUT_PROJECT = new Set(["thumbnail", "settings", "script"]);

  const renderPage = () => {
    // 프로젝트 없고, 화이트리스트 아닌 페이지면 초기화면
    if (!projectName && !ALLOW_WITHOUT_PROJECT.has(currentPage)) {
      return <ProjectInit onCreate={handleCreateProject} />;
    }

    switch (currentPage) {
      case "thumbnail":
        return <ThumbnailGenerator />;
      case "script":
        return <ScriptVoiceGenerator />;
      case "draft":
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
        // 설정은 오버레이 다이얼로그로 띄우므로 본문은 비움
        return null;
      default:
        // 기본 대시 카드 (프로젝트가 있는 상태에서만 의미 있음)
        return projectName ? (
          <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">{projectName}</h1>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm text-gray-700">
                <code>CachedPromise&lt;DocumentContent&gt;</code>, document
                content would be a <code>LazyD.property Couch</code>.
              </p>
            </div>
          </div>
        ) : null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] text-gray-800">
      {/* ▲ 헤더 */}
      <HeaderBar onOpenSettings={() => setCurrentPage("settings")} />

      {/* ▼ 본문 + 사이드바 */}
      <div className="flex flex-1">
        {/* ✅ 중앙정렬 제거: 페이지가 꽉 차게 교체 렌더 */}
        <main className="flex-1 p-10 overflow-auto">{renderPage()}</main>

        {/* 오른쪽 사이드바 */}
        <Sidebar onSelectMenu={(key) => setCurrentPage(key)} />
      </div>

      {/* 설정 다이얼로그 (오버레이) */}
      {currentPage === "settings" && (
        <SettingsDialog
          onClose={() => {
            setCurrentPage(null);
            window.dispatchEvent(new CustomEvent("health:refresh"));
          }}
        />
      )}
    </div>
  );
}
