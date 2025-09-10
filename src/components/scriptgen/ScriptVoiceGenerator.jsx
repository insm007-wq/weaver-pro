// src/ScriptVoiceGenerator.jsx
import { useState } from "react";
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
} from "@fluentui/react-components";
import { ErrorBoundary, StandardCard, ActionButton, StatusBadge } from "../common";
import { 
  DocumentEditRegular, 
  SparkleRegular, 
  BrainCircuitRegular, 
  DocumentTextRegular, 
  SettingsRegular 
} from "@fluentui/react-icons";

// 유틸 함수들
import { safeCharCount } from "../../utils/safeChars";

const STYLE_OPTIONS = [
  { key: 'informative', text: '📚 정보 전달형', desc: '교육적이고 명확한 설명' },
  { key: 'engaging', text: '🎯 매력적인', desc: '흥미롭고 재미있는 톤' },
  { key: 'professional', text: '💼 전문적인', desc: '비즈니스에 적합한 스타일' },
  { key: 'casual', text: '😊 캐주얼한', desc: '친근하고 편안한 분위기' },
  { key: 'dramatic', text: '🎭 극적인', desc: '강렬하고 임팩트 있는 전개' },
  { key: 'storytelling', text: '📖 스토리텔링', desc: '이야기 형식의 구성' },
];

const DURATION_OPTIONS = [
  { key: 1, text: '1분 (초단편)' },
  { key: 2, text: '2분 (단편)' },
  { key: 3, text: '3분 (표준)' },
  { key: 5, text: '5분 (중편)' },
  { key: 8, text: '8분 (장편)' },
  { key: 10, text: '10분 (긴편)' },
];

/** Enhanced 탭 폼 초기값 */
const makeDefaultForm = () => ({
  topic: "",
  style: "informative",
  durationMin: 3,
  maxScenes: 15,
  temperature: 1.0,
  customPrompt: "",
  referenceScript: "",
});

