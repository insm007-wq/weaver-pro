/**
 * 고급 설정 & 자동화 카드 컴포넌트
 *
 * @description
 * 고급 사용자를 위한 프리셋 설정, 배치 처리, 실시간 검증 등의
 * 전문 기능을 제공하는 카드 컴포넌트
 *
 * @component 고급 설정 & 자동화 카드
 *
 * @usage
 * - ScriptVoiceGenerator.jsx: 고급 설정 섹션
 * - 전문가용 세부 설정 제공
 *
 * @props
 * @param {boolean} showAdvanced - 고급 설정 표시 여부
 * @param {Function} onToggleAdvanced - 고급 설정 토글 핸들러
 * @param {string} selectedPreset - 현재 선택된 프리셋 이름
 * @param {Function} onApplyPreset - 프리셋 적용 핸들러
 * @param {Array} presets - 사용 가능한 프리셋 배열
 *
 * @features
 * - 🎯 용도별 최적화 프리셋 제공
 * - 🔧 고급 설정 토글 기능
 * - 📊 시각적 프리셋 선택 UI
 * - 🎨 반응형 그리드 레이아웃
 * - ✨ 선택 상태 시각적 피드백
 *
 * @presets
 * - 🎯 유튜브 최적화: 유튜브 알고리즘 최적화
 * - 📚 교육 컨텐츠: 교육용 영상 최적화
 * - 💼 비즈니스: 기업 프레젠테이션 최적화
 * - 🎬 영화 예고편: 시네마틱 스타일 최적화
 *
 * @example
 * ```jsx
 * import AdvancedSettingsCard from './AdvancedSettingsCard';
 *
 * function MyComponent() {
 *   const [showAdvanced, setShowAdvanced] = useState(false);
 *   const [selectedPreset, setSelectedPreset] = useState("");
 *
 *   return (
 *     <AdvancedSettingsCard
 *       showAdvanced={showAdvanced}
 *       onToggleAdvanced={setShowAdvanced}
 *       selectedPreset={selectedPreset}
 *       onApplyPreset={handleApplyPreset}
 *       presets={ADVANCED_PRESETS}
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
import { Card, Text, Badge, Switch, tokens } from "@fluentui/react-components";
import { SettingsRegular } from "@fluentui/react-icons";
import { useCardStyles, useSettingsStyles } from "../../../styles/commonStyles";

/**
 * 기본 프리셋 데이터
 */
const DEFAULT_PRESETS = [
  {
    name: "🎯 유튜브 최적화",
    description: "유튜브 알고리즘에 최적화된 설정",
    settings: {
      style: "engaging",
      durationMin: 8,
      maxScenes: 12,
      temperature: 1.1,
      imageStyle: "cinematic",
    },
  },
  {
    name: "📚 교육 컨텐츠",
    description: "교육용 영상에 최적화된 설정",
    settings: {
      style: "informative",
      durationMin: 5,
      maxScenes: 8,
      temperature: 0.9,
      imageStyle: "illustration",
    },
  },
  {
    name: "💼 비즈니스",
    description: "기업 프레젠테이션 최적화된 설정",
    settings: {
      style: "professional",
      durationMin: 3,
      maxScenes: 6,
      temperature: 0.8,
      imageStyle: "photo",
    },
  },
  {
    name: "🎬 영화 예고편",
    description: "시네마틱 영상 제작에 최적화",
    settings: {
      style: "dramatic",
      durationMin: 2,
      maxScenes: 5,
      temperature: 1.2,
      imageStyle: "cinematic",
    },
  },
];

/**
 * 고급 설정 & 자동화 카드 컴포넌트
 *
 * @param {Object} props - 컴포넌트 props
 * @returns {JSX.Element} 고급 설정 카드 JSX
 */
