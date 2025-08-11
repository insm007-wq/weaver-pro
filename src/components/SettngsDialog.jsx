import { useState, Suspense, lazy } from "react";
import { FaTimes } from "react-icons/fa";

// 탭 컴포넌트 lazy-load
const DefaultsTab = lazy(() => import("./settings/tabs/DefaultsTab"));
const ApiTab = lazy(() => import("./settings/tabs/ApiTab"));
const PromptTab = lazy(() => import("./settings/tabs/PromptTab"));
const ThumbnailTab = lazy(() => import("./settings/tabs/ThumbnailTab"));
const SubtitleTab = lazy(() => import("./settings/tabs/SubtitleTab"));
const AppearanceTab = lazy(() => import("./settings/tabs/AppearanceTab"));

const tabs = [
  { key: "API 설정", name: "API 설정", icon: "🔐", Comp: ApiTab },
  { key: "기본값", name: "기본값", icon: "⚙️", Comp: DefaultsTab },
  { key: "프롬프트", name: "프롬프트", icon: "🧠", Comp: PromptTab },
  { key: "썸네일", name: "썸네일", icon: "🖼️", Comp: ThumbnailTab },
  { key: "자막", name: "자막", icon: "💬", Comp: SubtitleTab },
  { key: "외관", name: "외관", icon: "🎨", Comp: AppearanceTab },
];

export default function SettingsDialog({ onClose }) {
  const [activeTab, setActiveTab] = useState("기본값");

  const ActiveComp = tabs.find((t) => t.key === activeTab)?.Comp ?? DefaultsTab;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white text-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 ring-1 ring-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold">설정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl"
          >
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-4 gap-2 border-b border-gray-100 bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 flex items-center gap-1
              ${
                activeTab === tab.key
                  ? "bg-white border border-b-0 border-gray-300 text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <span>{tab.icon}</span> {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 h-[440px] overflow-y-auto bg-gray-50 text-sm">
          <Suspense
            fallback={<div className="text-gray-500">불러오는 중…</div>}
          >
            <ActiveComp />
          </Suspense>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-white">
          <button
            onClick={onClose}
            className="text-sm bg-gray-100 text-gray-700 rounded-lg px-4 py-2 mr-2 hover:bg-gray-200"
          >
            취소
          </button>
          <button className="text-sm bg-purple-600 text-white rounded-lg px-4 py-2 hover:bg-purple-500">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
