// src/components/assemble/tabs/ArrangeTab.jsx
// -----------------------------------------------------------------------------
//   배치 & 타임라인 탭 (오토플레이/루프 + 자동 배치 연동)
// - 새 영상/이미지 저장 이벤트(files:downloaded)를 구독해 옵션에 따라 자동 배치
// - 씬 목록 클릭 시 미리보기에 즉시 반영(기존 UI/흐름 변경 없음)
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import TimelineView from "../parts/TimelineView";
import SceneList from "../parts/SceneList";
import PropertiesDrawer from "../parts/PropertiesDrawer";

const DEBUG = true;
const dlog = (...a) => DEBUG && console.log("[ArrangeTab]", ...a);

/** 씬 기본값 보정 */
function ensureSceneDefaults(sc) {
  if (!sc) return sc;
  return {
    fit: "cover",
    kenBurns: false,
    transition: "none",
    ...sc,
    asset: {
      type: sc?.asset?.type || null, // 'video' | 'image'
      path: sc?.asset?.path || null, // 로컬 절대경로
      ...sc?.asset,
    },
  };
}

/** 파일명에서 키워드 비슷한 토큰 추출: "홍콩_001_1920x1080.mp4" → "홍콩" */
function guessKeywordFromFileName(name = "") {
  const base = String(name).split(/[\\/]/).pop();
  const noExt = base.replace(/\.[a-z0-9]+$/i, "");
  const m1 = noExt.match(/^(.+?)[_\-]/);
  if (m1) return m1[1];
  return noExt.split(/[ _\-]+/)[0];
}

/** 씬의 '키워드' 속성이 있을 수도/없을 수도 있으니 가능한 후보 조사 */
function sceneHasKeyword(sc, kw) {
  if (!kw) return false;
  const s = (v) => String(v || "").toLowerCase();
  const needle = s(kw);
  const fields = [
    sc?.keyword,
    sc?.keywords?.join?.(" "),
    sc?.title,
    sc?.label,
    sc?.name,
    sc?.notes,
  ]
    .filter(Boolean)
    .map(s)
    .join(" ");
  return fields.includes(needle);
}

