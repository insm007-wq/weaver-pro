import { Field, Label, Dropdown, Option, Caption1 } from "@fluentui/react-components";
import { SettingsRegular } from "@fluentui/react-icons";
import { QUALITY_PRESETS } from "../../constants/thumbnailConstants";
import { StandardCard } from "../common";

const GenerationControls = ({ 
  count, 
  setCount, 
  qualityPreset, 
  setQualityPreset,
  provider,
  mode,
  setMode,
  aspectRatio,
  setAspectRatio
}) => {
  const controlsStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  const inputGroupStyle = {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  return (
    <StandardCard variant="glass" title="생성 설정" icon={<SettingsRegular />}>
      <div style={controlsStyle}>
        <div style={inputGroupStyle}>
          <Label weight="semibold">생성 개수</Label>
          <Dropdown value={count.toString()} onOptionSelect={(_, data) => setCount(Number(data.optionValue))}>
            {[1, 2, 3, 4].map((n) => (
              <Option key={n} value={n.toString()}>
                {n}개
              </Option>
            ))}
          </Dropdown>
        </div>

        <div style={inputGroupStyle}>
          <Label weight="semibold">품질 설정</Label>
          <Dropdown value={qualityPreset} onOptionSelect={(_, data) => setQualityPreset(data.optionValue)}>
            {QUALITY_PRESETS.map((preset) => (
              <Option key={preset.value} value={preset.value}>
                <div>
                  <div style={{ fontWeight: "600" }}>{preset.label}</div>
                  <Caption1>
                    {preset.description} • {preset.estimatedTime}
                  </Caption1>
                </div>
              </Option>
            ))}
          </Dropdown>
        </div>

        <div style={inputGroupStyle}>
          <Label weight="semibold">
            {provider === "replicate" ? "생성 모드" : "가로세로 비율"}
          </Label>
          {provider === "replicate" ? (
            <Dropdown value={mode} onOptionSelect={(_, data) => setMode(data.optionValue)}>
              <Option value="dramatic">🔥 극적 & 자극적 모드</Option>
              <Option value="calm">🌱 차분 & 자연스러운 모드</Option>
            </Dropdown>
          ) : (
            <Dropdown value={aspectRatio} onOptionSelect={(_, data) => setAspectRatio(data.optionValue)}>
              {["1:1", "3:4", "4:3", "9:16", "16:9"].map((r) => (
                <Option key={r} value={r}>
                  {r}
                </Option>
              ))}
            </Dropdown>
          )}
        </div>
      </div>
    </StandardCard>
  );
};

export { QUALITY_PRESETS };
export default GenerationControls;