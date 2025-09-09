import { useState, useRef, useEffect } from "react";
import { validateImageFile, createImagePreview } from "../../../utils/fileUtils";

export const useImageAnalysis = () => {
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const previewUrlRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  
  const [fxLoading, setFxLoading] = useState(false);
  const [fxErr, setFxErr] = useState("");
  const [fxEn, setFxEn] = useState("");
  const [fxKo, setFxKo] = useState("");
  const [fxAnalysis, setFxAnalysis] = useState("");
  const [analysisEngine, setAnalysisEngine] = useState("");

  // 안전한 미리보기 URL 해제
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const onFile = (file) => {
    if (!file) return;

    // 파일 유효성 검사
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    setImageFile(file);

    // 미리보기 URL 생성
    const url = createImagePreview(file, previewUrlRef);
    setImagePreview(url);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    onFile(file);
  };

  const analyzeReference = async (file, prompt = "") => {
    if (!file || !window?.api?.imagefxAnalyze) return;

    try {
      setFxLoading(true);
      setFxErr("");
      setFxEn("");
      setFxKo("");
      setFxAnalysis("");
      setAnalysisEngine("");

      const filePath = file.path || file.name;
      const res = await window.api.imagefxAnalyze({
        filePath,
        description: prompt.trim() || undefined,
      });
      
      if (!res?.ok) throw new Error(res?.message || "analysis_failed");

      const fullText = res.raw || res.text || "";
      setFxAnalysis(fullText);

      try {
        const savedAnalysisEngine = await window.api.getSetting("thumbnailAnalysisEngine");
        const engineName = savedAnalysisEngine === "gemini" ? "Google Gemini 2.5" : "Claude Sonnet 4";
        setAnalysisEngine(engineName);
      } catch (settingError) {
        setAnalysisEngine("Claude Sonnet 4");
      }
    } catch (e) {
      setFxErr(String(e?.message || e));
    } finally {
      setFxLoading(false);
    }
  };

  return {
    imageFile,
    setImageFile,
    imagePreview,
    setImagePreview,
    previewUrlRef,
    dragOver,
    setDragOver,
    fxLoading,
    fxErr,
    fxEn,
    fxKo,
    fxAnalysis,
    analysisEngine,
    setFxEn,
    setFxKo,
    setFxErr,
    setFxAnalysis,
    setAnalysisEngine,
    onFile,
    onDrop,
    analyzeReference,
  };
};