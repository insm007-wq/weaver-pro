// src/components/assemble/parts/PropertiesDrawer.jsx
// -----------------------------------------------------------------------------
// 속성 패널(배경 소스 선택)
// - UI는 그대로 유지하고, "선택한 파일을 프로젝트에 저장 → 절대경로를 씬에 주입" 로직만 보강
// - onPickVideo(payload) 콜백으로 부모에 전달:
//    payload = {
//      path: "C:\\...\\project\\assets\\xxx.mp4", // ✅ ffmpeg/미리보기용 로컬 절대경로
//      url: "blob:...",                            // 미리보기용 (videoPathToUrl로 생성)
//      name: "xxx.mp4",
//      type: "video/mp4" | "image/png" | ...,
//      revoke: () => URL.revokeObjectURL(url)
//    }
// -----------------------------------------------------------------------------

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

  // 파일을 프로젝트에 저장 → 경로/미리보기 URL 생성 → 부모로 전달
  const persistFileToProject = async (file) => {
    // 1) 파일 바이트 읽기 (renderer 환경)
    const ab = await file.arrayBuffer();
    const buffer = new Uint8Array(ab);

    // 2) 카테고리/파일명 결정
    //    * 카테고리는 하나로 묶어도 되고 용도별로 나눠도 됨. 여기선 "assets"
    const category = "assets";
    const fileName = file.name || `asset_${Date.now()}`;

    // 3) 프로젝트에 저장 (메인 프로세스에서 실제 파일 쓰기)
    const res = await window.api.saveBufferToProject({
      category,
      fileName,
      buffer,
    });

    // files/saveToProject 응답 규격: { ok: true, path: "C:\\...\\file.mp4", mime?:string }
    if (!res?.ok || !res?.path) {
      throw new Error(res?.message || "파일 저장에 실패했습니다.");
    }

    // 4) 미리보기용 blob: URL 생성 (보안/경로 이슈 회피)
    const previewUrl = await window.api.videoPathToUrl(res.path);

    return {
      path: res.path, // ✅ 로컬 절대경로 (씬에 저장 필수)
      url: previewUrl,
      name: fileName,
      type: file.type || res.mime || "",
      revoke: () => {
        try {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
        } catch {}
      },
    };
  };

  const onFile = async (e) => {
    try {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;

      // (중요) blob URL을 상태에 오래 들고 있지 말고, 프로젝트에 저장하여 "절대경로"를 확보
      const payload = await persistFileToProject(f);

      // 부모에 전달 → 부모는 선택된 씬에
      //   scene.asset = { type: 'video'|'image', path: payload.path }
      // 식으로 주입해 주세요.
      onPickVideo?.(payload);
    } catch (err) {
      console.error("[PropertiesDrawer] onFile error:", err);
      alert(err?.message || "파일 처리 중 오류가 발생했습니다.");
    }
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
