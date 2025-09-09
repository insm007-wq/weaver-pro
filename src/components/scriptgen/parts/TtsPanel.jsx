import React from "react";
import {
  makeStyles,
  tokens,
  shorthands,
  Text,
  Field,
  Input,
  Dropdown,
  Option,
} from "@fluentui/react-components";
import { TTS_ENGINES, VOICES_BY_ENGINE } from "../constants";

const useStyles = makeStyles({
  container: {
    ...shorthands.margin(tokens.spacingVerticalL, '0'),
  },
  sectionTitle: {
    ...shorthands.margin('0', '0', tokens.spacingVerticalM, '0'),
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    ...shorthands.gap(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },
});

export default function TtsPanel({ form, onChange, voices, disabled = false }) {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Text className={styles.sectionTitle} weight="semibold" size={400}>
        🔊 음성 합성 설정
      </Text>
      <div className={styles.grid}>
        <Field label="TTS 엔진">
          <Dropdown
            value={TTS_ENGINES.find(opt => opt.value === form.ttsEngine)?.label || ""}
            onOptionSelect={(_, data) => {
              onChange("ttsEngine", data.optionValue);
              const vs = VOICES_BY_ENGINE[data.optionValue] || [];
              if (vs.length) onChange("voiceName", vs[0]);
            }}
            disabled={disabled}
          >
            {TTS_ENGINES.map((option) => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="보이스">
          <Dropdown
            value={form.voiceName || ""}
            onOptionSelect={(_, data) => onChange("voiceName", data.optionValue)}
            disabled={disabled}
          >
            {voices.map((voice) => (
              <Option key={voice} value={voice}>
                {voice}
              </Option>
            ))}
          </Dropdown>
        </Field>
        <Field label="속도">
          <Input
            value={form.speakingRate || ""}
            onChange={(_, data) => onChange("speakingRate", data.value)}
            placeholder="1.0 (기본값)"
            disabled={disabled}
          />
        </Field>
        <Field label="피치">
          <Input
            value={form.pitch || ""}
            onChange={(_, data) => onChange("pitch", data.value)}
            placeholder="0 (기본값)"
            disabled={disabled}
          />
        </Field>
      </div>
    </div>
  );
}
