// src/ScriptVoiceGenerator.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Body1,
  Text,
  Title1,
  Badge,
  Field,
  Input,
  Dropdown,
  Option,
  Textarea,
  Switch,
  DataGrid,
  DataGridHeader,
  DataGridRow,
  DataGridHeaderCell,
  DataGridCell,
  DataGridBody,
  createTableColumn,
  MessageBar,
  MessageBarBody,
  tokens,
  Button,
} from "@fluentui/react-components";
import {
  DocumentEditRegular,
  SparkleRegular,
  BrainCircuitRegular,
  DocumentTextRegular,
  SettingsRegular,
  CheckmarkCircle24Regular,
  ShieldError24Regular,
} from "@fluentui/react-icons";
import { ErrorBoundary, StandardCard, ActionButton, StatusBadge } from "../common";
import { safeCharCount } from "../../utils/safeChars";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";

/* ============================== 옵션 ============================== */
const STYLE_OPTIONS = [
  { key: "informative", text: "📚 정보 전달형", desc: "교육적이고 명확한 설명" },
  { key: "engaging", text: "🎯 매력적인", desc: "흥미롭고 재미있는 톤" },
  { key: "professional", text: "💼 전문적인", desc: "비즈니스에 적합한 스타일" },
  { key: "casual", text: "😊 캐주얼한", desc: "친근하고 편안한 분위기" },
  { key: "dramatic", text: "🎭 극적인", desc: "강렬하고 임팩트 있는 전개" },
  { key: "storytelling", text: "📖 스토리텔링", desc: "이야기 형식의 구성" },
];

const DURATION_OPTIONS = [
  { key: 1, text: "1분 (초단편)" },
  { key: 2, text: "2분 (단편)" },
  { key: 3, text: "3분 (표준)" },
  { key: 5, text: "5분 (중편)" },
  { key: 8, text: "8분 (장편)" },
  { key: 10, text: "10분 (긴편)" },
];

const IMAGE_STYLE_OPTIONS = [
  { key: "photo", text: "실사" },
  { key: "illustration", text: "일러스트" },
  { key: "cinematic", text: "시네마틱" },
  { key: "sketch", text: "스케치" },
];

/* ========================== 기본 폼 ========================== */
const makeDefaultForm = () => ({
  topic: "",
  style: "informative",
  durationMin: 3,
  maxScenes: 15,
  temperature: 1.0,
  customPrompt: "",
  referenceScript: "",
  imageStyle: "photo",
  speed: "1.0",
  voiceId: "",
  promptName: "", // 선택된 사용자 프롬프트 이름
});

