// src/hooks/useAutoMatch.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_OPTS = Object.freeze({
  emptyOnly: true,
  byKeywords: true,
  byOrder: true,
  overwrite: false,
});

function normalizeBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

export default function useAutoMatch(pollMs = 1200) {
  const [enabled, setEnabled] = useState(false);
  const [options, setOptions] = useState(DEFAULT_OPTS);

  const lastRef = useRef({ en: undefined, opts: undefined });
  const unsubsRef = useRef([]);

  // ---- 초기 로드 ----
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const en = await window.api.getSetting?.("autoMatch.enabled");
        const raw = await window.api.getSetting?.("autoMatch.options");
        const parsed =
          typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
        if (!mounted) return;

        const normEn = normalizeBool(en);
        const normOpts = { ...DEFAULT_OPTS, ...(parsed || {}) };

        setEnabled(normEn);
        setOptions(normOpts);
        lastRef.current = { en: normEn, opts: normOpts };

        console.log("[useAutoMatch] init", {
          enabled: normEn,
          options: normOpts,
        });
      } catch (e) {
        console.warn("[useAutoMatch] load fail:", e);
      }
    })();

    // ---- settings:changed 브로드캐스트 구독 ----
    const off =
      window.api.onSettingsChanged?.(({ key, value }) => {
        if (key === "autoMatch.enabled") {
          const norm = normalizeBool(value);
          setEnabled(norm);
          lastRef.current.en = norm;
          console.log("[useAutoMatch] changed via broadcast -> enabled:", norm);
        } else if (key === "autoMatch.options") {
          try {
            const parsed =
              typeof value === "string" ? JSON.parse(value) : value || {};
            const norm = { ...DEFAULT_OPTS, ...(parsed || {}) };
            setOptions(norm);
            lastRef.current.opts = norm;
            console.log(
              "[useAutoMatch] changed via broadcast -> options:",
              norm
            );
          } catch (err) {
            console.warn("[useAutoMatch] parse broadcast options fail:", err);
          }
        }
      }) || null;
    if (off) unsubsRef.current.push(off);

    // ---- 브로드캐스트가 없다면 폴링으로 변동 감지 ----
    let pollTimer = null;
    if (!off && pollMs > 0) {
      pollTimer = setInterval(async () => {
        try {
          const en = await window.api.getSetting?.("autoMatch.enabled");
          const raw = await window.api.getSetting?.("autoMatch.options");
          const parsed =
            typeof raw === "string" ? JSON.parse(raw || "{}") : raw || {};
          const normEn = normalizeBool(en);
          const normOpts = { ...DEFAULT_OPTS, ...(parsed || {}) };

          if (lastRef.current.en !== normEn) {
            setEnabled(normEn);
            lastRef.current.en = normEn;
            console.log("[useAutoMatch] pollChanged -> enabled:", normEn);
          }
          if (
            JSON.stringify(lastRef.current.opts || {}) !==
            JSON.stringify(normOpts)
          ) {
            setOptions(normOpts);
            lastRef.current.opts = normOpts;
            console.log("[useAutoMatch] pollChanged -> options:", normOpts);
          }
        } catch (e) {
          // ignore
        }
      }, pollMs);
    }

    return () => {
      mounted = false;
      unsubsRef.current.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      unsubsRef.current = [];
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [pollMs]);

  // ---- 즉시 저장 세터 ----
  const setEnabledAndSave = useCallback((next) => {
    const v = !!next;
    setEnabled(v);
    window.api.setSetting?.({ key: "autoMatch.enabled", value: v });
    lastRef.current.en = v;
    console.log("[useAutoMatch] setEnabled ->", v);
  }, []);

  const setOptionAndSave = useCallback((key, value) => {
    setOptions((prev) => {
      const next = { ...DEFAULT_OPTS, ...(prev || {}), [key]: !!value };
      window.api.setSetting?.({
        key: "autoMatch.options",
        value: JSON.stringify(next),
      });
      lastRef.current.opts = next;
      console.log(
        "[useAutoMatch] setOption ->",
        key,
        "=",
        !!value,
        " | next:",
        next
      );
      return next;
    });
  }, []);

  const setOptionsAndSave = useCallback((partial) => {
    setOptions((prev) => {
      const next = { ...DEFAULT_OPTS, ...(prev || {}), ...(partial || {}) };
      window.api.setSetting?.({
        key: "autoMatch.options",
        value: JSON.stringify(next),
      });
      lastRef.current.opts = next;
      console.log(
        "[useAutoMatch] setOptions(partial) ->",
        partial,
        " | next:",
        next
      );
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      enabled,
      setEnabled: setEnabledAndSave,
      options,
      setOption: setOptionAndSave,
      setOptions: setOptionsAndSave,
    }),
    [enabled, options, setEnabledAndSave, setOptionAndSave, setOptionsAndSave]
  );
}
