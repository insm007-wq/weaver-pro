// src/pages/ThumbnailGenerator.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Text,
  Title1,
  Title3,
  Subtitle1,
  Body1,
  Caption1,
  Textarea,
  Dropdown,
  Option,
  makeStyles,
  tokens,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  MessageBarActions,
  Badge,
  Field,
  Label,
} from "@fluentui/react-components";
import {
  LightbulbRegular,
  SaveRegular,
  ArrowResetRegular,
  DocumentAddRegular,
  DeleteRegular,
  ArrowDownloadRegular,
  OpenRegular,
  ImageRegular,
  SparkleRegular,
} from "@fluentui/react-icons";
import { DEFAULT_TEMPLATE as IMPORTED_DEFAULT_TEMPLATE } from "./scriptgen/constants";

const useStyles = makeStyles({
  container: {
    maxWidth: '1024px',
    margin: '0 auto',
    padding: tokens.spacingVerticalXXL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow16,
    boxSizing: 'border-box',
  },
  toastContainer: {
    position: 'fixed',
    top: tokens.spacingVerticalL,
    right: tokens.spacingHorizontalL,
    zIndex: 1000,
  },
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalL,
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  formSection: {
    marginBottom: tokens.spacingVerticalL,
  },
  templateActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  uploadArea: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalXL,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: tokens.colorBrandStroke1,
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  uploadAreaDragOver: {
    borderColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  previewContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  previewImage: {
    width: '112px',
    height: '112px',
    objectFit: 'cover',
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  previewInfo: {
    textAlign: 'left',
    flex: 1,
  },
  gridTwoColumns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  analysisResult: {
    marginTop: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusSmall,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  resultCard: {
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: 'auto',
    objectFit: 'cover',
  },
  resultFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacingVerticalM,
  },
  resultActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  promptDisplay: {
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusSmall,
    padding: tokens.spacingVerticalM,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
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

/** 생성 엔진 옵션들 */
const GENERATION_ENGINES = [
  { value: "replicate", label: "Replicate" },
  { value: "gemini", label: "Google Gemini (이미지 생성)" },
  { value: "dalle3", label: "DALL-E 3" },
  { value: "midjourney", label: "Midjourney" },
  { value: "stable-diffusion", label: "Stable Diffusion" },
];

export default function ThumbnailGenerator() {
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

  // 이미지 분석(Anthropic) 결과
  const [fxLoading, setFxLoading] = useState(false);
  const [fxErr, setFxErr] = useState("");
  const [fxEn, setFxEn] = useState("");
  const [fxKo, setFxKo] = useState("");

  const onPickFile = () => fileInputRef.current?.click();

  /** 🔒 최초 렌더 시 컨테이너 실제 폭을 픽셀로 고정 (리플리케이트 탭 기준) */
  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const px = Math.round(containerRef.current.getBoundingClientRect().width);
      if (px > 0) setFixedWidthPx(px);
    }
  }, [fixedWidthPx]);

  /** 템플릿 로드 */
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const savedTemplate = await window.api.getSetting("thumbnailPromptTemplate");
        setMetaTemplate(savedTemplate || DEFAULT_TEMPLATE);
      } catch (error) {
        console.error("템플릿 로드 실패:", error);
        setMetaTemplate(DEFAULT_TEMPLATE);
      } finally {
        setTemplateLoading(false);
      }
    };
    loadTemplate();
  }, []);

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

      const filePath = file.path || file.name; // Electron은 path 제공
      const res = await window.api.imagefxAnalyze({
        filePath,
        // Replicate 모드에서는 장면 설명도 같이 넘겨 보조,
        // Imagen 모드에선 템플릿 기반이므로 description은 없어도 됨
        description: provider === "replicate" ? prompt.trim() || undefined : undefined,
      });
      if (!res?.ok) throw new Error(res?.message || "analysis_failed");

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
      const core = (metaTemplate || "").replace(/{content}/g, "").replace(/{referenceAnalysis}/g, referenceAnalysis).trim();
      return core;
    }

    // ✅ Replicate: 장면 설명 + 공통 키워드 + 모드
    const base = (prompt || "").trim();
    let core = (metaTemplate || "").replace(/{content}/g, base).replace(/{referenceAnalysis}/g, referenceAnalysis).trim();

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

  /** 생성 버튼 핸들러 */
  const onGenerate = async () => {
    // 각 프로바이더별 필수 필드 가드
    if (provider === "replicate" && !prompt.trim() && !fxEn.trim() && !metaTemplate.trim()) {
      return alert("장면 설명 또는 템플릿/분석 결과 중 하나는 필요합니다.");
    }
    if (provider === "gemini" && !metaTemplate.trim()) {
      return alert("Gemini 모드에서는 템플릿이 필요합니다.");
    }

    // IPC 가드
    const hasReplicate = !!window?.api?.generateThumbnails;
    const hasGemini = !!window?.api?.generateThumbnailsGemini;
    if (provider === "replicate" && !hasReplicate) {
      return alert("Replicate IPC(generateThumbnails)가 없습니다. preload/main 설정을 확인하세요.");
    }
    if (provider === "gemini" && !hasGemini) {
      return alert("Google Gemini IPC(generateThumbnailsGemini)가 없습니다. preload/main 설정을 확인하세요.");
    }

    setLoading(true);
    setResults([]);
    setTookMs(null);

    try {
      const started = Date.now();
      const finalPrompt = buildFinalPrompt();
      setUsedPrompt(finalPrompt);

      let res;
      if (provider === "gemini") {
        // ⬇️ Google Gemini 호출 (count, aspectRatio 사용)
        const geminiApiKey = await window.api.getSecret("geminiKey");
        res = await window.api.generateThumbnailsGemini({
          prompt: finalPrompt,
          count,
          aspectRatio,
          apiKey: geminiApiKey,
        });
      } else {
        // ⬇️ Replicate 호출 (count, mode 사용)
        res = await window.api.generateThumbnails({
          prompt: finalPrompt,
          count,
          mode,
        });
      }

      if (!res?.ok) {
        throw new Error(typeof res?.message === "string" ? res.message : JSON.stringify(res?.message));
      }

      const urls = Array.isArray(res.images) ? res.images : [];
      setResults(urls.map((u) => ({ url: u })));
      setTookMs(Date.now() - started);
    } catch (e) {
      alert(`실패: ${e?.message || e}`);
    } finally {
      setLoading(false);
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
      <div className={styles.headerContainer}>
        <div className={styles.titleContainer}>
          <SparkleRegular />
          <Title1>썸네일 생성기</Title1>
        </div>
        <Caption1>PNG, JPG, JPEG · 최대 {MAX_UPLOAD_MB}MB (WEBP 불가)</Caption1>
      </div>

      {/* 프로바이더 선택 */}
      <div className={styles.formSection}>
        <Field>
          <Label weight="semibold">생성 엔진</Label>
          <Dropdown
            value={provider}
            onOptionSelect={(_, data) => setProvider(data.optionValue)}
            style={{ maxWidth: '520px' }}
          >
            {GENERATION_ENGINES.map((engine) => (
              <Option key={engine.value} value={engine.value}>
                {engine.label}
              </Option>
            ))}
          </Dropdown>
          <Caption1>Replicate는 장면 설명 + 템플릿, Gemini는 AI 대화형 이미지 생성을 지원합니다.</Caption1>
        </Field>
      </div>

      {/* 프롬프트 템플릿 상태 표시 */}
      <div className={styles.formSection}>
        <Field>
          <Label weight="semibold">썸네일 생성 프롬프트 템플릿</Label>
          {templateLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', padding: tokens.spacingVerticalM }}>
              <Spinner size="small" />
              <Caption1 style={{ marginLeft: tokens.spacingHorizontalS }}>설정에서 템플릿 로드 중...</Caption1>
            </div>
          ) : (
            <Caption1>
              현재 설정된 템플릿을 사용합니다. 설정 → 썸네일 탭에서 수정할 수 있습니다.
            </Caption1>
          )}
        </Field>
      </div>

      {/* 장면 설명 — Replicate에서만 표시 */}
      {provider === "replicate" && (
        <div className={styles.formSection}>
          <Field>
            <Label weight="semibold">장면 설명</Label>
            <Textarea
              rows={5}
              placeholder="어떤 썸네일을 원하시나요? 인물의 표정, 상황, 감정을 구체적으로 적어주세요."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </Field>
          <TipCard className={styles.tipCard}>
            <Body1><strong>Tip.</strong></Body1>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
              <Badge appearance="outline">표정</Badge>
              <Text>+</Text>
              <Badge appearance="outline">구도(MCU/Close-up)</Badge>
              <Text>+</Text>
              <Badge appearance="outline">조명(dramatic)</Badge>
              <Text>+</Text>
              <Badge appearance="outline">배경(공항/사무실)</Badge>
              <Text>을 구체적으로 적을수록 결과가 좋아집니다.</Text>
            </div>
          </TipCard>
        </div>
      )}

      {/* 참고 이미지 업로드 (분석 보조) — 두 모드 공통 사용 가능 */}
      <div className={styles.formSection}>
        <Field>
          <Label weight="semibold">참고 이미지 (선택사항)</Label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`${styles.uploadArea} ${dragOver ? styles.uploadAreaDragOver : ''}`}
            onClick={onPickFile}
          >
            {imagePreview ? (
              <div className={styles.previewContainer}>
                <img src={imagePreview} alt="preview" className={styles.previewImage} />
                <div className={styles.previewInfo}>
                  <Body1 weight="semibold">{imageFile?.name}</Body1>
                  <Caption1>{(imageFile?.size / 1024 / 1024).toFixed(2)}MB</Caption1>
                  <div style={{ display: 'flex', gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalS }}>
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
                <div style={{ fontSize: '1.5rem', marginBottom: tokens.spacingVerticalS }}>⬆️</div>
                <Body1>클릭하거나 드래그하여 업로드</Body1>
                <Caption1>PNG, JPG, JPEG (최대 {MAX_UPLOAD_MB}MB, WEBP 불가)</Caption1>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg" // webp 제외
              style={{ display: 'none' }}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        </Field>

        {(fxLoading || fxErr || fxEn || fxKo) && (
          <div className="mt-4 rounded-lg border bg-gray-50 p-3">
            {fxErr && <div className="text-sm text-rose-600 mb-2">에러: {fxErr}</div>}
            {fxLoading && !fxErr && <div className="text-sm text-gray-600">이미지 분석 중…</div>}
            {fxEn && (
              <>
                <div className="text-[13px] font-medium mb-1">English Prompt</div>
                <textarea className="w-full h-28 border rounded p-2 text-xs" readOnly value={fxEn} />
              </>
            )}
            {fxKo && (
              <>
                <div className="text-[13px] font-medium mt-3 mb-1">한국어 번역</div>
                <textarea className="w-full h-28 border rounded p-2 text-xs" readOnly value={fxKo} />
              </>
            )}
          </div>
        )}

        <TipCard className="bg-white/70">참고 이미지 분석을 템플릿에 주입하면 일관성이 좋아집니다.</TipCard>
      </div>

      {/* 옵션들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 공통: 생성 개수 */}
        <div>
          <label className="font-semibold mb-2 block">생성 개수</label>
          <select className="w-full border rounded-lg p-2 text-sm" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </div>

        {/* 분기 옵션 */}
        {provider === "replicate" ? (
          <div>
            <label className="font-semibold mb-2 block">생성 모드</label>
            <select className="w-full border rounded-lg p-2 text-sm" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="dramatic">극적 & 자극적 모드</option>
              <option value="calm">차분 & 자연스러운 모드</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="font-semibold mb-2 block">가로세로 비율 (ImageFX)</label>
            <select className="w-full border rounded-lg p-2 text-sm" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
              {["1:1", "3:4", "4:3", "9:16", "16:9"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 생성 버튼 */}
      <Button
        appearance="primary"
        size="large"
        onClick={onGenerate}
        disabled={loading}
        icon={loading ? <Spinner size="small" /> : <SparkleRegular />}
        style={{ width: '100%', marginTop: tokens.spacingVerticalL }}
      >
        썸네일 생성하기
      </Button>

      {/* 결과 */}
      {results.length > 0 && (
        <div style={{ marginTop: tokens.spacingVerticalXXL }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM }}>
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
                <div style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
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
                          alert(`저장 실패: ${res?.message || "unknown"}`);
                        }
                      }}
                    >
                      다운로드
                    </Button>
                    <Button
                      size="small"
                      appearance="outline"
                      icon={<OpenRegular />}
                      as="a"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
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
