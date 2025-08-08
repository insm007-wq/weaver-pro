import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";

const tabs = [
  { name: "API 설정", icon: "🔐" },
  { name: "기본값", icon: "⚙️" },
  { name: "프롬프트", icon: "🧠" },
  { name: "썸네일", icon: "🖼️" },
  { name: "자막", icon: "💬" },
  { name: "외관", icon: "🎨" },
];

export default function SettingsDialog({ onClose }) {
  const [activeTab, setActiveTab] = useState("기본값");

  useEffect(() => {
    console.log();
    // 초기 데이터 fetch 등
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white text-gray-800 w-full max-w-4xl rounded-2xl shadow-2xl border border-gray-200 ring-1 ring-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold">설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-4 gap-2 border-b border-gray-100 bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 flex items-center gap-1
                ${activeTab === tab.name ? "bg-white border border-b-0 border-gray-300 text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"}`}
            >
              <span>{tab.icon}</span> {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 h-[440px] overflow-y-auto bg-gray-50 text-sm">
          {activeTab === "기본값" && (
            <div className="space-y-6">
              {/* Folder */}
              <div>
                <label className="block mb-1 font-medium text-sm">🎥 영상 저장 폴더</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue="C:\\tmplav"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button className="text-sm px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">폴더 선택</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">생성된 영상 파일이 저장될 경로입니다.</p>
              </div>

              {/* Resolution */}
              <div>
                <label className="block mb-1 font-medium text-sm">📐 기본 해상도</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>1920x1080 (Full HD)</option>
                  <option>1280x720 (HD)</option>
                  <option>3840x2160 (4K)</option>
                </select>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 bg-gray-100 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-base">💡</div>
                <div>
                  <b className="font-medium text-gray-800">영상 설정</b>
                  <div className="text-sm mt-1 leading-relaxed">
                    프레임레이트: <b>24fps</b> 고정
                    <br />
                    영상 길이: 프로젝트 생성 시 설정
                  </div>
                </div>
              </div>

              {/* Image model */}
              <div>
                <label className="block mb-1 font-medium text-sm">🧠 이미지 생성 모델</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>Flux Dev (고품질, 35원)</option>
                  <option>Flux Schnell (속도 우선)</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "API 설정" && (
            <div className="space-y-5">
              {/* Anthropic */}
              <div>
                <label className="block mb-1 font-medium text-sm">🤖 Anthropic API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    defaultValue="*************************"
                  />
                  <button className="text-sm px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">테스트</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">API 키가 프로그램에 내장되어 있습니다.</p>
              </div>

              {/* Replicate */}
              <div>
                <label className="block mb-1 font-medium text-sm">🔁 Replicate API Token</label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    defaultValue="*************************"
                  />
                  <button className="text-sm px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">테스트</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">API 토큰이 프로그램에 내장되어 있습니다.</p>
              </div>

              {/* MiniMax */}
              <div>
                <label className="block mb-1 font-medium text-sm">🧩 MiniMax API</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue="1940920060436550202"
                    className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="password"
                    defaultValue="*************************"
                    className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button className="text-sm px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">테스트</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Group ID와 API 키가 프로그램에 내장되어 있습니다.</p>
              </div>
            </div>
          )}

          {activeTab !== "기본값" && activeTab !== "API 설정" && <div className="text-gray-500">[{activeTab}] 탭의 내용은 추후 구현 예정입니다.</div>}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-white">
          <button onClick={onClose} className="text-sm bg-gray-100 text-gray-700 rounded-lg px-4 py-2 mr-2 hover:bg-gray-200">
            취소
          </button>
          <button className="text-sm bg-purple-600 text-white rounded-lg px-4 py-2 hover:bg-purple-500">저장</button>
        </div>
      </div>
    </div>
  );
}
