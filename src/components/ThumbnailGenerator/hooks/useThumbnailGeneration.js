import { useState, useEffect } from "react";
import { QUALITY_PRESETS, DEFAULT_PROMPT_KEYWORDS } from "../../../constants/thumbnailConstants";

export const useThumbnailGeneration = () => {
  const [provider, setProvider] = useState("replicate");
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(1);
  const [qualityPreset, setQualityPreset] = useState("balanced");
  const [mode, setMode] = useState("dramatic");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [usedPrompt, setUsedPrompt] = useState("");
  const [tookMs, setTookMs] = useState(null);
  const [metaTemplate, setMetaTemplate] = useState("");
  const [templateLoading, setTemplateLoading] = useState(true);

  // 템플릿 로드
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTemplate, savedEngine] = await Promise.all([
          window.api.getSetting("thumbnailPromptTemplate"),
          window.api.getSetting("thumbnailDefaultEngine"),
        ]);

        setMetaTemplate(savedTemplate || "");
        if (savedEngine) {
          setProvider(savedEngine);
        }
      } catch (error) {
        console.error("설정 로드 실패:", error);
        setMetaTemplate("");
      } finally {
        setTemplateLoading(false);
      }
    };
    loadSettings();
  }, []);

  // 설정 변경 감지
  useEffect(() => {
    const handleSettingsChanged = (payload) => {
      if (payload?.key === "thumbnailPromptTemplate") {
        setMetaTemplate(payload.value || "");
      } else if (payload?.key === "thumbnailDefaultEngine") {
        setProvider(payload.value || "replicate");
      }
    };

    if (window.api.onSettingsChanged) {
      const unsubscribe = window.api.onSettingsChanged(handleSettingsChanged);
      return unsubscribe;
    }
  }, []);

  // 최종 프롬프트 생성
  const buildFinalPrompt = (referenceAnalysis = "") => {
    const base = prompt.trim();
    
    if (provider === "gemini") {
      const core = (metaTemplate || "")
        .replace(/{content}/g, base)
        .replace(/{referenceAnalysis}/g, referenceAnalysis)
        .trim();
      return core;
    }

    // Replicate
    let core = (metaTemplate || "")
      .replace(/{content}/g, base)
      .replace(/{referenceAnalysis}/g, referenceAnalysis)
      .trim();

    if (!core) core = base;

    const { common, dramatic, calm } = DEFAULT_PROMPT_KEYWORDS;
    const mood = mode === "dramatic" ? dramatic : calm;

    return `${core}\n\n${[...common, ...mood].join(", ")}`;
  };

  // 예상 시간 계산
  const calculateEstimatedTime = () => {
    const preset = QUALITY_PRESETS.find(p => p.value === qualityPreset);
    const baseTime = preset ? preset.steps * 0.5 : 15;
    return baseTime * count;
  };

  return {
    provider,
    setProvider,
    prompt,
    setPrompt,
    count,
    setCount,
    qualityPreset,
    setQualityPreset,
    mode,
    setMode,
    aspectRatio,
    setAspectRatio,
    loading,
    setLoading,
    results,
    setResults,
    usedPrompt,
    setUsedPrompt,
    tookMs,
    setTookMs,
    metaTemplate,
    templateLoading,
    buildFinalPrompt,
    calculateEstimatedTime,
  };
};