function ScriptVoiceGenerator() {
  
  /* ========================= 상태: 폼/문서 ========================= */
  const [form, setForm] = useState(makeDefaultForm());
  const [doc, setDoc] = useState(null);
  const onChange = (key, v) => setForm((prev) => ({ ...prev, [key]: v }));
  const [error, setError] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const runGenerate = async () => {
    // TODO: 대본 생성 로직 추가 예정
    console.log('대본 생성 시작:', form);
  };

  const isLoading = false;

  // 예상 통계 계산
  const duration = form.durationMin || 3;
  const minChars = duration * 300;
  const maxChars = duration * 400;
  const avgChars = Math.floor((minChars + maxChars) / 2);
  const estimatedScenes = Math.min(form.maxScenes || 15, Math.max(3, Math.ceil(duration * 2)));

  const handleFieldChange = (field, value) => {
    onChange(field, value);
  };

  return (
    <ErrorBoundary>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalL}`,
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalL,
      }}>
        {/* 페이지 헤더 */}
        <div style={{
          margin: `0 0 ${tokens.spacingVerticalL}`,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            columnGap: tokens.spacingHorizontalM,
          }}>
            <DocumentEditRegular />
            <Title1>대본 & 음성 생성</Title1>
          </div>
          <Body1 style={{
            color: tokens.colorNeutralForeground3,
            marginTop: tokens.spacingVerticalXS,
            fontSize: tokens.fontSizeBase300,
          }}>SRT 자막 + MP3 내레이션을 한 번에 생성합니다</Body1>
          <div style={{
            borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
            marginTop: tokens.spacingVerticalM,
          }} />
        </div>


      {/* 기본 설정 */}
      <StandardCard>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM }}>
          <DocumentTextRegular />
          <Text size={500} weight="semibold">기본 설정</Text>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: tokens.spacingHorizontalXL,
          marginBottom: tokens.spacingVerticalL,
        }}>
          {/* 주제 */}
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="영상 주제" required>
              <Input
                value={form.topic || ""}
                onChange={(_, data) => handleFieldChange("topic", data.value)}
                placeholder="예: 건강한 아침 루틴 만들기"
                size="large"
              />
            </Field>
          </div>

          {/* 영상 길이 */}
          <Field label="영상 길이">
            <Dropdown
              value={DURATION_OPTIONS.find(opt => opt.key === duration)?.text || "3분 (표준)"}
              selectedOptions={[String(duration)]}
              onOptionSelect={(_, data) => handleFieldChange("durationMin", Number(data.optionValue))}
              size="large"
            >
              {DURATION_OPTIONS.map(option => (
                <Option key={option.key} value={String(option.key)}>
                  {option.text}
                </Option>
              ))}
            </Dropdown>
          </Field>

          {/* 스타일 */}
          <Field label="대본 스타일">
            <Dropdown
              value={STYLE_OPTIONS.find(opt => opt.key === (form.style || 'informative'))?.text || "📚 정보 전달형"}
              selectedOptions={[form.style || 'informative']}
              onOptionSelect={(_, data) => handleFieldChange("style", data.optionValue)}
              size="large"
            >
              {STYLE_OPTIONS.map(option => (
                <Option key={option.key} value={option.key} text={option.desc}>
                  {option.text}
                </Option>
              ))}
            </Dropdown>
          </Field>
        </div>

        {/* 예상 결과 미리보기 */}
        <div style={{
          background: `linear-gradient(135deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          borderRadius: tokens.borderRadiusMedium,
          padding: tokens.spacingVerticalL,
          marginTop: tokens.spacingVerticalL,
        }}>
          <Text weight="semibold" size={400} style={{textAlign: 'center', display: 'block', marginBottom: tokens.spacingVerticalM}}>📊 예상 생성 결과</Text>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: tokens.spacingHorizontalL,
            marginTop: tokens.spacingVerticalM,
          }}>
            <div style={{
              textAlign: "center",
              padding: tokens.spacingVerticalM,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              borderRadius: tokens.borderRadiusMedium,
            }}>
              <Text size={200} color="secondary" style={{display: 'block', marginBottom: tokens.spacingVerticalXS}}>예상 장면 수</Text>
              <Text weight="semibold" size={400}>{estimatedScenes}개</Text>
            </div>
            <div style={{
              textAlign: "center",
              padding: tokens.spacingVerticalM,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              borderRadius: tokens.borderRadiusMedium,
            }}>
              <Text size={200} color="secondary" style={{display: 'block', marginBottom: tokens.spacingVerticalXS}}>예상 글자 수</Text>
              <Text weight="semibold" size={300}>{avgChars.toLocaleString()}자</Text>
            </div>
            <div style={{
              textAlign: "center",
              padding: tokens.spacingVerticalM,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              borderRadius: tokens.borderRadiusMedium,
            }}>
              <Text size={200} color="secondary" style={{display: 'block', marginBottom: tokens.spacingVerticalXS}}>음성 시간</Text>
              <Text weight="semibold" size={400}>약 {duration}분</Text>
            </div>
          </div>
        </div>
      </StandardCard>

      {/* 고급 설정 */}
      <StandardCard>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: tokens.spacingVerticalM,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM }}>
              <SettingsRegular />
              <Text size={400} weight="semibold">고급 설정</Text>
            </div>
            <Text size={200} color="secondary">
              세부 옵션을 조정하여 더 정교한 대본을 생성할 수 있습니다.
            </Text>
          </div>
          <Switch
            checked={showAdvanced}
            onChange={(_, data) => setShowAdvanced(data.checked)}
          />
        </div>

        {showAdvanced && (
          <div style={{
            backgroundColor: tokens.colorNeutralBackground2,
            borderRadius: tokens.borderRadiusMedium,
            padding: tokens.spacingVerticalL,
            border: `1px solid ${tokens.colorNeutralStroke2}`,
            marginTop: tokens.spacingVerticalL,
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: tokens.spacingHorizontalXL,
              marginBottom: tokens.spacingVerticalL,
            }}>
              {/* 최대 장면 수 */}
              <Field label="최대 장면 수">
                <Input
                  type="number"
                  min={3}
                  max={30}
                  value={String(form.maxScenes || 15)}
                  onChange={(_, data) => handleFieldChange("maxScenes", Number(data.value) || 15)}
                />
                <Text size={100} color="secondary">
                  권장: {Math.ceil(duration * 2)}~{Math.ceil(duration * 4)}개
                </Text>
              </Field>

              {/* 온도 설정 */}
              <Field label="창의성 수준">
                <Dropdown
                  value={form.temperature === 1.2 ? "높음" : form.temperature === 0.8 ? "낮음" : "보통"}
                  selectedOptions={[String(form.temperature || 1.0)]}
                  onOptionSelect={(_, data) => handleFieldChange("temperature", Number(data.optionValue))}
                >
                  <Option value="0.8">낮음 (일관성 중시)</Option>
                  <Option value="1.0">보통 (균형)</Option>
                  <Option value="1.2">높음 (창의적)</Option>
                </Dropdown>
              </Field>

              {/* 커스텀 프롬프트 */}
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="추가 요구사항 (선택)">
                  <Textarea
                    value={form.customPrompt || ""}
                    onChange={(_, data) => handleFieldChange("customPrompt", data.value)}
                    placeholder="예: 젊은 직장인을 대상으로 하고, 실용적인 팁 위주로 구성해주세요."
                    rows={3}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </StandardCard>

      {/* 레퍼런스 대본 분석 */}
      <StandardCard>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalM }}>
          <DocumentTextRegular />
          <Text size={400} weight="semibold">레퍼런스 대본 분석 (선택)</Text>
          <Badge appearance="outline" color="warning">고급 기능</Badge>
        </div>
        <Text size={300} style={{color: tokens.colorNeutralForeground2, marginBottom: tokens.spacingVerticalL}}>
          기존 대본을 분석하여 그 스타일과 톤을 학습해 새로운 주제에 적용합니다.
        </Text>

        <Field label="참고할 대본 텍스트">
          <Textarea
            value={form.referenceScript || ""}
            onChange={(_, data) => handleFieldChange("referenceScript", data.value)}
            placeholder="분석할 대본 텍스트를 입력하세요. AI가 이 대본의 스타일, 어투, 구성 방식을 학습하여 새로운 주제에 적용합니다."
            rows={8}
            size="large"
          />
        </Field>

        {form.referenceScript && (
          <div style={{
            background: `linear-gradient(135deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
            border: `1px solid ${tokens.colorNeutralStroke1}`,
            borderRadius: tokens.borderRadiusMedium,
            padding: tokens.spacingVerticalL,
            marginTop: tokens.spacingVerticalL,
          }}>
            <Text weight="semibold" size={400} style={{textAlign: 'center', display: 'block', marginBottom: tokens.spacingVerticalM}}>📝 레퍼런스 분석 정보</Text>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: tokens.spacingHorizontalL,
              marginTop: tokens.spacingVerticalM,
            }}>
              <div style={{
                textAlign: "center",
                padding: tokens.spacingVerticalM,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                borderRadius: tokens.borderRadiusMedium,
              }}>
                <Text size={200} color="secondary" style={{display: 'block', marginBottom: tokens.spacingVerticalXS}}>글자 수</Text>
                <Text weight="semibold" size={400}>{form.referenceScript.length.toLocaleString()}자</Text>
              </div>
              <div style={{
                textAlign: "center",
                padding: tokens.spacingVerticalM,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                borderRadius: tokens.borderRadiusMedium,
              }}>
                <Text size={200} color="secondary" style={{display: 'block', marginBottom: tokens.spacingVerticalXS}}>분석 상태</Text>
                <StatusBadge status="success">분석 준비 완료</StatusBadge>
              </div>
              <div style={{
                textAlign: "center",
                padding: tokens.spacingVerticalM,
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                borderRadius: tokens.borderRadiusMedium,
              }}>
                <Text size={200} color="secondary" style={{display: 'block', marginBottom: tokens.spacingVerticalXS}}>예상 처리 시간</Text>
                <Text weight="semibold" size={300}>약 2-3초</Text>
              </div>
            </div>
          </div>
        )}
      </StandardCard>

      {/* 실행 버튼 */}
      <StandardCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Text weight="semibold">🚀 AI 대본 생성</Text>
            <br />
            <Text size={200} color="secondary">
              Claude Sonnet 4를 사용하여 고품질 대본을 생성합니다
            </Text>
          </div>
          <ActionButton
            variant="primary"
            icon={<SparkleRegular />}
            onClick={runGenerate}
            disabled={isLoading || !form.topic?.trim()}
            size="large"
          >
            대본 생성 시작
          </ActionButton>
        </div>

        {!form.topic?.trim() && (
          <div style={{ marginTop: tokens.spacingVerticalS }}>
            <Text size={200} color="danger">
              영상 주제를 입력해주세요.
            </Text>
          </div>
        )}
      </StandardCard>

      {/* 결과 테이블 */}
      <StandardCard>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
          <Text weight="semibold">씬 미리보기</Text>
          <Badge appearance="tint">
            {doc?.scenes?.length ? `${doc.scenes.length}개 씬` : "대본 없음"}
          </Badge>
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
              <DataGridRow>
                {({ renderHeaderCell }) => (
                  <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody>
              {({ item, rowId }) => (
                <DataGridRow key={rowId}>
                  {({ renderCell }) => renderCell(item)}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Body1>대본을 생성하거나 SRT를 불러오면 씬 목록이 표시됩니다.</Body1>
          </div>
        )}

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}
      </StandardCard>
      </div>
    </ErrorBoundary>
  );
}

export default function ScriptVoiceGeneratorWithBoundary() {
  return <ScriptVoiceGenerator />;
}