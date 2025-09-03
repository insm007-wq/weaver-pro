// src/hooks/useAutoMatch.js
// -----------------------------------------------------------------------------
// 기존 UI/흐름 유지. 내부 배치만 SSOT runAutoMatch로 수행.
// - 설정 키: autoMatch.enabled / autoMatch.options (+ legacy auto.*) 그대로
// - 다운로드 이벤트(onFileDownloaded), __autoPlaceQueue 드레인 그대로
// - scenes 구조는 그대로 유지: { asset: { type, path }, fileName, ... }
// -----------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from "react";
import runAutoMatch, { DEFAULT_OPTS } from "../utils/autoMatchEngine";
import { basename, extname, guessMimeByExt, stripExt } from "../utils/media";
import { sceneTextBlob } from "../utils/scenes";

function toEngineScenes(prevScenes) {
  // 엔진은 { id, text, assetId }만 보면 되므로 최소화
  return prevScenes.map((sc, i) => ({
    id: sc.id ?? `idx:${i}`,
    text: sceneTextBlob(sc),
    assetId: sc?.asset?.path || null, // path를 고유 id처럼 사용
  }));
}

function tokensFromFileName(name = "") {
  const base = stripExt(basename(name));
  // _, -, 공백 분리 + 소문자
  return base
    .split(/[_\-\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function toEngineAssets(items) {
  // items: { path, fileName, keywords? }[]
  return (items || [])
    .filter((it) => it?.path)
    .map((it) => {
      const fileName = it.fileName || basename(it.path);
      // 태그/키워드는 파일명 기반 토큰 + 주어진 키워드 병합
      const fromName = tokensFromFileName(fileName);
      const given = Array.isArray(it.keywords) ? it.keywords : [];
      const tags = Array.from(new Set([...fromName, ...given]));
      return {
        id: it.path, // path를 엔진의 id로 사용
        tags, // 가벼운 토큰
        keywords: given, // 원본 키워드도 보존
        _fileName: fileName, // 매핑용 메타
      };
    });
}

function applyEngine(prevScenes, assets, opts) {
  if (!assets?.length) return prevScenes;

  const engineInput = {
    scenes: toEngineScenes(prevScenes),
    assets: toEngineAssets(assets),
    opts,
  };
  const assetMap = new Map(engineInput.assets.map((a) => [a.id, a]));

  const { scenes: result } = runAutoMatch(engineInput);

  // 엔진 결과를 기존 씬 구조로 반영
  const next = prevScenes.map((sc, i) => {
    const beforePath = sc?.asset?.path || null;
    const afterId = result[i]?.assetId || null;
    if (!afterId || afterId === beforePath) return sc;

    const a = assetMap.get(afterId);
    const fileName = a?._fileName || (afterId ? basename(afterId) : "");
    const kind = (guessMimeByExt(fileName) || "").startsWith("image") ? "image" : "video";

    return {
      ...sc,
      fileName,
      asset: { ...(sc.asset || {}), type: kind, path: afterId },
    };
  });

  return next;
}

export function useAutoMatch({ commitScenes }) {
  const [autoOpt, setAutoOpt] = useState({
    enabled: false,
    fillEmpty: true,
    keywordMatch: true,
    sequential: true,
    allowOverwrite: false,
  });

  const loadedRef = useRef(false);

  // 옵션 로딩 (기존 키 유지)
  useEffect(() => {
    (async () => {
      try {
        const [enabledAM, optionsAM, enabledOld, fill, kw, seq, over] = await Promise.all([
          window.api.getSetting?.("autoMatch.enabled"),
          window.api.getSetting?.("autoMatch.options"),
          window.api.getSetting?.("auto.enabled"),
          window.api.getSetting?.("auto.fillEmpty"),
          window.api.getSetting?.("auto.keywordMatch"),
          window.api.getSetting?.("auto.sequential"),
          window.api.getSetting?.("auto.allowOverwrite"),
        ]);

        const enabled = enabledAM === true || enabledAM === "true" || enabledAM === 1 || enabledAM === "1" || !!enabledOld;

        let opts = {};
        try {
          opts = typeof optionsAM === "string" ? JSON.parse(optionsAM || "{}") : optionsAM || {};
        } catch {}

        setAutoOpt({
          enabled,
          fillEmpty: opts.emptyOnly != null ? !!opts.emptyOnly : fill != null ? fill !== false : true,
          keywordMatch: opts.byKeywords != null ? !!opts.byKeywords : !!kw || false,
          sequential: opts.byOrder != null ? !!opts.byOrder : seq !== false,
          allowOverwrite: opts.overwrite != null ? !!opts.overwrite : !!over || false,
        });
        loadedRef.current = true;
      } catch (e) {
        console.warn("[useAutoMatch] load failed:", e);
      }
    })();
  }, []);

  // 설정 변경 수신
  useEffect(() => {
    const off = window.api.onSettingsChanged?.(async ({ key }) => {
      if (key === "autoMatch.enabled" || key === "autoMatch.options" || key?.startsWith?.("auto.")) {
        try {
          const [enabledAM, optionsAM] = await Promise.all([
            window.api.getSetting?.("autoMatch.enabled"),
            window.api.getSetting?.("autoMatch.options"),
          ]);
          let opts = {};
          try {
            opts = typeof optionsAM === "string" ? JSON.parse(optionsAM || "{}") : optionsAM || {};
          } catch {}
          const enabled = enabledAM === true || enabledAM === "true" || enabledAM === 1 || enabledAM === "1";
          setAutoOpt((prev) => ({
            ...prev,
            enabled,
            fillEmpty: opts.emptyOnly != null ? !!opts.emptyOnly : prev.fillEmpty,
            keywordMatch: opts.byKeywords != null ? !!opts.byKeywords : prev.keywordMatch,
            sequential: opts.byOrder != null ? !!opts.byOrder : prev.sequential,
            allowOverwrite: opts.overwrite != null ? !!opts.overwrite : prev.allowOverwrite,
          }));
        } catch (e) {
          console.warn("[useAutoMatch] settings reload failed:", e);
        }
      }
    });
    return () => {
      try {
        off && off();
      } catch {}
    };
  }, []);

  // 엔진 옵션 매핑 (기존 스위치 ↔ 엔진 옵션)
  const buildEngineOpts = useCallback(
    () => ({
      ...DEFAULT_OPTS,
      emptyOnly: autoOpt.fillEmpty,
      byKeywords: autoOpt.keywordMatch,
      byOrder: autoOpt.sequential,
      overwrite: autoOpt.allowOverwrite,
      // 나머지는 DEFAULT_OPTS 유지 (재사용/연속중복/최소스코어 등)
    }),
    [autoOpt]
  );

  // 자산 목록으로 엔진 실행 → 씬 갱신
  const applyWithAssets = useCallback(
    (assets) => {
      if (!autoOpt.enabled || !assets?.length) return;
      const engineOpts = buildEngineOpts();
      commitScenes((prev) => applyEngine(prev, assets, engineOpts));
    },
    [autoOpt.enabled, buildEngineOpts, commitScenes]
  );

  // 다운로드/큐 바인딩 (ArrangeTab에서 1회 호출)
  const wireAutoPlacement = useCallback(() => {
    if (!loadedRef.current) return;

    // 1) 초기 큐 드레인
    const q = window.__autoPlaceQueue;
    if (autoOpt.enabled && Array.isArray(q) && q.length) {
      const items = q.splice(0, q.length);
      applyWithAssets(items);
    }

    // 2) 파일 다운로드 이벤트
    const off = window.api.onFileDownloaded?.((payload) => {
      if (!payload?.path) return;
      const fileName = payload.fileName || basename(payload.path);
      applyWithAssets([{ path: payload.path, fileName, keywords: payload.keywords }]);
    });

    return () => {
      try {
        off && off();
      } catch {}
    };
  }, [autoOpt.enabled, applyWithAssets]);

  // (선택) 외부에서 직접 배치 호출이 필요하면 노출
  const placeManyAssets = useCallback((items) => applyWithAssets(items), [applyWithAssets]);

  return {
    autoOpt,
    wireAutoPlacement,
    placeManyAssets,
  };
}
