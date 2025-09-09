import { useRef } from "react";
import { Field, Label, Button, Body1, Caption1, Card, Title3, Badge, Body2, Spinner } from "@fluentui/react-components";
import { ImageRegular, DeleteRegular, DismissCircleRegular } from "@fluentui/react-icons";
import { tokens } from "@fluentui/react-components";
import { MAX_UPLOAD_MB } from "../../constants/thumbnailConstants";
import { validateImageFile, createImagePreview, safeRevokeObjectURL } from "../../utils/fileUtils";
import GlassCard from "../ui/GlassCard";

const ReferenceImageUpload = ({ 
  imageFile, 
  setImageFile, 
  imagePreview, 
  setImagePreview,
  previewUrlRef,
  dragOver,
  setDragOver,
  onFile,
  onDrop,
  analyzeReference,
  fxLoading,
  fxErr,
  fxAnalysis,
  analysisEngine,
  setFxEn,
  setFxKo,
  setFxErr,
  setFxAnalysis,
  setAnalysisEngine,
  remainingTime
}) => {
  const fileInputRef = useRef(null);
  const onPickFile = () => fileInputRef.current?.click();

  return (
    <GlassCard title="참고 이미지 (선택사항)" icon={<ImageRegular />}>
      <Field>
        
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={onPickFile}
          style={{
            border: "2px dashed rgba(102, 126, 234, 0.3)",
            borderRadius: "20px",
            padding: "32px",
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            minHeight: "320px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            background: "linear-gradient(145deg, rgba(255,255,255,0.8) 0%, rgba(248,250,252,0.9) 100%)",
            backdropFilter: "blur(10px)",
            ...(dragOver && {
              borderColor: "rgba(102, 126, 234, 0.6)",
              background: "linear-gradient(145deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)",
              transform: "translateY(-2px) scale(1.01)",
              boxShadow: "0 12px 24px rgba(102, 126, 234, 0.15)",
            })
          }}
        >
          {imagePreview ? (
            <div style={{
              position: "relative",
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}>
              <img 
                src={imagePreview} 
                alt="preview" 
                style={{
                  width: "100%",
                  height: "200px",
                  objectFit: "cover",
                  borderRadius: "16px",
                  border: "none",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                  transition: "all 0.3s ease",
                }}
              />
              <div style={{ textAlign: "center", width: "100%" }}>
                <Body1 weight="semibold">{imageFile?.name}</Body1>
                <Caption1>{(imageFile?.size / 1024 / 1024).toFixed(2)}MB</Caption1>
                <div style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  marginTop: "16px"
                }}>
                  <Button
                    size="small"
                    appearance="outline"
                    icon={<DeleteRegular />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageFile(null);
                      if (previewUrlRef.current) {
                        URL.revokeObjectURL(previewUrlRef.current);
                        previewUrlRef.current = null;
                      }
                      setImagePreview(null);
                      setFxEn("");
                      setFxKo("");
                      setFxErr("");
                      setFxAnalysis("");
                      setAnalysisEngine("");
                    }}
                  >
                    제거
                  </Button>
                  <Button
                    size="small"
                    appearance="outline"
                    disabled={!imageFile || fxLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      analyzeReference(imageFile);
                    }}
                  >
                    {fxLoading ? (
                      <>
                        <Spinner size="extra-small" />
                        분석 중…
                        {remainingTime !== null && (
                          <span style={{ 
                            marginLeft: tokens.spacingHorizontalXS,
                            color: tokens.colorNeutralForegroundOnBrand,
                            fontWeight: tokens.fontWeightSemibold
                          }}>
                            (약 {Math.ceil(remainingTime)}초 남음)
                          </span>
                        )}
                      </>
                    ) : (
                      "분석 다시 실행"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ 
              color: "rgba(102, 126, 234, 0.7)",
              textAlign: "center"
            }}>
              <div style={{ 
                fontSize: "48px", 
                marginBottom: "16px",
                background: "var(--gradient-brand, linear-gradient(135deg, #667eea, #764ba2))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>
                📸
              </div>
              <Body1 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px", color: "#374151" }}>
                참고 이미지 업로드
              </Body1>
              <Caption1 style={{ color: "#6b7280", fontSize: "14px" }}>
                클릭하거나 드래그해서 업로드하세요<br/>
                PNG, JPG, JPEG • 최대 {MAX_UPLOAD_MB}MB
              </Caption1>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
        
        <Caption1 style={{ 
          marginTop: tokens.spacingVerticalXS, 
          color: tokens.colorNeutralForeground3 
        }}>
          □ 참고 이미지 분석을 템플릿에 주입하면 일관성이 좋아집니다.
        </Caption1>
      </Field>

      {/* 분석 결과 */}
      {(fxLoading || fxErr || fxAnalysis) && (
        <div style={{ marginTop: tokens.spacingVerticalM }}>
          {fxErr && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: tokens.spacingHorizontalS,
              padding: tokens.spacingVerticalM,
              borderRadius: tokens.borderRadiusMedium,
              marginBottom: tokens.spacingVerticalS,
              backgroundColor: "#fef2f2",
              border: "2px solid #dc2626",
              color: "#dc2626",
              fontSize: tokens.fontSizeBase400,
              fontWeight: tokens.fontWeightSemibold,
            }}>
              <DismissCircleRegular />
              <Body1 weight="semibold">❌ 분석 실패: {fxErr}</Body1>
            </div>
          )}
          
          {fxAnalysis && (
            <Card style={{
              backgroundColor: tokens.colorNeutralBackground1,
              border: `1px solid ${tokens.colorNeutralStroke2}`,
              padding: tokens.spacingVerticalL,
              marginTop: tokens.spacingVerticalM,
              borderRadius: tokens.borderRadiusLarge,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: tokens.spacingVerticalL,
                paddingBottom: tokens.spacingVerticalS,
                borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    backgroundColor: tokens.colorBrandBackground2,
                    borderRadius: "50%",
                    color: tokens.colorBrandForeground1,
                  }}>
                    🔍
                  </div>
                  <Title3 style={{ margin: 0, fontSize: tokens.fontSizeBase400 }}>참고 이미지 분석</Title3>
                </div>
                {analysisEngine && (
                  <Badge 
                    appearance="tint" 
                    color={analysisEngine.includes("Gemini") ? "success" : "brand"} 
                    size="small"
                  >
                    {analysisEngine}
                  </Badge>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
                {fxAnalysis.split("\n\n").map((section, index) => {
                  const isMainSection = section.match(/^\d+\.\s*\*\*(.*?)\*\*/);
                  const sectionTitle = isMainSection ? isMainSection[1] : null;
                  const sectionContent = isMainSection ? section.replace(/^\d+\.\s*\*\*(.*?)\*\*:\s*/, "") : section;

                  return (
                    <div
                      key={index}
                      style={{
                        padding: tokens.spacingVerticalM,
                        backgroundColor: tokens.colorSubtleBackground,
                        borderRadius: tokens.borderRadiusMedium,
                        border: `1px solid ${tokens.colorNeutralStroke2}`,
                      }}
                    >
                      {sectionTitle && (
                        <div style={{
                          marginBottom: tokens.spacingVerticalS,
                          fontWeight: tokens.fontWeightSemibold,
                          color: tokens.colorNeutralForeground1,
                          fontSize: tokens.fontSizeBase200,
                          display: "flex",
                          alignItems: "center",
                          gap: tokens.spacingHorizontalXS,
                        }}>
                          <div style={{
                            width: "6px",
                            height: "6px",
                            backgroundColor: tokens.colorBrandForeground1,
                            borderRadius: "50%",
                          }} />
                          {sectionTitle}
                        </div>
                      )}
                      <Body2 style={{
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.5",
                        color: tokens.colorNeutralForeground2,
                        margin: 0,
                        fontSize: tokens.fontSizeBase300,
                      }}>
                        {sectionContent}
                      </Body2>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </GlassCard>
  );
};

export default ReferenceImageUpload;