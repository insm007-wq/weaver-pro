import { useMemo } from "react";
import SceneList from "../parts/SceneList";
import TimelineView from "../parts/TimelineView";
import PropertiesDrawer from "../parts/PropertiesDrawer";
import ScenePreview from "../parts/ScenePreview";
import usePersistentState from "../../../hooks/usePersistentState";

// 프로젝트 ID가 있다면 그걸 사용 (없으면 'default')
const PROJECT_KEY = "cw:project:default";

const seedScenes = [
  { id: "sc1", start: 0, end: 60 },
  { id: "sc2", start: 60, end: 150 },
  { id: "sc3", start: 150, end: 240 },
  { id: "sc4", start: 240, end: 330 },
  { id: "sc5", start: 330, end: 420 },
];

const defaultSceneState = {
  url: "",
  fit: "cover", // "cover" | "contain"
  kenBurns: false, // boolean
  transition: "none", // "dissolve" | "none"
  offsetSec: 0,
};

export default function ArrangeTab({ scenes: scenesProp }) {
  const scenes = useMemo(
    () => (scenesProp?.length ? scenesProp : seedScenes),
    [scenesProp]
  );

  // 🔸 탭을 나갔다 돌아와도 유지되는 상태들
  const [selected, setSelected] = usePersistentState(
    `${PROJECT_KEY}:assemble:selected`,
    0
  );
  const [sceneState, setSceneState] = usePersistentState(
    `${PROJECT_KEY}:assemble:sceneState`,
    {}
  ); // { [sceneId]: {...} }

  const cur = scenes[selected];
  const curState = cur
    ? { ...defaultSceneState, ...(sceneState[cur.id] || {}) }
    : defaultSceneState;

  const updateSceneState = (sceneId, partial) =>
    setSceneState((m) => ({
      ...m,
      [sceneId]: { ...defaultSceneState, ...(m[sceneId] || {}), ...partial },
    }));

  // 속성 패널 이벤트
  const handlePickVideo = ({ url }) => cur && updateSceneState(cur.id, { url });
  const handleChangeFit = (fit) => cur && updateSceneState(cur.id, { fit });
  const handleToggleKenBurns = (on) =>
    cur && updateSceneState(cur.id, { kenBurns: !!on });
  const handleChangeTransition = (t) =>
    cur && updateSceneState(cur.id, { transition: t });

  // 타임라인 스크럽
  const handleScrub = (off, idx) => {
    const s = scenes[idx];
    if (!s) return;
    setSelected(idx);
    updateSceneState(s.id, { offsetSec: off });
  };

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-3">
        <SceneList scenes={scenes} selected={selected} onSelect={setSelected} />
      </div>

      <div className="col-span-6">
        <TimelineView
          scenes={scenes}
          selectedIndex={selected}
          onSelect={setSelected}
          onScrub={handleScrub}
          offsetSec={curState.offsetSec}
          getTransition={(sceneId) => sceneState[sceneId]?.transition ?? "none"}
        />

        <div className="mt-4 bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-sm font-semibold mb-2">씬 미리보기</div>
          <ScenePreview
            key={`${cur?.id || "none"}::${curState.url || "no-src"}::${
              curState.offsetSec
            }::${curState.kenBurns}::${curState.fit}`}
            scene={cur}
            videoUrl={curState.url}
            offsetSec={curState.offsetSec}
            fit={curState.fit}
            kenBurns={curState.kenBurns}
          />
        </div>
      </div>

      <div className="col-span-3">
        <PropertiesDrawer
          value={{
            fileName: curState.url ? curState.url.split("/").pop() : "",
            fit: curState.fit,
            kenBurns: curState.kenBurns,
            transition: curState.transition,
          }}
          onPickVideo={handlePickVideo}
          onChangeFit={handleChangeFit}
          onToggleKenBurns={handleToggleKenBurns}
          onChangeTransition={handleChangeTransition}
        />
      </div>
    </div>
  );
}
