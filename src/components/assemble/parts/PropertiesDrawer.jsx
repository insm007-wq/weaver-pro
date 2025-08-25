import { useRef, useState } from "react";

export default function PropertiesDrawer({ onPickVideo }) {
  const inputRef = useRef(null);
  const [pickedName, setPickedName] = useState("");

  const handleOpenPicker = () => inputRef.current?.click();

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 다시 선택 가능
    if (!f) return;
    // 파일을 바로 미리보기용 blob: URL로
    const url = URL.createObjectURL(f);
    setPickedName(f.name);
    onPickVideo?.({
      url,
      file: f,
      name: f.name,
      revoke: () => URL.revokeObjectURL(url),
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="text-sm font-semibold mb-2">속성</div>

      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">배경 소스</div>
        <button
          onClick={handleOpenPicker}
          className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
        >
          이미지/영상 선택
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleChange}
        />
        {pickedName ? (
          <div className="mt-2 text-[11px] text-slate-500 truncate">
            {pickedName}
          </div>
        ) : null}
      </div>

      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">맞춤</div>
        <div className="flex gap-2">
          <button className="h-9 flex-1 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
            Cover
          </button>
          <button className="h-9 flex-1 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
            Contain
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-slate-500 mb-1">Ken Burns</div>
        <div className="flex gap-2">
          <button className="h-9 flex-1 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
            켜기
          </button>
          <button className="h-9 flex-1 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
            끄기
          </button>
        </div>
      </div>

      <div className="mb-1">
        <div className="text-xs text-slate-500 mb-1">전환(Transition)</div>
        <div className="flex gap-2">
          <button className="h-9 flex-1 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
            디졸브
          </button>
          <button className="h-9 flex-1 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
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
