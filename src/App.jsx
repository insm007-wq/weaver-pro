import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ProjectInit from "./components/ProjectInit";

export default function App() {
  const [projectName, setProjectName] = useState(null);

  const handleCreateProject = (name) => {
    setProjectName(name);
  };

  return (
    <div className="flex h-screen bg-[#f5f7fa] text-gray-800">
      <main className="flex-1 p-10 flex items-center justify-center">
        {!projectName ? (
          <ProjectInit onCreate={handleCreateProject} />
        ) : (
          <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">{projectName}</h1>
            <div className="bg-gray-100 p-4 rounded">
              <p className="text-sm text-gray-700">
                <code>CachedPromise&lt;DocumentContent&gt;</code>, document
                content would be a <code>LazyD.property Couch</code>.
              </p>
            </div>
          </div>
        )}
      </main>
      <Sidebar />
    </div>
  );
}
