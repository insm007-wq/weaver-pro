import React from "react";
import {
  Card,
  Text,
  Dropdown,
  Option,
  Field,
  Badge,
  Button,
  Spinner,
  tokens,
} from "@fluentui/react-components";
import { MicRegular, PlayRegular, ShieldError24Regular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles, useLayoutStyles } from "../../../styles/commonStyles";

function VoiceSettingsCard({ 
  form, 
  voices, 
  voiceLoading, 
  voiceError, 
  onChange, 
  onPreviewVoice, 
  onRetryVoiceLoad 
}) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const layoutStyles = useLayoutStyles();

  const selectedVoice = voices.find((v) => v.id === form.voiceId);

  const getVoiceDescription = (voiceName) => {
    const name = voiceName?.toLowerCase() || "";
    if (name.includes("alice")) return "💬 친근한 대화형 - 리뷰, 브이로그에 적합한 자연스러운 톤";
    if (name.includes("bella") || name.includes("rachel")) return "📰 뉴스/설명형 - 튜토리얼, 가이드에 적합한 중립적 톤";
    if (name.includes("dorothy") || name.includes("elli")) return "🎓 교육/강의형 - 온라인 강의, 학습에 최적화 (가장 추천)";
    if (name.includes("josh")) return "🏢 차분/전문형 - B2B, 기업 소개에 적합한 안정적 톤";
    if (name.includes("sam")) return "⚡ 에너지 광고형 - 프로모션, 광고에 적합한 역동적 톤";
    if (name.includes("domi")) return "📚 스토리텔링 - 다큐멘터리, 힐링 콘텐츠에 적합한 감성적 톤";
    if (name.includes("fin")) return "🎭 다양한 표현형 - 창의적 콘텐츠, 엔터테인먼트에 적합";
    if (name.includes("sarah")) return "🌟 프리미엄 여성형 - 고급스러운 브랜드, 럭셔리 콘텐츠용";
    return "🎓 교육/강의형 - 한국어 콘텐츠에 가장 적합한 범용 목소리";
  };

  return (
    <Card className={cardStyles.settingsCard}>
      <div className={settingsStyles.sectionHeader}>
        <div className={settingsStyles.sectionTitle}>
          <MicRegular />
          <Text size={400} weight="semibold">음성 설정</Text>
        </div>
      </div>
      
      <div className={layoutStyles.gridTwo}>
        <Field label="TTS 엔진">
          <Dropdown
            value={form.ttsEngine === "google" ? "Google Cloud TTS" : "ElevenLabs"}
            selectedOptions={[form.ttsEngine]}
            onOptionSelect={(_, d) => onChange("ttsEngine", d.optionValue)}
            size="large"
          >
            <Option value="google">Google Cloud TTS</Option>
            <Option value="elevenlabs">ElevenLabs</Option>
          </Dropdown>
        </Field>
        
        <Field label="말하기 속도">
          <Dropdown
            value={form.speed === "0.9" ? "느림 (0.9x)" : form.speed === "1.1" ? "빠름 (1.1x)" : "보통 (1.0x)"}
            selectedOptions={[form.speed]}
            onOptionSelect={(_, d) => onChange("speed", d.optionValue)}
            size="large"
          >
            <Option value="0.9">느림 (0.9x)</Option>
            <Option value="1.0">보통 (1.0x)</Option>
            <Option value="1.1">빠름 (1.1x)</Option>
          </Dropdown>
        </Field>
        
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="목소리">
            <Dropdown
              value={selectedVoice?.name || (voiceLoading ? "불러오는 중…" : "목소리 선택")}
              selectedOptions={form.voiceId ? [form.voiceId] : []}
              onOptionSelect={(_, d) => onChange("voiceId", d.optionValue)}
              size="large"
              disabled={voiceLoading || !!voiceError}
            >
              {voices.map((v) => (
                <Option key={v.id} value={v.id}>
                  {v.name || v.id}
                  {v.type && (
                    <Badge size="small" appearance="tint" style={{ marginLeft: "8px" }}>
                      {v.type}
                    </Badge>
                  )}
                </Option>
              ))}
            </Dropdown>
            
            {selectedVoice && (
              <div style={{
                marginTop: 12,
                padding: 12,
                background: "#f8f9fa",
                borderRadius: 8,
                border: "1px solid rgba(0,0,0,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <Text weight="semibold" size={300}>🎤 {selectedVoice.name}</Text>
                  <Badge appearance="tint" color="brand">
                    {form.ttsEngine === "elevenlabs" ? "ElevenLabs" : "Google TTS"}
                  </Badge>
                </div>
                
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <Badge appearance="outline" size="small">
                    {selectedVoice.gender === "MALE" ? "👨 남성" : selectedVoice.gender === "FEMALE" ? "👩 여성" : "🧑 중성"}
                  </Badge>
                  <Badge appearance="outline" size="small">{selectedVoice.type}</Badge>
                  <Badge appearance="outline" size="small">{selectedVoice.language}</Badge>
                </div>
                
                <div style={{
                  marginBottom: 8,
                  padding: 8,
                  background: "#f8f9fa",
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}>
                  <Text size={200} style={{ color: "#666", lineHeight: 1.4 }}>
                    {getVoiceDescription(selectedVoice.name)}
                  </Text>
                </div>
                
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<PlayRegular />}
                  onClick={() => onPreviewVoice(selectedVoice.id, selectedVoice.name)}
                >
                  미리듣기
                </Button>
              </div>
            )}
          </Field>
        </div>
      </div>

      {voiceError && (
        <div style={{
          marginTop: tokens.spacingVerticalM,
          border: `1px solid ${tokens.colorPaletteRedBorder2}`,
          background: "#fff5f5",
          borderRadius: 12,
          padding: tokens.spacingVerticalM,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <ShieldError24Regular />
            <Text weight="semibold">TTS 음성 목록 로드 실패</Text>
          </div>
          <Text style={{ marginBottom: 8 }}>
            {form.ttsEngine === "elevenlabs" ? "ElevenLabs" : "Google TTS"} 음성 목록을 불러올 수 없습니다. API 키를 확인해주세요.
            <br />
            API 오류 ({voiceError.code}): {voiceError.message || "API 키가 설정되지 않았습니다."}
          </Text>
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="secondary" onClick={onRetryVoiceLoad}>
              다시 시도
            </Button>
            <Button appearance="outline" onClick={() => {}}>
              API 키 설정
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default VoiceSettingsCard;