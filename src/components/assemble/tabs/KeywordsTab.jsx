import { useState } from "react";
import SectionCard from "../parts/SectionCard";
import AssetLibrary from "../parts/AssetLibrary";

const seedKeywords = ["여행", "산", "노을", "도시", "강아지", "바다"];

export default function KeywordsTab({ assets, addAssets, autoMatch }) {
  const [keywords, setKeywords] = useState(seedKeywords);
  const [history, setHistory] = useState([]);

  const extractKeywords = () => {
    // 실제 구현은 자막 분석 → 키워드; 지금은 seed만 사용
    setHistory((h) => [{ at: Date.now(), items: seedKeywords }, ...h]);
  };

  const searchOnCanva = (kw) => {
    alert(`Canva에서 "${kw}" 검색 (다음 단계에서 연동)`);
  };

  const simulateDownload = () => {
    // 더미 에셋 3개 추가
    addAssets(
      Array.from({ length: 3 }).map((_, i) => ({
        id: "new-" + Date.now() + "-" + i,
        type: i % 2 ? "image" : "video",
        thumbUrl: "",
      }))
    );
    if (autoMatch) {
      // 이 자리에서 자동 배치 호출 가능
      // (지금은 안내만)
      setTimeout(() => {
        alert("자동 매칭: 3개 에셋을 빈 씬에 배치했습니다. (예시)");
      }, 200);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SectionCard
        title="키워드"
        right={
          <button
            onClick={extractKeywords}
            className="h-9 px-3 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
          >
            키워드 추출
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <button
              key={k}
              onClick={() => searchOnCanva(k)}
              className="px-3 h-8 rounded-full border border-slate-200 text-sm hover:bg-slate-50"
            >
              #{k}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="text-xs text-slate-500 mb-1">히스토리</div>
          <div className="flex flex-col gap-2">
            {history.length === 0 && (
              <div className="text-xs text-slate-400">
                아직 기록이 없습니다.
              </div>
            )}
            {history.map((h, i) => (
              <div
                key={i}
                className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1"
              >
                {new Date(h.at).toLocaleTimeString()} · {h.items.join(", ")}
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="lg:col-span-2">
        <SectionCard
          title="에셋 라이브러리"
          right={
            <div className="flex items-center gap-2">
              <button
                onClick={simulateDownload}
                className="h-9 px-3 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
              >
                (예시) 3개 다운로드
              </button>
              <button
                onClick={() => alert("폴더 불러오기 (다음 단계에서)")}
                className="h-9 px-3 rounded-lg bg-white border text-sm border-slate-200 hover:bg-slate-50"
              >
                폴더 가져오기
              </button>
            </div>
          }
        >
          <AssetLibrary
            assets={assets}
            onPick={() => alert("해당 씬에 배치")}
          />
        </SectionCard>
      </div>
    </div>
  );
}
