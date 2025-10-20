import React, { memo, useMemo, useEffect } from "react";
import { Card, Text, Dropdown, Option, Field, Badge, Button, Spinner, tokens } from "@fluentui/react-components";
import { MicRegular, PlayRegular, StopRegular, ShieldError24Regular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../styles/commonStyles";

/**
 * 음성 선택 공통 컴포넌트
 *
 * @description
 * 음성 선택, 미리듣기, 에러 처리 등을 포함한 공통 컴포넌트
 * ScriptVoiceGenerator, MediaPrepEditor 등에서 재사용 가능
 *
 * @param {Object} form - 폼 상태
 * @param {Array} voices - 음성 목록
 * @param {boolean} voiceLoading - 로딩 상태
 * @param {Object|null} voiceError - 에러 정보
 * @param {Function} onChange - 값 변경 핸들러
 * @param {Function} setForm - 폼 설정 핸들러
 * @param {Function} onPreviewVoice - 미리듣기 함수
 * @param {Function} onStopVoice - 중지 함수
 * @param {Function} onRetryVoiceLoad - 재시도 함수
 * @param {boolean} disabled - 비활성화 여부
 * @param {boolean} showPreview - 미리듣기 버튼 표시 여부
 * @param {string} title - 컴포넌트 제목
 * @param {string} description - 컴포넌트 설명
 */
const VoiceSelector = memo(
  ({
    form = {},
    voices = [],
    voiceLoading = false,
    voiceError = null,
    onChange = () => {},
    setForm = () => {},
    onPreviewVoice = () => {},
    onStopVoice = () => {},
    onRetryVoiceLoad = () => {},
    disabled = false,
    showPreview = true,
    title = "음성 설정",
    description = "목소리를 선택해 나레이션 톤을 맞춰요.",
  }) => {
    const cardStyles = useCardStyles();
    const settingsStyles = useSettingsStyles();

    // 안전한 폼 데이터 처리
    const safeForm = useMemo(() => ({
      voice: form?.voice || ""
    }), [form?.voice]);

    // 선택된 음성 정보
    const selectedVoice = useMemo(() => voices.find((v) => v.id === safeForm.voice), [voices, safeForm.voice]);

    // 음성 자동 선택 로직
    useEffect(() => {
      if (voices.length > 0 && !safeForm.voice) {
        setForm((prev) => ({ ...prev, voice: voices[0].id }));
      }
    }, [voices, safeForm.voice, setForm]);

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
          padding: "12px 16px",
          borderRadius: 16,
          borderColor: tokens.colorNeutralStroke2,
          height: "fit-content",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {/* 헤더 */}
        <div className={settingsStyles.sectionHeader} style={{ marginBottom: 8 }}>
          <div className={settingsStyles.sectionTitle} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MicRegular />
            <Text size={400} weight="semibold" style={{ letterSpacing: 0.2 }}>
              {title}
            </Text>
          </div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
            {description}
          </Text>
        </div>

        {/* 로딩 상태 */}
        {voiceLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Spinner size="tiny" />
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              음성 목록을 불러오는 중…
            </Text>
          </div>
        )}

        {/* 목소리 선택 */}
        <div>
          <Field
            label={
              <Text size={300} weight="semibold">
                목소리
              </Text>
            }
            hint={
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                목록에서 원하는 톤을 고르세요.
              </Text>
            }
          >
            <Dropdown
              value={selectedVoice?.name || (voiceLoading ? "불러오는 중…" : "목소리 선택")}
              selectedOptions={form?.voice ? [form.voice] : []}
              onOptionSelect={(_, d) => onChange("voice", d.optionValue)}
              size="medium"
              disabled={disabled || voiceLoading || !!voiceError}
              style={{ minHeight: 36 }}
            >
              {voices.map((v) => (
                <Option key={v.id} value={v.id} text={`${v.name || v.id}${v.type ? ` (${v.type})` : ''}`}>
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

                {/* 미리듣기 버튼 */}
                {showPreview && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      appearance="secondary"
                      size="small"
                      icon={<PlayRegular />}
                      onClick={() => onPreviewVoice(selectedVoice.id, selectedVoice.name)}
                      disabled={disabled}
                    >
                      미리듣기
                    </Button>
                    <Button
                      appearance="outline"
                      size="small"
                      icon={<StopRegular />}
                      onClick={onStopVoice}
                      disabled={disabled}
                      style={{
                        color: tokens.colorPaletteRedForeground1,
                        borderColor: tokens.colorPaletteRedBorder1
                      }}
                    >
                      중지
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Field>
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
              <Button appearance="secondary" size="small" onClick={onRetryVoiceLoad} disabled={disabled}>
                다시 시도
              </Button>
            </div>
          </div>
        )}
      </Card>
    );
  }
);

VoiceSelector.displayName = "VoiceSelector";

export default VoiceSelector;
