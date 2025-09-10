/**
 * SettingsHeader - 설정 페이지 헤더 컴포넌트
 * 
 * @description
 * 설정 탭에 최적화된 헤더 컴포넌트입니다.
 * 파란색 아이콘과 제목, 설명으로 구성된 깔끔한 헤더를 제공합니다.
 * 
 * @features
 * - 🎯 아이콘 + 제목 + 설명 구성
 * - 🎨 브랜드 컬러 아이콘 배경
 * - 📱 반응형 디자인
 * - ⚡ 최적화된 설정 페이지 스타일
 * 
 * @author Weaver Pro Team
 * @version 1.0.0
 */

import React, { memo } from 'react';
import {
  makeStyles,
  tokens,
  Text,
  Caption1
} from '@fluentui/react-components';

const useStyles = makeStyles({
  // 헤더 컨테이너
  header: {
    textAlign: 'center',
    marginBottom: tokens.spacingVerticalL,
    padding: `0 ${tokens.spacingHorizontalM}`,
  },

  // 제목 스타일 (아이콘 + 텍스트)
  headerTitle: {
    background: `linear-gradient(135deg, ${tokens.colorBrandForeground1} 0%, ${tokens.colorPaletteBlueForeground2} 100%)`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: tokens.spacingVerticalS,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: '1.4',
    wordBreak: 'keep-all',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
  },

  // 설명 스타일
  headerDescription: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase300,
    maxWidth: '600px',
    margin: '0 auto',
    lineHeight: '1.5',
  }
});

/**
 * SettingsHeader 컴포넌트
 * 
 * @param {Object} props - 컴포넌트 속성
 * @param {string|React.ReactNode} props.icon - 헤더 아이콘 (이모지 또는 컴포넌트)
 * @param {string} props.title - 페이지 제목
 * @param {string|React.ReactNode} props.description - 페이지 설명
 * @param {string} [props.className] - 추가 CSS 클래스
 * @param {Object} [props.style] - 인라인 스타일
 * @returns {JSX.Element} SettingsHeader 컴포넌트
 */
function SettingsHeader({
  icon,
  title,
  description,
  className = '',
  style = {},
  ...props
}) {
  const styles = useStyles();

  // 스타일 조합
  const getHeaderClasses = () => {
    const classes = [styles.header];
    if (className) classes.push(className);
    return classes.join(' ');
  };

  return (
    <div className={getHeaderClasses()} style={style} {...props}>
      <div className={styles.headerTitle}>
        {icon} {title}
      </div>
      {description && (
        <Caption1 className={styles.headerDescription}>
          {description}
        </Caption1>
      )}
    </div>
  );
}

export default memo(SettingsHeader);