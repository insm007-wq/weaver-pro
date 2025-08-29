// src/components/assemble/tabs/ArrangeTab.jsx
// -----------------------------------------------------------------------------
//   배치 & 타임라인 탭 (로컬 선택/드롭 교체 보강 + 자동 배치 그대로 유지)
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "../parts/SectionCard";
import TimelineView from "../parts/TimelineView";
import SceneList from "../parts/SceneList";
import PropertiesDrawer from "../parts/PropertiesDrawer";

const DEBUG = true;
const dlog = (...a) => DEBUG && console.log("[ArrangeTab]", ...a);

/* -------------------------------- utils ---------------------------------- */
function ensureSceneDefaults(sc) {
  if (!sc) return sc;
  return {
    fit: "cover",
    kenBurns: false,
    transition: "none",
    ...sc,
    asset: {
      type: sc?.asset?.type || null, // 'video' | 'image'
      path: sc?.asset?.path || null, // 절대경로
      ...sc?.asset,
    },
  };
}
function basename(p = "") {
  return String(p).split(/[\\/]/).pop();
}
function stripExt(n = "") {
  return String(n).replace(/\.[^.]+$/, "");
}
function extname(n = "") {
  const m = /\.[^.]+$/.exec(n);
  return m ? m[0].toLowerCase() : "";
}
/** 간단 MIME 추정 (없으면 video로) */
function guessMimeByExt(name = "") {
  const e = extname(name);
  if (/\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(e)) return "image/*";
  if (/\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(e)) return "video/*";
  return "video/*";
}
/** 파일명 → 키워드 첫 토큰 */
function keywordFromFileName(name = "") {
  const base = decodeURIComponent(stripExt(basename(name)));
  const token = base.split(/[_\-\s]+/)[0] || "";
  return token.trim();
}
function sceneTextBlob(sc) {
  const list = [];
  if (Array.isArray(sc?.keywords)) list.push(sc.keywords.join(" "));
  if (sc?.text) list.push(sc.text);
  if (sc?.title) list.push(sc.title);
  if (sc?.hint) list.push(sc.hint);
  return list.join(" ").toLowerCase();
}
const isOccupied = (sc) => !!sc?.asset?.path;

