// src/components/SettingsPage.jsx
import { useState, Suspense, lazy, useRef, useLayoutEffect } from "react";

// 탭 컴포넌트 lazy-load (기존 탭 그대로 재사용)
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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("기본값");
  const ActiveComp = tabs.find((t) => t.key === activeTab)?.Comp ?? DefaultsTab;

  // 💡 썸네일 생성기와 동일한 고정 폭 로직
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  return (
    <div
      ref={containerRef}
      className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-md"
      style={
        fixedWidthPx
          ? {
              width: `${fixedWidthPx}px`,
              minWidth: `${fixedWidthPx}px`,
              maxWidth: `${fixedWidthPx}px`,
              flex: `0 0 ${fixedWidthPx}px`,
              boxSizing: "border-box",
              scrollbarGutter: "stable both-edges",
            }
          : { scrollbarGutter: "stable both-edges" }
      }
    >
      {/* 헤더 (카드 내부, 썸네일 생성기와 동일한 톤) */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <span>⚙️</span> 전역 설정
        </h1>
      </div>

      {/* 탭 바 */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-2">
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
      </div>

      {/* 내용 패널 (카드 내부 스크롤) */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-6 h-[560px] overflow-y-auto text-sm">
          <Suspense
            fallback={<div className="text-gray-500">불러오는 중…</div>}
          >
            <ActiveComp />
          </Suspense>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-white">
          <button className="text-sm bg-gray-100 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-200">
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
