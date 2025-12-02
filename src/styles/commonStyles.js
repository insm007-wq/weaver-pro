/**
 * 공통 스타일 테마 - Weaver Pro (확장 버전)
 * * 이 파일은 프로젝트 전반에서 사용되는 공통 스타일 패턴을 정의합니다.
 * Fluent UI 토큰을 기반으로 일관된 디자인 시스템을 제공합니다.
 * * @features
 * - 📦 컨테이너 및 레이아웃 스타일
 * - 🎨 카드 및 표면 스타일
 * - 📝 타이포그래피 및 헤더 스타일
 * - 📋 폼 및 입력 스타일
 * - 🎬 애니메이션 및 트랜지션
 * - 🎯 상태 및 인터랙션 스타일
 * - 📱 반응형 유틸리티
 * * @author Weaver Pro Team
 * @version 3.0.0
 */

import { makeStyles, tokens, shorthands } from "@fluentui/react-components";

/**
 * 기본 컨테이너 스타일
 * - 최대 폭: 1400px (더 넓게)
 * - 중앙 정렬
 * - 적절한 패딩과 여백
 */
export const useContainerStyles = makeStyles({
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,

    "@media (max-width: 1024px)": {
      padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalM}`,
      gap: tokens.spacingVerticalM,
    },
  },

  /** 반응형 컨테이너 (모바일 대응) */
  responsiveContainer: {
    maxWidth: "100%",
    margin: "0 auto",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalS),
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,

    "@media (min-width: 768px)": {
      maxWidth: "1200px",
      ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
      gap: tokens.spacingVerticalL,
    },
  },
});

/**
 * 카드 스타일 패턴
 * - 더 부드럽고 깊이 있는 그림자 효과를 적용
 */
export const useCardStyles = makeStyles({
  /** 기본 카드 스타일 */
  baseCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusExtraLarge,
    padding: tokens.spacingVerticalL,
    boxShadow: tokens.shadow8,
    marginBottom: tokens.spacingVerticalL,
  },

  /** 설정 전용 카드 */
  settingsCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusExtraLarge,
    padding: tokens.spacingVerticalL,
    boxShadow: tokens.shadow8,
    marginBottom: tokens.spacingVerticalL,
  },

  /** 결과 표시용 카드 (더 눈에 띄는 스타일) */
  resultCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderRadius: tokens.borderRadiusExtraLarge,
    padding: tokens.spacingVerticalL,
    boxShadow: tokens.shadow16,
    marginBottom: tokens.spacingVerticalL,
  },

  /** 팁/도움말 카드 */
  tipCard: {
    backgroundColor: tokens.colorSubtleBackground,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalM,
    boxShadow: "none",
  },
});

/**
 * 헤더 및 타이틀 스타일
 */
export const useHeaderStyles = makeStyles({
  /** 페이지 헤더 */
  pageHeader: {
    ...shorthands.margin(0, 0, tokens.spacingVerticalXXL),
    textAlign: "center",
  },

  /** 통일된 페이지 타이틀 (아이콘과 함께) - AI 썸네일 기준 크기 */
  pageTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    columnGap: tokens.spacingHorizontalM,
    fontFamily: "'Pretendard', system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase500,
    lineHeight: "1.2",
    letterSpacing: "-0.01em",
    textRendering: "optimizeLegibility",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    marginBottom: tokens.spacingVerticalS,
  },

  /** 아이콘이 있는 페이지 타이틀 (시각적 중앙 정렬을 위한 transform) */
  pageTitleWithIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    columnGap: tokens.spacingHorizontalM,
    fontFamily: "'Pretendard', system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif",
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase500,
    lineHeight: "1.2",
    letterSpacing: "-0.01em",
    textRendering: "optimizeLegibility",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    marginBottom: tokens.spacingVerticalS,
    transform: "translateX(-16px)",
  },

  /** 페이지 설명 - AI 썸네일 기준 크기 */
  pageDescription: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase300,
    lineHeight: "1.5",
    textAlign: "center",
    maxWidth: "700px",
    margin: "0 auto",
  },

  /** 섹션 헤더 */
  sectionHeader: {
    marginBottom: tokens.spacingVerticalL,
  },

  /** 구분선 */
  divider: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    marginTop: tokens.spacingVerticalM,
  },
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
    marginTop: tokens.spacingVerticalL,
  },

  /** 업로드 영역 */
  uploadArea: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusExtraLarge,
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
      backgroundColor: tokens.colorBrandBackground2,
    },

    ":focus-within": {
      borderColor: tokens.colorBrandStroke1,
      ...shorthands.outline("2px", "solid", tokens.colorBrandStroke1),
      outlineOffset: "2px",
    },
  },

  /** 드래그 오버 상태 */
  uploadAreaDragOver: {
    borderColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
});

/**
 * 프로그레스 관련 스타일
 */
export const useProgressStyles = makeStyles({
  /** 프로그레스 컨테이너 */
  progressContainer: {
    padding: tokens.spacingVerticalM,
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
  },
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
    gap: tokens.spacingVerticalM,
  },

  /** 수평 스택 */
  horizontalStack: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },

  /** 격자 레이아웃 (2열) */
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingHorizontalL,

    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },

  /** 격자 레이아웃 (3열) */
  gridThree: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: tokens.spacingHorizontalL,

    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr 1fr",
    },

    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

/**
 * 애니메이션 스타일
 */
export const useAnimationStyles = makeStyles({
  /** 페이드 인 애니메이션 */
  fadeIn: {
    animationName: {
      "0%": { opacity: 0, transform: "translateY(10px)" },
      "100%": { opacity: 1, transform: "translateY(0)" },
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
    },
  },
});


/**
 * 설정 탭 전용 스타일
 * - 설정 페이지에서 반복적으로 사용되는 UI 패턴들
 */
export const useSettingsStyles = makeStyles({
  /** 설정 그룹 그리드 */
  settingsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: tokens.spacingVerticalL,
  },

  /** 정보 박스 컨테이너 */
  infoBox: {
    backgroundColor: tokens.colorSubtleBackground,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalM,
    boxShadow: "none",
  },

  /** 정보 박스 아이콘 */
  infoIcon: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  /** 정보 박스 내용 */
  infoContent: {
    flex: 1,
  },

  /** 정보 박스 제목 */
  infoTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXS,
  },

  /** 정보 박스 텍스트 */
  infoText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    lineHeight: "1.5",
  },

  /** 폴더 선택 섹션 */
  folderSection: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "flex-end",
  },

  /** 폴더 입력 필드 */
  folderInput: {
    flex: 1,
  },

  /** 플레이스홀더 카드 (개발 중 표시용) */
  placeholderCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    padding: tokens.spacingVerticalXXL,
    boxShadow: tokens.shadow8,
    textAlign: "center",
  },

  /** 플레이스홀더 텍스트 */
  placeholderText: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase400,
  },

  /** 프롬프트 관리 카드 (컴팩트) */
  manageCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusExtraLarge,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    boxShadow: tokens.shadow8,
    marginBottom: tokens.spacingVerticalL,
  },

  /** 관리 행 레이아웃 */
  manageRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },

  /** 관리 라벨 */
  manageLabel: {
    fontWeight: tokens.fontWeightSemibold,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },

  /** 관리 드롭다운 */
  manageDropdown: {
    minWidth: "200px",
    flex: 1,
    maxWidth: "400px",
  },

  /** 관리 액션 버튼들 */
  manageActions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    marginLeft: "auto",
  },

  /** 인라인 생성 폼 */
  inlineCreate: {
    marginTop: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: tokens.spacingHorizontalS,
  },

  /** 섹션 그리드 (2열) */
  sectionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalL,

    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },

  /** 섹션 카드 */
  sectionCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusExtraLarge,
    padding: tokens.spacingVerticalL,
    boxShadow: tokens.shadow8,
  },

  /** 섹션 헤더 */
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalM,
  },

  /** 섹션 제목 */
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },

  /** 에디터 스타일 */
  editor: {
    minHeight: "200px",
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
  },

  /** 문자 수 표시 */
  charCount: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    marginTop: tokens.spacingVerticalS,
  },
});

/**
 * 폰트 유틸리티 - Pretendard 폰트 통일
 */
export const fontTokens = {
  // Pretendard 폰트를 최우선으로 하는 폰트 스택
  primary: "'Pretendard', 'Segoe UI', system-ui, -apple-system, 'Malgun Gothic', sans-serif",
  monospace: "'Pretendard', 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Consolas', monospace",
  
  // 폰트 크기 (Fluent UI 토큰 기반)
  xs: tokens.fontSizeBase100,
  sm: tokens.fontSizeBase200,
  base: tokens.fontSizeBase300,
  lg: tokens.fontSizeBase400,
  xl: tokens.fontSizeBase500,
  xxl: tokens.fontSizeBase600,
  
  // 폰트 웨이트
  normal: tokens.fontWeightRegular,
  medium: tokens.fontWeightMedium,
  semibold: tokens.fontWeightSemibold,
  bold: tokens.fontWeightBold,
};

/**
 * 글로벌 폰트 오버라이드 스타일
 */
export const useFontOverrideStyles = makeStyles({
  // 모든 텍스트 요소에 Pretendard 폰트 적용
  globalFont: {
    fontFamily: fontTokens.primary,
    
    // 모든 하위 요소에도 적용
    "& *": {
      fontFamily: "inherit !important",
    },
    
    // Fluent UI 컴포넌트 폰트 오버라이드
    "& .fui-Text": {
      fontFamily: "inherit !important",
    },
    
    "& .fui-Title1, & .fui-Title2, & .fui-Title3": {
      fontFamily: "inherit !important",
    },
    
    "& .fui-Body1, & .fui-Body1Strong, & .fui-Body2": {
      fontFamily: "inherit !important",
    },
    
    "& .fui-Caption1, & .fui-Caption2": {
      fontFamily: "inherit !important",
    },
    
    "& .fui-Button, & .fui-Input, & .fui-Textarea": {
      fontFamily: "inherit !important",
    },
    
    "& .fui-Dropdown, & .fui-Option": {
      fontFamily: "inherit !important",
    },
    
    "& .fui-Tab, & .fui-TabList": {
      fontFamily: "inherit !important",
    },
    
    "& .fui-Badge, & .fui-MessageBar": {
      fontFamily: "inherit !important",
    },
  },
  
  // 코드 전용 폰트 (모노스페이스 유지하되 Pretendard 우선)
  codeFont: {
    fontFamily: fontTokens.monospace,
  },
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
  info: tokens.colorPaletteBlueBackground3,

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

/**
 * 상태 및 인터랙션 스타일
 */
export const useInteractionStyles = makeStyles({
  /** 호버 가능한 요소 */
  hoverable: {
    cursor: "pointer",
    transition: "all 0.2s ease",

    ":hover": {
      transform: "translateY(-1px)",
      boxShadow: tokens.shadow8,
    },
  },

  /** 클릭 가능한 요소 */
  clickable: {
    cursor: "pointer",
    transition: "all 0.15s ease",

    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },

    ":active": {
      transform: "scale(0.98)",
    },
  },

  /** 비활성화 상태 */
  disabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    pointerEvents: "none",
  },

  /** 선택된 상태 */
  selected: {
    backgroundColor: tokens.colorBrandBackground2,
    border: `1px solid ${tokens.colorBrandStroke1}`,
  },

  /** 포커스 가능한 요소 */
  focusable: {
    ":focus-visible": {
      ...shorthands.outline("3px", "solid", tokens.colorBrandStroke1),
      outlineOffset: "2px",
      borderRadius: tokens.borderRadiusMedium,
    },
  },

  /** 드래그 가능한 요소 */
  draggable: {
    cursor: "grab",

    ":active": {
      cursor: "grabbing",
    },
  },
});

/**
 * 고급 애니메이션 스타일
 */
export const useAdvancedAnimationStyles = makeStyles({
  /** 부드러운 스케일 호버 */
  scaleOnHover: {
    transition: "transform 0.2s ease",
    ":hover": {
      transform: "scale(1.05)",
    },
  },

  /** 글로우 효과 */
  glowEffect: {
    transition: "box-shadow 0.3s ease",
    ":hover": {
      boxShadow: `0 0 20px ${tokens.colorBrandBackground}40`,
    },
  },

  /** 슬라이드 인 애니메이션 */
  slideIn: {
    animationName: {
      "0%": { transform: "translateX(-100%)", opacity: 0 },
      "100%": { transform: "translateX(0)", opacity: 1 },
    },
    animationDuration: "0.3s",
    animationTimingFunction: "ease-out",
  },

  /** 페이드 인 업 */
  fadeInUp: {
    animationName: {
      "0%": { transform: "translateY(20px)", opacity: 0 },
      "100%": { transform: "translateY(0)", opacity: 1 },
    },
    animationDuration: "0.4s",
    animationTimingFunction: "ease-out",
  },

  /** 펄스 애니메이션 */
  pulse: {
    animationName: {
      "0%, 100%": { opacity: 1 },
      "50%": { opacity: 0.5 },
    },
    animationDuration: "2s",
    animationIterationCount: "infinite",
  },

  /** 바운스 로딩 */
  bounce: {
    animationName: {
      "0%, 20%, 53%, 80%, 100%": { transform: "translate3d(0,0,0)" },
      "40%, 43%": { transform: "translate3d(0, -30px, 0)" },
      "70%": { transform: "translate3d(0, -15px, 0)" },
      "90%": { transform: "translate3d(0, -4px, 0)" },
    },
    animationDuration: "1s",
    animationIterationCount: "infinite",
  },
});

/**
 * 고급 레이아웃 유틸리티
 */
export const useAdvancedLayoutStyles = makeStyles({
  /** 스티키 헤더 */
  stickyHeader: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    backgroundColor: tokens.colorNeutralBackground1,
    backdropFilter: "blur(10px)",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },

  /** 사이드바 레이아웃 */
  sidebarLayout: {
    display: "grid",
    gridTemplateColumns: "250px 1fr",
    minHeight: "100vh",

    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },

  /** 마스터-디테일 레이아웃 */
  masterDetail: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: tokens.spacingHorizontalL,
    height: "100%",

    "@media (max-width: 1024px)": {
      gridTemplateColumns: "1fr",
      gridTemplateRows: "auto 1fr",
    },
  },

  /** 카드 그리드 (자동 크기 조정) */
  autoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: tokens.spacingVerticalL,
  },

  /** 센터링 컨테이너 */
  absoluteCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },

  /** 전체 화면 오버레이 */
  fullScreenOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  /** 비율 유지 컨테이너 */
  aspectRatio16_9: {
    aspectRatio: "16 / 9",
    width: "100%",
  },

  aspectRatio4_3: {
    aspectRatio: "4 / 3",
    width: "100%",
  },

  aspectRatio1_1: {
    aspectRatio: "1 / 1",
    width: "100%",
  },
});

/**
 * 반응형 타이포그래피 스타일
 */
export const useResponsiveTypographyStyles = makeStyles({
  /** 반응형 헤드라인 */
  responsiveHeadline: {
    fontSize: tokens.fontSizeHero900,
    lineHeight: tokens.lineHeightHero900,
    fontWeight: tokens.fontWeightBold,

    "@media (max-width: 768px)": {
      fontSize: tokens.fontSizeHero700,
      lineHeight: tokens.lineHeightHero700,
    },

    "@media (max-width: 480px)": {
      fontSize: tokens.fontSizeBase600,
      lineHeight: tokens.lineHeightBase600,
    },
  },

  /** 반응형 본문 텍스트 */
  responsiveBody: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,

    "@media (max-width: 768px)": {
      fontSize: tokens.fontSizeBase300,
      lineHeight: tokens.lineHeightBase300,
    },
  },

  /** 코드 블록 스타일 */
  codeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalM}`,
    overflowX: "auto",
    whiteSpace: "pre",
  },

  /** 인라인 코드 스타일 */
  inlineCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: "0.9em",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorBrandForeground1,
    padding: "2px 4px",
    borderRadius: tokens.borderRadiusSmall,
  },
});

