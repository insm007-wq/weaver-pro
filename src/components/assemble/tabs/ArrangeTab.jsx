// src/components/assemble/tabs/ArrangeTab.jsx
// -----------------------------------------------------------------------------
//   배치 & 타임라인 탭 (자동 배치/놓친 이벤트 복구 + 수동 교체 보강)
//   - UI/레이아웃 변경 없음
//   - ✅ TimelineView ↔ 비디오 시간 양방향 동기화(absoluteTime / onScrub)
//   - ✅ 씬 종료 시 자동 다음 씬으로 이동 (마지막 씬은 정지)
//   - ♻️ 리팩토링: 훅/유틸 분리 (기능 변경 없음)
// -----------------------------------------------------------------------------
import { useCallback, useMemo, useState } from "react";
import SectionCard from "../parts/SectionCard";
import TimelineView from "../parts/TimelineView";
import SceneList from "../parts/SceneList";
import PropertiesDrawer from "../parts/PropertiesDrawer";

import { usePersistProject } from "../../../hooks/usePersistProject";
import { usePreviewSync } from "../../../hooks/usePreviewSync.js";
import { useAutoMatch } from "../../../hooks/useAutoMatch";

import { ensureSceneDefaults } from "../../../utils/scenes";
import { basename } from "../../../utils/media";

const DEBUG = true;
const dlog = (...a) => DEBUG && console.log("[ArrangeTab]", ...a);

export default function ArrangeTab({ scenes: propScenes, onChangeScenes, selectedSceneIdx: propSelectedIdx, onChangeSelectedScene }) {
  // 컨트롤드/언컨트롤드 동시 지원
  const [localScenes, setLocalScenes] = useState(() => (propScenes || []).map(ensureSceneDefaults));
  const usingLocal = typeof onChangeScenes !== "function";

  const scenes = useMemo(() => (propScenes ? propScenes.map(ensureSceneDefaults) : localScenes), [propScenes, localScenes]);

  const [localSelectedIdx, setLocalSelectedIdx] = useState(Number.isInteger(propSelectedIdx) ? propSelectedIdx : 0);
  const selectedIdx = useMemo(
    () => (Number.isInteger(propSelectedIdx) ? propSelectedIdx : localSelectedIdx),
    [propSelectedIdx, localSelectedIdx]
  );
  const setSelectedIdx = typeof onChangeSelectedScene === "function" ? onChangeSelectedScene : setLocalSelectedIdx;

  // 공용 commit (참조 안정화)
  const commitScenes = useCallback(
    (updater) => {
      if (usingLocal) setLocalScenes((prev) => updater(prev));
      else onChangeScenes(updater(scenes));
    },
    [usingLocal, scenes, onChangeScenes]
  );

  const selectedScene = scenes[selectedIdx];

  // 파일 저장/정규화 유틸
  const { persistFileToProject, normalizePicked } = usePersistProject();

  /* ------------------------------ 수동 교체 ------------------------------- */
  const patchScene = useCallback(
    (idx, patch) => {
      commitScenes((prev) =>
        prev.map((sc, i) =>
          i === idx
            ? {
                ...sc,
                ...patch,
                asset: { ...(sc.asset || {}), ...(patch?.asset || {}) },
              }
            : sc
        )
      );
    },
    [commitScenes]
  );

  const handlePickVideo = useCallback(
    async (payload) => {
      try {
        const info = await normalizePicked(payload);
        if (!info?.path) return;
        const kind = (info.type || "").startsWith("image/") ? "image" : "video";
        patchScene(selectedIdx, {
          fileName: info.name || "",
          asset: { type: kind, path: info.path },
        });
      } catch (err) {
        console.warn("[ArrangeTab] handlePickVideo failed:", err);
      }
    },
    [normalizePicked, patchScene, selectedIdx]
  );

  const onDropFile = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      const info = await persistFileToProject(f);
      const kind = (info.type || "").startsWith("image/") ? "image" : "video";
      patchScene(selectedIdx, {
        fileName: info.name || "",
        asset: { type: kind, path: info.path },
      });
    },
    [persistFileToProject, patchScene, selectedIdx]
  );

  /* ===================== ✅ 비디오 시간 ↔ 타임라인 동기화 ===================== */
  const { previewUrl, previewVideoRef, absTime, handleTimelineScrub } = usePreviewSync({
    scenes,
    selectedIdx,
    setSelectedIdx,
    selectedScene,
  });

  /* ------------------------- 자동 배치(설정/이벤트) ------------------------- */
  const { wireAutoPlacement } = useAutoMatch({ commitScenes }); // 기존 훅 파일 교체
  wireAutoPlacement();

  /* -------------------------------- 렌더 --------------------------------- */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 씬 목록 */}
      <div className="lg:col-span-3">
        <SceneList scenes={scenes} selected={selectedIdx} selectedIndex={selectedIdx} onSelect={(i) => setSelectedIdx(i)} />
      </div>

      {/* 타임라인 + 미리보기 */}
      <div className="lg:col-span-6">
        <TimelineView
          scenes={scenes}
          selectedIndex={selectedIdx}
          onSelect={(i) => setSelectedIdx(i)}
          absoluteTime={absTime} // ✅ 비디오 → 타임라인
          onScrub={handleTimelineScrub} // ✅ 타임라인 → 비디오
        />

        <SectionCard title="씬 미리보기" className="mt-3" bodyClass="relative">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropFile}
            className="w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center"
            title="여기에 파일을 드롭하여 배경 소스로 설정"
          >
            {selectedScene?.asset?.path ? (
              <video
                ref={previewVideoRef}
                className="w-full h-full"
                src={previewUrl || ""}
                controls
                muted
                autoPlay
                /* ❌ loop 제거: 무한 반복 방지 */
                playsInline
                onCanPlay={(e) => {
                  try {
                    e.currentTarget.play();
                  } catch {}
                }}
              />
            ) : (
              <div className="text-slate-500 text-sm">배경 소스를 선택하거나 파일을 드롭하세요</div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* 속성 패널 */}
      <div className="lg:col-span-3">
        <PropertiesDrawer
          value={{
            fileName: selectedScene?.fileName || (selectedScene?.asset?.path ? basename(selectedScene.asset.path) : ""),
            fit: selectedScene?.fit ?? "cover",
            kenBurns: selectedScene?.kenBurns ?? false,
            transition: selectedScene?.transition ?? "none",
          }}
          onPickVideo={handlePickVideo}
          onPick={handlePickVideo}
          onPickMedia={handlePickVideo}
          onPickSource={handlePickVideo}
          onChangeFit={(fit) => patchScene(selectedIdx, { fit })}
          onToggleKenBurns={(v) => patchScene(selectedIdx, { kenBurns: !!v })}
          onChangeTransition={(name) => patchScene(selectedIdx, { transition: name })}
        />
      </div>
    </div>
  );
}
