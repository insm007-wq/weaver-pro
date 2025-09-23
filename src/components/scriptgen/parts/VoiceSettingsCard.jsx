import React from "react";
import { Card, Text, Dropdown, Option, Field, Badge, Button, Spinner, tokens } from "@fluentui/react-components";
import { MicRegular, PlayRegular, ShieldError24Regular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles, useLayoutStyles } from "../../../styles/commonStyles";

function VoiceSettingsCard({ form, voices, voiceLoading, voiceError, onChange, onPreviewVoice, onRetryVoiceLoad }) {
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
    <Card
      className={cardStyles.settingsCard}
      style={{
        padding: "18px",
        borderRadius: 16,
        borderColor: tokens.colorNeutralStroke2,
      }}
    >
      {/* 헤더 */}
      <div className={settingsStyles.sectionHeader} style={{ marginBottom: 8 }}>
        <div className={settingsStyles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MicRegular />
          <Text size={500} weight="semibold" style={{ letterSpacing: 0.2 }}>
            음성 설정
          </Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
          TTS 엔진 · 말하기 속도 · 목소리를 선택해 나레이션 톤을 맞춰요.
        </Text>
      </div>

      {/* 상단 상태 바 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 28,
          marginBottom: 8,
        }}
      >
        {voiceLoading && (
          <>
            <Spinner size="tiny" />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              음성 목록을 불러오는 중…
            </Text>
          </>
        )}
        {!voiceLoading && !voiceError && (
          <Badge appearance="tint" color="brand">
            {voices.length ? `${voices.length}개 음성 사용 가능` : "목록 비어 있음"}
          </Badge>
        )}
      </div>

      {/* 폼: 2열 그리드 */}
      <div className={layoutStyles.gridTwo} style={{ gap: 16, alignItems: "start" }}>
        {/* TTS 엔진 */}
        <Field
          label={
            <Text size={300} weight="semibold">
              TTS 엔진
            </Text>
          }
          hint={
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Google: 안정적 발음
            </Text>
          }
        >
          <Dropdown
            value="Google Cloud TTS"
            selectedOptions={["google"]}
            onOptionSelect={(_, d) => onChange("ttsEngine", d.optionValue)}
            size="medium" /* 🔧 large → medium */
            style={{ minHeight: 36 }}
          >
            <Option value="google">Google Cloud TTS</Option>
          </Dropdown>
        </Field>

        {/* 말하기 속도 */}
        <Field
          label={
            <Text size={300} weight="semibold">
              말하기 속도
            </Text>
          }
          hint={
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              0.95~1.05 범위가 대부분 콘텐츠에 무난
            </Text>
          }
        >
          <Dropdown
            value={form.speed === "0.9" ? "느림 (0.9x)" : form.speed === "1.1" ? "빠름 (1.1x)" : "보통 (1.0x)"}
            selectedOptions={[form.speed]}
            onOptionSelect={(_, d) => onChange("speed", d.optionValue)}
            size="medium" /* 🔧 large → medium */
            style={{ minHeight: 36 }}
          >
            <Option value="0.9">느림 (0.9x)</Option>
            <Option value="1.0">보통 (1.0x)</Option>
            <Option value="1.1">빠름 (1.1x)</Option>
          </Dropdown>
        </Field>

        {/* 목소리 */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Field
            label={
              <Text size={300} weight="semibold">
                목소리
              </Text>
            }
            hint={
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                엔진 선택 후 목록에서 원하는 톤을 고르세요.
              </Text>
            }
          >
            <Dropdown
              value={selectedVoice?.name || (voiceLoading ? "불러오는 중…" : "목소리 선택")}
              selectedOptions={form.voiceId ? [form.voiceId] : []}
              onOptionSelect={(_, d) => onChange("voiceId", d.optionValue)}
              size="medium" /* 🔧 large → medium */
              disabled={voiceLoading || !!voiceError}
              style={{ minHeight: 36 }}
            >
              {voices.map((v) => (
                <Option key={v.id} value={v.id}>
                  {v.name || v.id}
                  {v.type && (
                    <Badge size="small" appearance="tint" style={{ marginLeft: 8 }}>
                      {v.type}
                    </Badge>
                  )}
                </Option>
              ))}
            </Dropdown>

            {/* 선택한 목소리 정보 패널 */}
            {selectedVoice && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${tokens.colorNeutralStroke2}`,
                  background: tokens.colorNeutralBackground2,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Text weight="semibold" size={300}>
                    🎤 {selectedVoice.name}
                  </Text>
                  <Badge appearance="tint" color="brand">
                    Google TTS
                  </Badge>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <Badge appearance="outline" size="small">
                    {selectedVoice.gender === "MALE" ? "👨 남성" : selectedVoice.gender === "FEMALE" ? "👩 여성" : "🧑 중성"}
                  </Badge>
                  {selectedVoice.type && (
                    <Badge appearance="outline" size="small">
                      {selectedVoice.type}
                    </Badge>
                  )}
                  {selectedVoice.language && (
                    <Badge appearance="outline" size="small">
                      {selectedVoice.language}
                    </Badge>
                  )}
                </div>

                <div
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 10,
                    border: `1px dashed ${tokens.colorNeutralStroke2}`,
                    background: tokens.colorNeutralBackground3,
                  }}
                >
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3, lineHeight: 1.5 }}>
                    {getVoiceDescription(selectedVoice.name)}
                  </Text>
                </div>

                <Button
                  appearance="secondary"
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

      {/* 오류 패널 */}
      {voiceError && (
        <div
          style={{
            marginTop: tokens.spacingVerticalM,
            border: `1px solid ${tokens.colorPaletteRedBorder2}`,
            background: tokens.colorPaletteRedBackground1,
            borderRadius: 12,
            padding: tokens.spacingVerticalM,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <ShieldError24Regular />
            <Text weight="semibold">TTS 음성 목록 로드 실패</Text>
          </div>
          <Text style={{ marginBottom: 10 }}>
            Google TTS 음성 목록을 불러올 수 없습니다. API 키를 확인해주세요.
            <br />
            API 오류 ({voiceError.code || "unknown"}): {voiceError.message || "API 키가 설정되지 않았습니다."}
          </Text>
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="secondary" size="small" onClick={onRetryVoiceLoad}>
              다시 시도
            </Button>
            <Button appearance="outline" size="small" onClick={() => {}}>
              API 키 설정
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default VoiceSettingsCard;
