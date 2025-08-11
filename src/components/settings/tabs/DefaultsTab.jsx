export default function DefaultsTab() {
  return (
    <div className="space-y-6">
      {/* Folder */}
      <div>
        <label className="block mb-1 font-medium text-sm">
          🎥 영상 저장 폴더
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            defaultValue="C:\\tmplav"
            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button className="text-sm px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200">
            폴더 선택
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          생성된 영상 파일이 저장될 경로입니다.
        </p>
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
        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-base">
          💡
        </div>
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
        <label className="block mb-1 font-medium text-sm">
          🧠 이미지 생성 모델
        </label>
        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option>Flux Dev (고품질, 35원)</option>
          <option>Flux Schnell (속도 우선)</option>
        </select>
      </div>
    </div>
  );
}
