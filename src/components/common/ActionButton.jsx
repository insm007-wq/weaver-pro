/**
 * ActionButton - 표준 액션 버튼 컴포넌트
 * 
 * @description
 * Fluent UI Button을 기반으로 한 표준 액션 버튼 컴포넌트입니다.
 * 일관된 스타일과 동작을 제공합니다.
 * 
 * @features
 * - 🎨 다양한 variant (primary, secondary, subtle, transparent)
 * - 📏 크기 옵션 (small, medium, large)
 * - 🎯 아이콘 지원 (앞/뒤 위치)
 * - ⏳ 로딩 상태 지원
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
  Button,
  Spinner
} from '@fluentui/react-components';

const useStyles = makeStyles({
  // 기본 버튼 스타일
  button: {
    transition: 'all 0.2s ease',
    fontWeight: tokens.fontWeightSemibold,
  },

  // 크기별 스타일
  small: {
    minWidth: '64px',
    height: '24px',
    ...shorthands.padding('4px', tokens.spacingHorizontalS),
    fontSize: tokens.fontSizeBase200,
  },

  medium: {
    minWidth: '96px',
    height: '32px', 
    ...shorthands.padding('6px', tokens.spacingHorizontalM),
    fontSize: tokens.fontSizeBase300,
  },

  large: {
    minWidth: '120px',
    height: '40px',
    ...shorthands.padding('8px', tokens.spacingHorizontalL),
    fontSize: tokens.fontSizeBase400,
  },

  // 전체 폭
  fullWidth: {
    width: '100%',
  },

  // 로딩 상태
  loading: {
    cursor: 'wait',
    opacity: 0.8,
  },

  // 아이콘 간격
  iconGap: {
    ...shorthands.gap(tokens.spacingHorizontalXS),
  },

  // 성공 버튼 스타일
  success: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteGreenBorder2),
    
    ':hover': {
      backgroundColor: tokens.colorPaletteGreenBackground2,
    },
    
    ':active': {
      backgroundColor: tokens.colorPaletteGreenBackground1,
    },
  },

  // 위험 버튼 스타일
  danger: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
    ...shorthands.border('1px', 'solid', tokens.colorPaletteRedBorder2),
    
    ':hover': {
      backgroundColor: tokens.colorPaletteRedBackground2,
    },
    
    ':active': {
      backgroundColor: tokens.colorPaletteRedBackground1,
    },
  },

  // 브랜드 버튼 스타일
  brand: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    
    ':hover': {
      backgroundColor: tokens.colorBrandBackgroundHover,
    },
    
    ':active': {
      backgroundColor: tokens.colorBrandBackgroundPressed,
    },
  },

  // 아웃라인 버튼 스타일
  outline: {
    backgroundColor: 'transparent',
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1Hover),
    },
  },

  // 텍스트만 버튼
  text: {
    backgroundColor: 'transparent',
    border: 'none',
    ...shorthands.padding('4px', tokens.spacingHorizontalXS),
    
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },

  // 둥근 버튼
  rounded: {
    ...shorthands.borderRadius('50px'),
  },

  // 정사각형 버튼 (아이콘만)
  square: {
    width: '32px',
    height: '32px',
    minWidth: 'unset',
    ...shorthands.padding('0'),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },

  // 부동 액션 버튼
  fab: {
    width: '56px',
    height: '56px',
    minWidth: 'unset',
    ...shorthands.borderRadius('50%'),
    ...shorthands.padding('0'),
    boxShadow: tokens.shadow16,
    position: 'fixed',
    bottom: tokens.spacingVerticalXXL,
    right: tokens.spacingHorizontalXXL,
    zIndex: 1000,
    
    ':hover': {
      boxShadow: tokens.shadow28,
      transform: 'scale(1.05)',
    },
  },
});

/**
 * ActionButton 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {'primary'|'secondary'|'subtle'|'transparent'|'success'|'danger'|'brand'|'outline'|'text'} [props.variant='primary'] - 버튼 모양
 * @param {'small'|'medium'|'large'} [props.size='medium'] - 버튼 크기
 * @param {React.ReactNode} [props.icon] - 버튼 아이콘
 * @param {'start'|'end'} [props.iconPosition='start'] - 아이콘 위치
 * @param {boolean} [props.loading=false] - 로딩 상태
 * @param {React.ReactNode} [props.loadingText] - 로딩 중 표시할 텍스트
 * @param {boolean} [props.fullWidth=false] - 전체 폭 사용 여부
 * @param {boolean} [props.rounded=false] - 둥근 버튼 여부
 * @param {boolean} [props.square=false] - 정사각형 버튼 여부 (아이콘만)
 * @param {boolean} [props.fab=false] - 부동 액션 버튼 여부
 * @param {boolean} [props.disabled=false] - 비활성화 여부
 * @param {React.ReactNode} props.children - 버튼 텍스트
 * @param {string} [props.className] - 추가 CSS 클래스
 * @param {Function} [props.onClick] - 클릭 핸들러
 * @returns {JSX.Element} ActionButton 컴포넌트
 */
