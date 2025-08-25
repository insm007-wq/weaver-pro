import { useMemo, useState } from "react";
import SceneList from "../parts/SceneList";
import TimelineView from "../parts/TimelineView";
import PropertiesDrawer from "../parts/PropertiesDrawer";
import ScenePreview from "../parts/ScenePreview";

// 상위에서 scenes 안 내려오면 안전한 기본
const seedScenes = [
  { id: "sc1", start: 0, end: 60 },
  { id: "sc2", start: 60, end: 150 },
  { id: "sc3", start: 150, end: 240 },
  { id: "sc4", start: 240, end: 330 },
  { id: "sc5", start: 330, end: 420 },
];

export default function ArrangeTab({ scenes: scenesProp }) {
  const scenes = useMemo(
    () => (scenesProp?.length ? scenesProp : seedScenes),
    [scenesProp]
  );
  const [selected, setSelected] = useState(0);

  // 씬별 미리보기 URL
  const [sceneUrls, setSceneUrls] = useState({}); // { [sceneId]: blob/http(s) url }

  const currentScene = scenes[selected];
  const currentUrl = currentScene ? sceneUrls[currentScene.id] : "";

  // 오른쪽 속성패널에서 파일 고르면 현재 씬의 URL로 설정
  const handlePickVideo = ({ url }) => {
    const sid = currentScene?.id;
    if (!sid) return;
    setSceneUrls((m) => ({ ...m, [sid]: url }));
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* 왼쪽: 씬 목록 */}
      <div className="col-span-3">
        <SceneList scenes={scenes} selected={selected} onSelect={setSelected} />
      </div>

      {/* 가운데: 타임라인 + (아래) 씬 미리보기 */}
      <div className="col-span-6">
        <TimelineView
          scenes={scenes}
          selectedIndex={selected}
          onSelect={setSelected}
        />

        <div className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <div className="text-sm font-semibold mb-2">씬 미리보기</div>
            <ScenePreview
              key={`${currentScene?.id || "none"}::${currentUrl || "no-src"}`} // 씬/영상 변경 시 자동 재생
              scene={currentScene}
              videoUrl={currentUrl}
            />
          </div>
        </div>
      </div>

      {/* 오른쪽: 기존 속성 패널 */}
      <div className="col-span-3">
        <PropertiesDrawer onPickVideo={handlePickVideo} />
      </div>
    </div>
  );
}
