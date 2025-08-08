import { useState } from "react";

export default function Sidebar({ onSelectMenu }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const globalMenu = [
    { icon: "🗂️", label: "프로젝트 관리", desc: "새 프로젝트 생성 및 관리", key: "project" },
    { icon: "🖼️", label: "AI 썸네일 생성기", desc: "독립형 썸네일 제작 유틸리티", key: "thumbnail" },
    { icon: "⚙️", label: "전역 설정", desc: "API 및 계정 설정", key: "settings" },
  ];

  const projectMenu = [
    { icon: "📜", label: "대본", desc: "대본 및 음성 생성", key: "script" },
    { icon: "✨", label: "영상 구성", desc: "AI 전략 설정 및 타임라인 생성", key: "assemble" },
    { icon: "🚀", label: "초안 내보내기", desc: "Draft 영상 렌더링", key: "draft" },
    { icon: "🎬", label: "편집 및 다듬기", desc: "세부 편집 및 교체", key: "edit" },
    { icon: "🏆", label: "최종 완성", desc: "최종 영상 출력", key: "finalize" },
    { icon: "🔧", label: "프로젝트 설정", desc: "프롬프트 및 모델 설정", key: "projectSettings" },
  ];

  const handleMenuClick = (key) => {
    if (onSelectMenu) onSelectMenu(key);
  };

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-72"
      } bg-white text-slate-800 flex flex-col justify-between shadow-xl border-r border-slate-200 transition-all duration-300`}
    >
      <div>
        {/* Toggle */}
        <div className="flex justify-end p-4">
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-sm bg-slate-100 rounded px-2 py-1 hover:bg-slate-200 transition">
            {isCollapsed ? "➡️" : "⬅️"}
          </button>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-3 px-6 mb-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-cyan-400 flex items-center justify-center text-white text-xl shadow">
            🎥
          </div>
          {!isCollapsed && (
            <div>
              <div className="text-base font-bold">Content Weaver Pro</div>
              <div className="text-xs text-slate-500">AI 영상 제작 솔루션</div>
            </div>
          )}
        </div>

        {/* Global Menu */}
        <nav className="px-4 py-2">
          <ul className="space-y-2">
            {globalMenu.map((item) => (
              <li
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                className="group relative flex items-center gap-3 text-sm font-medium text-slate-700 hover:bg-blue-50 px-3 py-2 rounded transition-all cursor-pointer"
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed ? (
                  <div>
                    <div className="text-slate-800">{item.label}</div>
                    <div className="text-xs text-slate-500 ml-1">{item.desc}</div>
                  </div>
                ) : (
                  <span className="absolute left-16 bg-white text-xs shadow px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-10">
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Divider */}
        {!isCollapsed && <div className="px-6 py-1 text-xs text-slate-400 border-b border-slate-200">프로젝트 작업 영역</div>}

        {/* Project Menu */}
        <nav className="px-4 py-2">
          <ul className="space-y-2">
            {projectMenu.map((item) => (
              <li
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                className="group relative flex items-center gap-3 text-sm font-medium text-slate-700 hover:bg-blue-50 px-3 py-2 rounded transition-all cursor-pointer"
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed ? (
                  <div>
                    <div className="text-slate-800">{item.label}</div>
                    <div className="text-xs text-slate-500 ml-1">{item.desc}</div>
                  </div>
                ) : (
                  <span className="absolute left-16 bg-white text-xs shadow px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap z-10">
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="text-xs text-slate-400 p-4 border-t border-slate-200">
          <div>Version 1.0.0</div>
          <div className="text-[10px] mt-1">© 2025 Content Weaver</div>
        </div>
      )}
    </aside>
  );
}
