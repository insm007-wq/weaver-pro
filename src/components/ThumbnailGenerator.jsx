// src/pages/ThumbnailGenerator.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  Button,
  Card,
  Text,
  Title1,
  Title2,
  Title3,
  Body1,
  Body2,
  Caption1,
  Textarea,
  Dropdown,
  Option,
  Divider,
  makeStyles,
  shorthands,
  tokens,
  Spinner,
  MessageBar,
  MessageBarBody,
  Badge,
  Field,
  Label,
  ProgressBar,
} from "@fluentui/react-components";
import {
  LightbulbRegular,
  DeleteRegular,
  ArrowDownloadRegular,
  OpenRegular,
  ImageRegular,
  SparkleRegular,
  DismissCircleRegular,
  InfoRegular,
  TimerRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { DEFAULT_TEMPLATE as IMPORTED_DEFAULT_TEMPLATE } from "./scriptgen/constants";

const useStyles = makeStyles({
  container: {
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  toastContainer: {
    position: "fixed",
    top: tokens.spacingVerticalL,
    right: tokens.spacingHorizontalL,
    zIndex: 1000,
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
    padding: tokens.spacingVerticalXL,
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
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
    width: "200px",
    height: "200px",
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
const QUALITY_PRESETS = [
  {
    value: "fast",
    label: "빠른 생성",
    steps: 20,
    cfg: 7,
    description: "빠른 속도, 적절한 품질",
    estimatedTime: "약 10-15초",
  },
  {
    value: "balanced",
    label: "균형 잡힌",
    steps: 30,
    cfg: 8,
    description: "속도와 품질의 균형",
    estimatedTime: "약 20-30초",
  },
  {
    value: "quality",
    label: "최고 품질",
    steps: 50,
    cfg: 10,
    description: "최상의 품질, 느린 속도",
    estimatedTime: "약 40-60초",
  },
];

function ThumbnailGenerator() {
  const styles = useStyles();
  const fileInputRef = useRef(null);

  /** 🔒 고정 폭 측정/저장 (리플리케이트 기준) */
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  /** 공통 상태 */
  const [provider, setProvider] = useState("replicate"); // 'replicate' | 'gemini'
  const [metaTemplate, setMetaTemplate] = useState("");
  const [templateLoading, setTemplateLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [defaultEngineLoaded, setDefaultEngineLoaded] = useState(false);

  /** 프로그레스 상태 */
  const [progress, setProgress] = useState({
    phase: "idle", // 'idle' | 'analyzing' | 'generating' | 'processing' | 'completed'
    percentage: 0,
    message: "",
    current: 0,
    total: 0,
  });

  /** 품질 설정 */
  const [qualityPreset, setQualityPreset] = useState("balanced");

  /** Replicate 전용 */
  const [prompt, setPrompt] = useState(""); // ⬅️ Replicate일 때만 사용
  const [mode, setMode] = useState("dramatic"); // dramatic | calm

  /** 공통 옵션 */
  const [count, setCount] = useState(1);

  /** Imagen3 전용 옵션 */
  const [aspectRatio, setAspectRatio] = useState("16:9"); // "1:1" | "3:4" | "4:3" | "9:16" | "16:9"

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

  // 이미지 분석(Anthropic) 결과
  const [fxLoading, setFxLoading] = useState(false);
  const [fxErr, setFxErr] = useState("");
  const [fxEn, setFxEn] = useState("");
  const [fxKo, setFxKo] = useState("");
  const [fxAnalysis, setFxAnalysis] = useState(""); // 구도 분석 및 개선점

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

        if (savedEngine && !defaultEngineLoaded) {
          setProvider(savedEngine);
          setDefaultEngineLoaded(true);
        }
      } catch (error) {
        console.error("설정 로드 실패:", error);
        setMetaTemplate(DEFAULT_TEMPLATE);
      } finally {
        setTemplateLoading(false);
      }
    };
    loadSettings();
  }, [defaultEngineLoaded]);

  /** 설정 변경 감지 */
  useEffect(() => {
    const handleSettingsChanged = (payload) => {
      if (payload?.key === "thumbnailPromptTemplate") {
        setMetaTemplate(payload.value || DEFAULT_TEMPLATE);
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

  /** Toast 자동 숨김 */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  /** 참고 이미지 분석 (메인 프로세스 Anthropic IPC) */
  const analyzeReference = async (file) => {
    if (!file || !window?.api?.imagefxAnalyze) return;
    try {
      setFxLoading(true);
      setFxErr("");
      setFxEn("");
      setFxKo("");
      setFxAnalysis("");

      const filePath = file.path || file.name; // Electron은 path 제공
      const res = await window.api.imagefxAnalyze({
        filePath,
        // Replicate 모드에서는 장면 설명도 같이 넘겨 보조,
        // Imagen 모드에선 템플릿 기반이므로 description은 없어도 됨
        description: provider === "replicate" ? prompt.trim() || undefined : undefined,
      });
      if (!res?.ok) throw new Error(res?.message || "analysis_failed");

      // 구도 분석 추출 (첫 번째 블록)
      const fullText = res.text || "";
      const analysisMatch = fullText.match(/구도 분석 및 개선점:([\s\S]*?)(?=English Prompt:|$)/);
      if (analysisMatch) {
        setFxAnalysis(analysisMatch[1].trim());
      }

      setFxEn(res.english || "");
      setFxKo(res.korean || "");
    } catch (e) {
      setFxErr(String(e?.message || e));
    } finally {
      setFxLoading(false);
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

  /** 최종 프롬프트 만들기 */
  const buildFinalPrompt = () => {
    const referenceAnalysis = (fxEn || "").trim();

    if (provider === "gemini") {
      // ✅ Gemini: 대화형 이미지 생성, 템플릿과 참고 분석 활용
      // {content}는 비워두고 {referenceAnalysis}만 주입 가능
      const core = (metaTemplate || "")
        .replace(/{content}/g, "")
        .replace(/{referenceAnalysis}/g, referenceAnalysis)
        .trim();
      return core;
    }

    // ✅ Replicate: 장면 설명 + 공통 키워드 + 모드
    const base = (prompt || "").trim();
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
    const mood =
      mode === "dramatic"
        ? ["high contrast", "emotional clarity", "tense atmosphere"]
        : ["soft lighting", "natural mood", "subtle color palette"];

    return `${core}\n\n${[...common, ...mood].join(", ")}`;
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
    const preset = QUALITY_PRESETS.find((p) => p.value === qualityPreset);
    const baseTime = preset ? preset.steps * 0.5 : 15; // 기본 15초
    return baseTime * count; // 개수에 비례
  };

  /** 생성 버튼 핸들러 */
  const onGenerate = async () => {
    // 템플릿 로딩 중인 경우 대기
    if (templateLoading) {
      setToast({ type: "error", text: "템플릿을 로딩 중입니다. 잠시 후 다시 시도하세요." });
      return;
    }

    // 각 프로바이더별 필수 필드 가드
    if (provider === "replicate" && !prompt.trim() && !fxEn.trim() && !metaTemplate.trim()) {
      setToast({ type: "error", text: "장면 설명 또는 템플릿/분석 결과 중 하나는 필요합니다." });
      return;
    }
    if (provider === "gemini" && !metaTemplate.trim()) {
      setToast({ type: "error", text: "Gemini 모드에서는 템플릿이 필요합니다." });
      return;
    }

    // IPC 가드
    const hasReplicate = !!window?.api?.generateThumbnails;
    const hasGemini = !!window?.api?.generateThumbnailsGemini;
    if (provider === "replicate" && !hasReplicate) {
      setToast({ type: "error", text: "Replicate 서비스를 사용할 수 없습니다. 설정을 확인하세요." });
      return;
    }
    if (provider === "gemini" && !hasGemini) {
      setToast({ type: "error", text: "Gemini 서비스를 사용할 수 없습니다. 설정을 확인하세요." });
      return;
    }

    setLoading(true);
    setResults([]);
    setTookMs(null);
    updateProgress("generating", 0, count);
    setEstimatedTime(calculateEstimatedTime());

    try {
      const started = Date.now();
      const finalPrompt = buildFinalPrompt();
      setUsedPrompt(finalPrompt);

      let res;
      if (provider === "gemini") {
        // ⬇️ Google Gemini 호출 (count, aspectRatio 사용)
        updateProgress("generating", 0, count, "Gemini API 초기화 중...");
        const geminiApiKey = await window.api.getSecret("geminiKey");
        if (!geminiApiKey?.trim()) {
          throw new Error("Gemini API 키가 설정되지 않았습니다. 설정 > API에서 키를 입력하세요.");
        }

        updateProgress("generating", 1, count, `${count}개 썸네일 생성 중...`);
        const preset = QUALITY_PRESETS.find((p) => p.value === qualityPreset);
        res = await window.api.generateThumbnailsGemini({
          prompt: finalPrompt,
          count,
          aspectRatio,
          apiKey: geminiApiKey,
          quality: preset ? { steps: preset.steps, cfg: preset.cfg } : undefined,
        });
      } else {
        // ⬇️ Replicate 호출 (count, mode 사용)
        updateProgress("generating", 0, count, "Replicate API 초기화 중...");
        updateProgress("generating", 1, count, `${count}개 썸네일 생성 중...`);

        const preset = QUALITY_PRESETS.find((p) => p.value === qualityPreset);
        res = await window.api.generateThumbnails({
          prompt: finalPrompt,
          count,
          mode,
          quality: preset ? { steps: preset.steps, cfg: preset.cfg } : undefined,
        });
      }

      if (!res?.ok) {
        throw new Error(typeof res?.message === "string" ? res.message : JSON.stringify(res?.message));
      }

      const urls = Array.isArray(res.images) ? res.images : [];

      updateProgress("processing", count, count, "결과 처리 중...");
      setResults(urls.map((u) => ({ url: u })));
      setTookMs(Date.now() - started);

      updateProgress("completed", count, count);
      setTimeout(() => updateProgress("idle"), 3000);
    } catch (e) {
      console.error("썸네일 생성 실패:", e);
      setToast({
        type: "error",
        text: `생성 실패: ${e?.message || "알 수 없는 오류가 발생했습니다."}`,
      });
    } finally {
      setLoading(false);
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
      {/* Toast 알림 */}
      <div className={styles.toastContainer}>
        {toast && (
          <MessageBar intent={toast.type === "success" ? "success" : "error"}>
            <MessageBarBody>
              {toast.type === "success" ? "✅" : "❌"} {toast.text}
            </MessageBarBody>
          </MessageBar>
        )}
      </div>

      {/* 헤더 */}
      {/* <div className={styles.sectionLead}>
        <Title2 style={{ fontSize: tokens.fontSizeBase500, marginBottom: tokens.spacingVerticalXXS }}>
          🎨 썸네일 생성기
        </Title2>
        <Body1 style={{ color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase300 }}>
          AI를 활용한 YouTube 썸네일 생성 도구 · PNG, JPG, JPEG 지원 · 최대 {MAX_UPLOAD_MB}MB (WEBP 불가)
        </Body1>
      </div> */}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <SparkleRegular />
          <Title1>썸네일 생성기</Title1>
        </div>
        <Body1 className={styles.pageDesc}>AI를 활용한 YouTube 썸네일 생성 도구</Body1>
        <div className={styles.hairline} />
      </div>

      {/* 장면 설명 — Replicate에서만 표시 */}
      {provider === "replicate" && (
        <Card className={styles.settingsCard}>
          <Field>
            <Label weight="semibold" size="large">
              <SparkleRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
              장면 설명
            </Label>
            <Textarea
              rows={5}
              placeholder="어떤 썸네일을 원하시나요? 인물의 표정, 상황, 감정을 구체적으로 적어주세요."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              style={{
                marginTop: tokens.spacingVerticalS,
                fontFamily: tokens.fontFamilyBase,
                fontSize: tokens.fontSizeBase300,
              }}
            />
          </Field>
        </Card>
      )}

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
            className={`${styles.uploadArea} ${dragOver ? styles.uploadAreaDragOver : ""}`}
            onClick={onPickFile}
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
                          <Spinner size="extra-small" /> 분석 중…
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
        </Field>

        {(fxLoading || fxErr || fxEn || fxKo || fxAnalysis) && (
          <div className={styles.analysisResult}>
            {fxErr && (
              <div className={`${styles.statusMessage} ${styles.errorMessage}`}>
                <DismissCircleRegular />
                <Caption1>에러: {fxErr}</Caption1>
              </div>
            )}
            {fxLoading && !fxErr && (
              <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
                <Spinner size="small" />
                <Caption1>이미지 분석 중…</Caption1>
              </div>
            )}
            {fxAnalysis && (
              <Card
                style={{
                  backgroundColor: tokens.colorPaletteLightTealBackground1,
                  border: `1px solid ${tokens.colorPaletteLightTealBorder1}`,
                  padding: tokens.spacingVerticalM,
                  marginBottom: tokens.spacingVerticalM,
                }}
              >
                <Label
                  weight="semibold"
                  style={{
                    marginBottom: tokens.spacingVerticalS,
                    display: "flex",
                    alignItems: "center",
                    color: tokens.colorPaletteDarkBlueForeground2,
                  }}
                >
                  <InfoRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
                  📊 참고 이미지 분석
                </Label>
                <div
                  style={{
                    backgroundColor: tokens.colorNeutralBackground1,
                    padding: tokens.spacingVerticalM,
                    borderRadius: tokens.borderRadiusSmall,
                    border: `1px solid ${tokens.colorNeutralStroke1}`,
                    fontFamily: tokens.fontFamilyBase,
                    lineHeight: "1.8",
                  }}
                >
                  {fxAnalysis
                    .split("\n")
                    .map((line, index) => {
                      if (line.trim().startsWith("•") || line.trim().startsWith("-")) {
                        return (
                          <div
                            key={index}
                            style={{
                              marginBottom: tokens.spacingVerticalXS,
                              paddingLeft: tokens.spacingHorizontalS,
                              color: tokens.colorNeutralForeground1,
                            }}
                          >
                            <Body1>{line.trim()}</Body1>
                          </div>
                        );
                      } else if (line.trim()) {
                        return (
                          <div
                            key={index}
                            style={{
                              marginBottom: tokens.spacingVerticalS,
                              fontWeight: tokens.fontWeightSemibold,
                              color: tokens.colorNeutralForeground1,
                            }}
                          >
                            <Body1>{line.trim()}</Body1>
                          </div>
                        );
                      }
                      return null;
                    })
                    .filter(Boolean)}
                </div>
              </Card>
            )}
          </div>
        )}

        <TipCard className={styles.tipCard}>
          <InfoRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
          참고 이미지 분석을 템플릿에 주입하면 일관성이 좋아집니다.
        </TipCard>
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
            <Dropdown value={count.toString()} onOptionSelect={(_, data) => setCount(Number(data.optionValue))}>
              {[1, 2, 3, 4].map((n) => (
                <Option key={n} value={n.toString()}>
                  {n}개
                </Option>
              ))}
            </Dropdown>
          </Field>

          {/* 품질 설정 */}
          <Field>
            <Label weight="semibold">
              <SettingsRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
              품질 설정
            </Label>
            <Dropdown value={qualityPreset} onOptionSelect={(_, data) => setQualityPreset(data.optionValue)}>
              {QUALITY_PRESETS.map((preset) => (
                <Option key={preset.value} value={preset.value}>
                  <div>
                    <div style={{ fontWeight: tokens.fontWeightSemibold }}>{preset.label}</div>
                    <Caption1>
                      {preset.description} • {preset.estimatedTime}
                    </Caption1>
                  </div>
                </Option>
              ))}
            </Dropdown>
          </Field>

          {/* 분기 옵션 */}
          {provider === "replicate" ? (
            <Field>
              <Label weight="semibold">생성 모드</Label>
              <Dropdown value={mode} onOptionSelect={(_, data) => setMode(data.optionValue)}>
                <Option value="dramatic">극적 & 자극적 모드</Option>
                <Option value="calm">차분 & 자연스러운 모드</Option>
              </Dropdown>
            </Field>
          ) : (
            <Field>
              <Label weight="semibold">가로세로 비율 (ImageFX)</Label>
              <Dropdown value={aspectRatio} onOptionSelect={(_, data) => setAspectRatio(data.optionValue)}>
                {["1:1", "3:4", "4:3", "9:16", "16:9"].map((r) => (
                  <Option key={r} value={r}>
                    {r}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          )}
        </div>
      </Card>

      {/* 생성 버튼 */}
      <Card className={styles.settingsCard}>
        <Button
          appearance="primary"
          size="large"
          onClick={onGenerate}
          disabled={loading}
          icon={loading ? <Spinner size="small" /> : <SparkleRegular />}
          style={{
            width: "100%",
            height: "56px",
            fontSize: tokens.fontSizeBase400,
            fontWeight: tokens.fontWeightSemibold,
          }}
        >
          {loading ? "생성 중..." : "🎨 썸네일 생성하기"}
        </Button>
      </Card>

      {/* 프로그레스 표시 */}
      {progress.phase !== "idle" && (
        <Card style={{ marginTop: tokens.spacingVerticalL, padding: tokens.spacingVerticalM }}>
          <div style={{ marginBottom: tokens.spacingVerticalS }}>
            <Body1 weight="semibold">{progress.message}</Body1>
            {estimatedTime && progress.phase === "generating" && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                <TimerRegular style={{ marginRight: tokens.spacingHorizontalXS }} />
                예상 소요 시간: 약 {estimatedTime}초
              </Caption1>
            )}
          </div>
          <ProgressBar value={progress.percentage / 100} color={progress.phase === "completed" ? "success" : "brand"} />
          {progress.total > 0 && (
            <Caption1 style={{ marginTop: tokens.spacingVerticalXS, textAlign: "right" }}>
              {progress.current} / {progress.total} 완료
            </Caption1>
          )}
        </Card>
      )}

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
                          setToast({ type: "error", text: `저장 실패: ${res?.message || "알 수 없는 오류"}` });
                        } else if (res?.ok) {
                          setToast({ type: "success", text: "썸네일이 성공적으로 저장되었습니다!" });
                        }
                      }}
                    >
                      다운로드
                    </Button>
                    <Button size="small" appearance="outline" icon={<OpenRegular />} as="a" href={r.url} target="_blank" rel="noreferrer">
                      새 창에서 보기
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div style={{ marginTop: tokens.spacingVerticalL }}>
            <Body1 weight="semibold" style={{ marginBottom: tokens.spacingVerticalS }}>
              🧩 생성에 사용된 프롬프트
            </Body1>
            <div className={styles.promptDisplay}>{usedPrompt}</div>
          </div>
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
