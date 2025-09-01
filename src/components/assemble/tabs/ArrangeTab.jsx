// src/components/assemble/tabs/ArrangeTab.jsx
// -----------------------------------------------------------------------------
//   배치 & 타임라인 탭 (자동 배치/놓친 이벤트 복구 + 수동 교체 보강)
//   - UI/레이아웃 변경 없음
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
      type: sc?.asset?.type || null,
      path: sc?.asset?.path || null,
      ...sc?.asset,
    },
  };
}
const basename = (p = "") => String(p).split(/[\\/]/).pop();
const stripExt = (n = "") => String(n).replace(/\.[^.]+$/, "");
const extname = (n = "") => (/\.[^.]+$/.exec(n)?.[0] || "").toLowerCase();
/** 파일명 → 키워드 첫 토큰(언더스코어/하이픈/스페이스 기준) */
const keywordFromFileName = (name = "") =>
  (
    decodeURIComponent(stripExt(basename(name))).split(/[_\-\s]+/)[0] || ""
  ).trim();
const sceneTextBlob = (sc) => {
  const list = [];
  if (Array.isArray(sc?.keywords)) list.push(sc.keywords.join(" "));
  if (sc?.text) list.push(sc.text);
  if (sc?.title) list.push(sc.title);
  if (sc?.hint) list.push(sc.hint);
  return list.join(" ").toLowerCase();
};
const isOccupied = (sc) => !!sc?.asset?.path;
const guessMimeByExt = (name = "") =>
  /\.(png|jpg|jpeg|gif|webp|bmp)$/i.test(extname(name)) ? "image/*" : "video/*";

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

  /* ------------------------- 로컬 파일 → 프로젝트 저장 -------------------- */
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

  /** 경로 문자열(or {path}) → 읽어서 프로젝트에 복사 저장 (readBinary → base64 디코드) */
  const persistPathToProject = useCallback(async (pathStrOrObj) => {
    const p =
      typeof pathStrOrObj === "string" ? pathStrOrObj : pathStrOrObj?.path;
    if (!p) throw new Error("invalid_path");
    // 프로젝트 내부면 그대로 사용
    if (/ContentWeaver|projects|assets/i.test(p)) {
      const name = basename(p);
      return { path: p, name, type: guessMimeByExt(name) };
    }
    // 외부 경로 → base64 수신 → 바이트로 변환 → 프로젝트 저장
    const r = await window.api.readBinary?.(p);
    if (!r?.ok || !r?.data) throw new Error(r?.message || "read_failed");
    const b64 = r.data;
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); // ← 중요
    const name = basename(p) || `asset_${Date.now()}`;
    const res = await window.api.saveBufferToProject?.({
      category: "assets",
      fileName: name,
      buffer: bin,
    });
    if (!res?.ok || !res?.path) throw new Error(res?.message || "save_failed");
    return { path: res.path, name, type: guessMimeByExt(name) };
  }, []);

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

  const normalizePicked = useCallback(
    async (payload) => {
      const f1 = payload?.target?.files?.[0];
      if (f1) return persistFileToProject(f1);
      const f2 = payload?.file instanceof File ? payload.file : payload;
      if (f2 instanceof File) return persistFileToProject(f2);
      if (
        typeof payload === "string" ||
        (payload?.path && typeof payload.path === "string")
      ) {
        return persistPathToProject(payload);
      }
      return null;
    },
    [persistFileToProject, persistPathToProject]
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

  /* ------------------------- 미리보기 URL + 오토플레이 --------------------- */
  const [previewUrl, setPreviewUrl] = useState(null);
  const previewVideoRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = selectedScene?.asset?.path;
        if (!p) return setPreviewUrl(null);
        const url = await window.api.videoPathToUrl(p);
        if (!cancelled) setPreviewUrl(url);
        const v = previewVideoRef.current;
        if (v) {
          v.muted = true;
          const play = () => v.play().catch(() => {});
          if (v.readyState >= 2) play();
          else v.addEventListener("canplay", play, { once: true });
        }
      } catch {
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

  // 최초 로드(Setup에서 저장한 키 사용: autoMatch.enabled / autoMatch.options)
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
        } catch {}
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

  // 설정 변경 실시간 반영(있으면)
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
          } catch {}
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

  /* ----------------------- 순수 함수: 1건 배치 ----------------------------- */
  function placeInto(draft, { filePath, fileName, mimeHint = "" }) {
    if (!autoOpt.enabled) return draft;
    const kind = mimeHint.startsWith("image") ? "image" : "video";
    const kw = autoOpt.keywordMatch ? keywordFromFileName(fileName) : "";
    const indices = draft.map((_, i) => i);
    const order = autoOpt.sequential ? indices : indices;

    // 1) 키워드 매칭
    if (autoOpt.keywordMatch && kw) {
      for (const i of order) {
        const sc = draft[i];
        const occupied = isOccupied(sc);
        if (autoOpt.fillEmpty && occupied && !autoOpt.allowOverwrite) continue;
        if (sceneTextBlob(sc).includes(kw.toLowerCase())) {
          const next = draft.slice();
          next[i] = {
            ...sc,
            fileName,
            asset: { ...(sc.asset || {}), type: kind, path: filePath },
          };
          return next;
        }
      }
    }
    // 2) 첫 빈 칸(또는 덮어쓰기 허용 시 첫 장)
    for (const i of order) {
      const sc = draft[i];
      const occupied = isOccupied(sc);
      if (autoOpt.fillEmpty && occupied && !autoOpt.allowOverwrite) continue;
      const next = draft.slice();
      next[i] = {
        ...sc,
        fileName,
        asset: { ...(sc.asset || {}), type: kind, path: filePath },
      };
      return next;
    }
    return draft; // 못 놓았으면 그대로
  }

  const placeOneAsset = useCallback(
    (filePath, fileName, mimeHint = "") => {
      commitScenes((prev) => placeInto(prev, { filePath, fileName, mimeHint }));
    },
    [commitScenes, autoOpt]
  );

  const placeManyAssets = useCallback(
    (items) => {
      if (!items?.length) return;
      commitScenes((prev) => {
        let next = prev;
        for (const it of items) {
          if (!it?.path) continue;
          const name = it.fileName || basename(it.path);
          next = placeInto(next, {
            filePath: it.path,
            fileName: name,
            mimeHint: "",
          });
        }
        return next;
      });
    },
    [commitScenes, autoOpt]
  );

  // 놓친 파일 재배치: 자동 매칭이 켜지는 순간 큐를 한 번에 비움
  useEffect(() => {
    if (!autoOpt.enabled) return;
    const q = window.__autoPlaceQueue;
    if (Array.isArray(q) && q.length) {
      const items = q.splice(0, q.length);
      dlog("queue drained", items.length);
      placeManyAssets(items);
    }
  }, [autoOpt.enabled, placeManyAssets]);

  // 실시간: 새로 저장된 파일 이벤트 → 단건 배치
  useEffect(() => {
    const off = window.api.onFileDownloaded?.((payload) => {
      if (!payload?.path) return;
      const name = payload.fileName || basename(payload.path);
      placeOneAsset(payload.path, name, "");
    });
    return () => {
      try {
        off && off();
      } catch {}
    };
  }, [placeOneAsset]);

  /* -------------------------------- 렌더 --------------------------------- */
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
            {selectedScene?.asset?.path ? (
              <video
                ref={previewVideoRef}
                className="w-full h-full"
                src={previewUrl || ""}
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
