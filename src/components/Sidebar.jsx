import { useState } from "react";
import { 
  FaFolderOpen, 
  FaImage, 
  FaGear,
  FaFileLines,
  FaWandMagicSparkles,
  FaRocket,
  FaVideo,
  FaTrophy,
  FaScrewdriverWrench
} from "react-icons/fa6";

export default function Sidebar({ onSelectMenu }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const globalMenu = [
    {
      icon: <FaFolderOpen className="w-4 h-4 text-blue-500" />,
      label: "프로젝트 관리",
      desc: "새 프로젝트 생성 및 관리",
      key: "project",
    },
    {
      icon: <FaImage className="w-4 h-4 text-emerald-500" />,
      label: "AI 썸네일 생성기",
      desc: "독립형 썸네일 제작 유틸리티",
      key: "thumbnail",
    },
    {
      icon: <FaGear className="w-4 h-4 text-orange-500" />,
      label: "전역 설정",
      desc: "API 및 계정 설정",
      key: "settings",
    },
  ];

  const projectMenu = [
    { 
      icon: <FaFileLines className="w-4 h-4 text-indigo-500" />, 
      label: "대본", 
      desc: "대본 및 음성 생성", 
      key: "script" 
    },
    {
      icon: <FaWandMagicSparkles className="w-4 h-4 text-purple-500" />,
      label: "영상 구성",
      desc: "AI 전략 설정 및 타임라인 생성",
      key: "assemble",
    },
    {
      icon: <FaRocket className="w-4 h-4 text-pink-500" />,
      label: "초안 내보내기",
      desc: "Draft 영상 렌더링",
      key: "draft",
    },
    {
      icon: <FaVideo className="w-4 h-4 text-red-500" />,
      label: "편집 및 다듬기",
      desc: "세부 편집 및 교체",
      key: "refine",
    },
    { 
      icon: <FaTrophy className="w-4 h-4 text-yellow-500" />, 
      label: "최종 완성", 
      desc: "최종 영상 출력", 
      key: "finalize" 
    },
    {
      icon: <FaScrewdriverWrench className="w-4 h-4 text-slate-500" />,
      label: "프로젝트 설정",
      desc: "프롬프트 및 모델 설정",
      key: "projectSettings",
    },
  ];

  const handleMenuClick = (key) => {
    if (onSelectMenu) onSelectMenu(key);
  };

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-80"
      } nav-sidebar flex flex-col justify-between transition-all duration-300`}
    >
      <div>
        {/* Toggle */}
        <div className="flex justify-end p-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn-ghost text-lg w-8 h-8 !p-0"
          >
            {isCollapsed ? "→" : "←"}
          </button>
        </div>

        {/* Logo */}
        <div className="flex items-center gap-4 px-6 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white text-2xl shadow-medium">
            🎥
          </div>
          {!isCollapsed && (
            <div className="animate-fade-in">
              <div className="text-lg font-bold text-neutral-900">Content Weaver Pro</div>
              <div className="text-sm text-neutral-500">AI 영상 제작 솔루션</div>
            </div>
          )}
        </div>

        {/* Global Menu */}
        <nav className="px-4 py-2">
          <ul className="space-y-1">
            {globalMenu.map((item) => (
              <li
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                className="menu-item group"
              >
                <div className="w-5 h-5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  {item.icon}
                </div>
                {!isCollapsed ? (
                  <div className="flex-1 animate-fade-in">
                    <div className="font-semibold text-neutral-900">{item.label}</div>
                    <div className="text-xs text-neutral-600 mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                ) : (
                  <div className="tooltip left-full ml-2 top-1/2 -translate-y-1/2">
                    {item.label}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {/* Divider */}
        {!isCollapsed && (
          <div className="mx-6 my-4 px-0 py-2 text-xs font-medium text-neutral-400 border-b border-neutral-200">
            프로젝트 작업 영역
          </div>
        )}

        {/* Project Menu */}
        <nav className="px-4 py-2">
          <ul className="space-y-1">
            {projectMenu.map((item) => (
              <li
                key={item.key}
                onClick={() => handleMenuClick(item.key)}
                className="menu-item group"
              >
                <div className="w-5 h-5 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                  {item.icon}
                </div>
                {!isCollapsed ? (
                  <div className="flex-1 animate-fade-in">
                    <div className="font-semibold text-neutral-900">{item.label}</div>
                    <div className="text-xs text-neutral-600 mt-0.5">
                      {item.desc}
                    </div>
                  </div>
                ) : (
                  <div className="tooltip left-full ml-2 top-1/2 -translate-y-1/2">
                    {item.label}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="text-xs text-neutral-400 p-6 border-t border-neutral-200 bg-neutral-25/50">
          <div className="font-medium">Version 1.0.0</div>
          <div className="text-[10px] mt-1 opacity-75">© 2025 Content Weaver</div>
        </div>
      )}
    </aside>
  );
}