function ActionButton({
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'start',
  loading = false,
  loadingText,
  fullWidth = false,
  rounded = false,
  square = false,
  fab = false,
  disabled = false,
  children,
  className = '',
  onClick,
  ...props
}) {
  const styles = useStyles();

  // 스타일 조합
  const getClassNames = () => {
    const classNames = [styles.button];
    
    // 크기 스타일
    if (!square && !fab) {
      classNames.push(styles[size]);
    }
    
    // Variant 스타일
    if (['success', 'danger', 'brand', 'outline', 'text'].includes(variant)) {
      classNames.push(styles[variant]);
    }
    
    // 모양 스타일
    if (fullWidth) classNames.push(styles.fullWidth);
    if (rounded) classNames.push(styles.rounded);
    if (square) classNames.push(styles.square);
    if (fab) classNames.push(styles.fab);
    if (loading) classNames.push(styles.loading);
    if (icon && children) classNames.push(styles.iconGap);
    if (className) classNames.push(className);

    return classNames.join(' ');
  };

  // Fluent UI appearance 매핑
  const getAppearance = () => {
    switch (variant) {
      case 'success':
      case 'danger':
      case 'brand':
        return 'primary';
      case 'outline':
        return 'outline';
      case 'text':
        return 'transparent';
      default:
        return variant;
    }
  };

  // 아이콘 렌더링
  const renderIcon = () => {
    if (loading) {
      return <Spinner size="tiny" />;
    }
    return icon;
  };

  // 버튼 내용 렌더링
  const renderContent = () => {
    const iconElement = renderIcon();
    const text = loading && loadingText ? loadingText : children;

    if (square || fab) {
      return iconElement;
    }

    if (iconPosition === 'end') {
      return (
        <>
          {text}
          {iconElement}
        </>
      );
    }

    return (
      <>
        {iconElement}
        {text}
      </>
    );
  };

  return (
    <Button
      appearance={getAppearance()}
      size={fab ? 'large' : size}
      className={getClassNames()}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {renderContent()}
    </Button>
  );
}

// =========================== 특화된 버튼 컴포넌트들 ===========================

/**
 * 주 액션 버튼 (Primary)
 */
export function PrimaryButton(props) {
  return <ActionButton variant="primary" {...props} />;
}

/**
 * 보조 액션 버튼 (Secondary)
 */
export function SecondaryButton(props) {
  return <ActionButton variant="secondary" {...props} />;
}

/**
 * 성공 버튼
 */
export function SuccessButton(props) {
  return <ActionButton variant="success" {...props} />;
}

/**
 * 위험 버튼 (삭제, 취소 등)
 */
export function DangerButton(props) {
  return <ActionButton variant="danger" {...props} />;
}

/**
 * 브랜드 버튼
 */
export function BrandButton(props) {
  return <ActionButton variant="brand" {...props} />;
}

/**
 * 아웃라인 버튼
 */
export function OutlineButton(props) {
  return <ActionButton variant="outline" {...props} />;
}

/**
 * 텍스트 버튼
 */
export function TextButton(props) {
  return <ActionButton variant="text" {...props} />;
}

/**
 * 아이콘 버튼 (정사각형)
 */
export function IconButton({ icon, ...props }) {
  return <ActionButton icon={icon} square {...props} />;
}

/**
 * 부동 액션 버튼
 */
export function FloatingActionButton({ icon, ...props }) {
  return <ActionButton icon={icon} fab variant="brand" {...props} />;
}

/**
 * 로딩 버튼 (로딩 상태를 쉽게 관리)
 */
export function LoadingButton({ 
  loading, 
  loadingText = "처리 중...", 
  children,
  ...props 
}) {
  return (
    <ActionButton 
      loading={loading} 
      loadingText={loadingText}
      {...props}
    >
      {children}
    </ActionButton>
  );
}

/**
 * 제출 버튼 (폼 제출용)
 */
export function SubmitButton({ 
  loading, 
  loadingText = "제출 중...", 
  children = "제출",
  ...props 
}) {
  return (
    <ActionButton 
      variant="primary"
      type="submit"
      loading={loading}
      loadingText={loadingText}
      {...props}
    >
      {children}
    </ActionButton>
  );
}

/**
 * 취소 버튼
 */
export function CancelButton({ 
  children = "취소", 
  ...props 
}) {
  return (
    <ActionButton 
      variant="secondary"
      {...props}
    >
      {children}
    </ActionButton>
  );
}

/**
 * 저장 버튼
 */
export function SaveButton({ 
  loading, 
  loadingText = "저장 중...", 
  children = "저장",
  ...props 
}) {
  return (
    <ActionButton 
      variant="success"
      loading={loading}
      loadingText={loadingText}
      {...props}
    >
      {children}
    </ActionButton>
  );
}

/**
 * 삭제 버튼
 */
export function DeleteButton({ 
  loading, 
  loadingText = "삭제 중...", 
  children = "삭제",
  ...props 
}) {
  return (
    <ActionButton 
      variant="danger"
      loading={loading}
      loadingText={loadingText}
      {...props}
    >
      {children}
    </ActionButton>
  );
}

export default memo(ActionButton);