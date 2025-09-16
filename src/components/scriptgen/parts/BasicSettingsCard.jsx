/**
 * 기본 설정 카드 컴포넌트
 * 
 * @description
 * 스크립트 생성을 위한 기본 설정들을 관리하는 공통 카드 컴포넌트
 * 영상 주제, 스타일, 길이, AI 엔진, 프롬프트 선택 등의 핵심 설정을 포함
 * 
 * @component 기본 설정 카드
 * 
 * @usage
 * - ScriptVoiceGenerator.jsx: 대본 생성을 위한 기본 설정
 * - 다른 스크립트 관련 컴포넌트에서도 재사용 가능
 * 
 * @props
 * @param {Object} form - 폼 상태 객체
 * @param {string} form.topic - 영상 주제
 * @param {string} form.style - 스타일 (informative, engaging, professional, casual, dramatic, storytelling)
 * @param {number} form.durationMin - 예상 길이 (분)
 * @param {string} form.aiEngine - AI 엔진 (openai-gpt5mini, anthropic)
 * @param {string} form.promptName - 선택된 프롬프트 이름
 * @param {Function} onChange - 폼 값 변경 핸들러 (key, value) => void
 * @param {Array<string>} promptNames - 사용 가능한 프롬프트 이름 목록
 * @param {boolean} promptLoading - 프롬프트 로딩 상태
 * 
 * @features
 * - 📝 영상 주제 입력 필드 (필수)
 * - 🎨 스타일 선택 드롭다운 (6가지 스타일)
 * - ⏱️ 예상 길이 설정 (1분~10분+)
 * - 🤖 AI 엔진 선택 (3가지 엔진 지원)
 * - 📋 프롬프트 선택 (동적 로딩)
 * - 🎯 실시간 설정 상태 표시
 * 
 * @example
 * ```jsx
 * import BasicSettingsCard from './BasicSettingsCard';
 * 
 * function MyComponent() {
 *   const [form, setForm] = useState({
 *     topic: '',
 *     style: 'informative',
 *     durationMin: 3,
 *     aiEngine: '',
 *     promptName: ''
 *   });
 *   
 *   const onChange = (key, value) => {
 *     setForm(prev => ({ ...prev, [key]: value }));
 *   };
 *   
 *   return (
 *     <BasicSettingsCard
 *       form={form}
 *       onChange={onChange}
 *       promptNames={['프롬프트1', '프롬프트2']}
 *       promptLoading={false}
 *     />
 *   );
 * }
 * ```
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 * @since 2024-01-01
 */

import React from "react";
import {
  Card,
  Text,
  Field,
  Input,
  Dropdown,
  Option,
  Spinner,
  Switch,
  Textarea,
  tokens,
} from "@fluentui/react-components";
import { SettingsRegular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles, useLayoutStyles } from "../../../styles/commonStyles";
import { STYLE_OPTIONS, DURATION_OPTIONS } from "../../../constants/scriptSettings";

/**
 * 기본 설정 카드 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @returns {JSX.Element} 기본 설정 카드 JSX
 */
function BasicSettingsCard({ 
  form, 
  onChange, 
  promptNames, 
  promptLoading 
}) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();
  const layoutStyles = useLayoutStyles();

  return (
    <Card className={cardStyles.settingsCard}>
      {/* 카드 헤더 */}
      <div className={settingsStyles.sectionHeader}>
        <div className={settingsStyles.sectionTitle}>
          <SettingsRegular />
          <Text size={400} weight="semibold">기본 설정</Text>
        </div>
      </div>

      {/* 설정 필드들 - 2열 그리드 레이아웃 */}
      <div className={layoutStyles.gridTwo}>
        {/* 영상 주제 - 전체 너비 사용 */}
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="영상 주제" required>
            <Input
              value={form.topic || ""}
              onChange={(e) => onChange("topic", e.target.value)}
              placeholder="예: 인공지능의 미래와 우리 삶의 변화"
              size="large"
            />
          </Field>
        </div>

        {/* 스타일 선택 */}
        <Field label="스타일">
          <Dropdown
            value={STYLE_OPTIONS.find((s) => s.key === form.style)?.text || "스타일 선택"}
            selectedOptions={[form.style]}
            onOptionSelect={(_, d) => onChange("style", d.optionValue)}
            size="large"
          >
            {STYLE_OPTIONS.map((style) => (
              <Option key={style.key} value={style.key}>
                {style.text}
              </Option>
            ))}
          </Dropdown>
        </Field>

        {/* 예상 길이 선택 */}
        <Field label="예상 길이">
          <Dropdown
            value={DURATION_OPTIONS.find((d) => d.key === form.durationMin)?.text || "길이 선택"}
            selectedOptions={[form.durationMin?.toString()]}
            onOptionSelect={(_, d) => onChange("durationMin", parseInt(d.optionValue))}
            size="large"
          >
            {DURATION_OPTIONS.map((duration) => (
              <Option key={duration.key} value={duration.key.toString()}>
                {duration.text}
              </Option>
            ))}
          </Dropdown>
        </Field>


        {/* 프롬프트 선택 */}
        <Field label="대본 생성 프롬프트">
          <Dropdown
            value={form.promptName || (promptLoading ? "불러오는 중..." : "프롬프트 선택")}
            selectedOptions={form.promptName ? [form.promptName] : []}
            onOptionSelect={(_, d) => onChange("promptName", d.optionValue)}
            size="large"
            disabled={promptLoading || promptNames.length === 0}
          >
            {promptNames.map((name) => (
              <Option key={name} value={name}>
                {name}
              </Option>
            ))}
          </Dropdown>
          
          {/* 프롬프트 로딩 상태 표시 */}
          {promptLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Spinner size="tiny" />
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                프롬프트 목록을 불러오는 중...
              </Text>
            </div>
          ) : promptNames.length > 0 ? (
            <div style={{ marginTop: 4 }}>
              <Text size={200} style={{ color: tokens.colorBrandForeground1, fontWeight: "500" }}>
                선택됨: {form.promptName}
              </Text>
            </div>
          ) : (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginTop: 4 }}>
              설정 탭에서 프롬프트를 먼저 저장하세요. (대본 생성 프롬프트가 필요합니다)
            </Text>
          )}
        </Field>

        {/* 레퍼런스 대본 (선택사항) - 전체 너비 사용 */}
        <div style={{ gridColumn: "1 / -1", marginTop: tokens.spacingVerticalM }}>
          <Field>
            <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalS, marginBottom: tokens.spacingVerticalXS }}>
              <Switch
                checked={form.showReferenceScript || false}
                onChange={(_, data) => onChange("showReferenceScript", data.checked)}
                label="레퍼런스 대본 (선택사항)"
              />
            </div>
            
            {form.showReferenceScript && (
              <>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3, marginBottom: tokens.spacingVerticalXS, display: "block" }}>
                  참고할 대본이 있다면 붙여넣기해주세요. AI가 구조와 스타일을 분석해 더 나은 대본을 만들어드립니다.
                </Text>
                <Textarea
                  value={form.referenceScript || ""}
                  onChange={(e) => onChange("referenceScript", e.target.value)}
                  placeholder="예: 
안녕하세요! 오늘은 인공지능에 대해 알아보겠습니다.

## 도입
인공지능이 우리 생활에 미치는 영향을 살펴보면...

## 본론
구체적인 예시를 들어보겠습니다..."
                  rows={6}
                  resize="vertical"
                  style={{ minHeight: "120px" }}
                />
              </>
            )}
          </Field>
        </div>
      </div>
    </Card>
  );
}

export default BasicSettingsCard;