/* -------------------------------- comp ----------------------------------- */
export default function ArrangeTab({
  scenes: propScenes,
  onChangeScenes,
  selectedSceneIdx: propSelectedIdx,
  onChangeSelectedScene,
}) {
  // 로컬/컨트롤드 양쪽 지원
  const [localScenes, setLocalScenes] = useState(() =>
    (propScenes || []).map(ensureSceneDefaults)
  );
  const usingLocal = typeof onChangeScenes !== "function";
  const scenes = useMemo(
    () => (propScenes ? propScenes.map(ensureSceneDefaults) : localScenes),
    [propScenes, localScenes]
  );

  const [localSelectedIdx, setLocalSelectedIdx] = useState(
    Number.isInteger(propSelectedIdx) ? propSelectedIdx : 0
  );
  const selectedIdx = useMemo(
    () =>
      Number.isInteger(propSelectedIdx) ? propSelectedIdx : localSelectedIdx,
    [propSelectedIdx, localSelectedIdx]
  );
  const setSelectedIdx =
    typeof onChangeSelectedScene === "function"
      ? onChangeSelectedScene
      : setLocalSelectedIdx;

  /** 공용 commit */
  const commitScenes = useCallback(
    (updater) => {
      if (usingLocal) setLocalScenes((prev) => updater(prev));
      else onChangeScenes(updater(scenes));
    },
    [usingLocal, scenes, onChangeScenes]
  );

  const selectedScene = scenes[selectedIdx];

  /* ------------------------- 로컬 파일 → 프로젝트에 저장 ------------------- */
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
    return {
      path: res.path,
      name: file.name,
      type: file.type || guessMimeByExt(file.name),
    };
  }, []);

  /** 로컬 경로 문자열을 받아 프로젝트에 복사 저장 */
  const persistPathToProject = useCallback(async (pathStr) => {
    const name = basename(pathStr);
    const bin = await window.api.readBinary?.(pathStr);
    if (!bin) throw new Error("파일 읽기 실패");
    const res = await window.api.saveBufferToProject?.({
      category: "assets",
      fileName: name || `asset_${Date.now()}`,
      buffer: bin,
    });
    if (!res?.ok || !res?.path)
      throw new Error(res?.message || "프로젝트 저장 실패");
    return {
      path: res.path,
      name,
      type: guessMimeByExt(name),
    };
  }, []);

  /** 다양한 형태의 선택 payload 통합 처리 */
  const normalizePicked = useCallback(
    async (payload) => {
      // 1) <input type="file" onChange> 이벤트
      const f1 = payload?.target?.files?.[0];
      if (f1) return persistFileToProject(f1);

      // 2) File 객체 직접
      const f2 = payload?.file instanceof File ? payload.file : payload;
      if (f2 instanceof File) return persistFileToProject(f2);

      // 3) 경로 문자열(or {path,name})
      if (typeof payload === "string") return persistPathToProject(payload);
      if (payload?.path && typeof payload.path === "string") {
        if (/ContentWeaver|projects|assets/i.test(payload.path)) {
          return {
            path: payload.path,
            name: payload.name || basename(payload.path),
            type: payload.type || guessMimeByExt(payload.name || payload.path),
          };
        }
        return persistPathToProject(payload.path);
      }

      return null;
    },
    [persistFileToProject, persistPathToProject]
  );

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

  /** 버튼/파일선택/여러 구현 모두 수용 */
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

  /* ----------------------------- 드래그&드롭 ------------------------------ */
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

  /* ------------------------- 미리보기 URL + 오토플레이 --------------------- */
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
        if (!cancelled) setPreviewUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedScene?.asset?.path]);

  /* ------------------------- 자동 배치 옵션/이벤트 ------------------------- */
  const [autoOpt, setAutoOpt] = useState({
    enabled: false,
    fillEmpty: true,
    keywordMatch: true,
    sequential: true,
    allowOverwrite: false,
  });

  // 최초 로드
  useEffect(() => {
    (async () => {
      try {
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

        const enabled =
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

        setAutoOpt({
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
        });
      } catch (e) {
        console.warn("[ArrangeTab] auto options load failed:", e);
      }
    })();
  }, []);

  // 설정 변경 실시간 반영
  useEffect(() => {
    const off = window.api.onSettingsChanged?.(async ({ key }) => {
      if (
        key === "autoMatch.enabled" ||
        key === "autoMatch.options" ||
        key?.startsWith?.("auto.")
      ) {
        try {
          const [enabledAM, optionsAM] = await Promise.all([
            window.api.getSetting?.("autoMatch.enabled"),
            window.api.getSetting?.("autoMatch.options"),
          ]);
          let opts = {};
          try {
            opts =
              typeof optionsAM === "string"
                ? JSON.parse(optionsAM || "{}")
                : optionsAM || {};
          } catch {
            opts = {};
          }
          const enabled =
            enabledAM === true ||
            enabledAM === "true" ||
            enabledAM === 1 ||
            enabledAM === "1";
          setAutoOpt((prev) => ({
            ...prev,
            enabled,
            fillEmpty:
              opts.emptyOnly != null ? !!opts.emptyOnly : prev.fillEmpty,
            keywordMatch:
              opts.byKeywords != null ? !!opts.byKeywords : prev.keywordMatch,
            sequential: opts.byOrder != null ? !!opts.byOrder : prev.sequential,
            allowOverwrite:
              opts.overwrite != null ? !!opts.overwrite : prev.allowOverwrite,
          }));
        } catch (e) {
          console.warn("[ArrangeTab] settings changed reload failed:", e);
        }
      }
    });
    return () => {
      try {
        off && off();
      } catch {}
    };
  }, []);

  /* ------------------------------ 렌더 ------------------------------------ */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 씬 목록 */}
      <div className="lg:col-span-3">
        <SceneList
          scenes={scenes}
          selected={selectedIdx}
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
        />

        <SectionCard title="씬 미리보기" className="mt-3" bodyClass="relative">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropFile}
            className="w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center"
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
          onPick={handlePickVideo}
          onPickMedia={handlePickVideo}
          onPickSource={handlePickVideo}
          onChangeFit={(fit) => patchScene(selectedIdx, { fit })}
          onToggleKenBurns={(v) => patchScene(selectedIdx, { kenBurns: !!v })}
          onChangeTransition={(name) =>
            patchScene(selectedIdx, { transition: name })
          }
        />
      </div>
    </div>
  );
}
