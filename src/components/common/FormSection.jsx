/**
 * FormSection - 폼 섹션 래퍼 컴포넌트
 * 
 * @description
 * 폼을 논리적 섹션으로 그룹화하는 컴포넌트입니다.
 * 제목, 설명, 구분선 등을 포함할 수 있습니다.
 * 
 * @features
 * - 🏷️ 제목 및 설명 지원
 * - 📏 다양한 레이아웃 옵션
 * - 🎨 일관된 스타일링
 * - 📱 반응형 디자인
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
  Text,
  Divider
} from '@fluentui/react-components';

const useStyles = makeStyles({
  // 기본 섹션 스타일
  section: {
    marginBottom: tokens.spacingVerticalXL,
  },

  // 컴팩트 섹션
  compact: {
    marginBottom: tokens.spacingVerticalL,
  },

  // 스페이셔스 섹션
  spacious: {
    marginBottom: tokens.spacingVerticalXXL,
  },

  // 헤더 영역
  header: {
    marginBottom: tokens.spacingVerticalL,
  },

  // 컴팩트 헤더
  compactHeader: {
    marginBottom: tokens.spacingVerticalM,
  },

  // 제목 스타일
  title: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase500,
    marginBottom: tokens.spacingVerticalXS,
  },

  // 서브 제목 스타일
  subtitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase400,
    marginBottom: tokens.spacingVerticalXS,
  },

  // 소제목 스타일
  heading: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
    marginBottom: tokens.spacingVerticalXS,
  },

  // 설명 스타일
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
    maxWidth: '600px',
  },

  // 작은 설명 스타일
  smallDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase200,
    maxWidth: '500px',
  },

  // 아이콘 컨테이너
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalS,
  },

  // 아이콘 스타일
  icon: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorBrandForeground1,
  },

  // 카드 스타일 섹션
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL),
    boxShadow: tokens.shadow4,
  },

  // 구분선 포함 섹션
  withDivider: {
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    paddingBottom: tokens.spacingVerticalL,
  },

  // 콘텐츠 영역
  content: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalM),
  },

  // 그리드 레이아웃
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    ...shorthands.gap(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },

  // 2열 그리드
  twoColumn: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    ...shorthands.gap(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    
    '@media (max-width: 768px)': {
      gridTemplateColumns: '1fr',
    },
  },

  // 액션 영역
  actions: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginTop: tokens.spacingVerticalL,
    
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      ...shorthands.gap(tokens.spacingVerticalM),
    },
  },

  // 우측 정렬 액션
  actionsEnd: {
    justifyContent: 'flex-end',
  },

  // 중앙 정렬 액션
  actionsCenter: {
    justifyContent: 'center',
  },

  // 양쪽 정렬 액션
  actionsBetween: {
    justifyContent: 'space-between',
  },
});

/**
 * FormSection 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {React.ReactNode} [props.icon] - 섹션 아이콘
 * @param {string} [props.title] - 섹션 제목
 * @param {string} [props.subtitle] - 섹션 부제목
 * @param {string} [props.description] - 섹션 설명
 * @param {'title'|'subtitle'|'heading'} [props.titleLevel='title'] - 제목 레벨
 * @param {'default'|'compact'|'spacious'} [props.spacing='default'] - 간격 설정
 * @param {'default'|'grid'|'twoColumn'} [props.layout='default'] - 레이아웃
 * @param {boolean} [props.card=false] - 카드 스타일 적용 여부
 * @param {boolean} [props.divider=false] - 하단 구분선 표시 여부
 * @param {React.ReactNode} [props.actions] - 액션 버튼들
 * @param {'start'|'center'|'end'|'between'} [props.actionsAlign='end'] - 액션 정렬
 * @param {React.ReactNode} props.children - 섹션 내용
 * @param {string} [props.className] - 추가 CSS 클래스
 * @param {Object} [props.style] - 인라인 스타일
 * @returns {JSX.Element} FormSection 컴포넌트
 */
