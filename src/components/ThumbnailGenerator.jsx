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

/** 기본 템플릿 (원하면 자유롭게 바꿔도 OK) */
const DEFAULT_TEMPLATE = `Imagen-3 결과를 참고해서
붙여넣기한 사진이나 붙여넣기한 내용을 토대로
인물의 표정, 인물의 위치 및 배치, 복장을 자세히 묘사 하고 분석한 뒤에
Imagen-3 프롬프트를 만들어줘. 프롬프트는 영어로 만들어줘.
더 극적이고 자극적으로 만들어줘.
당신은 "Imagen-3 프롬프트 제너레이터"입니다.
사용자가 아래 형식으로 **이미지나 장면 설명**을 붙여넣으면, 곧바로 상세하고 예술적인 이미지 생성 프롬프트를 출력해야 합니다.

### 장면 설명: {content}{referenceAnalysis}

1. 원본 설명에서 **주제 대상**(사람·사물·생물·장소 등)과 **핵심 특징**(머리 모양·의상·표정 등)을 뽑아
 → "길게 늘어뜨린 붉은색 머리를 두 겹의 굵은 땋은 머리로 스타일링한 아시아 여인"

2. 배경·장면·조명·텍스처·소품·분위기·연출·키워드 등을
 - **조명·텍스처**: "빨강·파랑 네온 조명이 희미하게 깔린 어두운 작업실"
 - **소품·소도구**: "흐릿한 빛을 발하는 버섯과 커다란 체스말"
 - **스타일**: "흔들리는 필름 그레인과 구불구불한 경계의 빈티지 필름 테두리"
 - **암시적 요소**: "반투명 천이 부드러운 곡선을 은근히 드러내는 암시적 누드 표현"
 - **분위기 키워드**: "alluring, enigmatic, provocative"
 - **구도·무대감**: "관객 뒤에서 비추는 극장 조명 같은 무대감", "하단 1/3은 자막을 위한 여백으로 비워 두고 인물은 프레임 상단 중앙에 배치"
 - **후처리·효과**: "형광 빛 에너지가 공중에서 소용돌이치는 초현실적 효과"
 - **촬영 스타일**: "상반신 중심 구도 (medium close-up), 감정 중심 포커싱"
 - **썸네일 최적화**: "thumbnail-friendly framing, emotional clarity, caption-safe layout"

3. 위 요소들을 **자연스러운 한 문장**으로 조합해 최종 프롬프트를 생성한다.
 - 절대 "[ ]" 같은 플레이스홀더를 남기지 말 것.
 - 묘사된 디테일, 감성 단어, 연출 단어를 빠짐없이 담을 것.

### 중요한 제약사항:
- 반드시 **Asian person** 또는 **Korean** 명시 (동양인 인물로 생성)
- 반드시 **no text, no words, no letters** 포함 (글자 없이 생성)
- **16:9 aspect ratio** 명시 (썸네일 비율)
- **ultra-realistic, cinematic style** 포함 (고품질 스타일)
- **dramatic lighting** 포함 (극적인 조명)

### 사용 예시:
**사무실 커피 모멸 장면**
"An explosive moment of humiliation unfolds in a high-pressure South Korean office: a furious male team leader in a sharply tailored navy suit hurls a full cup of coffee at a young Korean female employee. The liquid detonates mid-air in a dramatic burst—dark coffee splattering in every direction, frozen in a chaotic, high-speed arc that captures each droplet suspended in motion. The young woman, wearing a crisp white blouse now soaked through and clinging to her skin, reveals the faint silhouette of her undergarments beneath, amplifying her visible vulnerability... ultra-realistic, cinematic style with dramatic lighting, medium close-up framing, 16:9 aspect ratio, no text, no words, no letters"

**공항 보안대치 장면**
"A high-stakes confrontation unfolds at a sleek, modern airport security checkpoint: a confident Asian woman with sharp features and shoulder-length jet-black hair stands tall in a form-fitting black blazer that accentuates her silhouette, worn open over a low-cut, silk white blouse that subtly reveals her curves with a commanding sensuality. Her expression is one of poised indignation... ultra-realistic, cinematic style with dramatic lighting, medium close-up framing, 16:9 aspect ratio, no text, no words, no letters"

영문 Imagen-3 생성 프롬프트만 응답해주세요:`;

export default function ThumbnailGenerator() {
  const fileInputRef = useRef(null);

  const [prompt, setPrompt] = useState("");
  const [metaTemplate, setMetaTemplate] = useState(DEFAULT_TEMPLATE);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const [count, setCount] = useState(1);
  const [mode, setMode] = useState("dramatic"); // dramatic | calm

  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // 결과
  const [results, setResults] = useState([]); // [{url}]
  const [usedPrompt, setUsedPrompt] = useState("");
  const [tookMs, setTookMs] = useState(null);

  const onPickFile = () => fileInputRef.current?.click();

  const onFile = (file) => {
    if (!file) return;
    if (!/image\/(png|jpe?g)/i.test(file.type))
      return alert("PNG/JPG/JPEG만 업로드 가능합니다.");
    if (file.size > 10 * 1024 * 1024)
      return alert("최대 10MB까지 업로드 가능합니다.");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
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

  /** 최종 프롬프트 만들기: 템플릿 → 공통 키워드 덧붙이기 */
  const buildFinalPrompt = () => {
    const base = prompt.trim();
    const referenceAnalysis = ""; // (참고 이미지 분석: 추후 추가 예정)
    let core = (metaTemplate || "")
      .replaceAll("{content}", base)
      .replaceAll("{referenceAnalysis}", referenceAnalysis)
      .trim();

    if (!core) core = base; // 템플릿이 비어있다면 기존 방식 유지

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

  const onGenerate = async () => {
    if (!prompt.trim() && !imageFile)
      return alert("장면 설명 또는 참고 이미지를 입력해주세요.");
    if (!window?.api?.generateThumbnails)
      return alert(
        "IPC generateThumbnails가 없습니다. preload/main 설정을 확인하세요."
      );

    setLoading(true);
    setResults([]);
    setTookMs(null);

    try {
      const started = Date.now();
      const finalPrompt = buildFinalPrompt();
      setUsedPrompt(finalPrompt);

      const referenceImage = await fileToDataUrl(imageFile);

      const res = await window.api.generateThumbnails({
        prompt: finalPrompt,
        count,
        mode,
        referenceImage,
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

      {/* ▶ 프롬프트 템플릿 */}
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
          이 템플릿은 사용자가 입력한 장면 설명을 바탕으로 실제 이미지 생성
          프롬프트를 만드는 데 사용됩니다.{" "}
          <code className="bg-gray-100 px-1 rounded">{`{content}`}</code>,{" "}
          <code className="bg-gray-100 px-1 rounded">{`{referenceAnalysis}`}</code>{" "}
          변수를 사용할 수 있습니다.
        </p>
        <textarea
          rows={6}
          className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
          placeholder="여기에 템플릿을 작성하세요. {content}, {referenceAnalysis} 변수를 사용할 수 있습니다."
          value={metaTemplate}
          onChange={(e) => setMetaTemplate(e.target.value)}
        />
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
