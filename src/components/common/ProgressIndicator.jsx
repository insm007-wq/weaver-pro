/**
 * ProgressIndicator - 진행률 표시 컴포넌트
 * 
 * @description
 * 다양한 형태의 진행률을 표시하는 컴포넌트입니다.
 * Fluent UI ProgressBar를 기반으로 확장 기능을 제공합니다.
 * 
 * @features
 * - 📊 선형/원형 진행률 표시
 * - 🎨 다양한 색상 테마
 * - 📏 크기 옵션
 * - ⏱️ 애니메이션 효과
 * - 🔧 완전히 커스터마이징 가능
 * 
 * @author Weaver Pro Team
 * @version 2.0.0
 */

import React, { memo, useMemo } from 'react';
import {
  makeStyles,
  shorthands,
  tokens,
  ProgressBar,
  Text,
  mergeClasses
} from '@fluentui/react-components';

const useStyles = makeStyles({
  // 컨테이너 스타일
  container: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalS),
  },

  // 인라인 컨테이너
  inlineContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
  },

  // 레이블 스타일
  label: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  // 작은 레이블
  smallLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    color: tokens.colorNeutralForeground2,
  },

  // 값 표시
  valueDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalXS,
  },

  // 퍼센트 텍스트
  percentage: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },

  // 상세 정보
  details: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
  },

  // 원형 진행률 컨테이너
  circularContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingVerticalS),
  },

  // 원형 진행률 SVG
  circularProgress: {
    transform: 'rotate(-90deg)',
    transition: 'all 0.3s ease',
  },

  // 원형 진행률 텍스트
  circularText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    textAlign: 'center',
  },

  // 작은 원형 텍스트
  smallCircularText: {
    fontSize: tokens.fontSizeBase200,
  },

  // 큰 원형 텍스트
  largeCircularText: {
    fontSize: tokens.fontSizeBase400,
  },

  // 스텝 진행률 컨테이너
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalM),
  },

  // 스텝 헤더
  stepsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // 스텝 리스트
  stepsList: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalS),
  },

  // 스텝 아이템
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    ...shorthands.borderRadius('50%'),
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    transition: 'all 0.2s ease',
  },

  // 완료된 스텝
  completedStep: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
  },

  // 현재 스텝
  currentStep: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },

  // 미완료 스텝
  pendingStep: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
  },

  // 스텝 연결선
  stepConnector: {
    flex: 1,
    height: '2px',
    backgroundColor: tokens.colorNeutralStroke2,
    position: 'relative',
    
    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      height: '100%',
      backgroundColor: tokens.colorPaletteGreenBackground3,
      transition: 'width 0.3s ease',
    },
  },
});

/**
 * ProgressIndicator 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {'linear'|'circular'|'steps'} [props.type='linear'] - 진행률 표시 타입
 * @param {number} [props.value=0] - 현재 값
 * @param {number} [props.max=100] - 최대 값
 * @param {string} [props.label] - 레이블 텍스트
 * @param {boolean} [props.showPercentage=true] - 퍼센트 표시 여부
 * @param {boolean} [props.showValues=false] - 값 표시 여부
 * @param {boolean} [props.inline=false] - 인라인 레이아웃
 * @param {'small'|'medium'|'large'} [props.size='medium'] - 크기
 * @param {'default'|'success'|'warning'|'error'} [props.color='default'] - 색상
 * @param {Array} [props.steps] - 스텝 정보 (steps 타입용)
 * @param {number} [props.currentStep] - 현재 스텝 (steps 타입용)
 * @param {string} [props.description] - 설명 텍스트
 * @param {string} [props.className] - 추가 CSS 클래스
 * @returns {JSX.Element} ProgressIndicator 컴포넌트
 */
