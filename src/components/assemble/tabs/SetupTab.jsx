import SectionCard from "../parts/SectionCard";

function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`w-10 h-6 rounded-full transition ${
          checked ? "bg-blue-600" : "bg-slate-300"
        } relative`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </span>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}

export default function SetupTab({
  srtConnected,
  mp3Connected,
  setSrtConnected,
  setMp3Connected,
  autoMatch,
  setAutoMatch,
  autoOpts,
  setAutoOpts,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <SectionCard
        title="자막 / 오디오 연결"
        right={<span className="text-xs text-slate-500">프로젝트 준비</span>}
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setSrtConnected(true)}
            className={`h-10 px-4 rounded-lg text-sm border ${
              srtConnected
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {srtConnected ? "SRT 연결됨" : "SRT 연결"}
          </button>

          <button
            onClick={() => setMp3Connected(true)}
            className={`h-10 px-4 rounded-lg text-sm border ${
              mp3Connected
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {mp3Connected ? "오디오 연결됨" : "오디오 연결(MP3)"}
          </button>

          <button
            onClick={() => alert("Canva 로그인/연결 플로우는 다음 단계에서!")}
            className="h-10 px-4 rounded-lg text-sm border bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            Canva 연결
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="자동 매칭"
        right={
          <span className="text-xs text-slate-500">신규 에셋 자동 배치</span>
        }
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={autoMatch}
            onChange={setAutoMatch}
            label="자동 매칭 ON/OFF"
          />
          <div className="grid grid-cols-2 gap-3">
            {[
              ["emptyOnly", "빈 씬만 채우기"],
              ["byKeywords", "키워드 매칭 사용"],
              ["byOrder", "순차 배치 사용"],
              ["overwrite", "덮어쓰기 허용"],
            ].map(([k, label]) => (
              <Toggle
                key={k}
                checked={!!autoOpts[k]}
                onChange={(v) => setAutoOpts((s) => ({ ...s, [k]: v }))}
                label={label}
              />
            ))}
          </div>
          <div className="text-[12px] text-slate-500">
            새로 다운로드된 에셋을 감지하면 규칙에 따라 빈 씬부터 자동
            배치합니다. 실패 시 자동으로 OFF 됩니다.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
