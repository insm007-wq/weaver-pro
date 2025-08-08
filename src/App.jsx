import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ProjectInit from "./components/ProjectInit";
import SettingsDialog from "./components/SettngsDialog";

export default function App() {
  const [projectName, setProjectName] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);

  const handleCreateProject = (name) => {
    setProjectName(name);
    setCurrentPage("script");
  };

  const renderPage = () => {
    switch (currentPage) {
      case "script":
        return <ScriptPage />;
      case "draft":
        return <DraftPage />;
      case "settings":
        return null;
      default:
        return (
          <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">{projectName}</h1>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm text-gray-700">
                <code>CachedPromise&lt;DocumentContent&gt;</code>, document content would be a <code>LazyD.property Couch</code>.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#f5f7fa] text-gray-800">
      {/* 본문 먼저 */}
      <main className="flex-1 p-10 overflow-auto flex items-center justify-center">
        {!projectName ? <ProjectInit onCreate={handleCreateProject} /> : renderPage()}
      </main>

      {/* 사이드바 오른쪽으로 이동 */}
      <Sidebar onSelectMenu={(key) => setCurrentPage(key)} />

      {/* 설정 다이얼로그 */}
      {currentPage === "settings" && <SettingsDialog onClose={() => setCurrentPage(null)} />}
    </div>
  );
}
