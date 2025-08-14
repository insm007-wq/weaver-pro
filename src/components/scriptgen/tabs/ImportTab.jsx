import { Card } from "../parts/SmallUI";
import TtsPanel from "../parts/TtsPanel";

export default function ImportTab({
  form,
  onChange,
  voices,
  importSrtRef,
  importMp3Ref,
  onImportSrt,
  onUseMp3,
}) {
  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            자막 파일(SRT)
          </label>
          <div className="flex gap-2">
            <input
              ref={importSrtRef}
              type="file"
              accept=".srt"
              className="text-sm"
            />
            <button
              onClick={onImportSrt}
              className="px-3 py-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200"
            >
              불러오기
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            음성 파일(MP3) — 선택
          </label>
          <div className="flex gap-2">
            <input
              ref={importMp3Ref}
              type="file"
              accept=".mp3"
              className="text-sm"
            />
            <button
              onClick={onUseMp3}
              className="px-3 py-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200"
            >
              프로젝트에 저장
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            MP3를 업로드하지 않으면, 아래 TTS 옵션으로 자동 생성합니다.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <TtsPanel form={form} onChange={onChange} voices={voices} />
      </div>
    </Card>
  );
}
