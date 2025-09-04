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
      className="max-w-5xl mx-auto p-8 animate-fade-in"
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
      {/* 헤더 */}
      <div className="card card-header mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center text-white">
            ⚙️
          </div>
          전역 설정
        </h1>
        <p className="text-neutral-500 mt-2">애플리케이션 전반의 설정을 관리합니다</p>
      </div>

      {/* 메인 카드 */}
      <div className="card">
        {/* 탭 바 */}
        <div className="card-header">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 whitespace-nowrap
                  ${
                    activeTab === tab.key
                      ? "bg-primary-100 text-primary-700 shadow-soft border border-primary-200"
                      : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-50"
                  }`}
              >
                <span className="text-base">{tab.icon}</span> 
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 내용 패널 */}
        <div className="card-body">
          <div className="h-[580px] overflow-y-auto pr-2 -mr-2">
            <Suspense
              fallback={
                <div className="flex items-center justify-center h-40 text-neutral-500">
                  <div className="flex items-center gap-3">
                    <div className="loading-spinner"></div>
                    불러오는 중...
                  </div>
                </div>
              }
            >
              <ActiveComp />
            </Suspense>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-neutral-200 bg-neutral-25/50">
          <div className="text-sm text-neutral-500">
            변경사항은 자동으로 저장됩니다
          </div>
          <div className="flex gap-3">
            <button className="btn-ghost">
              초기화
            </button>
            <button className="btn-primary">
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
