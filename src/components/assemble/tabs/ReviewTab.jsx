import SectionCard from "../parts/SectionCard";
import SubtitlePreview from "../parts/SubtitlePreview";

export default function ReviewTab({
  scenes,
  selectedSceneIdx,
  srtConnected,
  mp3Connected,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <SectionCard
        title="미리보기"
        right={
          <div className="text-xs text-slate-500">
            자막: {srtConnected ? "연결" : "미연결"} · 오디오:{" "}
            {mp3Connected ? "연결" : "미연결"}
          </div>
        }
        className="lg:col-span-2"
      >
        <div className="aspect-video w-full bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center text-slate-500">
          (에셋이 없으면) 배경 에셋을 추가하세요
        </div>

        <div className="mt-3 flex gap-2">
          <button className="h-10 px-4 rounded-lg border border-slate-200 text-sm hover:bg-slate-50">
            프레임 미리보기
          </button>
          <button className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500">
            초안 내보내기
          </button>
        </div>
      </SectionCard>

      <SubtitlePreview scenes={scenes} />
    </div>
  );
}
