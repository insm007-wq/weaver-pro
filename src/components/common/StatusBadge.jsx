/**
 * StatusBadge - 상태 표시 배지 컴포넌트
 * 
 * @description
 * 다양한 상태를 시각적으로 표시하는 배지 컴포넌트입니다.
 * Fluent UI Badge를 기반으로 하며 확장된 기능을 제공합니다.
 * 
 * @features
 * - 🎨 다양한 상태별 색상 (success, warning, error, info, pending)
 * - 📏 크기 옵션 (tiny, small, medium, large)
 * - 🎯 아이콘 지원
 * - ⚡ 애니메이션 효과 옵션
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
  Badge,
  Text,
  mergeClasses
} from '@fluentui/react-components';
import {
  CheckmarkCircleRegular,
  WarningRegular,
  DismissCircleRegular,
  InfoRegular,
  ClockRegular,
  CircleRegular
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  // 기본 배지 스타일
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    fontWeight: tokens.fontWeightSemibold,
    transition: 'all 0.2s ease',
  },

  // 크기별 스타일
  tinySize: {
    ...shorthands.padding('2px', tokens.spacingHorizontalXS),
    fontSize: '10px',
    lineHeight: '1.2',
  },

  smallSize: {
    ...shorthands.padding('3px', tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase100,
    lineHeight: '1.2',
  },

  mediumSize: {
    ...shorthands.padding('4px', tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase200,
    lineHeight: '1.3',
  },

  largeSize: {
    ...shorthands.padding('6px', tokens.spacingHorizontalM),
    fontSize: tokens.fontSizeBase300,
    lineHeight: '1.4',
  },

  // 성공 상태
  success: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
    color: tokens.colorPaletteGreenForeground1,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteGreenBorder1),
  },

  // 경고 상태
  warning: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
    color: tokens.colorPaletteYellowForeground1,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteYellowBorder1),
  },

  // 오류 상태
  error: {
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteRedBorder1),
  },

  // 정보 상태
  info: {
    backgroundColor: tokens.colorPaletteBluBackground1,
    color: tokens.colorPaletteBluForeground1,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteBluBorder1),
  },

  // 대기 상태
  pending: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
  },

  // 브랜드 상태
  brand: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke1),
  },

  // 비활성 상태
  inactive: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke3),
  },

  // 아이콘 스타일
  icon: {
    fontSize: 'inherit',
    lineHeight: 1,
  },

  // 점 표시자
  dot: {
    width: '6px',
    height: '6px',
    ...shorthands.borderRadius('50%'),
    backgroundColor: 'currentColor',
  },

  // 펄스 애니메이션
  pulse: {
    animationName: {
      '0%': { opacity: 1, transform: 'scale(1)' },
      '50%': { opacity: 0.7, transform: 'scale(1.05)' },
      '100%': { opacity: 1, transform: 'scale(1)' }
    },
    animationDuration: '2s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'ease-in-out',
  },

  // 글로우 효과
  glow: {
    boxShadow: '0 0 8px currentColor',
  },

  // 인터랙티브
  interactive: {
    cursor: 'pointer',
    ':hover': {
      transform: 'scale(1.05)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    }
  }
});

// 상태별 기본 아이콘 매핑
const statusIcons = {
  success: CheckmarkCircleRegular,
  warning: WarningRegular,
  error: DismissCircleRegular,
  info: InfoRegular,
  pending: ClockRegular,
  brand: CircleRegular,
  inactive: CircleRegular,
};

/**
 * StatusBadge 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {'success'|'warning'|'error'|'info'|'pending'|'brand'|'inactive'} [props.status='info'] - 상태 타입
 * @param {'tiny'|'small'|'medium'|'large'} [props.size='medium'] - 배지 크기
 * @param {React.ReactNode} [props.icon] - 커스텀 아이콘 (기본 아이콘 대신 사용)
 * @param {boolean} [props.showIcon=true] - 아이콘 표시 여부
 * @param {boolean} [props.showDot=false] - 점 표시 여부 (아이콘 대신)
 * @param {boolean} [props.pulse=false] - 펄스 애니메이션 사용 여부
 * @param {boolean} [props.glow=false] - 글로우 효과 사용 여부
 * @param {boolean} [props.interactive=false] - 인터랙티브 여부 (클릭 가능)
 * @param {React.ReactNode} props.children - 배지 텍스트
 * @param {string} [props.className] - 추가 CSS 클래스
 * @param {Object} [props.style] - 인라인 스타일
 * @param {Function} [props.onClick] - 클릭 핸들러
 * @returns {JSX.Element} StatusBadge 컴포넌트
 */
