/**
 * 공통 스타일 테마 - Weaver Pro
 * 
 * 이 파일은 프로젝트 전반에서 사용되는 공통 스타일 패턴을 정의합니다.
 * Fluent UI 토큰을 기반으로 일관된 디자인 시스템을 제공합니다.
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 */

import { makeStyles, tokens, shorthands } from "@fluentui/react-components";

/**
 * 기본 컨테이너 스타일
 * - 최대 폭: 1200px
 * - 중앙 정렬
 * - 적절한 패딩과 여백
 */
export const useContainerStyles = makeStyles({
  container: {
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },
  
  /** 반응형 컨테이너 (모바일 대응) */
  responsiveContainer: {
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    ...shorthands.padding(
      tokens.spacingVerticalL, 
      tokens.spacingHorizontalM,
      "@media (min-width: 768px)": {
        ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
      }
    ),
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  }
});

/**
 * 카드 스타일 패턴
 * - 기본 카드, 설정 카드, 결과 카드 등 다양한 변형 제공
 */
export const useCardStyles = makeStyles({
  /** 기본 카드 스타일 */
  baseCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
    marginBottom: tokens.spacingVerticalL,
  },
  
  /** 설정 전용 카드 */
  settingsCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
    marginBottom: tokens.spacingVerticalL,
  },
  
  /** 결과 표시용 카드 (좀 더 눈에 띄는 스타일) */
  resultCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("2px", "solid", tokens.colorBrandStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)",
    marginBottom: tokens.spacingVerticalL,
  },
  
  /** 팁/도움말 카드 */
  tipCard: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
    marginBottom: tokens.spacingVerticalM,
  }
});

/**
 * 헤더 및 타이틀 스타일
 */
export const useHeaderStyles = makeStyles({
  /** 페이지 헤더 */
  pageHeader: {
    ...shorthands.margin(0, 0, tokens.spacingVerticalL),
  },
  
  /** 페이지 타이틀 (아이콘과 함께) */
  pageTitle: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
  },
  
  /** 페이지 설명 */
  pageDescription: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase300,
    lineHeight: "1.5",
  },
  
  /** 섹션 헤더 */
  sectionHeader: {
    marginBottom: tokens.spacingVerticalL,
  },
  
  /** 구분선 */
  divider: {
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    marginTop: tokens.spacingVerticalM,
  }
});

/**
 * 폼 관련 스타일
 */
export const useFormStyles = makeStyles({
  /** 폼 그룹 (라벨 + 입력 필드) */
  formGroup: {
    marginBottom: tokens.spacingVerticalM,
  },
  
  /** 액션 버튼 그룹 */
  actionGroup: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
  
  /** 업로드 영역 */
  uploadArea: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalL,
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
    minHeight: "200px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    
    ":hover": {
      borderColor: tokens.colorBrandStroke1,
      backgroundColor: tokens.colorNeutralBackground2,
    },
    
    ":focus": {
      borderColor: tokens.colorBrandStroke1,
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: "2px",
    }
  },
  
  /** 드래그 오버 상태 */
  uploadAreaDragOver: {
    borderColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  }
});

/**
 * 프로그레스 관련 스타일
 */
export const useProgressStyles = makeStyles({
  /** 프로그레스 컨테이너 */
  progressContainer: {
    ...shorthands.padding(tokens.spacingVerticalM),
    textAlign: "center",
  },
  
  /** 프로그레스 바 래퍼 */
  progressWrapper: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  
  /** 상태 뱃지 */
  statusBadge: {
    marginTop: tokens.spacingVerticalS,
  }
});

/**
 * 레이아웃 유틸리티 스타일
 */
export const useLayoutStyles = makeStyles({
  /** Flexbox 중앙 정렬 */
  centerFlex: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  
  /** 수직 스택 */
  verticalStack: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
  },
  
  /** 수평 스택 */
  horizontalStack: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  
  /** 격자 레이아웃 (2열) */
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    ...shorthands.gap(tokens.spacingHorizontalL),
    
    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    }
  },
  
  /** 격자 레이아웃 (3열) */
  gridThree: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    ...shorthands.gap(tokens.spacingHorizontalL),
    
    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr 1fr",
    },
    
    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    }
  }
});

/**
 * 애니메이션 스타일
 */
export const useAnimationStyles = makeStyles({
  /** 페이드 인 애니메이션 */
  fadeIn: {
    animationName: {
      "0%": { opacity: 0, transform: "translateY(10px)" },
      "100%": { opacity: 1, transform: "translateY(0)" }
    },
    animationDuration: "0.3s",
    animationTimingFunction: "ease-out",
  },
  
  /** 부드러운 트랜지션 */
  smoothTransition: {
    transition: "all 0.2s ease",
  },
  
  /** 호버 효과 */
  hoverScale: {
    transition: "transform 0.2s ease",
    ":hover": {
      transform: "scale(1.02)",
    }
  }
});

/**
 * 토스트/알림 스타일
 */
export const useToastStyles = makeStyles({
  toastContainer: {
    position: "fixed",
    top: tokens.spacingVerticalL,
    right: tokens.spacingHorizontalL,
    zIndex: 1000,
    maxWidth: "400px",
  }
});

/**
 * 색상 유틸리티
 */
export const colorTokens = {
  // 브랜드 컬러
  primary: tokens.colorBrandBackground,
  primaryHover: tokens.colorBrandBackgroundHover,
  
  // 상태 컬러
  success: tokens.colorPaletteGreenBackground3,
  warning: tokens.colorPaletteYellowBackground3,
  error: tokens.colorPaletteRedBackground3,
  info: tokens.colorPaletteBluBackground3,
  
  // 텍스트 컬러
  textPrimary: tokens.colorNeutralForeground1,
  textSecondary: tokens.colorNeutralForeground2,
  textTertiary: tokens.colorNeutralForeground3,
  
  // 배경 컬러
  backgroundPrimary: tokens.colorNeutralBackground1,
  backgroundSecondary: tokens.colorNeutralBackground2,
  backgroundTertiary: tokens.colorNeutralBackground3,
};

/**
 * 간격 유틸리티
 */
export const spacingTokens = {
  xs: tokens.spacingVerticalXS,
  s: tokens.spacingVerticalS,
  m: tokens.spacingVerticalM,
  l: tokens.spacingVerticalL,
  xl: tokens.spacingVerticalXL,
  xxl: tokens.spacingVerticalXXL,
};