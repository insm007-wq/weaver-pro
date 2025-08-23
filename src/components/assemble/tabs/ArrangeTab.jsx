import SceneList from "../parts/SceneList";
import TimelineView from "../parts/TimelineView";
import PropertiesDrawer from "../parts/PropertiesDrawer";

export default function ArrangeTab({
  scenes,
  setScenes,
  selectedSceneIdx,
  selectScene,
  assets = [], // ✅ 에셋 전달 받아서 Drawer에 넘김
}) {
  // ✅ 선택 인덱스 안전화
  const safeIndex =
    typeof selectedSceneIdx === "number" && selectedSceneIdx >= 0 && selectedSceneIdx < scenes.length
      ? selectedSceneIdx
      : Math.max(0, Math.min(selectedSceneIdx || 0, scenes.length - 1));

  const currentScene = scenes[safeIndex] || null;

  // ✅ 개별 씬 업데이트(시간/텍스트/메타/assetId 등 변경)
  const updateScene = (partial) => {
    if (!currentScene) return;
    setScenes((prev) => prev.map((s, i) => (i === safeIndex ? { ...s, ...(typeof partial === "function" ? partial(s) : partial) } : s)));
  };

  // ✅ 에셋 배치/해제 콜백 (PropertiesDrawer에서 사용)
  const assignAsset = (assetId) => updateScene({ assetId: assetId || null });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-3">
        <SceneList scenes={scenes} selected={safeIndex} onSelect={selectScene} />
      </div>

      <div className="lg:col-span-6">
        {/* ✅ 타임라인에서도 선택 이동 가능하도록 prop 전달 */}
        <TimelineView scenes={scenes} selectedIndex={safeIndex} onSelect={selectScene} />
      </div>

      <div className="lg:col-span-3">
        <PropertiesDrawer
          // ✅ 현재 씬 + 수정/에셋배치 콜백 + 에셋 리스트 전달
          scene={currentScene}
          onChange={updateScene}
          onAssignAsset={assignAsset}
          assets={assets}
          selectedIndex={safeIndex}
          totalScenes={scenes.length}
        />
      </div>
    </div>
  );
}