// 유틸
function basename(p = "") {
  return String(p).split(/[\\/]/).pop();
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
  // 파일 보관 로직 (프로젝트에 저장 → 절대경로 확보) : 드롭/수동 선택 때 사용
  // ---------------------------------------------------------------------------
  const persistFileToProject = useCallback(async (file) => {
    const ab = await file.arrayBuffer();
    const buffer = new Uint8Array(ab);
    const res = await window.api.saveBufferToProject?.({
      category: "assets",
      fileName: file.name || `asset_${Date.now()}`,
      buffer,
    });
    if (!res?.ok || !res?.path)
      throw new Error(res?.message || "파일 저장 실패");
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
        dlog("선택된 파일에 path 없음", payload);
        return;
      }
      const kind = (info.type || "").startsWith("image/")
        ? "image"
        : (info.type || "").startsWith("video/")
        ? "video"
        : "video";

      patchScene(selectedIdx, {
        fileName: info.name || "",
        asset: { type: kind, path: info.path }, // 절대경로
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

        const v = previewVideoRef.current;
        if (v) {
          v.muted = true;
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
  // 자동 배치 옵션 로드
  //   SetupTab은 autoMatch.enabled / autoMatch.options 로 저장합니다.
  //   options 구조: { emptyOnly, byKeywords, byOrder, overwrite }
  // ---------------------------------------------------------------------------
  const [autoOpt, setAutoOpt] = useState({
    enabled: false,
    fillEmpty: true,
    keywordMatch: true,
    sequential: true,
    allowOverwrite: false,
  });

  useEffect(() => {
    (async () => {
      try {
        // 우선 순위: autoMatch.* → (없으면) 기존 auto.*
        const [enabledAM, optionsAM, enabledOld, fill, kw, seq, over] =
          await Promise.all([
            window.api.getSetting?.("autoMatch.enabled"),
            window.api.getSetting?.("autoMatch.options"),
            window.api.getSetting?.("auto.enabled"),
            window.api.getSetting?.("auto.fillEmpty"),
            window.api.getSetting?.("auto.keywordMatch"),
            window.api.getSetting?.("auto.sequential"),
            window.api.getSetting?.("auto.allowOverwrite"),
          ]);

        let enabled =
          enabledAM === true ||
          enabledAM === "true" ||
          enabledAM === 1 ||
          enabledAM === "1" ||
          !!enabledOld;

        let opts = {};
        try {
          opts =
            typeof optionsAM === "string"
              ? JSON.parse(optionsAM || "{}")
              : optionsAM || {};
        } catch {
          opts = {};
        }

        const mapped = {
          enabled,
          fillEmpty:
            opts.emptyOnly != null
              ? !!opts.emptyOnly
              : fill != null
              ? fill !== false
              : true,
          keywordMatch:
            opts.byKeywords != null ? !!opts.byKeywords : !!kw || false,
          sequential: opts.byOrder != null ? !!opts.byOrder : seq !== false,
          allowOverwrite:
            opts.overwrite != null ? !!opts.overwrite : !!over || false,
        };

        dlog("auto options loaded →", mapped);
        setAutoOpt(mapped);
      } catch (e) {
        console.warn("[ArrangeTab] auto options load failed:", e);
      }
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // 자동 배치 핵심
  // ---------------------------------------------------------------------------
  const placeOneAsset = useCallback(
    (filePath, fileName, mimeHint = "") => {
      dlog("placeOneAsset called", {
        enabled: autoOpt.enabled,
        filePath,
        fileName,
        mimeHint,
      });
      if (!autoOpt.enabled) return false;

      const kind = mimeHint.startsWith("image") ? "image" : "video";
      const kw = autoOpt.keywordMatch ? guessKeywordFromFileName(fileName) : "";

      const indices = scenes.map((_, i) => i);
      const order = autoOpt.sequential ? indices : indices;

      // 1) 키워드 매칭 우선
      if (autoOpt.keywordMatch && kw) {
        for (const i of order) {
          const sc = scenes[i];
          const occupied = !!sc?.asset?.path;
          if (autoOpt.fillEmpty && occupied && !autoOpt.allowOverwrite)
            continue;
          if (sceneHasKeyword(sc, kw)) {
            dlog("→ keyword match", { index: i, kw });
            patchScene(i, { fileName, asset: { type: kind, path: filePath } });
            return true;
          }
        }
      }

      // 2) 첫 빈(또는 덮어쓰기 허용 시 첫 장)
      for (const i of order) {
        const sc = scenes[i];
        const occupied = !!sc?.asset?.path;
        if (autoOpt.fillEmpty && occupied && !autoOpt.allowOverwrite) continue;
        dlog("→ fallback place", { index: i });
        patchScene(i, { fileName, asset: { type: kind, path: filePath } });
        return true;
      }

      dlog("→ no slot available");
      return false;
    },
    [autoOpt, scenes, patchScene]
  );

  // 새로 저장된 파일 이벤트 구독 → 자동 배치
  useEffect(() => {
    const off = window.api.onFileDownloaded?.((payload) => {
      dlog("files:downloaded ←", payload);
      if (!payload?.path) return;
      // 카테고리 제한 두지 않음(assets/videos/exports 등 모두 허용)
      const name = payload.fileName || basename(payload.path);
      placeOneAsset(payload.path, name, "");
    });
    return () => {
      try {
        off && off();
      } catch {}
    };
  }, [placeOneAsset]);

  // ---------------------------------------------------------------------------
  // 속성 패널 핸들러 (맞춤/켄번즈/전환)
  // ---------------------------------------------------------------------------
  const handleChangeFit = (fit) => patchScene(selectedIdx, { fit });
  const handleToggleKenBurns = (bool) =>
    patchScene(selectedIdx, { kenBurns: !!bool });
  const handleChangeTransition = (name) =>
    patchScene(selectedIdx, { transition: name });

  // ---------------------------------------------------------------------------
  // 렌더 — 기존 UI 유지
  // ---------------------------------------------------------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 씬 목록 */}
      <div className="lg:col-span-3">
        <SceneList
          scenes={scenes}
          selectedIndex={selectedIdx}
          onSelect={(i) => setSelectedIdx(i)}
        />
      </div>

      {/* 타임라인 + 미리보기 */}
      <div className="lg:col-span-6">
        <TimelineView
          scenes={scenes}
          selectedIndex={selectedIdx}
          onSelect={(i) => setSelectedIdx(i)}
          onScrub={() => {}}
        />

        <SectionCard title="씬 미리보기" className="mt-3" bodyClass="relative">
          <div
            onDragOver={(e) => e.preventDefault()}
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