function FormSection({
  icon,
  title,
  subtitle,
  description,
  titleLevel = 'title',
  spacing = 'default',
  layout = 'default',
  card = false,
  divider = false,
  actions,
  actionsAlign = 'end',
  children,
  className = '',
  style = {},
  ...props
}) {
  const styles = useStyles();

  // 스타일 조합
  const getSectionClasses = () => {
    const classes = [styles.section];
    
    if (spacing === 'compact') classes.push(styles.compact);
    if (spacing === 'spacious') classes.push(styles.spacious);
    if (card) classes.push(styles.card);
    if (divider) classes.push(styles.withDivider);
    if (className) classes.push(className);

    return classes.join(' ');
  };

  const getHeaderClasses = () => {
    const classes = [styles.header];
    if (spacing === 'compact') classes.push(styles.compactHeader);
    return classes.join(' ');
  };

  const getContentClasses = () => {
    const classes = [styles.content];
    
    if (layout === 'grid') classes.push(styles.grid);
    if (layout === 'twoColumn') classes.push(styles.twoColumn);

    return classes.join(' ');
  };

  const getActionsClasses = () => {
    const classes = [styles.actions];
    
    if (actionsAlign === 'end') classes.push(styles.actionsEnd);
    if (actionsAlign === 'center') classes.push(styles.actionsCenter);
    if (actionsAlign === 'between') classes.push(styles.actionsBetween);

    return classes.join(' ');
  };

  // 제목 스타일 결정
  const getTitleStyle = () => {
    switch (titleLevel) {
      case 'subtitle':
        return styles.subtitle;
      case 'heading':
        return styles.heading;
      default:
        return styles.title;
    }
  };

  // 설명 스타일 결정
  const getDescriptionStyle = () => {
    return titleLevel === 'heading' ? styles.smallDescription : styles.description;
  };

  // 헤더 렌더링
  const renderHeader = () => {
    if (!icon && !title && !subtitle && !description) return null;

    return (
      <div className={getHeaderClasses()}>
        {(icon || title || subtitle) && (
          <div className={styles.iconContainer}>
            {icon && (
              <span className={styles.icon}>
                {icon}
              </span>
            )}
            <div>
              {title && (
                <Text className={getTitleStyle()}>
                  {title}
                </Text>
              )}
              {subtitle && titleLevel === 'title' && (
                <Text className={styles.subtitle}>
                  {subtitle}
                </Text>
              )}
            </div>
          </div>
        )}
        
        {description && (
          <Text className={getDescriptionStyle()}>
            {description}
          </Text>
        )}
      </div>
    );
  };

  return (
    <section 
      className={getSectionClasses()}
      style={style}
      {...props}
    >
      {renderHeader()}
      
      <div className={getContentClasses()}>
        {children}
      </div>

      {actions && (
        <div className={getActionsClasses()}>
          {actions}
        </div>
      )}

      {divider && !card && (
        <Divider style={{ marginTop: tokens.spacingVerticalL }} />
      )}
    </section>
  );
}

// =========================== 특화된 섹션 컴포넌트들 ===========================

/**
 * 카드 형태의 폼 섹션
 */
export function CardSection(props) {
  return <FormSection card {...props} />;
}

/**
 * 구분선이 있는 폼 섹션
 */
export function DividerSection(props) {
  return <FormSection divider {...props} />;
}

/**
 * 컴팩트 폼 섹션
 */
export function CompactSection(props) {
  return <FormSection spacing="compact" {...props} />;
}

/**
 * 넓은 간격의 폼 섹션
 */
export function SpaciousSection(props) {
  return <FormSection spacing="spacious" {...props} />;
}

/**
 * 그리드 레이아웃 섹션
 */
export function GridSection(props) {
  return <FormSection layout="grid" {...props} />;
}

/**
 * 2열 레이아웃 섹션
 */
export function TwoColumnSection(props) {
  return <FormSection layout="twoColumn" {...props} />;
}

/**
 * 설정 섹션 (카드 + 구분선)
 */
export function SettingsSection(props) {
  return <FormSection card divider {...props} />;
}

export default memo(FormSection);