/* ======================== 컴포넌트 ======================== */
function ScriptVoiceGenerator() {
  const api = useApi();
  const toast = useToast();

  /* 상태: 폼/문서 */
  const [form, setForm] = useState(makeDefaultForm());
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* 상태: 프롬프트 목록 */
  const [promptNames, setPromptNames] = useState([]);
  const [promptLoading, setPromptLoading] = useState(true);

  /* 상태: 음성 목록 */
  const [voices, setVoices] = useState([]);
  const [voiceLoading, setVoiceLoading] = useState(true);
  const [voiceError, setVoiceError] = useState(null); // { code, message }

  /* ------------------------- 유틸 ------------------------- */
  const onChange = (key, v) => setForm((prev) => ({ ...prev, [key]: v }));

  const duration = form.durationMin || 3;
  const minChars = duration * 300;
  const maxChars = duration * 400;
  const avgChars = Math.floor((minChars + maxChars) / 2);
  const estimatedScenes = Math.min(form.maxScenes || 15, Math.max(3, Math.ceil(duration * 2)));

  /* --------------------- 데이터 로드 ---------------------- */
  useEffect(() => {
    // 프롬프트 이름 로딩 (설정 화면의 사용자 프롬프트)
    const loadPrompts = async () => {
      try {
        const res = await api.invoke("prompts:getAll");
        const list = res?.ok && Array.isArray(res.data) ? res.data : [];
        const names = Array.from(new Set(list.filter((p) => !p.isDefault).map((p) => p.name))).sort((a, b) => a.localeCompare(b, "ko"));
        setPromptNames(names);
        if (!form.promptName && names.length) {
          setForm((prev) => ({ ...prev, promptName: names[0] }));
        }
      } catch {
        // 무시: 초기엔 이름 없을 수 있음
      } finally {
        setPromptLoading(false);
      }
    };

    // 음성 목록 로딩
    const loadVoices = async () => {
      setVoiceLoading(true);
      setVoiceError(null);
      try {
        // 프로젝트 환경에 맞춰 IPC 채널명을 사용하세요.
        // 예시: "tts:listVoices" 또는 "elevenlabs:listVoices" 등
        const res = await api.invoke("tts:listVoices");
        if (res?.ok) {
          const items = Array.isArray(res.data) ? res.data : [];
          setVoices(items);
          if (!form.voiceId && items[0]?.id) {
            setForm((prev) => ({ ...prev, voiceId: items[0].id }));
          }
        } else {
          // 표준화된 오류 형태가 아니라면 메시지 추정
          setVoiceError({
            code: res?.code ?? res?.errorCode ?? 1004,
            message: res?.message ?? "음성 목록을 불러올 수 없습니다. API 키를 확인해주세요.",
          });
        }
      } catch (e) {
        setVoiceError({
          code: e?.code ?? e?.status ?? 1004,
          message: e?.message ?? "음성 목록을 불러올 수 없습니다. API 키를 확인해주세요.",
        });
      } finally {
        setVoiceLoading(false);
      }
    };

    loadPrompts();
    loadVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------- 액션: 생성 ---------------------- */
  const runGenerate = async () => {
    setError("");
    setIsLoading(true);
    try {
      // 여기에 Claude 호출 연결
      // ex) const res = await api.invoke("ai:generateScriptAndVoice", { provider: "claude", form })
      // 데모: 결과 리스트만 구성
      const scenes = Array.from({ length: estimatedScenes }).map((_, i) => ({
        scene_number: i + 1,
        duration: Math.max(3, Math.round((duration * 60) / estimatedScenes)),
        text: `${form.topic || "주제"} - 샘플 내레이션 텍스트 (${i + 1})`,
      }));
      setDoc({ scenes });
      toast.success("Claude로 대본 생성이 시작되었습니다.");
    } catch (e) {
      setError(e?.message || "대본 생성 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  /* ============================ UI ============================ */
  const headerDividerStyle = {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: tokens.spacingVerticalM,
  };

  const cardSurface = {
    background: `linear-gradient(180deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalL,
  };

  const sectionTitle = (icon, text) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: tokens.spacingVerticalM }}>
      {icon}
      <Text size={400} weight="semibold">
        {text}
      </Text>
    </div>
  );

  const gradientCTA = {
    background: "linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)",
    color: "#fff",
    border: "none",
    boxShadow: "0 8px 24px rgba(124,58,237,0.35)",
  };

  return (
    <ErrorBoundary>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
          display: "flex",
          flexDirection: "column",
          gap: tokens.spacingVerticalL,
        }}
      >
        {/* ===== 헤더 (대 제목은 그대로) ===== */}
        <div>
          <div style={{ display: "flex", alignItems: "center", columnGap: tokens.spacingHorizontalM }}>
            <DocumentEditRegular />
            <Title1>대본 & 음성 생성</Title1>
          </div>
          <Body1
            style={{
              color: tokens.colorNeutralForeground3,
              marginTop: tokens.spacingVerticalXS,
              fontSize: tokens.fontSizeBase300,
            }}
          >
            SRT 자막 + MP3 내레이션을 한 번에 생성합니다
          </Body1>
          <div style={headerDividerStyle} />
        </div>

        {/* ===== 생성 프롬프트 선택 ===== */}
        <div style={cardSurface}>
          {sectionTitle(<BrainCircuitRegular />, "대본 생성 프롬프트")}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: tokens.spacingHorizontalL }}>
            <Field label="프롬프트 선택">
              <Dropdown
                placeholder={promptLoading ? "불러오는 중..." : "프롬프트를 선택하세요"}
                value={form.promptName}
                selectedOptions={form.promptName ? [form.promptName] : []}
                onOptionSelect={(_, d) => onChange("promptName", d.optionValue)}
              >
                {promptNames.map((nm) => (
                  <Option key={nm} value={nm}>
                    {nm}
                  </Option>
                ))}
              </Dropdown>
            </Field>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              {form.promptName ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    color: tokens.colorPaletteGreenForeground2,
                  }}
                >
                  <CheckmarkCircle24Regular />
                  <Text>선택된 프롬프트: {form.promptName}</Text>
                </div>
              ) : (
                <Text style={{ color: tokens.colorNeutralForeground3 }}>설정에서 사용자 프롬프트를 추가할 수 있습니다.</Text>
              )}
            </div>
          </div>
        </div>

        {/* ===== 레퍼런스 대본 (선택사항) ===== */}
        <div style={cardSurface}>
          {sectionTitle(<DocumentTextRegular />, "레퍼런스 대본 (선택사항)")}
          <Field>
            <Textarea
              value={form.referenceScript}
              onChange={(_, d) => onChange("referenceScript", d.value)}
              placeholder="여기에 레퍼런스 대본을 직접 붙여넣기하세요…"
              rows={6}
            />
          </Field>
          {form.referenceScript && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: tokens.spacingHorizontalL,
                marginTop: tokens.spacingVerticalM,
              }}
            >
              <StatTile label="글자 수" value={`${form.referenceScript.length.toLocaleString()}자`} />
              <StatTile label="분석 상태" value={<StatusBadge status="success">분석 준비 완료</StatusBadge>} />
              <StatTile label="예상 처리 시간" value="약 2–3초" />
            </div>
          )}
        </div>

        {/* ===== 기본/고급 설정 ===== */}
        <div style={cardSurface}>
          {sectionTitle(<SettingsRegular />, "생성 옵션")}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: tokens.spacingHorizontalXL,
            }}
          >
            {/* 주제 */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="영상 주제" required>
                <Input
                  value={form.topic}
                  onChange={(_, d) => onChange("topic", d.value)}
                  placeholder="예: 건강한 아침 루틴 만들기"
                  size="large"
                />
              </Field>
            </div>

            {/* 영상 길이 */}
            <Field label="영상 길이">
              <Dropdown
                value={DURATION_OPTIONS.find((o) => o.key === form.durationMin)?.text || "3분 (표준)"}
                selectedOptions={[String(form.durationMin)]}
                onOptionSelect={(_, d) => onChange("durationMin", Number(d.optionValue))}
                size="large"
              >
                {DURATION_OPTIONS.map((o) => (
                  <Option key={o.key} value={String(o.key)}>
                    {o.text}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            {/* 대본 스타일 */}
            <Field label="영상 스타일">
              <Dropdown
                value={STYLE_OPTIONS.find((o) => o.key === form.style)?.text || "📚 정보 전달형"}
                selectedOptions={[form.style]}
                onOptionSelect={(_, d) => onChange("style", d.optionValue)}
                size="large"
              >
                {STYLE_OPTIONS.map((o) => (
                  <Option key={o.key} value={o.key} text={o.desc}>
                    {o.text}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            {/* 이미지 스타일 */}
            <Field label="이미지 스타일">
              <Dropdown
                value={IMAGE_STYLE_OPTIONS.find((o) => o.key === form.imageStyle)?.text || "실사"}
                selectedOptions={[form.imageStyle]}
                onOptionSelect={(_, d) => onChange("imageStyle", d.optionValue)}
                size="large"
              >
                {IMAGE_STYLE_OPTIONS.map((o) => (
                  <Option key={o.key} value={o.key}>
                    {o.text}
                  </Option>
                ))}
              </Dropdown>
            </Field>

            {/* 말하기 속도 */}
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

            {/* 목소리 */}
            <Field label="목소리">
              <Dropdown
                value={voices.find((v) => v.id === form.voiceId)?.name || (voiceLoading ? "불러오는 중…" : "목소리 선택")}
                selectedOptions={form.voiceId ? [form.voiceId] : []}
                onOptionSelect={(_, d) => onChange("voiceId", d.optionValue)}
                size="large"
                disabled={voiceLoading || !!voiceError}
              >
                {voices.map((v) => (
                  <Option key={v.id} value={v.id}>
                    {v.name || v.id}
                  </Option>
                ))}
              </Dropdown>
            </Field>
          </div>

          {/* 음성 오류 박스 (스크린샷 스타일) */}
          {voiceError && (
            <div
              style={{
                marginTop: tokens.spacingVerticalM,
                border: `1px solid ${tokens.colorPaletteRedBorder2}`,
                background: tokens.colorPaletteRedBackground2,
                borderRadius: tokens.borderRadiusMedium,
                padding: tokens.spacingVerticalM,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <ShieldError24Regular />
                <Text weight="semibold">음성 목록 로드 실패</Text>
              </div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>
                음성 목록을 불러올 수 없습니다. API 키를 확인해주세요. API 오류 ({voiceError.code}):{" "}
                {voiceError.message || "token is unusable"}
              </Body1>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  appearance="secondary"
                  onClick={async () => {
                    // 재시도
                    try {
                      setVoiceLoading(true);
                      setVoiceError(null);
                      const res = await api.invoke("tts:listVoices");
                      if (res?.ok) {
                        const items = Array.isArray(res.data) ? res.data : [];
                        setVoices(items);
                        if (!form.voiceId && items[0]?.id) {
                          setForm((prev) => ({ ...prev, voiceId: items[0].id }));
                        }
                      } else {
                        setVoiceError({
                          code: res?.code ?? res?.errorCode ?? 1004,
                          message: res?.message ?? "token is unusable",
                        });
                      }
                    } catch (e) {
                      setVoiceError({
                        code: e?.code ?? 1004,
                        message: e?.message ?? "token is unusable",
                      });
                    } finally {
                      setVoiceLoading(false);
                    }
                  }}
                >
                  다시 시도
                </Button>
              </div>
            </div>
          )}

          {/* 고급 설정 토글 */}
          <div
            style={{
              marginTop: tokens.spacingVerticalL,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: tokens.colorNeutralBackground3,
              borderRadius: tokens.borderRadiusMedium,
              padding: tokens.spacingVerticalM,
              border: `1px solid ${tokens.colorNeutralStroke2}`,
            }}
          >
            <div>
              <Text weight="semibold">고급 설정</Text>
              <div style={{ color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 }}>
                세부 옵션을 조정하여 더 정교한 대본을 생성할 수 있습니다.
              </div>
            </div>
            <Switch checked={showAdvanced} onChange={(_, d) => setShowAdvanced(d.checked)} />
          </div>

          {showAdvanced && (
            <div
              style={{
                marginTop: tokens.spacingVerticalM,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: tokens.spacingHorizontalXL,
              }}
            >
              <Field label="최대 장면 수">
                <Input
                  type="number"
                  min={3}
                  max={30}
                  value={String(form.maxScenes || 15)}
                  onChange={(_, d) => onChange("maxScenes", Number(d.value) || 15)}
                />
                <Text size={100} color="secondary">
                  권장: {Math.ceil(duration * 2)}~{Math.ceil(duration * 4)}개
                </Text>
              </Field>

              <Field label="창의성 수준">
                <Dropdown
                  value={form.temperature === 1.2 ? "높음" : form.temperature === 0.8 ? "낮음" : "보통"}
                  selectedOptions={[String(form.temperature || 1.0)]}
                  onOptionSelect={(_, d) => onChange("temperature", Number(d.optionValue))}
                >
                  <Option value="0.8">낮음 (일관성 중시)</Option>
                  <Option value="1.0">보통 (균형)</Option>
                  <Option value="1.2">높음 (창의적)</Option>
                </Dropdown>
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="추가 요구사항 (선택)">
                  <Textarea
                    value={form.customPrompt}
                    onChange={(_, d) => onChange("customPrompt", d.value)}
                    placeholder="예: 젊은 직장인을 대상으로 하고, 실용적인 팁 위주로 구성해주세요."
                    rows={3}
                  />
                </Field>
              </div>
            </div>
          )}

          {/* 예상 결과 미리보기 */}
          <div
            style={{
              background: `linear-gradient(135deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
              border: `1px solid ${tokens.colorNeutralStroke1}`,
              borderRadius: tokens.borderRadiusMedium,
              padding: tokens.spacingVerticalL,
              marginTop: tokens.spacingVerticalL,
            }}
          >
            <Text weight="semibold" size={400} style={{ textAlign: "center", display: "block", marginBottom: tokens.spacingVerticalM }}>
              📊 예상 생성 결과
            </Text>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: tokens.spacingHorizontalL,
              }}
            >
              <StatTile label="예상 장면 수" value={`${estimatedScenes}개`} />
              <StatTile label="예상 글자 수" value={`${avgChars.toLocaleString()}자`} />
              <StatTile label="음성 시간" value={`약 ${duration}분`} />
            </div>
          </div>
        </div>

        {/* ===== 실행 영역 (자동 모드 CTA) ===== */}
        <div style={cardSurface}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Text weight="semibold">🚀 AI 대본 생성</Text>
              <br />
              <Text size={200} color="secondary">
                Claude Sonnet 4(클루우드)로 고품질 대본을 생성합니다
              </Text>
            </div>
            <ActionButton
              variant="primary"
              icon={<SparkleRegular />}
              onClick={runGenerate}
              disabled={isLoading || !form.topic?.trim()}
              size="large"
              style={gradientCTA}
            >
              자동 모드로 시작하기
            </ActionButton>
          </div>
          {!form.topic?.trim() && (
            <div style={{ marginTop: tokens.spacingVerticalS }}>
              <Text size={200} color="danger">
                영상 주제를 입력해주세요.
              </Text>
            </div>
          )}
          <div style={{ marginTop: tokens.spacingVerticalXS, color: tokens.colorNeutralForeground3 }}>
            자동 모드: AI가 모든 과정을 자동으로 처리하여 주제만 입력하면 완성된 영상을 제공합니다.
          </div>
        </div>

        {/* ===== 결과 테이블 ===== */}
        <div style={cardSurface}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Text weight="semibold">씬 미리보기</Text>
            <Badge appearance="tint">{doc?.scenes?.length ? `${doc.scenes.length}개 씬` : "대본 없음"}</Badge>
          </div>

          {(doc?.scenes || []).length > 0 ? (
            <DataGrid
              items={doc.scenes}
              columns={[
                createTableColumn({
                  columnId: "scene_number",
                  renderHeaderCell: () => "#",
                  renderCell: (item, index) => (
                    <DataGridCell>
                      <Text>{item.scene_number ?? index + 1}</Text>
                    </DataGridCell>
                  ),
                }),
                createTableColumn({
                  columnId: "duration",
                  renderHeaderCell: () => "지속 시간",
                  renderCell: (item) => (
                    <DataGridCell>
                      <Text>{item.duration}초</Text>
                    </DataGridCell>
                  ),
                }),
                createTableColumn({
                  columnId: "charCount",
                  renderHeaderCell: () => "글자수",
                  renderCell: (item) => (
                    <DataGridCell>
                      <Text>{safeCharCount(item.text)}</Text>
                    </DataGridCell>
                  ),
                }),
                createTableColumn({
                  columnId: "text",
                  renderHeaderCell: () => "텍스트",
                  renderCell: (item) => (
                    <DataGridCell>
                      <Text>{item.text}</Text>
                    </DataGridCell>
                  ),
                }),
              ]}
            >
              <DataGridHeader>
                <DataGridRow>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
              </DataGridHeader>
              <DataGridBody>
                {({ item, rowId }) => <DataGridRow key={rowId}>{({ renderCell }) => renderCell(item)}</DataGridRow>}
              </DataGridBody>
            </DataGrid>
          ) : (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Body1>대본을 생성하거나 SRT를 불러오면 씬 목록이 표시됩니다.</Body1>
            </div>
          )}

          {error && (
            <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalM }}>
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

/* ===== 작은 통계 타일 ===== */
function StatTile({ label, value }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: tokens.spacingVerticalM,
        backgroundColor: "rgba(255,255,255,0.06)",
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        borderRadius: tokens.borderRadiusMedium,
      }}
    >
      <Text size={200} color="secondary" style={{ display: "block", marginBottom: tokens.spacingVerticalXS }}>
        {label}
      </Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text weight="semibold" size={400}>
          {value}
        </Text>
      ) : (
        value
      )}
    </div>
  );
}

export default function ScriptVoiceGeneratorWithBoundary() {
  return <ScriptVoiceGenerator />;
}
