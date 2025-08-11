// src/pages/ThumbnailGenerator.jsx
import { useRef, useState } from "react";
import { HiLightBulb } from "react-icons/hi";

function TipCard({ children, className = "" }) {
  return (
    <div
      className={`mt-2 flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 ${className}`}
    >
      <div className="mt-0.5 shrink-0">
        <HiLightBulb className="h-4 w-4 text-amber-500" />
      </div>
      <div className="text-[13px] leading-6 text-gray-600">{children}</div>
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

export default function ThumbnailGenerator() {
  const fileInputRef = useRef(null);
  const [prompt, setPrompt] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [count, setCount] = useState(1);
  const [mode, setMode] = useState("dramatic"); // dramatic | calm
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // 결과 관련
  const [results, setResults] = useState([]); // [{url, w?, h?, fmt?}]
  const [usedPrompt, setUsedPrompt] = useState("");
  const [tookMs, setTookMs] = useState(null);

  const onPickFile = () => fileInputRef.current?.click();

  const onFile = (file) => {
    if (!file) return;
    if (!/image\/(png|jpe?g)/i.test(file.type)) {
      alert("PNG/JPG/JPEG만 업로드 가능합니다.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("최대 10MB까지 업로드 가능합니다.");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    onFile(file);
  };

  const fileToDataUrl = async (file) => {
    if (!file) return null;
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `data:${file.type};base64,${b64}`;
  };

  const buildFinalPrompt = () => {
    const base = prompt.trim();
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

    return `${base}\n\n${[...common, ...mood].join(", ")}`;
  };

  const onGenerate = async () => {
    if (!prompt.trim() && !imageFile) {
      alert("장면 설명 또는 참고 이미지를 입력해주세요.");
      return;
    }
    if (!window?.api?.generateThumbnails) {
      alert(
        "IPC generateThumbnails가 없습니다. preload/main 설정을 확인하세요."
      );
      return;
    }

    setLoading(true);
    setResults([]);
    setTookMs(null);

    try {
      const started = Date.now();
      const finalPrompt = buildFinalPrompt();
      setUsedPrompt(finalPrompt);

      // 참고 이미지(base64 data URL)
      const referenceImage = await fileToDataUrl(imageFile);

      // Electron main으로 호출 (Replicate 실행)
      const res = await window.api.generateThumbnails({
        prompt: finalPrompt,
        count,
        mode,
        referenceImage, // data URL 또는 null
      });

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
    <div className="max-w-4xl mx-auto p-8 bg-white rounded-2xl shadow-md">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span>🎯</span> 썸네일 생성기
        </h1>
        <span className="text-xs text-gray-500">
          PNG, JPG, JPEG · 최대 10MB
        </span>
      </div>

      {/* 장면 설명 */}
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

      {/* 참고 이미지 업로드 */}
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="mt-2 text-xs px-2 py-1 rounded border hover:bg-gray-50"
                >
                  제거
                </button>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">
              <div className="text-2xl mb-2">⬆️</div>
              <p className="text-sm">클릭하거나 드래그하여 업로드</p>
              <p className="text-xs mt-1">PNG, JPG, JPEG (최대 10MB)</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>

        <TipCard className="bg-white/70">
          참고 이미지를 업로드하면 스타일과 구도를 분석해 결과의 일관성이
          좋아집니다.
        </TipCard>
      </div>

      {/* 옵션 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
      </div>

      {/* 생성 버튼 */}
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <Spinner />}
        썸네일 생성하기
      </button>

      {/* 결과 섹션 */}
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
                    <a
                      href={r.url}
                      download={`thumbnail-${i + 1}.png`}
                      className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    >
                      다운로드
                    </a>
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

          {/* 사용된 프롬프트 */}
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
