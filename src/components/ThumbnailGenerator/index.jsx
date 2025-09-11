import React from "react";
import { MessageBar, MessageBarBody, Title1, Body1, Button, Badge, Caption1 } from "@fluentui/react-components";
import { SparkleRegular } from "@fluentui/react-icons";
import { tokens } from "@fluentui/react-components";
import { ErrorBoundary } from "../common/ErrorBoundary";

// Components
import SceneInput from "./SceneInput";
import ReferenceImageUpload from "./ReferenceImageUpload";
import GenerationControls from "./GenerationControls";
import ProgressDisplay from "./ProgressDisplay";
import ResultsDisplay from "./ResultsDisplay";
import { StandardCard } from "../common";

// Hooks
import { useThumbnailGeneration } from "./hooks/useThumbnailGeneration";
import { useImageAnalysis } from "./hooks/useImageAnalysis";
import { useProgressTracking } from "../../hooks/useProgressTracking";

// Utils
const createErrorToast = (text, type = 'error') => ({ type: 'error', text });

// Styles
import styles from "./ThumbnailGenerator.module.css";

function ThumbnailGenerator() {
  // Custom hooks
  const thumbnailGeneration = useThumbnailGeneration();
  const imageAnalysis = useImageAnalysis();
  const progressTracking = useProgressTracking();

  // Generation handler
  const onGenerate = async () => {
    if (thumbnailGeneration.templateLoading) {
      progressTracking.setToast(createErrorToast("템플릿을 로딩 중입니다. 잠시 후 다시 시도하세요.", "initialization"));
      return;
    }

    // Validation
    if (thumbnailGeneration.provider === "replicate" && 
        !thumbnailGeneration.prompt.trim() && 
        !imageAnalysis.fxAnalysis.trim() && 
        !thumbnailGeneration.metaTemplate.trim()) {
      progressTracking.setToast(createErrorToast("장면 설명 또는 템플릿/분석 결과 중 하나는 필요합니다.", "validation"));
      return;
    }

    // IPC guards
    const hasReplicate = !!window?.api?.generateThumbnails;
    const hasGemini = !!window?.api?.generateThumbnailsGemini;
    
    if (thumbnailGeneration.provider === "replicate" && !hasReplicate) {
      progressTracking.setToast(createErrorToast("Replicate 서비스를 사용할 수 없습니다.", "service"));
      return;
    }
    
    if (thumbnailGeneration.provider === "gemini" && !hasGemini) {
      progressTracking.setToast(createErrorToast("Gemini 서비스를 사용할 수 없습니다.", "service"));
      return;
    }

    // Clear cache
    try {
      await window.api.clearCache();
    } catch (error) {
      console.warn("캐시 삭제 실패:", error);
    }

    thumbnailGeneration.setLoading(true);
    thumbnailGeneration.setResults([]);
    thumbnailGeneration.setTookMs(null);
    
    const estimatedTime = thumbnailGeneration.calculateEstimatedTime();
    progressTracking.startProgress(estimatedTime);
    progressTracking.updateProgress("generating", 0, thumbnailGeneration.count);

    try {
      const started = Date.now();
      const finalPrompt = thumbnailGeneration.buildFinalPrompt(imageAnalysis.fxAnalysis);
      thumbnailGeneration.setUsedPrompt(finalPrompt);

      let res;
      if (thumbnailGeneration.provider === "gemini") {
        progressTracking.updateProgress("generating", 0, thumbnailGeneration.count, "Gemini API 초기화 중...");
        
        const geminiApiKey = await window.api.getSecret("geminiKey");
        if (!geminiApiKey?.trim()) {
          throw new Error("Gemini API 키가 설정되지 않았습니다.");
        }

        progressTracking.updateProgress("generating", 1, thumbnailGeneration.count, `${thumbnailGeneration.count}개 썸네일 생성 중...`);
        
        res = await window.api.generateThumbnailsGemini({
          prompt: finalPrompt,
          count: thumbnailGeneration.count,
          aspectRatio: thumbnailGeneration.aspectRatio,
          apiKey: geminiApiKey,
        });
      } else {
        progressTracking.updateProgress("generating", 0, thumbnailGeneration.count, "Replicate API 초기화 중...");
        progressTracking.updateProgress("generating", 1, thumbnailGeneration.count, `${thumbnailGeneration.count}개 썸네일 생성 중...`);
        
        res = await window.api.generateThumbnails({
          prompt: finalPrompt,
          count: thumbnailGeneration.count,
          mode: thumbnailGeneration.mode,
        });
      }

      if (!res?.ok) {
        throw new Error(res?.message || "생성 실패");
      }

      const urls = Array.isArray(res.images) ? res.images : [];
      
      progressTracking.updateProgress("processing", thumbnailGeneration.count, thumbnailGeneration.count, "결과 처리 중...");
      thumbnailGeneration.setResults(urls.map(u => ({ url: u })));
      thumbnailGeneration.setTookMs(Date.now() - started);
      
      progressTracking.updateProgress("completed", thumbnailGeneration.count, thumbnailGeneration.count);
      setTimeout(() => progressTracking.resetProgress(), 3000);
    } catch (e) {
      console.error("썸네일 생성 실패:", e);
      
      let errorMessage = e?.message || "알 수 없는 오류가 발생했습니다.";
      
      // Error message mapping
      if (errorMessage.includes("402") && errorMessage.includes("credit")) {
        errorMessage = "💳 크레딧이 부족합니다. 크레딧을 충전하거나 다른 AI 엔진을 선택해주세요.";
      } else if (errorMessage.includes("401") || errorMessage.includes("403")) {
        errorMessage = "🔑 API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.";
      } else if (errorMessage.includes("429")) {
        errorMessage = "⏱️ API 사용 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
      }
      
      progressTracking.setToast({
        type: "error",
        text: `생성 실패: ${errorMessage}`,
      });
    } finally {
      thumbnailGeneration.setLoading(false);
      progressTracking.resetProgress();
    }
  };

  // Auto-analyze on image upload
  const handleFileUpload = (file) => {
    imageAnalysis.onFile(file);
    if (file) {
      imageAnalysis.analyzeReference(file, thumbnailGeneration.prompt);
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast */}
      <div className={styles.toastContainer}>
        {progressTracking.toast && (
          <MessageBar intent={progressTracking.toast.type === "success" ? "success" : "error"}>
            <MessageBarBody>
              {progressTracking.toast.type === "success" ? "✅" : "❌"} {progressTracking.toast.text}
            </MessageBarBody>
          </MessageBar>
        )}
      </div>

      {/* Hero Section */}
      <div className={styles.heroSection}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "12px", 
            marginBottom: "16px" 
          }}>
            <div style={{ 
              background: "rgba(255,255,255,0.2)",
              borderRadius: "12px",
              padding: "12px",
              backdropFilter: "blur(10px)"
            }}>
              <SparkleRegular style={{ fontSize: "32px" }} />
            </div>
            <Title1 style={{ fontSize: "48px", fontWeight: "700", margin: 0 }}>
              썸네일 생성기
            </Title1>
          </div>
          <Body1 style={{ 
            fontSize: "18px", 
            opacity: 0.9, 
            maxWidth: "600px", 
            margin: "0 auto" 
          }}>
            AI 기반 YouTube 썸네일 생성 도구로 몇 초 만에 전문가급 썸네일을 만들어보세요
          </Body1>
        </div>
      </div>

      {/* Main Workspace */}
      <div className={styles.workspaceGrid}>
        {/* Control Panel */}
        <div className={styles.controlPanel}>
          <SceneInput 
            prompt={thumbnailGeneration.prompt}
            setPrompt={thumbnailGeneration.setPrompt}
            provider={thumbnailGeneration.provider}
          />
          
          <GenerationControls
            count={thumbnailGeneration.count}
            setCount={thumbnailGeneration.setCount}
            qualityPreset={thumbnailGeneration.qualityPreset}
            setQualityPreset={thumbnailGeneration.setQualityPreset}
            provider={thumbnailGeneration.provider}
            mode={thumbnailGeneration.mode}
            setMode={thumbnailGeneration.setMode}
            aspectRatio={thumbnailGeneration.aspectRatio}
            setAspectRatio={thumbnailGeneration.setAspectRatio}
          />

          {/* Generate Button */}
          <StandardCard variant="glass" hover={false}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between", 
              marginBottom: tokens.spacingVerticalM 
            }}>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                생성 엔진:
              </Caption1>
              <Badge appearance="filled" color="brand" size="medium">
                {thumbnailGeneration.provider === "replicate" 
                  ? "Replicate (Flux)" 
                  : "Google Gemini (Imagen 3)"}
              </Badge>
            </div>
            
            <ProgressDisplay 
              loading={thumbnailGeneration.loading}
              fxLoading={imageAnalysis.fxLoading}
              progress={progressTracking.progress}
              remainingTime={progressTracking.remainingTime}
            />
            
            <Button
              appearance="primary"
              size="large"
              onClick={onGenerate}
              disabled={thumbnailGeneration.loading || imageAnalysis.fxLoading}
              style={{
                width: "100%",
                height: "56px",
                fontSize: tokens.fontSizeBase400,
                fontWeight: tokens.fontWeightSemibold,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: tokens.spacingHorizontalS,
                marginTop: (thumbnailGeneration.loading || imageAnalysis.fxLoading) 
                  ? tokens.spacingVerticalM : 0,
                background: (thumbnailGeneration.loading || imageAnalysis.fxLoading)
                  ? tokens.colorNeutralBackground3
                  : "linear-gradient(135deg, #0078d4 0%, #106ebe 100%)",
                boxShadow: (thumbnailGeneration.loading || imageAnalysis.fxLoading)
                  ? "none"
                  : "0 4px 16px rgba(0, 120, 212, 0.3)",
                transition: "all 0.3s ease",
              }}
            >
              {thumbnailGeneration.loading || imageAnalysis.fxLoading ? (
                <>
                  <div style={{ 
                    width: "20px", 
                    height: "20px", 
                    border: "2px solid #ccc",
                    borderTop: "2px solid #0078d4",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite"
                  }} />
                  {imageAnalysis.fxLoading ? "분석 중..." : "생성 중..."}
                </>
              ) : (
                <>
                  <SparkleRegular />
                  🎨 썸네일 생성하기
                </>
              )}
            </Button>
          </StandardCard>
        </div>

        {/* Canvas Area */}
        <div className={styles.canvasArea}>
          <ReferenceImageUpload
            imageFile={imageAnalysis.imageFile}
            setImageFile={imageAnalysis.setImageFile}
            imagePreview={imageAnalysis.imagePreview}
            setImagePreview={imageAnalysis.setImagePreview}
            previewUrlRef={imageAnalysis.previewUrlRef}
            dragOver={imageAnalysis.dragOver}
            setDragOver={imageAnalysis.setDragOver}
            onFile={handleFileUpload}
            onDrop={imageAnalysis.onDrop}
            analyzeReference={imageAnalysis.analyzeReference}
            fxLoading={imageAnalysis.fxLoading}
            fxErr={imageAnalysis.fxErr}
            fxAnalysis={imageAnalysis.fxAnalysis}
            analysisEngine={imageAnalysis.analysisEngine}
            setFxEn={imageAnalysis.setFxEn}
            setFxKo={imageAnalysis.setFxKo}
            setFxErr={imageAnalysis.setFxErr}
            setFxAnalysis={imageAnalysis.setFxAnalysis}
            setAnalysisEngine={imageAnalysis.setAnalysisEngine}
            remainingTime={progressTracking.remainingTime}
          />
          
          <ResultsDisplay
            results={thumbnailGeneration.results}
            tookMs={thumbnailGeneration.tookMs}
            provider={thumbnailGeneration.provider}
            setToast={progressTracking.setToast}
          />
        </div>
      </div>
    </div>
  );
}

export default function ThumbnailGeneratorWithErrorBoundary() {
  return (
    <ErrorBoundary variant="default" showDetails={true}>
      <ThumbnailGenerator />
    </ErrorBoundary>
  );
}