import { useState } from "react";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const globalMenu = [
    { icon: "🗂️", label: "프로젝트 관리", desc: "새 프로젝트 생성 및 관리" },
    {
      icon: "🖼️",
      label: "AI 썸네일 생성기",
      desc: "독립형 썸네일 제작 유틸리티",
    },
    { icon: "⚙️", label: "전역 설정", desc: "API 및 계정 설정" },
  ];

  const projectMenu = [
    { icon: "📜", label: "대본", desc: "대본 및 음성 생성" },
    { icon: "✨", label: "영상 구성", desc: "AI 전략 설정 및 타임라인 생성" },
    { icon: "🚀", label: "초안 내보내기", desc: "Draft 영상 렌더링" },
    { icon: "🎬", label: "편집 및 다듬기", desc: "세부 편집 및 교체" },
    { icon: "🏆", label: "최종 완성", desc: "최종 영상 출력" },
    { icon: "🔧", label: "프로젝트 설정", desc: "프롬프트 및 모델 설정" },
  ];

  return (
    <aside
      className={`${
        isCollapsed ? "w-20" : "w-72"
      } bg-white text-slate-800 flex flex-col shadow-xl border-r border-slate-200 transition-all duration-300`}
    >
      {/* 상단 영역 (스크롤 가능) */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* 접기 버튼 */}
        <div className="flex justify-end p-4">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-sm bg-slate-100 rounded px-2 py-1 hover:bg-slate-200 transition"
          >
            {isCollapsed ? "➡️" : "⬅️"}
          </button>
        </div>

        {/* 로고 */}
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

        {/* 글로벌 메뉴 */}
        <nav className="px-4 py-2">
          <ul className="space-y-2">
            {globalMenu.map((item, idx) => (
              <li
                key={idx}
                className="group relative flex items-center gap-3 text-sm font-medium text-slate-700 hover:bg-blue-50 px-3 py-2 rounded transition-all"
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed ? (
                  <div>
                    <div className="text-slate-800">{item.label}</div>
                    <div className="text-xs text-slate-500 ml-1">
                      {item.desc}
                    </div>
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

        {/* 섹션 구분선 */}
        {!isCollapsed && (
          <div className="px-6 py-1 text-xs text-slate-400 border-b border-slate-200">
            프로젝트 작업 영역
          </div>
        )}

        {/* 프로젝트 메뉴 */}
        <nav className="px-4 py-2">
          <ul className="space-y-2">
            {projectMenu.map((item, idx) => (
              <li
                key={idx}
                className="group relative flex items-center gap-3 text-sm font-medium text-slate-700 hover:bg-blue-50 px-3 py-2 rounded transition-all"
              >
                <span className="text-lg">{item.icon}</span>
                {!isCollapsed ? (
                  <div>
                    <div className="text-slate-800">{item.label}</div>
                    <div className="text-xs text-slate-500 ml-1">
                      {item.desc}
                    </div>
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

      {/* 하단 고정 정보 */}
      <div className="text-xs text-slate-400 p-4 border-t border-slate-200 shrink-0">
        <div>Version 1.0.0</div>
        <div className="text-[10px] mt-1">© 2025 Content Weaver</div>
      </div>
    </aside>
  );
}
