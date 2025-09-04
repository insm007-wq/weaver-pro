// src/pages/ThumbnailGenerator.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HiLightBulb } from "react-icons/hi";

function TipCard({ children, className = "" }) {
  return (
    <div
      className={`mt-2 flex items-start gap-3 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 ${className}`}
    >
      <div className="mt-0.5 shrink-0">
        <HiLightBulb className="h-4 w-4 text-warning-500" />
      </div>
      <div className="text-[13px] leading-6 text-neutral-700">{children}</div>
    </div>
  );
}

function Spinner({ size = 16 }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/** 업로드 정책 */
const MAX_UPLOAD_MB = 10; // 10MB로 제한

/** 프롬프트 템플릿 */
const DEFAULT_TEMPLATE = ``;

export default function ThumbnailGenerator() {
  const fileInputRef = useRef(null);

  /** 🔒 고정 폭 측정/저장 (리플리케이트 기준) */
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);

  /** 공통 상태 */
  const [provider, setProvider] = useState("replicate"); // 'replicate' | 'imagen3'
  const [metaTemplate, setMetaTemplate] = useState(DEFAULT_TEMPLATE);

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

  /** 안전한 미리보기 URL 해제 */
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

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
        description:
          provider === "replicate" ? prompt.trim() || undefined : undefined,
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

    if (provider === "imagen3") {
      // ✅ ImageFX(Imagen3): 장면 설명란 사용 X, 템플릿만 사용
      // {content}는 비워두고 {referenceAnalysis}만 주입 가능
      const core = (metaTemplate || "")
        .replaceAll("{content}", "")
        .replaceAll("{referenceAnalysis}", referenceAnalysis)
        .trim();
      return core;
    }

    // ✅ Replicate: 장면 설명 + 공통 키워드 + 모드
    const base = (prompt || "").trim();
    let core = (metaTemplate || "")
      .replaceAll("{content}", base)
      .replaceAll("{referenceAnalysis}", referenceAnalysis)
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

  /** 생성 버튼 핸들러 */
  const onGenerate = async () => {
    // 각 프로바이더별 필수 필드 가드
    if (
      provider === "replicate" &&
      !prompt.trim() &&
      !fxEn.trim() &&
      !metaTemplate.trim()
    ) {
      return alert("장면 설명 또는 템플릿/분석 결과 중 하나는 필요합니다.");
    }
    if (provider === "imagen3" && !metaTemplate.trim()) {
      return alert("ImageFX 모드에서는 템플릿이 필요합니다.");
    }

    // IPC 가드
    const hasReplicate = !!window?.api?.generateThumbnails;
    const hasImagen3 = !!window?.api?.generateThumbnailsGoogleImagen3;
    if (provider === "replicate" && !hasReplicate) {
      return alert(
        "Replicate IPC(generateThumbnails)가 없습니다. preload/main 설정을 확인하세요."
      );
    }
    if (provider === "imagen3" && !hasImagen3) {
      return alert(
        "Google Imagen3 IPC(generateThumbnailsGoogleImagen3)가 없습니다. preload/main 설정을 확인하세요."
      );
    }

    setLoading(true);
    setResults([]);
    setTookMs(null);

    try {
      const started = Date.now();
      const finalPrompt = buildFinalPrompt();
      setUsedPrompt(finalPrompt);

      let res;
      if (provider === "imagen3") {
        // ⬇️ Google Imagen3 호출 (count, aspectRatio 사용)
        res = await window.api.generateThumbnailsGoogleImagen3({
          prompt: finalPrompt,
          count,
          aspectRatio,
          // 추가 파라미터 필요하면 여기에…
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
        throw new Error(
          typeof res?.message === "string"
            ? res.message
            : JSON.stringify(res?.message)
        );
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
      className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-md"
      style={
        fixedWidthPx
          ? {
              width: `${fixedWidthPx}px`,
              minWidth: `${fixedWidthPx}px`,
              maxWidth: `${fixedWidthPx}px`,
              flex: `0 0 ${fixedWidthPx}px`,
              boxSizing: "border-box",
              // 스크롤바 유무에 따른 레이아웃 흔들림 방지
              scrollbarGutter: "stable both-edges",
            }
          : {
              scrollbarGutter: "stable both-edges",
            }
      }
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
          <span>🎯</span> 썸네일 생성기
        </h1>
        <span className="text-xs text-neutral-600 font-medium">
          PNG, JPG, JPEG · 최대 {MAX_UPLOAD_MB}MB (WEBP 불가)
        </span>
      </div>

      {/* 프로바이더 선택 */}
      <div className="mb-6">
        <label className="font-semibold text-neutral-900 mb-2 block">생성 엔진</label>

        {/* ✅ 고정폭 + 2열 그리드 */}
        <div className="w-full max-w-[520px]">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-gray-300">
            <button
              type="button"
              onClick={() => setProvider("replicate")}
              className={`h-10 w-full text-sm font-medium transition
                    ${
                      provider === "replicate"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
              aria-pressed={provider === "replicate"}
            >
              Replicate
            </button>

            <button
              type="button"
              onClick={() => setProvider("imagen3")}
              className={`h-10 w-full text-sm font-medium transition
                    ${
                      provider === "imagen3"
                        ? "bg-gray-900 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    }`}
              aria-pressed={provider === "imagen3"}
            >
              Google ImageFX (Imagen 3)
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Replicate는 장면 설명 + 템플릿, ImageFX는 템플릿 중심으로 생성합니다.
        </p>
      </div>

      {/* 프롬프트 템플릿 (공통) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="font-semibold">썸네일 생성 프롬프트 템플릿</label>
          <button
            onClick={() => setMetaTemplate(DEFAULT_TEMPLATE)}
            className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
            title="기본 템플릿으로 되돌리기"
          >
            기본값으로 초기화
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-2">
          <code className="bg-gray-100 px-1 rounded">{`{content}`}</code>,{" "}
          <code className="bg-gray-100 px-1 rounded">{`{referenceAnalysis}`}</code>{" "}
          변수를 사용할 수 있어요. ImageFX 모드에서는{" "}
          <code className="bg-gray-100 px-1 rounded">{`{content}`}</code>가
          비워질 수 있습니다.
        </p>
        <textarea
          rows={6}
          className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
          placeholder="여기에 템플릿을 작성하세요. {content}, {referenceAnalysis} 변수를 사용할 수 있습니다."
          value={metaTemplate}
          onChange={(e) => setMetaTemplate(e.target.value)}
        />
      </div>

      {/* 장면 설명 — Replicate에서만 표시 */}
      {provider === "replicate" && (
        <div className="mb-6">
          <label className="font-semibold mb-2 block">장면 설명</label>
          <textarea
            rows={5}
            placeholder="어떤 썸네일을 원하시나요? 인물의 표정, 상황, 감정을 구체적으로 적어주세요."
            className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <TipCard>
            <span className="font-medium text-gray-700 mr-1">Tip.</span>
            <span className="inline-flex flex-wrap items-center gap-1">
              <span className="inline-flex items-center rounded-md bg-white/80 px-2 py-0.5 text-[12px] font-medium text-gray-700 ring-1 ring-gray-200">
                표정
              </span>
              <span className="text-gray-400">+</span>
              <span className="inline-flex items-center rounded-md bg-white/80 px-2 py-0.5 text-[12px] font-medium text-gray-700 ring-1 ring-gray-200">
                구도(MCU/Close-up)
              </span>
              <span className="text-gray-400">+</span>
              <span className="inline-flex items-center rounded-md bg-white/80 px-2 py-0.5 text-[12px] font-medium text-gray-700 ring-1 ring-gray-200">
                조명(dramatic)
              </span>
              <span className="text-gray-400">+</span>
              <span className="inline-flex items-center rounded-md bg-white/80 px-2 py-0.5 text-[12px] font-medium text-gray-700 ring-1 ring-gray-200">
                배경(공항/사무실)
              </span>
              <span className="ml-1">
                을 구체적으로 적을수록 결과가 좋아집니다.
              </span>
            </span>
          </TipCard>
        </div>
      )}

      {/* 참고 이미지 업로드 (분석 보조) — 두 모드 공통 사용 가능 */}
      <div className="mb-6">
        <label className="font-semibold mb-2 block">
          참고 이미지 (선택사항)
        </label>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
            dragOver
              ? "border-blue-400 bg-blue-50/30"
              : "border-gray-300 hover:border-blue-400"
          }`}
          onClick={onPickFile}
        >
          {imagePreview ? (
            <div className="flex items-center gap-4">
              <img
                src={imagePreview}
                alt="preview"
                className="w-28 h-28 object-cover rounded-lg border"
              />
              <div className="text-left">
                <p className="text-sm font-medium">{imageFile?.name}</p>
                <p className="text-xs text-gray-500">
                  {(imageFile?.size / 1024 / 1024).toFixed(2)}MB
                </p>
                <div className="flex gap-2 mt-2">
                  <button
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
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                  >
                    제거
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      analyzeReference(imageFile);
                    }}
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
                    disabled={!imageFile || fxLoading}
                    title="참고 이미지 재분석"
                  >
                    {fxLoading ? "분석 중…" : "분석 다시 실행"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              <div className="text-2xl mb-2">⬆️</div>
              <p className="text-sm">클릭하거나 드래그하여 업로드</p>
              <p className="text-xs mt-1">
                PNG, JPG, JPEG (최대 {MAX_UPLOAD_MB}MB, WEBP 불가)
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg" // webp 제외
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        {(fxLoading || fxErr || fxEn || fxKo) && (
          <div className="mt-4 rounded-lg border bg-gray-50 p-3">
            {fxErr && (
              <div className="text-sm text-rose-600 mb-2">에러: {fxErr}</div>
            )}
            {fxLoading && !fxErr && (
              <div className="text-sm text-gray-600">이미지 분석 중…</div>
            )}
            {fxEn && (
              <>
                <div className="text-[13px] font-medium mb-1">
                  English Prompt
                </div>
                <textarea
                  className="w-full h-28 border rounded p-2 text-xs"
                  readOnly
                  value={fxEn}
                />
              </>
            )}
            {fxKo && (
              <>
                <div className="text-[13px] font-medium mt-3 mb-1">
                  한국어 번역
                </div>
                <textarea
                  className="w-full h-28 border rounded p-2 text-xs"
                  readOnly
                  value={fxKo}
                />
              </>
            )}
          </div>
        )}

        <TipCard className="bg-white/70">
          참고 이미지 분석을 템플릿에 주입하면 일관성이 좋아집니다.
        </TipCard>
      </div>

      {/* 옵션들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 공통: 생성 개수 */}
        <div>
          <label className="font-semibold mb-2 block">생성 개수</label>
          <select
            className="w-full border rounded-lg p-2 text-sm"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
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
            <select
              className="w-full border rounded-lg p-2 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="dramatic">극적 & 자극적 모드</option>
              <option value="calm">차분 & 자연스러운 모드</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="font-semibold mb-2 block">
              가로세로 비율 (ImageFX)
            </label>
            <select
              className="w-full border rounded-lg p-2 text-sm"
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
            >
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
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Spinner />}썸네일 생성하기
      </button>

      {/* 결과 */}
      {results.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <h2 className="text-lg font-semibold">생성 완료!</h2>
            {tookMs != null && (
              <span className="text-sm text-gray-500">
                {(tookMs / 1000).toFixed(1)}초 만에 {results.length}개의
                썸네일이 생성되었습니다.
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.map((r, i) => (
              <div
                key={i}
                className="rounded-xl border bg-white overflow-hidden shadow-sm"
              >
                <div className="bg-black/5">
                  <img
                    src={r.url}
                    alt={`thumb-${i + 1}`}
                    className="w-full object-cover"
                  />
                </div>
                <div className="p-3 flex items-center justify-between">
                  <div className="text-sm font-medium">썸네일 #{i + 1}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const res = await window.api.saveUrlToFile({
                          url: r.url,
                          suggestedName: `thumbnail-${i + 1}.jpg`, // JPG 저장 권장
                        });
                        if (!res?.ok && res?.message !== "canceled") {
                          alert(`저장 실패: ${res?.message || "unknown"}`);
                        }
                      }}
                      className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    >
                      다운로드
                    </button>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    >
                      새 창에서 보기
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="text-sm font-semibold mb-2">
              🧩 생성에 사용된 프롬프트
            </div>
            <pre className="text-xs leading-6 text-gray-700 bg-gray-50 border rounded-lg p-3 whitespace-pre-wrap">
              {usedPrompt}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
