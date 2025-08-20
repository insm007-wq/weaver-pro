import SceneList from "../parts/SceneList";
import TimelineView from "../parts/TimelineView";
import PropertiesDrawer from "../parts/PropertiesDrawer";

export default function ArrangeTab({
  scenes,
  setScenes,
  selectedSceneIdx,
  selectScene,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-3">
        <SceneList
          scenes={scenes}
          selected={selectedSceneIdx}
          onSelect={selectScene}
        />
      </div>

      <div className="lg:col-span-6">
        <TimelineView scenes={scenes} />
      </div>

      <div className="lg:col-span-3">
        <PropertiesDrawer />
      </div>
    </div>
  );
}
