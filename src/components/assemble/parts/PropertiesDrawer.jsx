import { useRef } from "react";

export default function PropertiesDrawer({
  value,
  onPickVideo,
  onChangeFit,
  onToggleKenBurns,
  onChangeTransition,
}) {
  const {
    fileName = "",
    fit = "cover",
    kenBurns = false,
    transition = "none",
  } = value || {};
  const inputRef = useRef(null);

  const openPicker = () => inputRef.current?.click();
  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const url = URL.createObjectURL(f);
    onPickVideo?.({
      url,
      file: f,
      name: f.name,
      revoke: () => URL.revokeObjectURL(url),
    });
  };

  const btn = (active) =>
    `h-9 flex-1 rounded-lg text-sm border ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "border-slate-200 hover:bg-slate-50"
    }`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">속성</div>

      {/* 배경 소스 */}
      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">배경 소스</div>
        <button
          onClick={openPicker}
          className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
        >
          이미지/영상 선택
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={onFile}
        />
        {fileName ? (
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            {fileName}
          </div>
        ) : null}
      </div>

      {/* 맞춤 */}
      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">맞춤</div>
        <div className="flex gap-2">
          <button
            className={btn(fit === "cover")}
            onClick={() => onChangeFit?.("cover")}
          >
            Cover
          </button>
          <button
            className={btn(fit === "contain")}
            onClick={() => onChangeFit?.("contain")}
          >
            Contain
          </button>
        </div>
      </div>

      {/* Ken Burns */}
      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">Ken Burns</div>
        <div className="flex gap-2">
          <button
            className={btn(kenBurns)}
            onClick={() => onToggleKenBurns?.(true)}
          >
            켜기
          </button>
          <button
            className={btn(!kenBurns)}
            onClick={() => onToggleKenBurns?.(false)}
          >
            끄기
          </button>
        </div>
      </div>

      {/* 전환 */}
      <div>
        <div className="text-xs text-slate-500 mb-1">전환(Transition)</div>
        <div className="flex gap-2">
          <button
            className={btn(transition === "dissolve")}
            onClick={() => onChangeTransition?.("dissolve")}
          >
            디졸브
          </button>
          <button
            className={btn(transition === "none")}
            onClick={() => onChangeTransition?.("none")}
          >
            없음
          </button>
        </div>
        <div className="text-[11px] text-slate-400 mt-2">
          * 겹치는 구간이 있을 때 디졸브가 적용됩니다(기본 12프레임).
        </div>
      </div>
    </div>
  );
}