function ProgressIndicator({
  type = 'linear',
  value = 0,
  max = 100,
  label,
  showPercentage = true,
  showValues = false,
  inline = false,
  size = 'medium',
  color = 'default',
  steps = [],
  currentStep = 0,
  description,
  className = '',
  ...props
}) {
  const styles = useStyles();

  // 퍼센트 계산
  const percentage = useMemo(() => {
    return Math.min(Math.max((value / max) * 100, 0), 100);
  }, [value, max]);

  // 포맷된 퍼센트
  const formattedPercentage = useMemo(() => {
    return Math.round(percentage);
  }, [percentage]);

  // 선형 진행률 렌더링
  const renderLinearProgress = () => {
    const containerClass = inline ? styles.inlineContainer : styles.container;

    return (
      <div className={mergeClasses(containerClass, className)}>
        {(label || showPercentage || showValues) && (
          <div className={styles.valueDisplay}>
            {label && (
              <Text className={size === 'small' ? styles.smallLabel : styles.label}>
                {label}
              </Text>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS }}>
              {showValues && (
                <Text className={styles.percentage}>
                  {value}/{max}
                </Text>
              )}
              {showPercentage && (
                <Text className={styles.percentage}>
                  {formattedPercentage}%
                </Text>
              )}
            </div>
          </div>
        )}
        
        <ProgressBar 
          value={percentage} 
          max={100}
          thickness={size === 'small' ? 'medium' : size}
          {...props}
        />
        
        {description && (
          <div className={styles.details}>
            <Text>{description}</Text>
          </div>
        )}
      </div>
    );
  };

  // 원형 진행률 렌더링
  const renderCircularProgress = () => {
    const circleSize = size === 'small' ? 60 : size === 'large' ? 100 : 80;
    const strokeWidth = size === 'small' ? 4 : size === 'large' ? 8 : 6;
    const radius = (circleSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const getStrokeColor = () => {
      switch (color) {
        case 'success': return tokens.colorPaletteGreenBackground3;
        case 'warning': return tokens.colorPaletteYellowBackground3;
        case 'error': return tokens.colorPaletteRedBackground3;
        default: return tokens.colorBrandBackground;
      }
    };

    return (
      <div className={mergeClasses(styles.circularContainer, className)}>
        {label && (
          <Text className={size === 'small' ? styles.smallLabel : styles.label}>
            {label}
          </Text>
        )}
        
        <div style={{ position: 'relative', width: circleSize, height: circleSize }}>
          <svg 
            className={styles.circularProgress}
            width={circleSize} 
            height={circleSize}
          >
            {/* 배경 원 */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke={tokens.colorNeutralStroke2}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeLinecap="round"
            />
            {/* 진행률 원 */}
            <circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              stroke={getStrokeColor()}
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              style={{ 
                transition: 'stroke-dashoffset 0.5s ease',
                transformOrigin: 'center'
              }}
            />
          </svg>
          
          <div className={mergeClasses(
            styles.circularText,
            size === 'small' && styles.smallCircularText,
            size === 'large' && styles.largeCircularText
          )}>
            {showPercentage ? `${formattedPercentage}%` : `${value}/${max}`}
          </div>
        </div>
        
        {description && (
          <Text style={{ textAlign: 'center', maxWidth: circleSize + 20 }}>
            {description}
          </Text>
        )}
      </div>
    );
  };

  // 스텝 진행률 렌더링
  const renderStepsProgress = () => {
    return (
      <div className={mergeClasses(styles.stepsContainer, className)}>
        {label && (
          <div className={styles.stepsHeader}>
            <Text className={styles.label}>{label}</Text>
            <Text className={styles.percentage}>
              {currentStep + 1}/{steps.length}
            </Text>
          </div>
        )}
        
        <div className={styles.stepsList}>
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isPending = index > currentStep;
            
            return (
              <React.Fragment key={index}>
                <div 
                  className={`${styles.stepItem} ${
                    isCompleted ? styles.completedStep :
                    isCurrent ? styles.currentStep :
                    styles.pendingStep
                  }`}
                  title={step.title || `Step ${index + 1}`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                
                {index < steps.length - 1 && (
                  <div 
                    className={styles.stepConnector}
                    style={{
                      '::before': {
                        width: isCompleted ? '100%' : '0%'
                      }
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        
        {description && (
          <Text className={styles.details}>{description}</Text>
        )}
      </div>
    );
  };

  // 타입별 렌더링
  switch (type) {
    case 'circular':
      return renderCircularProgress();
    case 'steps':
      return renderStepsProgress();
    default:
      return renderLinearProgress();
  }
}

// =========================== 특화된 진행률 컴포넌트들 ===========================

/**
 * 원형 진행률 표시기
 */
export function CircularProgress(props) {
  return <ProgressIndicator type="circular" {...props} />;
}

/**
 * 스텝 진행률 표시기
 */
export function StepsProgress(props) {
  return <ProgressIndicator type="steps" {...props} />;
}

/**
 * 간단한 진행률 바
 */
export function SimpleProgress({ value, max = 100, ...props }) {
  return (
    <ProgressIndicator 
      value={value}
      max={max}
      showPercentage={false}
      showValues={false}
      {...props}
    />
  );
}

/**
 * 업로드 진행률 표시기
 */
export function UploadProgress({ 
  value, 
  max = 100, 
  filename, 
  speed,
  ...props 
}) {
  const description = speed ? `${filename} - ${speed}/s` : filename;
  
  return (
    <ProgressIndicator 
      type="linear"
      value={value}
      max={max}
      label="파일 업로드"
      description={description}
      showPercentage
      color="success"
      {...props}
    />
  );
}

export default memo(ProgressIndicator);