function StatusBadge({
  status = 'info',
  size = 'medium',
  icon,
  showIcon = true,
  showDot = false,
  pulse = false,
  glow = false,
  interactive = false,
  children,
  className = '',
  style = {},
  onClick,
  ...props
}) {
  const styles = useStyles();

  // 스타일 조합
  const getClassNames = () => {
    return mergeClasses(
      styles.badge,
      styles[`${size}Size`],
      styles[status],
      pulse && styles.pulse,
      glow && styles.glow,
      interactive && styles.interactive,
      className
    );
  };

  // 아이콘 렌더링
  const renderIcon = () => {
    if (showDot) {
      return <span className={styles.dot} />;
    }

    if (!showIcon) return null;

    if (icon) {
      return React.cloneElement(icon, { className: styles.icon });
    }

    const DefaultIcon = statusIcons[status];
    if (DefaultIcon) {
      return <DefaultIcon className={styles.icon} />;
    }

    return null;
  };

  return (
    <span
      className={getClassNames()}
      style={style}
      onClick={interactive ? onClick : undefined}
      {...props}
    >
      {renderIcon()}
      {children && (
        <Text as="span" size={size === 'tiny' ? 100 : size === 'small' ? 200 : size === 'large' ? 400 : 300}>
          {children}
        </Text>
      )}
    </span>
  );
}

// =========================== 특화된 상태 배지 컴포넌트들 ===========================

/**
 * 성공 배지
 */
export function SuccessBadge(props) {
  return <StatusBadge status="success" {...props} />;
}

/**
 * 경고 배지
 */
export function WarningBadge(props) {
  return <StatusBadge status="warning" {...props} />;
}

/**
 * 오류 배지
 */
export function ErrorBadge(props) {
  return <StatusBadge status="error" {...props} />;
}

/**
 * 정보 배지
 */
export function InfoBadge(props) {
  return <StatusBadge status="info" {...props} />;
}

/**
 * 대기 배지 (애니메이션 포함)
 */
export function PendingBadge(props) {
  return <StatusBadge status="pending" pulse {...props} />;
}

/**
 * 온라인 상태 배지
 */
export function OnlineBadge({ children = "온라인", ...props }) {
  return (
    <StatusBadge 
      status="success" 
      showDot 
      size="small"
      glow
      {...props}
    >
      {children}
    </StatusBadge>
  );
}

/**
 * 오프라인 상태 배지
 */
export function OfflineBadge({ children = "오프라인", ...props }) {
  return (
    <StatusBadge 
      status="inactive" 
      showDot 
      size="small"
      {...props}
    >
      {children}
    </StatusBadge>
  );
}

/**
 * 진행률 배지
 */
export function ProgressBadge({ progress, total, ...props }) {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  const status = percentage === 100 ? 'success' : percentage > 0 ? 'info' : 'pending';
  
  return (
    <StatusBadge 
      status={status}
      {...props}
    >
      {progress}/{total} ({percentage}%)
    </StatusBadge>
  );
}

/**
 * 상태 카운트 배지
 */
export function CountBadge({ count, maxCount, status = 'info', ...props }) {
  const isOverMax = maxCount && count > maxCount;
  const displayCount = isOverMax ? `${maxCount}+` : count;
  const badgeStatus = isOverMax ? 'warning' : status;
  
  return (
    <StatusBadge 
      status={badgeStatus}
      size="small"
      {...props}
    >
      {displayCount}
    </StatusBadge>
  );
}

export default memo(StatusBadge);