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
function GenerationPreviewCard({ form, globalSettings = {}, doc = null }) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  /**
   * 초기화 및 유효성 검사
   */
  // 필수 값들이 없으면 빈 상태로 표시 (null, undefined, 0 모두 체크)
  if (!form.durationMin || !form.maxScenes || form.durationMin <= 0 || form.maxScenes <= 0) {
    return (
      <Card className={cardStyles.settingsCard}>
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
            영상 길이와 장면 수를 설정하면 예상 결과가 표시됩니다
          </Text>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "120px",
          color: tokens.colorNeutralForeground3,
          fontStyle: "italic"
        }}>
          설정을 완료해주세요
        </div>
      </Card>
    );
  }

  /**
   * 협력업체보다 향상된 예상 값 계산
   */
  const duration = form.durationMin;
  const maxScenes = form.maxScenes;

  // 더 정확한 글자 수 계산 (한국어 TTS 기준)
  const minChars = duration * 300; // 최소 글자 수
  const maxChars = duration * 400; // 최대 글자 수
  const avgChars = Math.floor((minChars + maxChars) / 2);

  // 실제 설정된 장면 수 사용 (협력업체 방식)
  const estimatedScenes = maxScenes;

  // 장면별 상세 분석 (협력업체보다 향상된 기능)
  const avgSecsPerScene = Math.round((duration * 60) / maxScenes);
  const avgCharsPerScene = Math.round(avgChars / maxScenes);

  /**
   * 실제 음성 시간 계산 (완성된 대본이 있으면 실제 글자 수 기준, 없으면 예상)
   */
  const actualChars = doc && doc.scenes
    ? doc.scenes.reduce((sum, scene) => sum + (scene.text ? scene.text.length : 0), 0)
    : avgChars;

  const actualSpeechTime = Math.round((actualChars / 350) * 60); // 분당 350자 기준으로 초 단위 계산

  /**
   * 실제 장면 수 (완성된 대본이 있으면 실제 수, 없으면 예상)
   */
  const actualScenes = doc && doc.scenes ? doc.scenes.length : estimatedScenes;

  /**
   * 선택된 AI 엔진 정보 가져오기 (전역 설정 기반)
   */
  const getEngineInfo = (llmModel) => {
    switch (llmModel) {
      case "anthropic":
        return { name: "Claude", emoji: "🧠", desc: "정확하고 자연스러운 문체" };
      case "openai-gpt5mini":
        return { name: "GPT-5 Mini", emoji: "🤖", desc: "롱폼 대본 최적화" };
      default:
        return { name: "AI", emoji: "🤖", desc: "기본 설정" };
    }
  };

  const engineInfo = getEngineInfo(globalSettings.llmModel);

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
          {doc ? "생성 완료된 실제 결과입니다" : "설정 기반 예상 결과입니다"}
        </Text>
      </div>

      {/* 협력업체보다 향상된 통계 그리드 - 2x3 레이아웃 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: tokens.spacingHorizontalM }}>
        <StatTile
          label={doc ? "실제 장면 수" : "설정 장면 수"}
          value={
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{actualScenes}개</span>
              {doc && <Badge appearance="tint" color="success" size="small">완료</Badge>}
              {!doc && maxScenes !== estimatedScenes && (
                <Badge appearance="outline" color="warning" size="small">설정값</Badge>
              )}
            </div>
          }
        />

        <StatTile
          label={doc ? "실제 글자 수" : "예상 글자 수"}
          value={
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{actualChars.toLocaleString()}자</span>
              {doc && <Badge appearance="tint" color="success" size="small">완료</Badge>}
            </div>
          }
        />

        <StatTile
          label={doc ? "실제 음성 시간" : "예상 음성 시간"}
          value={
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{Math.floor(actualSpeechTime / 60)}분 {actualSpeechTime % 60}초</span>
              {doc && <Badge appearance="tint" color="success" size="small">완료</Badge>}
            </div>
          }
        />

        <StatTile
          label="장면당 평균 시간"
          value={
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{avgSecsPerScene}초</span>
              <Badge appearance="outline" color="info" size="small">분석</Badge>
            </div>
          }
        />

        <StatTile
          label="장면당 평균 글자수"
          value={
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span>{avgCharsPerScene}자</span>
              <Badge appearance="outline" color="info" size="small">분석</Badge>
            </div>
          }
        />

        <StatTile
          label="AI 엔진"
          value={
            <Badge appearance="tint" color="brand" style={{ fontWeight: 600 }}>
              {engineInfo.emoji} {engineInfo.name}
            </Badge>
          }
        />
      </div>
    </Card>
  );
}

export default GenerationPreviewCard;