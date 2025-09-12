/**
 * 예상 생성 결과 카드 컴포넌트
 * 
 * @description
 * 설정된 조건에 따른 예상 생성 결과를 통계 형태로 보여주는 카드 컴포넌트
 * 예상 장면 수, 글자 수, 음성 시간, AI 엔진 등의 정보를 표시
 * 
 * @component 예상 생성 결과 카드
 * 
 * @usage
 * - ScriptVoiceGenerator.jsx: 설정 기반 예상 결과 표시
 * - 대본 생성 전 사용자에게 예상 결과 제공
 * 
 * @props
 * @param {Object} form - 대본 생성 폼 데이터
 * @param {number} form.durationMin - 예상 영상 길이 (분)
 * @param {number} form.maxScenes - 최대 씬 개수
 * @param {string} form.aiEngine - 선택된 AI 엔진
 * @param {Array} aiEngineOptions - AI 엔진 옵션 배열
 * 
 * @features
 * - 📊 예상 장면 수 자동 계산
 * - 📝 예상 글자 수 통계 표시
 * - ⏱️ 예상 음성 시간 계산
 * - 🤖 선택된 AI 엔진 정보 표시
 * - 📱 반응형 그리드 레이아웃
 * 
 * @example
 * ```jsx
 * import GenerationPreviewCard from './GenerationPreviewCard';
 * 
 * function MyComponent() {
 *   const form = {
 *     durationMin: 5,
 *     maxScenes: 10,
 *     aiEngine: 'claude-3-5-sonnet-20240620'
 *   };
 *   
 *   return (
 *     <GenerationPreviewCard
 *       form={form}
 *       aiEngineOptions={AI_ENGINE_OPTIONS}
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
  Badge,
  tokens,
} from "@fluentui/react-components";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";

/**
 * 통계 타일 컴포넌트 - 기존 스타일 유지
 */
const StatTile = ({ label, value }) => (
  <div
    style={{
      textAlign: "center",
      padding: tokens.spacingVerticalM,
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 12,
    }}
  >
    <Text size={200} color="secondary" style={{ display: "block", marginBottom: 6 }}>
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

/**
 * 예상 생성 결과 카드 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 props
 * @returns {JSX.Element} 예상 생성 결과 카드 JSX
 */
function GenerationPreviewCard({ form, aiEngineOptions = [] }) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  /**
   * 예상 값들 계산
   */
  const duration = form.durationMin || 3;
  const avgChars = Math.floor((duration * 300 + duration * 400) / 2); // 분당 300-400자 기준
  const estimatedScenes = Math.min(
    form.maxScenes || 15, 
    Math.max(3, Math.ceil(duration * 2))
  );

  /**
   * 선택된 AI 엔진 정보 가져오기
   */
  const selectedEngine = aiEngineOptions.find((engine) => engine.key === form.aiEngine);

  return (
    <Card className={cardStyles.settingsCard}>
      {/* 카드 헤더 */}
      <div className={settingsStyles.sectionHeader}>
        <div className={settingsStyles.sectionTitle}>
          <Badge appearance="outline" style={{ border: `1px solid ${tokens.colorNeutralStroke2}` }}>
            📊
          </Badge>
          <Text size={400} weight="semibold">
            예상 생성 결과
          </Text>
        </div>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          설정 기반 예상 결과입니다
        </Text>
      </div>

      {/* 통계 그리드 - 기존 2x2 레이아웃 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalM }}>
        <StatTile
          label="예상 장면 수"
          value={`${estimatedScenes}개`}
        />
        
        <StatTile
          label="예상 글자 수"
          value={`${avgChars.toLocaleString()}자`}
        />
        
        <StatTile
          label="음성 시간"
          value={`약 ${duration}분`}
        />
        
        <StatTile
          label="AI 엔진"
          value={selectedEngine ? (
            <Badge appearance="tint" color="brand" style={{ fontWeight: 600 }}>
              {selectedEngine.text.split(" ")[1]}
            </Badge>
          ) : (
            "미선택"
          )}
        />
      </div>
    </Card>
  );
}

export default GenerationPreviewCard;