/**
 * StandardCard - 통합 카드 컴포넌트
 * 
 * @description
 * Fluent UI를 기반으로 한 표준 카드 컴포넌트입니다.
 * 다양한 variant를 통해 여러 스타일을 지원합니다.
 * 
 * @features
 * - 🎨 3가지 variant: default, glass, elevated
 * - 📱 반응형 디자인
 * - ⚡ 성능 최적화 (React.memo)
 * - 🔧 완전히 커스터마이징 가능
 * 
 * @author Weaver Pro Team
 * @version 2.0.0
 */

import React, { memo } from 'react';
import { 
  makeStyles, 
  shorthands, 
  tokens,
  Card,
  CardHeader,
  CardPreview,
  Text 
} from '@fluentui/react-components';

const useStyles = makeStyles({
  // 기본 카드 스타일
  defaultCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    boxShadow: tokens.shadow4,
    transition: 'all 0.2s ease',
    
    ':hover': {
      boxShadow: tokens.shadow8,
      transform: 'translateY(-1px)',
    }
  },

  // 글래스 효과 카드
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(20px)',
    ...shorthands.border('1px', 'solid', 'rgba(255, 255, 255, 0.2)'),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 0 rgba(255, 255, 255, 0.5) inset',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative',
    overflow: 'hidden',
    
    ':hover': {
      transform: 'translateY(-4px) scale(1.01)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.6) inset',
    },

    '::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)',
      ...shorthands.borderRadius(tokens.borderRadiusXLarge),
      pointerEvents: 'none',
    }
  },

  // 엘리베이트 카드
  elevatedCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    boxShadow: tokens.shadow16,
    transition: 'all 0.2s ease',
    
    ':hover': {
      boxShadow: tokens.shadow28,
      transform: 'translateY(-2px)',
    }
  },

  // 컴팩트 패딩
  compactPadding: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },

  // 기본 패딩
  defaultPadding: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
  },

  // 넓은 패딩
  spaciousPadding: {
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalXL),
  },

  // 헤더 스타일
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM,
  },

  // 아이콘 컨테이너
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },

  // 제목 스타일
  title: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase400,
  },

  // 설명 스타일
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
    marginTop: tokens.spacingVerticalXS,
  },

  // 컨텐츠 영역
  content: {
    position: 'relative',
    zIndex: 1,
  },

  // 호버 비활성화
  noHover: {
    ':hover': {
      transform: 'none',
      boxShadow: 'inherit',
    }
  },

  // 클릭 불가
  nonInteractive: {
    cursor: 'default',
  }
});

/**
 * StandardCard 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {'default'|'glass'|'elevated'} [props.variant='default'] - 카드 스타일 변형
 * @param {'compact'|'default'|'spacious'} [props.size='default'] - 패딩 크기
 * @param {React.ReactNode} [props.icon] - 헤더 아이콘
 * @param {string} [props.title] - 카드 제목
 * @param {string} [props.description] - 카드 설명
 * @param {React.ReactNode} props.children - 카드 내용
 * @param {boolean} [props.hover=true] - 호버 효과 사용 여부
 * @param {boolean} [props.interactive=true] - 인터랙티브 여부
 * @param {string} [props.className] - 추가 CSS 클래스
 * @param {Object} [props.style] - 인라인 스타일
 * @param {Function} [props.onClick] - 클릭 핸들러
 * @returns {JSX.Element} StandardCard 컴포넌트
 */
function StandardCard({
  variant = 'default',
  size = 'default',
  icon,
  title,
  description,
  children,
  hover = true,
  interactive = true,
  className = '',
  style = {},
  onClick,
  ...props
}) {
  const styles = useStyles();

  // 스타일 조합
  const getCardStyles = () => {
    const styleArray = [];
    
    // Variant 스타일
    switch (variant) {
      case 'glass':
        styleArray.push(styles.glassCard);
        break;
      case 'elevated':
        styleArray.push(styles.elevatedCard);
        break;
      default:
        styleArray.push(styles.defaultCard);
        break;
    }

    // 패딩 스타일
    switch (size) {
      case 'compact':
        styleArray.push(styles.compactPadding);
        break;
      case 'spacious':
        styleArray.push(styles.spaciousPadding);
        break;
      default:
        styleArray.push(styles.defaultPadding);
        break;
    }

    // 호버/인터랙티브 설정
    if (!hover) styleArray.push(styles.noHover);
    if (!interactive) styleArray.push(styles.nonInteractive);

    return styleArray.join(' ');
  };

  // 헤더 렌더링
  const renderHeader = () => {
    if (!icon && !title && !description) return null;

    return (
      <div className={styles.cardHeader}>
        {icon && (
          <div className={styles.iconContainer}>
            {icon}
          </div>
        )}
        <div>
          {title && (
            <Text className={styles.title}>
              {title}
            </Text>
          )}
          {description && (
            <Text className={styles.description}>
              {description}
            </Text>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card
      className={`${getCardStyles()} ${className}`}
      style={style}
      onClick={interactive ? onClick : undefined}
      {...props}
    >
      <div className={styles.content}>
        {renderHeader()}
        {children}
      </div>
    </Card>
  );
}

export default memo(StandardCard);