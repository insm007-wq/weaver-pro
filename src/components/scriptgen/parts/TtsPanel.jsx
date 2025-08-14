import { SelectField, TextField } from "./SmallUI";
import { TTS_ENGINES, VOICES_BY_ENGINE } from "../constants";

export default function TtsPanel({ form, onChange, voices }) {
  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <SelectField
        label="TTS 엔진"
        value={form.ttsEngine}
        options={TTS_ENGINES}
        onChange={(v) => {
          onChange("ttsEngine", v);
          const vs = VOICES_BY_ENGINE[v] || [];
          if (vs.length) onChange("voiceName", vs[0]);
        }}
      />
      <SelectField
        label="보이스"
        value={form.voiceName}
        options={voices.map((v) => ({ label: v, value: v }))}
        onChange={(v) => onChange("voiceName", v)}
      />
      <TextField
        label="속도(speakingRate)"
        value={form.speakingRate}
        onChange={(v) => onChange("speakingRate", v)}
        placeholder="1.0"
      />
      <TextField
        label="피치(pitch)"
        value={form.pitch}
        onChange={(v) => onChange("pitch", v)}
        placeholder="0"
      />
    </div>
  );
}
