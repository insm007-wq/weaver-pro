import { useState } from "react";

export default function ProjectInit({ onCreate }) {
  const [name, setName] = useState("");

  return (
    <div className="bg-white shadow-xl rounded-xl p-10 max-w-md w-full text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">
        ✨ 새 프로젝트 시작
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        프로젝트 이름을 입력하고 시작해보세요
      </p>
      <input
        type="text"
        placeholder="프로젝트 이름을 입력하세요"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="px-4 py-2 w-full border border-gray-300 rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded-md transition"
        onClick={() => {
          if (name.trim()) onCreate(name);
        }}
      >
        프로젝트 생성
      </button>
    </div>
  );
}
