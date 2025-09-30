// src/components/ThumbnailGenerator.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../common/ErrorBoundary";

// Utils - 중앙화된 에러 처리
import { handleError, handleApiError } from "@utils";
import { showGlobalToast } from "../common/GlobalToast";
import { useHeaderStyles } from "../../styles/commonStyles";
import {
  Button,
  Card,
  Title1,
  Title2,
  Title3,
  Body1,
  Caption1,
  Textarea,
  Dropdown,
  Option,
  makeStyles,
  shorthands,
  tokens,
  Spinner,
  Badge,
  Field,
  Label,
  mergeClasses,
} from "@fluentui/react-components";
import {
  DeleteRegular,
  ArrowDownloadRegular,
  ImageRegular,
  SparkleRegular,
  DismissCircleRegular,
  TimerRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { DEFAULT_TEMPLATE as IMPORTED_DEFAULT_TEMPLATE } from "../../constants/prompts";

const useStyles = makeStyles({
  container: {
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  pageHeader: {
    ...shorthands.margin(0, 0, tokens.spacingVerticalL),
  },
  pageTitle: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
  },
  pageDesc: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase300,
  },
  hairline: {
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    marginTop: tokens.spacingVerticalM,
  },
  sectionLead: {
    marginBottom: tokens.spacingVerticalL,
  },
  settingsCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
    marginBottom: tokens.spacingVerticalL,
  },
  templateActions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
  uploadArea: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalL,
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "200px", // 텍스트 영역과 유사한 높이
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    "&:hover": {
      ...shorthands.borderColor(tokens.colorBrandStroke1),
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  uploadAreaDragOver: {
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    backgroundColor: tokens.colorBrandBackground2,
  },
  previewContainer: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  previewImage: {
    width: "300px",
    height: "300px",
    objectFit: "cover",
    borderRadius: tokens.borderRadiusMedium,
    border: `2px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
  },
  previewInfo: {
    textAlign: "left",
    flex: 1,
  },
  optionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: tokens.spacingHorizontalL,
    marginBottom: tokens.spacingVerticalL,
  },
  analysisResult: {
    marginTop: tokens.spacingVerticalM,
  },
  resultsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: tokens.spacingHorizontalL,
  },
  resultCard: {
    overflow: "hidden",
  },
  resultImage: {
    width: "100%",
    height: "auto",
    objectFit: "cover",
  },
  resultFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: tokens.spacingVerticalM,
  },
  resultActions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
  promptDisplay: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    padding: tokens.spacingVerticalM,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: "pre-wrap",
    marginTop: tokens.spacingVerticalM,
  },
  tipCard: {
    marginTop: tokens.spacingVerticalS,
  },
  statusMessage: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    marginBottom: tokens.spacingVerticalS,
  },
  errorMessage: {
    backgroundColor: "#fef2f2",
    border: `2px solid #dc2626`,
    color: "#dc2626",
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
});

function TipCard({ children, className = "" }) {
  return (
    <MessageBar intent="warning" className={className}>
      <MessageBarBody>
        <LightbulbRegular /> {children}
      </MessageBarBody>
    </MessageBar>
  );
}

/** 업로드 정책 */
const MAX_UPLOAD_MB = 10; // 10MB로 제한

/** 프롬프트 템플릿 기본값 */
const DEFAULT_TEMPLATE = IMPORTED_DEFAULT_TEMPLATE;

/** 품질 설정 프리셋 */
// 품질 설정은 Replicate API에서 자동 처리되므로 UI 옵션 제거됨

function ThumbnailGenerator() {
  const styles = useStyles();
  const headerStyles = useHeaderStyles();
  const fileInputRef = useRef(null);

  /** 🔒 고정 폭 측정/저장 (리플리케이트 기준) */
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  /** 공통 상태 */
  const [metaTemplate, setMetaTemplate] = useState("");
  const [templateLoading, setTemplateLoading] = useState(true);
  const [provider, setProvider] = useState("replicate");

  /** 프로그레스 상태 */
  const [progress, setProgress] = useState({
    phase: "idle", // 'idle' | 'analyzing' | 'generating' | 'processing' | 'completed'
    percentage: 0,
    message: "",
    current: 0,
    total: 0,
  });

  /** Replicate 전용 */
  const [prompt, setPrompt] = useState("");

  /** 공통 옵션 */
  const [count, setCount] = useState(1);

  /** 참고 이미지(분석용) */
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null); // ObjectURL
  const previewUrlRef = useRef(null); // revoke 관리용

  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // 결과
  const [results, setResults] = useState([]); // [{url}]
  const [usedPrompt, setUsedPrompt] = useState("");
  const [tookMs, setTookMs] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [remainingTime, setRemainingTime] = useState(null); // 실시간 카운트다운용
  const [startTime, setStartTime] = useState(null); // 생성 시작 시점

  // 이미지 분석(Anthropic) 결과
  const [fxLoading, setFxLoading] = useState(false);
  const [fxErr, setFxErr] = useState("");
  const [fxEn, setFxEn] = useState("");
  const [fxKo, setFxKo] = useState("");
  const [fxAnalysis, setFxAnalysis] = useState(""); // 구도 분석 및 개선점
  const [analysisEngine, setAnalysisEngine] = useState(""); // 분석 엔진 정보

  const onPickFile = () => fileInputRef.current?.click();

  /** 🔒 최초 렌더 시 컨테이너 실제 폭을 픽셀로 고정 (리플리케이트 탭 기준) */
  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  /** 템플릿 및 기본 엔진 로드 */
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [savedTemplate, savedEngine] = await Promise.all([
          window.api.getSetting("thumbnailPromptTemplate"),
          window.api.getSetting("thumbnailDefaultEngine"),
        ]);

        setMetaTemplate(savedTemplate || DEFAULT_TEMPLATE);

        // 전역 설정의 기본 엔진을 항상 사용
        if (savedEngine) {
          setProvider(savedEngine);
        }
      } catch (error) {
        console.error("설정 로드 실패:", error);
        setMetaTemplate(DEFAULT_TEMPLATE);
      } finally {
        setTemplateLoading(false);
      }
    };
    loadSettings();
  }, []);

  /** 설정 변경 감지 */
  useEffect(() => {
    const handleSettingsChanged = (payload) => {
      if (payload?.key === "thumbnailPromptTemplate") {
        setMetaTemplate(payload.value || DEFAULT_TEMPLATE);
        console.log(`프롬프트 템플릿 변경됨`);
      } else if (payload?.key === "thumbnailDefaultEngine") {
        // 생성 엔진 변경 시 실시간 업데이트
        setProvider(payload.value || "replicate");
        console.log(`생성 엔진 변경됨: ${payload.value}`);
      } else if (payload?.key === "thumbnailAnalysisEngine") {
        // 분석 엔진 변경 시 콘솔에 알림 (실제 분석 시에만 적용됨)
        console.log(`이미지 분석 엔진 변경됨: ${payload.value}`);
      }
    };

    if (window.api.onSettingsChanged) {
      const unsubscribe = window.api.onSettingsChanged(handleSettingsChanged);
      return unsubscribe;
    }
  }, []);

  /** 안전한 미리보기 URL 해제 */
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  /** 실시간 카운트다운 계산 */
  useEffect(() => {
    if ((!loading && !fxLoading) || !startTime || !estimatedTime) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // 경과 시간 (초)
      const remaining = Math.max(0, estimatedTime - elapsed); // 남은 시간

      setRemainingTime(remaining);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, fxLoading, startTime, estimatedTime]);

  /** 참고 이미지 분석 (메인 프로세스 Anthropic IPC) */
  const analyzeReference = async (file) => {
    if (!file || !window?.api?.imagefxAnalyze) return;

    // 분석 시작 시점 설정
    const analysisStartTime = Date.now();
    const analysisEstimatedTime = 15; // 15초 예상

    try {
      setFxLoading(true);
      setFxErr("");
      setFxEn("");
      setFxKo("");
      setFxAnalysis("");
      setAnalysisEngine(""); // 분석 엔진 정보도 초기화

      // 분석용 카운트다운 시작
      setStartTime(analysisStartTime);
      setEstimatedTime(analysisEstimatedTime);
      setRemainingTime(analysisEstimatedTime);

      // 프로그레스 상태 업데이트
      updateProgress("analyzing", 0, 1, "이미지 분석 중...");

      const filePath = file.path || file.name; // Electron은 path 제공
      const res = await window.api.imagefxAnalyze({
        filePath,
        // Replicate 모드에서는 장면 설명도 같이 넘겨 보조,
        // Imagen 모드에선 템플릿 기반이므로 description은 없어도 됨
        description: provider === "replicate" ? prompt.trim() || undefined : undefined,
      });
      if (!res?.ok) throw new Error(res?.message || "analysis_failed");

      // 전체 텍스트 받기
      const fullText = res.raw || res.text || "";

      // 전체 분석 결과를 그대로 사용
      setFxAnalysis(fullText);

      // 영어와 한국어 프롬프트는 무시 (필요없음)
      setFxEn("");
      setFxKo("");

      // 설정에서 선택된 분석 엔진에 따라 표시 (실제 사용된 엔진 표시)
      try {
        setAnalysisEngine("Claude Sonnet 4");
        console.log(`이미지 분석 완료 - 사용된 엔진: Claude Sonnet 4`);
      } catch (settingError) {
        console.error("분석 엔진 설정 로드 실패:", settingError);
        setAnalysisEngine("Claude Sonnet 4");
      }

      // 분석 완료 상태 업데이트
      updateProgress("completed", 1, 1, "분석 완료!");
      setTimeout(() => updateProgress("idle"), 2000);
    } catch (e) {
      setFxErr(String(e?.message || e));
      updateProgress("idle");
    } finally {
      setFxLoading(false);
      // 분석 완료 시 카운트다운 리셋
      setRemainingTime(null);
      setStartTime(null);
    }
  };

  /** 파일 선택 처리 */
  const onFile = (file) => {
    if (!file) return;

    // PNG/JPG/JPEG만 허용 (WEBP 제외)
    if (!/image\/(png|jpe?g)$/i.test(file.type)) {
      return alert("PNG / JPG / JPEG만 업로드 가능합니다. (WEBP 불가)");
    }

    // 파일 크기 10MB 제한
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return alert(`최대 ${MAX_UPLOAD_MB}MB까지 업로드 가능합니다.`);
    }

    setImageFile(file);

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setImagePreview(url);

    // 업로드 직후 분석
    analyzeReference(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    onFile(file);
  };

  /** 최종 프롬프트 만들기 (Replicate 전용) */
  const buildFinalPrompt = () => {
    const referenceAnalysis = (fxAnalysis || "").trim(); // 전체 분석 결과 사용
    const base = (prompt || "").trim(); // 사용자 입력

    // 템플릿에 변수 치환
    let core = (metaTemplate || "")
      .replace(/{content}/g, base)
      .replace(/{referenceAnalysis}/g, referenceAnalysis)
      .trim();

    if (!core) core = base;

    const common = [
      "ultra-realistic",
      "cinematic style",
      "dramatic lighting",
      "16:9 aspect ratio",
      "no text, no words, no letters",
      "thumbnail-friendly framing",
    ];

    return `${core}\n\n${common.join(", ")}`;
  };

  /** 프로그레스 업데이트 함수 */
  const updateProgress = (phase, current = 0, total = 0, message = "") => {
    const phaseMessages = {
      idle: "대기 중...",
      analyzing: "이미지 분석 중...",
      generating: "썸네일 생성 중...",
      processing: "후처리 중...",
      completed: "완료!",
    };

    setProgress({
      phase,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      message: message || phaseMessages[phase] || "",
      current,
      total,
    });
  };

  /** 예상 시간 계산 */
  const calculateEstimatedTime = () => {
    const baseTime = 25; // Replicate Flux 평균 생성 시간 (초)
    return baseTime * count; // 개수에 비례
  };

  /** 생성 버튼 핸들러 */

  const onGenerate = async () => {
    // 템플릿 로딩 중인 경우 대기
    if (templateLoading) {
      handleError(new Error("template_loading"), "thumbnail_generation", {
        customMessage: "템플릿을 로딩 중입니다. 잠시 후 다시 시도하세요.",
      });
      return;
    }

    // 필수 필드 검증
    if (!prompt.trim() && !fxEn.trim() && !metaTemplate.trim()) {
      handleError(new Error("validation_failed"), "thumbnail_generation", {
        customMessage: "장면 설명 또는 템플릿/분석 결과 중 하나는 필요합니다.",
      });
      return;
    }

    // IPC 가드
    if (!window?.api?.generateThumbnails) {
      handleError(new Error("service_unavailable"), "thumbnail_generation", {
        customMessage: "Replicate 서비스를 사용할 수 없습니다. 설정을 확인하세요.",
      });
      return;
    }

    // 생성 시작 전 캐시 삭제 (선택사항)
    if (window.api?.clearCache) {
      try {
        await window.api.clearCache();
        console.log("캐시가 자동으로 삭제되었습니다.");
      } catch (error) {
        // 캐시 삭제는 선택사항이므로 오류 무시
      }
    }

    setLoading(true);
    setResults([]);
    setTookMs(null);
    updateProgress("generating", 0, count);

    const calcTime = calculateEstimatedTime();
    const now = Date.now();
    setEstimatedTime(calcTime);
    setStartTime(now); // 시작 시점 설정
    setRemainingTime(calcTime); // 초기 남은 시간

    try {
      const started = Date.now();

      // ✨ 1단계: Anthropic으로 프롬프트 확장
      updateProgress("generating", 0, count, "프롬프트 최적화 중...");
      const userPrompt = buildFinalPrompt();

      let finalPrompt = userPrompt;
      try {
        const expandResult = await window.api.expandThumbnailPrompt(userPrompt);
        if (expandResult?.ok && expandResult?.prompt) {
          finalPrompt = expandResult.prompt;
          console.log('[썸네일 생성] 프롬프트 확장 완료:', finalPrompt);
        } else if (expandResult?.fallbackPrompt) {
          finalPrompt = expandResult.fallbackPrompt;
          console.warn('[썸네일 생성] 프롬프트 확장 실패, 폴백 사용:', finalPrompt);
        }
      } catch (expandError) {
        console.error('[썸네일 생성] 프롬프트 확장 오류, 원본 사용:', expandError);
        // 오류 시 원본 프롬프트 사용
      }

      setUsedPrompt(finalPrompt);

      // ✨ 2단계: Replicate으로 이미지 생성
      updateProgress("generating", 1, count, `${count}개 썸네일 생성 중...`);

      const res = await window.api.generateThumbnails({
        prompt: finalPrompt,
        count,
      });

      if (!res?.ok) {
        throw new Error(typeof res?.message === "string" ? res.message : JSON.stringify(res?.message));
      }

      const urls = Array.isArray(res.images) ? res.images : [];

      updateProgress("processing", count, count, "결과 처리 중...");
      setResults(urls.map((u) => ({ url: u })));
      setTookMs(Date.now() - started);

      updateProgress("completed", count, count);
      
      // 성공 토스트 표시
      showGlobalToast({ 
        type: "success", 
        text: `썸네일 ${count}개가 성공적으로 생성되었습니다!` 
      });
      
      setTimeout(() => updateProgress("idle"), 3000);
    } catch (e) {
      console.error("썸네일 생성 실패:", e);

      // Use centralized error handling with context-aware error processing
      handleApiError(e, "thumbnail_generation", {
        metadata: {
          provider: "replicate",
          count: count,
          hasPrompt: !!prompt.trim(),
        },
      });
    } finally {
      setLoading(false);
      setRemainingTime(null); // 카운트다운 리셋
      setStartTime(null); // 시작 시점 리셋
      if (progress.phase !== "completed") {
        updateProgress("idle");
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={
        fixedWidthPx
          ? {
              width: `${fixedWidthPx}px`,
              minWidth: `${fixedWidthPx}px`,
              maxWidth: `${fixedWidthPx}px`,
              flex: `0 0 ${fixedWidthPx}px`,
            }
          : {}
      }
    >
      <div className={headerStyles.pageHeader}>
        <div className={headerStyles.pageTitleWithIcon}>
          <SparkleRegular />
          썸네일 생성기
        </div>
        <div className={headerStyles.pageDescription}>
          AI를 활용한 YouTube 썸네일 생성 도구
        </div>
        <div className={headerStyles.divider} />
      </div>

      {/* 장면 설명 — 둘 모드 모두에서 표시 */}
      <Card className={styles.settingsCard}>
        <Field>
          <Label weight="semibold" size="large">
            <SparkleRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
            장면 설명
          </Label>
          <Textarea
            rows={8}
            placeholder="한글/영어로 간단히 입력하세요 (예: 농구 선수, basketball player dunking)&#10;AI가 자동으로 YouTube 썸네일에 최적화된 프롬프트로 변환합니다."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading || fxLoading}
            style={{
              marginTop: tokens.spacingVerticalS,
              fontFamily: tokens.fontFamilyBase,
              fontSize: tokens.fontSizeBase300,
            }}
          />
          <Caption1 style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
            💡 간단히 입력하면 AI가 자동으로 상세한 프롬프트로 확장합니다. 한글/영어 모두 지원!
          </Caption1>
        </Field>
      </Card>

      {/* 참고 이미지 업로드 (분석 보조) — 두 모드 공통 사용 가능 */}
      <Card className={styles.settingsCard}>
        <Field>
          <Label weight="semibold" size="large">
            <ImageRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
            참고 이미지 (선택사항)
          </Label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={mergeClasses(styles.uploadArea, dragOver && styles.uploadAreaDragOver)}
            onClick={loading ? undefined : onPickFile}
            style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}
          >
            {imagePreview ? (
              <div className={styles.previewContainer}>
                <img src={imagePreview} alt="preview" className={styles.previewImage} />
                <div className={styles.previewInfo}>
                  <Body1 weight="semibold">{imageFile?.name}</Body1>
                  <Caption1>{(imageFile?.size / 1024 / 1024).toFixed(2)}MB</Caption1>
                  <div style={{ display: "flex", gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalS }}>
                    <Button
                      size="small"
                      appearance="outline"
                      icon={<DeleteRegular />}
                      disabled={loading || fxLoading}
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
                        setFxAnalysis(""); // 분석 결과도 제거
                        setAnalysisEngine(""); // 분석 엔진 정보도 초기화
                      }}
                    >
                      제거
                    </Button>
                    <Button
                      size="small"
                      appearance="outline"
                      disabled={!imageFile || fxLoading || loading}
                      onClick={(e) => {
                        e.stopPropagation();
                        analyzeReference(imageFile);
                      }}
                    >
                      {fxLoading ? (
                        <>
                          <Spinner size="extra-small" style={{ marginRight: tokens.spacingHorizontalS }} />
                          <span style={{ color: "#0078d4", fontWeight: tokens.fontWeightSemibold }}>
                            분석 중…
                          </span>
                          {remainingTime !== null && (
                            <span
                              style={{
                                marginLeft: tokens.spacingHorizontalS,
                                color: "#0078d4",
                                fontWeight: tokens.fontWeightBold,
                              }}
                            >
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
              <div style={{ color: tokens.colorNeutralForeground2 }}>
                <div style={{ fontSize: "1.5rem", marginBottom: tokens.spacingVerticalS }}>⬆️</div>
                <Body1>클릭하거나 드래그하여 업로드</Body1>
                <Caption1>PNG, JPG, JPEG (최대 {MAX_UPLOAD_MB}MB, WEBP 불가)</Caption1>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg" // webp 제외
              style={{ display: "none" }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
          <Caption1 style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
            □ 참고 이미지 분석을 템플릿에 주입하면 일관성이 좋아집니다.
          </Caption1>
        </Field>

        {(fxLoading || fxErr || fxEn || fxKo || fxAnalysis) && (
          <div className={styles.analysisResult}>
            {fxErr && (
              <div className={mergeClasses(styles.statusMessage, styles.errorMessage)}>
                <DismissCircleRegular />
                <Body1 weight="semibold">❌ 분석 실패: {fxErr}</Body1>
              </div>
            )}
            {fxAnalysis && (
              <Card
                style={{
                  backgroundColor: tokens.colorNeutralBackground1,
                  border: `1px solid ${tokens.colorNeutralStroke2}`,
                  padding: tokens.spacingVerticalL,
                  marginTop: tokens.spacingVerticalM,
                  borderRadius: tokens.borderRadiusLarge,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: tokens.spacingVerticalL,
                    paddingBottom: tokens.spacingVerticalS,
                    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "32px",
                        height: "32px",
                        backgroundColor: tokens.colorBrandBackground2,
                        borderRadius: "50%",
                        color: tokens.colorBrandForeground1,
                      }}
                    >
                      🔍
                    </div>
                    <Title3 style={{ margin: 0, fontSize: tokens.fontSizeBase400 }}>참고 이미지 분석</Title3>
                  </div>
                </div>

                <div
                  style={{
                    padding: tokens.spacingVerticalL,
                    backgroundColor: tokens.colorSubtleBackground,
                    borderRadius: tokens.borderRadiusMedium,
                    border: `1px solid ${tokens.colorNeutralStroke2}`,
                  }}
                >
                  <Body1
                    style={{
                      whiteSpace: "pre-wrap",
                      lineHeight: "1.6",
                      color: tokens.colorNeutralForeground2,
                      margin: 0,
                      fontSize: tokens.fontSizeBase300,
                    }}
                  >
                    {fxAnalysis}
                  </Body1>
                </div>
              </Card>
            )}
          </div>
        )}
      </Card>

      {/* 옵션들 */}
      <Card className={styles.settingsCard}>
        <Title3 style={{ marginBottom: tokens.spacingVerticalM, display: "flex", alignItems: "center" }}>
          <SettingsRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
          생성 옵션
        </Title3>
        <div className={styles.optionsGrid}>
          {/* 공통: 생성 개수 */}
          <Field>
            <Label weight="semibold">생성 개수</Label>
            <Dropdown
              value={count.toString()}
              onOptionSelect={(_, data) => setCount(Number(data.optionValue))}
              disabled={loading || fxLoading}
            >
              {[1, 2, 3, 4].map((n) => (
                <Option key={n} value={n.toString()}>
                  {n}개
                </Option>
              ))}
            </Dropdown>
          </Field>

        </div>
      </Card>

      {/* 생성 버튼 */}
      <Card className={styles.settingsCard}>
        <Button
          appearance="primary"
          size="large"
          onClick={onGenerate}
          disabled={loading}
          style={{
            width: "100%",
            height: "56px",
            fontSize: tokens.fontSizeBase400,
            fontWeight: tokens.fontWeightSemibold,
            overflow: "visible",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: tokens.spacingHorizontalS,
            padding: "0 24px",
            backgroundColor: loading ? "#e3f2fd" : undefined,
            color: loading ? "#0078d4" : undefined,
            border: loading ? "2px solid #0078d4" : undefined,
          }}
        >
          {loading ? (
            <>
              <Spinner size="small" style={{ marginRight: tokens.spacingHorizontalS }} />
              <span style={{ color: "#0078d4", fontWeight: tokens.fontWeightBold }}>
                생성 중...
              </span>
              {remainingTime !== null && remainingTime > 1 && (
                <span style={{
                  marginLeft: tokens.spacingHorizontalS,
                  fontWeight: tokens.fontWeightBold,
                  color: "#0078d4"
                }}>
                  (약 {Math.ceil(remainingTime)}초)
                </span>
              )}
            </>
          ) : (
            <>
              <SparkleRegular />
              🎨 썸네일 생성하기
            </>
          )}
        </Button>
      </Card>

      {/* 결과 */}
      {results.length > 0 && (
        <div style={{ marginTop: tokens.spacingVerticalXXL }}>
          <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM }}>
            <span>🎉</span>
            <Title3>생성 완료!</Title3>
            {tookMs != null && (
              <Caption1>
                {(tookMs / 1000).toFixed(1)}초 만에 {results.length}개의 썸네일이 생성되었습니다.
              </Caption1>
            )}
          </div>

          <div className={styles.resultsGrid}>
            {results.map((r, i) => (
              <Card key={i} className={styles.resultCard}>
                <div style={{ backgroundColor: "rgba(0,0,0,0.05)" }}>
                  <img src={r.url} alt={`thumb-${i + 1}`} className={styles.resultImage} />
                </div>
                <div className={styles.resultFooter}>
                  <Body1 weight="semibold">썸네일 #{i + 1}</Body1>
                  <div className={styles.resultActions}>
                    <Button
                      size="small"
                      appearance="outline"
                      icon={<ArrowDownloadRegular />}
                      onClick={async () => {
                        const res = await window.api.saveUrlToFile({
                          url: r.url,
                          suggestedName: `thumbnail-${i + 1}.jpg`,
                        });
                        if (!res?.ok && res?.message !== "canceled") {
                          showGlobalToast({ type: "error", text: `저장 실패: ${res?.message || "알 수 없는 오류"}` });
                        } else if (res?.ok) {
                          showGlobalToast({ type: "success", text: "썸네일이 성공적으로 저장되었습니다!" });
                        }
                      }}
                    >
                      다운로드
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* 프롬프트 표시 숨김 처리 */}
          {false && (
            <div style={{ marginTop: tokens.spacingVerticalL }}>
              <Body1 weight="semibold" style={{ marginBottom: tokens.spacingVerticalS }}>
                🧩 생성에 사용된 프롬프트
              </Body1>
              <div className={styles.promptDisplay}>{usedPrompt}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ThumbnailGeneratorWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <ThumbnailGenerator />
    </ErrorBoundary>
  );
}
