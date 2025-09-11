import { useState, useRef, useEffect } from "react";
import { validateImageFile, createImagePreview } from "@utils";
import { handleError, handleApiError } from "@utils";

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
      const { message } = handleError(
        new Error("file_validation_failed"), 
        "image_analysis",
        { customMessage: validation.error }
      );
      alert(message);
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

      // 분석 전에 현재 설정된 엔진 확인 및 표시
      let currentEngine = "Claude Sonnet 4"; // 기본값
      try {
        const savedAnalysisEngine = await window.api.getSetting("thumbnailAnalysisEngine");
        console.log("[이미지 분석] 설정된 엔진:", savedAnalysisEngine);
        
        if (savedAnalysisEngine === "gemini") {
          currentEngine = "Google Gemini 2.5 Flash";
        } else if (savedAnalysisEngine === "gemini-pro") {
          currentEngine = "Google Gemini 2.5 Pro";
        } else if (savedAnalysisEngine === "gemini-lite") {
          currentEngine = "Google Gemini 2.5 Flash Lite";
        } else {
          currentEngine = "Claude Sonnet 4";
        }
      } catch (settingError) {
        console.warn("[이미지 분석] 설정 읽기 실패:", settingError);
      }
      
      setAnalysisEngine(currentEngine);

      const filePath = file.path || file.name;
      console.log("[이미지 분석] 분석 시작:", { filePath, engine: currentEngine });
      
      const res = await window.api.imagefxAnalyze({
        filePath,
        description: prompt.trim() || undefined,
      });
      
      console.log("[이미지 분석] 결과:", res?.ok ? "성공" : "실패", res?.message);
      
      if (!res?.ok) throw new Error(res?.message || "analysis_failed");

      const fullText = res.raw || res.text || "";
      setFxAnalysis(fullText);
      
    } catch (e) {
      console.error("[이미지 분석] 오류:", e);
      
      // Use centralized error handling for image analysis
      const { message } = handleApiError(e, "image_analysis", {
        metadata: { 
          engine: currentEngine,
          filePath: filePath || "unknown",
          hasPrompt: !!prompt.trim()
        }
      });
      
      setFxErr(message);
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