import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ProjectInit from "./components/ProjectInit";
import SettingsDialog from "./components/SettngsDialog";
import HeaderBar from "./components/HeaderBar";
import ThumbnailGenerator from "./components/ThumbnailGenerator";

export default function App() {
  const [projectName, setProjectName] = useState(null);
  const [currentPage, setCurrentPage] = useState(null);

  const handleCreateProject = (name) => {
    setProjectName(name);
    setCurrentPage("script");
  };

  const renderPage = () => {
    switch (currentPage) {
      case "thumbnail":
        return <ThumbnailGenerator />;
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
                <code>CachedPromise&lt;DocumentContent&gt;</code>, document
                content would be a <code>LazyD.property Couch</code>.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f7fa] text-gray-800">
      {/* ▲ 헤더 */}
      <HeaderBar onOpenSettings={() => setCurrentPage("settings")} />

      {/* ▼ 본문 + 사이드바 */}
      <div className="flex flex-1">
        <main className="flex-1 p-10 overflow-auto flex items-center justify-center">
          {currentPage === "thumbnail" ? (
            <ThumbnailGenerator />
          ) : !projectName ? (
            <ProjectInit onCreate={handleCreateProject} />
          ) : (
            renderPage()
          )}
        </main>

        <Sidebar onSelectMenu={(key) => setCurrentPage(key)} />
      </div>

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
