import { Card } from "../parts/SmallUI";

export default function PromptTab({
  genPrompt,
  setGenPrompt,
  refPrompt,
  setRefPrompt,
  onSave,
  onReset,
  savedAt,
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">프롬프트 관리</div>
        <div className="text-xs text-slate-500">
          {savedAt ? `저장됨: ${savedAt.toLocaleTimeString()}` : ""}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            대본 생성 프롬프트
          </label>
          <textarea
            className="w-full h-64 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={genPrompt}
            onChange={(e) => setGenPrompt(e.target.value)}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            사용 변수: {"{topic}, {style}, {duration}, {maxScenes}"}
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            레퍼런스 분석 프롬프트
          </label>
          <textarea
            className="w-full h-64 text-sm rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
            value={refPrompt}
            onChange={(e) => setRefPrompt(e.target.value)}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            사용 변수: {"{referenceScript}, {topic}"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onSave}
          className="px-3 py-2 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-500"
        >
          저장
        </button>
        <button
          onClick={onReset}
          className="px-3 py-2 text-xs rounded-lg bg-slate-100 hover:bg-slate-200"
        >
          기본값으로 초기화
        </button>
      </div>
    </Card>
  );
}