function AdvancedSettingsCard({ showAdvanced = false, onToggleAdvanced, selectedPreset = "", onApplyPreset, presets = DEFAULT_PRESETS }) {
  const cardStyles = useCardStyles();
  const settingsStyles = useSettingsStyles();

  /**
   * 프리셋 적용 핸들러
   */
  const handlePresetClick = (presetName) => {
    if (onApplyPreset) {
      onApplyPreset(presetName);
    }
  };

  /**
   * 고급 설정 토글 핸들러
   */
  const handleToggle = (_, data) => {
    if (onToggleAdvanced) {
      onToggleAdvanced(data.checked);
    }
  };

  return (
    <Card className={cardStyles.settingsCard}>
      {/* 카드 헤더 */}
      <div className={settingsStyles.sectionHeader}>
        <div className={settingsStyles.sectionTitle}>
          <SettingsRegular />
          <Text weight="semibold" size={400}>
            고급 설정
          </Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalM }}>
          <div>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              프리셋, 배치 처리, 실시간 검증 등 전문 기능을 사용할 수 있습니다.
            </Text>
          </div>
          <Switch checked={showAdvanced} onChange={handleToggle} label={showAdvanced ? "사용 중" : "사용 안함"} />
        </div>
      </div>

      {/* 고급 설정 내용 */}
      {showAdvanced && (
        <div style={{ marginTop: tokens.spacingVerticalM }}>
          {/* 프리셋 섹션 헤더 */}
          <div style={{ marginBottom: tokens.spacingVerticalM }}>
            <Text weight="semibold" size={300} style={{ display: "block", marginBottom: tokens.spacingVerticalXS }}>
              🎯 설정 프리셋
            </Text>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              용도별 최적화된 설정을 한 번에 적용할 수 있습니다.
            </Text>
          </div>

          {/* 프리셋 그리드 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: tokens.spacingHorizontalM,
            }}
          >
            {presets.map((preset) => (
              <Card
                key={preset.name}
                style={{
                  padding: tokens.spacingVerticalM,
                  cursor: "pointer",
                  border:
                    selectedPreset === preset.name ? `2px solid ${tokens.colorBrandBackground}` : `1px solid ${tokens.colorNeutralStroke2}`,
                  background: selectedPreset === preset.name ? tokens.colorBrandBackground2 : tokens.colorNeutralBackground1,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    background: tokens.colorNeutralBackground2,
                    borderColor: tokens.colorBrandBorder1,
                  },
                }}
                onClick={() => handlePresetClick(preset.name)}
              >
                <Text weight="semibold" size={200} style={{ display: "block", marginBottom: tokens.spacingVerticalXS }}>
                  {preset.name}
                </Text>
                <Text
                  size={100}
                  style={{
                    color: tokens.colorNeutralForeground3,
                    lineHeight: 1.3,
                    display: "block",
                    marginBottom: tokens.spacingVerticalS,
                  }}
                >
                  {preset.description}
                </Text>

                {/* 프리셋 설정 미리보기 */}
                {preset.settings && (
                  <div
                    style={{
                      fontSize: "10px",
                      color: tokens.colorNeutralForeground3,
                      marginTop: tokens.spacingVerticalXS,
                    }}
                  >
                    {preset.settings.durationMin}분 · {preset.settings.maxScenes}씬
                  </div>
                )}

                {/* 선택된 상태 표시 */}
                {selectedPreset === preset.name && (
                  <Badge
                    appearance="tint"
                    color="brand"
                    size="small"
                    style={{
                      marginTop: tokens.spacingVerticalS,
                      fontSize: "10px",
                    }}
                  >
                    적용됨
                  </Badge>
                )}
              </Card>
            ))}
          </div>

          {/* 추가 정보 */}
          <div
            style={{
              marginTop: tokens.spacingVerticalL,
              padding: tokens.spacingVerticalM,
              background: tokens.colorNeutralBackground2,
              borderRadius: tokens.borderRadiusMedium,
              border: `1px solid ${tokens.colorNeutralStroke2}`,
            }}
          >
            <Text size={200} style={{ color: tokens.colorNeutralForeground2, lineHeight: 1.4 }}>
              💡 <strong>프리셋 활용 팁:</strong> 각 프리셋은 특정 용도에 최적화된 설정입니다. 프리셋 적용 후 필요에 따라 세부 설정을 조정할
              수 있습니다.
            </Text>
          </div>
        </div>
      )}
    </Card>
  );
}

export default AdvancedSettingsCard;
