/**
 * PageHeader - 페이지 헤더 컴포넌트
 * 
 * @description
 * 일관된 페이지 헤더를 제공하는 컴포넌트입니다.
 * 제목, 설명, 액션 버튼, 브레드크럼 등을 포함할 수 있습니다.
 * 
 * @features
 * - 🏷️ 제목, 부제목, 설명 지원
 * - 🎯 아이콘 및 액션 버튼 지원
 * - 🍞 브레드크럼 네비게이션
 * - 📱 반응형 디자인
 * - 🎨 일관된 스타일링
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbDivider
} from '@fluentui/react-components';

const useStyles = makeStyles({
  // 헤더 컨테이너
  header: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap(tokens.spacingVerticalM),
    marginBottom: tokens.spacingVerticalXL,
    
    '@media (max-width: 768px)': {
      ...shorthands.gap(tokens.spacingVerticalS),
      marginBottom: tokens.spacingVerticalL,
    },
  },

  // 컴팩트 헤더
  compact: {
    marginBottom: tokens.spacingVerticalL,
    ...shorthands.gap(tokens.spacingVerticalS),
  },

  // 브레드크럼 컨테이너
  breadcrumbContainer: {
    marginBottom: tokens.spacingVerticalS,
  },

  // 메인 헤더 영역
  main: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    ...shorthands.gap(tokens.spacingHorizontalL),
    
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      alignItems: 'stretch',
      ...shorthands.gap(tokens.spacingVerticalM),
    },
  },

  // 제목 영역
  titleSection: {
    flex: 1,
    minWidth: 0, // flex item이 축소될 수 있도록
  },

  // 아이콘과 제목 컨테이너
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalXS,
  },

  // 아이콘 컨테이너
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: tokens.fontSizeBase400,
  },

  // 제목 스타일
  title: {
    fontSize: tokens.fontSizeHero800,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightHero800,
    ...shorthands.margin(0),
    
    '@media (max-width: 768px)': {
      fontSize: tokens.fontSizeBase600,
      lineHeight: tokens.lineHeightBase600,
    },
  },

  // 부제목 스타일
  subtitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase500,
    marginTop: tokens.spacingVerticalXS,
    marginBottom: 0,
    
    '@media (max-width: 768px)': {
      fontSize: tokens.fontSizeBase400,
      lineHeight: tokens.lineHeightBase400,
    },
  },

  // 설명 스타일
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase300,
    marginTop: tokens.spacingVerticalS,
    maxWidth: '600px',
    
    '@media (max-width: 768px)': {
      fontSize: tokens.fontSizeBase200,
      lineHeight: tokens.lineHeightBase200,
    },
  },

  // 액션 영역
  actions: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
    flexShrink: 0,
    
    '@media (max-width: 768px)': {
      alignSelf: 'stretch',
      justifyContent: 'flex-end',
    },
  },

  // 상태 인디케이터
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalS),
    marginTop: tokens.spacingVerticalXS,
  },

  // 메타 정보 영역
  meta: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginTop: tokens.spacingVerticalS,
    
    '@media (max-width: 768px)': {
      flexDirection: 'column',
      alignItems: 'flex-start',
      ...shorthands.gap(tokens.spacingVerticalXS),
    },
  },

  // 메타 아이템
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap(tokens.spacingHorizontalXS),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },

  // 구분선
  divider: {
    width: '100%',
    height: '1px',
    backgroundColor: tokens.colorNeutralStroke2,
    ...shorthands.margin(0),
  },
});

/**
 * PageHeader 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {React.ReactNode} [props.icon] - 헤더 아이콘
 * @param {string} props.title - 페이지 제목
 * @param {string} [props.subtitle] - 부제목
 * @param {string} [props.description] - 페이지 설명
 * @param {Array} [props.breadcrumb] - 브레드크럼 항목들 [{label, href, onClick}]
 * @param {React.ReactNode} [props.actions] - 액션 버튼들
 * @param {React.ReactNode} [props.status] - 상태 배지나 인디케이터
 * @param {Array} [props.meta] - 메타 정보 [{icon, label, value}]
 * @param {boolean} [props.compact=false] - 컴팩트 모드
 * @param {boolean} [props.divider=true] - 하단 구분선 표시
 * @param {string} [props.className] - 추가 CSS 클래스
 * @param {Object} [props.style] - 인라인 스타일
 * @returns {JSX.Element} PageHeader 컴포넌트
 */
function PageHeader({
  icon,
  title,
  subtitle,
  description,
  breadcrumb = [],
  actions,
  status,
  meta = [],
  compact = false,
  divider = true,
  className = '',
  style = {},
  ...props
}) {
  const styles = useStyles();

  // 스타일 조합
  const getHeaderClasses = () => {
    const classes = [styles.header];
    if (compact) classes.push(styles.compact);
    if (className) classes.push(className);
    return classes.join(' ');
  };

  // 브레드크럼 렌더링
  const renderBreadcrumb = () => {
    if (!breadcrumb.length) return null;

    return (
      <div className={styles.breadcrumbContainer}>
        <Breadcrumb>
          {breadcrumb.map((item, index) => (
            <React.Fragment key={index}>
              <BreadcrumbItem
                href={item.href}
                onClick={item.onClick}
              >
                {item.label}
              </BreadcrumbItem>
              {index < breadcrumb.length - 1 && <BreadcrumbDivider />}
            </React.Fragment>
          ))}
        </Breadcrumb>
      </div>
    );
  };

  // 제목 영역 렌더링
  const renderTitleSection = () => (
    <div className={styles.titleSection}>
      <div className={styles.titleContainer}>
        {icon && (
          <div className={styles.iconContainer}>
            {icon}
          </div>
        )}
        <Text as="h1" className={styles.title}>
          {title}
        </Text>
      </div>

      {subtitle && (
        <Text as="h2" className={styles.subtitle}>
          {subtitle}
        </Text>
      )}

      {status && (
        <div className={styles.statusContainer}>
          {status}
        </div>
      )}

      {description && (
        <Text className={styles.description}>
          {description}
        </Text>
      )}

      {meta.length > 0 && (
        <div className={styles.meta}>
          {meta.map((item, index) => (
            <div key={index} className={styles.metaItem}>
              {item.icon && item.icon}
              <span>{item.label}:</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className={getHeaderClasses()} style={style} {...props}>
      {renderBreadcrumb()}
      
      <div className={styles.main}>
        {renderTitleSection()}
        
        {actions && (
          <div className={styles.actions}>
            {actions}
          </div>
        )}
      </div>

      {divider && <div className={styles.divider} />}
    </header>
  );
}

// =========================== 특화된 헤더 컴포넌트들 ===========================

/**
 * 컴팩트 페이지 헤더
 */
export function CompactPageHeader(props) {
  return <PageHeader compact {...props} />;
}

/**
 * 구분선 없는 페이지 헤더
 */
export function NoDividerPageHeader(props) {
  return <PageHeader divider={false} {...props} />;
}

export default memo(PageHeader);