// src/components/assemble/tabs/ArrangeTab.jsx
// -----------------------------------------------------------------------------
// 배치 & 타임라인 탭 (오토플레이/루프 보강 · 한 세트만 표시)
// - 새 영상 선택/드롭 시 미리보기 <video>가 즉시 재생되고 끝나면 반복
// - 씬 목록 + 타임라인 + 미리보기 + 속성 **한 번만** 렌더 (중복 제거)
// - 기존 UI/기능은 그대로 유지
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import TimelineView from "../parts/TimelineView";
import ScenePreview from "../parts/ScenePreview"; // (미사용 가능: 유지해도 동작 영향 없음)
import SceneList from "../parts/SceneList";
import PropertiesDrawer from "../parts/PropertiesDrawer";

function ensureSceneDefaults(sc) {
  if (!sc) return sc;
  return {
    fit: "cover",
    kenBurns: false,
    transition: "none",
    ...sc,
    asset: {
      type: sc?.asset?.type || null, // 'video' | 'image'
      path: sc?.asset?.path || null, // ✅ 로컬 절대경로
      ...sc?.asset,
    },
  };
}

export default function ArrangeTab({
  scenes: propScenes,
  onChangeScenes,
  selectedSceneIdx: propSelectedIdx,
  onChangeSelectedScene,
}) {
  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const [localScenes, setLocalScenes] = useState(() =>
    (propScenes || []).map(ensureSceneDefaults)
  );
  const [localSelectedIdx, setLocalSelectedIdx] = useState(
    Number.isInteger(propSelectedIdx) ? propSelectedIdx : 0
  );

  const scenes = useMemo(
    () => (propScenes ? propScenes.map(ensureSceneDefaults) : localScenes),
    [propScenes, localScenes]
  );
  const selectedIdx = useMemo(
    () =>
      Number.isInteger(propSelectedIdx) ? propSelectedIdx : localSelectedIdx,
    [propSelectedIdx, localSelectedIdx]
  );
  const selectedScene = scenes[selectedIdx];

  useEffect(() => {
    window.__scenes = scenes; // 개발 확인용
  }, [scenes]);

  // ---------------------------------------------------------------------------
  // 상태 업데이트 유틸
  // ---------------------------------------------------------------------------
  const setScenes = useCallback(
    (updater) => {
      if (onChangeScenes) {
        const next =
          typeof updater === "function" ? updater(scenes) : updater ?? scenes;
        onChangeScenes(next.map(ensureSceneDefaults));
      } else {
        setLocalScenes((prev) => {
          const next =
            typeof updater === "function" ? updater(prev) : updater ?? prev;
          return next.map(ensureSceneDefaults);
        });
      }
    },
    [onChangeScenes, scenes]
  );

  const setSelectedIdx = useCallback(
    (idx) => {
      if (onChangeSelectedScene) onChangeSelectedScene(idx);
      else setLocalSelectedIdx(idx);
    },
    [onChangeSelectedScene]
  );

  const patchScene = useCallback(
    (idx, patch) => {
      setScenes((prev) =>
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
    [setScenes]
  );

  // ---------------------------------------------------------------------------
  // 파일 보관 로직 (프로젝트에 저장 → 절대경로 확보)
  // ---------------------------------------------------------------------------
  const persistFileToProject = useCallback(async (file) => {
    const ab = await file.arrayBuffer();
    const buffer = new Uint8Array(ab);
    const res = await window.api.saveBufferToProject({
      category: "assets",
      fileName: file.name || `asset_${Date.now()}`,
      buffer,
    });
    if (!res?.ok || !res?.path) {
      throw new Error(res?.message || "파일 저장에 실패했습니다.");
    }
    const previewUrl = await window.api.videoPathToUrl(res.path);
    return {
      path: res.path,
      url: previewUrl,
      name: file.name,
      type: file.type || res.mime || "",
    };
  }, []);

  // ---------------------------------------------------------------------------
  // 속성 패널: 이미지/영상 선택 콜백
  // ---------------------------------------------------------------------------
  const handlePickVideo = useCallback(
    async (payload) => {
      let info = payload;
      if (!info?.path && payload?.file) {
        info = await persistFileToProject(payload.file);
      }
      if (!info?.path) {
        console.warn("[ArrangeTab] 선택된 파일에 path가 없습니다.", payload);
        return;
      }
      const kind = (info.type || "").startsWith("image/")
        ? "image"
        : (info.type || "").startsWith("video/")
        ? "video"
        : "video";

      patchScene(selectedIdx, {
        fileName: info.name || "",
        asset: {
          type: kind,
          path: info.path, // ✅ 절대경로 주입
        },
      });
    },
    [patchScene, persistFileToProject, selectedIdx]
  );

  // ---------------------------------------------------------------------------
  // 드래그&드롭
  // ---------------------------------------------------------------------------
  const onDropFile = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      const info = await persistFileToProject(f);
      const kind = (info.type || "").startsWith("image/")
        ? "image"
        : (info.type || "").startsWith("video/")
        ? "video"
        : "video";
      patchScene(selectedIdx, {
        fileName: info.name || "",
        asset: { type: kind, path: info.path },
      });
    },
    [patchScene, persistFileToProject, selectedIdx]
  );
  const onDragOver = (e) => e.preventDefault();

  // ---------------------------------------------------------------------------
  // 미리보기 URL + 오토플레이/루프
  // ---------------------------------------------------------------------------
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewVideoRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = selectedScene?.asset?.path;
        if (!p) {
          setPreviewUrl(null);
          return;
        }
        const url = await window.api.videoPathToUrl(p);
        if (cancelled) return;
        setPreviewUrl(url);

        // ✅ 오토플레이 보장 (Chromium 정책 회피: muted + canplay 후 play)
        const v = previewVideoRef.current;
        if (v) {
          v.muted = true; // 오토플레이 허용
          const play = () => v.play().catch(() => {});
          if (v.readyState >= 2) play();
          else v.addEventListener("canplay", play, { once: true });
        }
      } catch (e) {
        console.warn("[ArrangeTab] preview URL 생성 실패:", e);
        if (!cancelled) setPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedScene?.asset?.path]);

  // ---------------------------------------------------------------------------
  // 속성 패널 핸들러 (맞춤/켄번즈/전환)
  // ---------------------------------------------------------------------------
  const handleChangeFit = (fit) => patchScene(selectedIdx, { fit });
  const handleToggleKenBurns = (bool) =>
    patchScene(selectedIdx, { kenBurns: !!bool });
  const handleChangeTransition = (name) =>
    patchScene(selectedIdx, { transition: name });

  // ---------------------------------------------------------------------------
  // 렌더 — 한 세트만 표시 (중복 제거)
  //  * SceneList, TimelineView 내부에서 이미 SectionCard를 감싸고 있다면
  //    여기선 **바깥 SectionCard를 제거**해 중복 타이틀/카드를 없앱니다.
  // ---------------------------------------------------------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 씬 목록 (내부 카드 사용) */}
      <div className="lg:col-span-3">
        <SceneList
          scenes={scenes}
          selectedIndex={selectedIdx}
          onSelect={(i) => setSelectedIdx(i)}
        />
      </div>

      {/* 타임라인 (내부 카드 사용) + 미리보기 */}
      <div className="lg:col-span-6">
        {/* ✅ 외부 SectionCard 제거: TimelineView 가 자체 카드/헤더를 가지는 경우 중복 방지 */}
        <TimelineView
          scenes={scenes}
          selectedIndex={selectedIdx}
          onSelect={(i) => setSelectedIdx(i)}
          onScrub={() => {}}
        />

        {/* 미리보기는 외부 카드 유지 (내부 카드 없음) */}
        <SectionCard title="씬 미리보기" className="mt-3" bodyClass="relative">
          <div
            onDragOver={onDragOver}
            onDrop={onDropFile}
            className="aspect-video w-full bg-slate-100 border border-slate-200 rounded-lg overflow-hidden flex items-center justify-center"
            title="여기에 파일을 드롭하여 배경 소스로 설정"
          >
            {previewUrl ? (
              <video
                ref={previewVideoRef}
                className="w-full h-full"
                src={previewUrl}
                controls
                muted
                autoPlay
                loop
                playsInline
              />
            ) : (
              <div className="text-slate-500 text-sm">
                배경 소스를 선택하거나 파일을 드롭하세요
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* 속성 패널 */}
      <div className="lg:col-span-3">
        <PropertiesDrawer
          value={{
            fileName:
              selectedScene?.fileName ||
              (selectedScene?.asset?.path
                ? basename(selectedScene.asset.path)
                : ""),
            fit: selectedScene?.fit ?? "cover",
            kenBurns: selectedScene?.kenBurns ?? false,
            transition: selectedScene?.transition ?? "none",
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

// 유틸
function fmtTotal(scenes = []) {
  const total = scenes.length ? Math.max(...scenes.map((s) => s.end || 0)) : 0;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function basename(p = "") {
  return String(p).split(/[\\/]/).pop();
}