/**
 * 접근성 스타일
 */
export const useAccessibilityStyles = makeStyles({
  /** 스크린 리더 전용 텍스트 */
  srOnly: {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clipPath: "inset(50%)",
    whiteSpace: "nowrap",
    border: "0",
  },

  /** 고대비 모드 지원 */
  highContrast: {
    "@media (prefers-contrast: high)": {
      border: "2px solid ButtonText",
      backgroundColor: "ButtonFace",
      color: "ButtonText",
    },
  },

  /** 모션 감소 지원 */
  respectMotion: {
    "@media (prefers-reduced-motion: reduce)": {
      animationDuration: "0.01ms",
      animationIterationCount: "1",
      transitionDuration: "0.01ms",
    },
  },

  /** 포커스 인디케이터 */
  accessibleFocus: {
    ":focus-visible": {
      ...shorthands.outline("3px", "solid", tokens.colorBrandStroke1),
      outlineOffset: "2px",
      borderRadius: tokens.borderRadiusMedium,
    },
  },
});

/**
 * 유틸리티 스타일
 */
export const useUtilityStyles = makeStyles({
  /** 텍스트 자르기 (말줄임표) */
  truncate: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  /** 멀티라인 텍스트 자르기 */
  lineClamp2: {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  lineClamp3: {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },

  /** 스크롤바 스타일링 */
  customScrollbar: {
    scrollbarWidth: "thin",
    scrollbarColor: `${tokens.colorNeutralStroke1} transparent`,

    "::-webkit-scrollbar": {
      width: "8px",
      height: "8px",
    },

    "::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },

    "::-webkit-scrollbar-thumb": {
      backgroundColor: tokens.colorNeutralStroke1,
      borderRadius: "4px",

      ":hover": {
        backgroundColor: tokens.colorNeutralStroke2,
      },
    },
  },

  /** 그라디언트 배경 */
  brandGradient: {
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorPaletteBlueBackground3} 100%)`,
  },

  successGradient: {
    background: `linear-gradient(135deg, ${tokens.colorPaletteGreenBackground3} 0%, ${tokens.colorPaletteTealBackground3} 100%)`,
  },

  /** 쉐도우 변형 */
  softShadow: {
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },

  mediumShadow: {
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.12)",
  },

  strongShadow: {
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.16)",
  },
});

/**
 * 성능 최적화를 위한 스타일 상수
 */
export const PERFORMANCE_STYLES = {
  // GPU 가속을 위한 transform
  GPU_ACCELERATION: {
    transform: "translateZ(0)",
    backfaceVisibility: "hidden",
    perspective: "1000px",
  },

  // 레이어 승격
  LAYER_PROMOTION: {
    willChange: "transform, opacity",
  },

  // 하드웨어 가속 호버
  HARDWARE_HOVER: {
    transform: "translate3d(0, 0, 0)",
    transition: "transform 0.2s ease",
  },
};

/**
 * CSS 커스텀 프로퍼티 (CSS 변수) 정의
 */
export const CSS_VARIABLES = {
  "--weaver-brand-primary": tokens.colorBrandBackground,
  "--weaver-brand-hover": tokens.colorBrandBackgroundHover,
  "--weaver-success": tokens.colorPaletteGreenBackground3,
  "--weaver-warning": tokens.colorPaletteYellowBackground3,
  "--weaver-error": tokens.colorPaletteRedBackground3,
  "--weaver-info": tokens.colorPaletteBlueBackground3,
  "--weaver-radius-small": tokens.borderRadiusSmall,
  "--weaver-radius-medium": tokens.borderRadiusMedium,
  "--weaver-radius-large": tokens.borderRadiusLarge,
  "--weaver-shadow-soft": "0 2px 8px rgba(0, 0, 0, 0.08)",
  "--weaver-shadow-medium": "0 4px 16px rgba(0, 0, 0, 0.12)",
  "--weaver-shadow-strong": "0 8px 32px rgba(0, 0, 0, 0.16)",
};
