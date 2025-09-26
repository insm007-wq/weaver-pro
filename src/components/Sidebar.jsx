import { useState } from "react";
import { makeStyles, shorthands, tokens, Button, Text, Title3, Caption1, Tooltip, mergeClasses } from "@fluentui/react-components";
import {
  FolderOpenRegular,
  ImageRegular,
  SettingsRegular,
  DocumentTextRegular,
  WandRegular,
  RocketRegular,
  VideoRegular,
  TrophyRegular,
  WrenchScrewdriverRegular,
  ChevronLeftRegular,
  ChevronRightRegular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  sidebar: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke1),
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    boxShadow: "4px 0 12px rgba(0, 0, 0, 0.05)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  expanded: {
    width: "280px",
  },
  collapsed: {
    width: "72px",
  },
  toggleContainer: {
    display: "flex",
    justifyContent: "flex-end",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
  },
  
  headerSection: {
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    background: `linear-gradient(135deg, ${tokens.colorBrandBackground} 0%, ${tokens.colorBrandBackground2} 100%)`,
    color: tokens.colorNeutralForegroundOnBrand,
    position: "relative",
    "&::before": {
      content: "''",
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
    },
  },
  
  logoContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    position: "relative",
    zIndex: 1,
  },
  
  logoBox: {
    width: "44px",
    height: "44px",
    minWidth: "44px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    ...shorthands.border("1px", "solid", "rgba(255, 255, 255, 0.3)"),
  },
  logoText: {
    animation: "fadeIn 0.3s ease-out",
    color: "inherit",
  },
  
  mainContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    ...shorthands.padding(tokens.spacingVerticalL, "0"),
  },
  
  navigation: {
    ...shorthands.padding("0", tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalL,
  },
  
  sectionTitle: {
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  
  menuSection: {
    marginBottom: tokens.spacingVerticalXL,
  },
  
  menuItem: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.margin("0", tokens.spacingHorizontalXS),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: "transparent",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    "&::before": {
      content: "''",
      position: "absolute",
      left: "0",
      top: "50%",
      transform: "translateY(-50%)",
      width: "3px",
      height: "0",
      backgroundColor: tokens.colorBrandBackground,
      ...shorthands.borderRadius("0", "2px", "2px", "0"),
      transition: "height 0.3s ease",
    },
    "&:hover": {
      backgroundColor: "rgba(0, 120, 212, 0.05)",
      transform: "translateX(4px)",
      "&::before": {
        height: "24px",
      },
    },
    "&:active": {
      transform: "translateX(2px)",
      backgroundColor: "rgba(0, 120, 212, 0.1)",
    },
  },
  menuItemCollapsed: {
    justifyContent: "center",
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalS),
    ...shorthands.margin("0", tokens.spacingHorizontalXXS),
  },
  
  iconContainer: {
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    marginRight: tokens.spacingHorizontalM,
    fontSize: "18px",
  },
  
  iconContainerCollapsed: {
    marginRight: "0",
    fontSize: "20px",
  },
  
  menuContent: {
    flex: 1,
    animation: "fadeIn 0.3s ease-out",
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXXS),
  },
  
  menuLabel: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightMedium,
    color: tokens.colorNeutralForeground1,
  },
  
  menuDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  footer: {
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground2,
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.1)",
  },
  
  footerContent: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalXS),
  },
});

export default function Sidebar({ onSelectMenu }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const styles = useStyles();

  const globalMenu = [
    {
      icon: <FolderOpenRegular />,
      label: "프로젝트 관리",
      desc: "새 프로젝트 생성 및 관리",
      key: "projects",
      color: tokens.colorPaletteBlueForeground1,
    },
    {
      icon: <ImageRegular />,
      label: "AI 썸네일 생성기",
      desc: "독립형 썸네일 제작 유틸리티",
      key: "thumbnail",
      color: tokens.colorPaletteGreenForeground1,
    },
    {
      icon: <SettingsRegular />,
      label: "전역 설정",
      desc: "API 및 계정 설정",
      key: "settings",
      color: tokens.colorPaletteMarigoldForeground1,
    },
  ];

  const projectMenu = [
    {
      icon: <DocumentTextRegular />,
      label: "대본",
      desc: "대본 및 음성 생성",
      key: "script",
      color: tokens.colorPaletteBlueForeground1,
    },
    {
      icon: <WandRegular />,
      label: "미디어 준비",
      desc: "자막과 오디오 업로드, AI 키워드 추출",
      key: "assemble",
      color: tokens.colorPalettePurpleForeground1,
    },
    {
      icon: <RocketRegular />,
      label: "미디어 다운로드",
      desc: "Draft 영상 렌더링",
      key: "draft",
      color: tokens.colorPaletteMagentaForeground1,
    },
    // {
    //   icon: <VideoRegular />,
    //   label: "편집 및 다듬기",
    //   desc: "세부 편집 및 교체",
    //   key: "refine",
    //   color: tokens.colorPaletteRedForeground1,
    // },
    {
      icon: <TrophyRegular />,
      label: "최종 완성",
      desc: "최종 영상 출력",
      key: "finalize",
      color: tokens.colorPaletteYellowForeground1,
    },
    // {
    //   icon: <WrenchScrewdriverRegular />,
    //   label: "프로젝트 설정",
    //   desc: "프롬프트 및 모델 설정",
    //   key: "projectSettings",
    //   color: tokens.colorNeutralForeground2,
    // },
  ];

  const handleMenuClick = (key) => {
    if (onSelectMenu) onSelectMenu(key);
  };

  const MenuItem = ({ item, collapsed }) => {
    const content = (
      <div 
        className={mergeClasses(styles.menuItem, collapsed && styles.menuItemCollapsed)} 
        onClick={() => handleMenuClick(item.key)}
      >
        <div 
          className={mergeClasses(styles.iconContainer, collapsed && styles.iconContainerCollapsed)} 
          style={{ color: item.color }}
        >
          {item.icon}
        </div>
        {!collapsed && (
          <div className={styles.menuContent}>
            <div className={styles.menuLabel}>
              {item.label}
            </div>
            <div className={styles.menuDescription}>
              {item.desc}
            </div>
          </div>
        )}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip content={`${item.label} - ${item.desc}`} relationship="label" positioning="after">
          {content}
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside className={mergeClasses(styles.sidebar, isCollapsed ? styles.collapsed : styles.expanded)}>
      {/* Toggle Button */}
      <div className={styles.toggleContainer}>
        <Button
          appearance="subtle"
          icon={isCollapsed ? <ChevronRightRegular /> : <ChevronLeftRegular />}
          onClick={() => setIsCollapsed(!isCollapsed)}
          size="small"
        />
      </div>

      {/* Header Section */}
      <div className={styles.headerSection}>
        <div className={styles.logoContainer}>
          <div className={styles.logoBox}>🎬</div>
          {!isCollapsed && (
            <div className={styles.logoText}>
              <Title3 block>Weaver Pro</Title3>
              <Caption1 block>
                AI 영상 제작 솔루션
              </Caption1>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        {/* Global Menu */}
        <nav className={styles.navigation}>
          {!isCollapsed && (
            <div className={styles.sectionTitle}>전역 메뉴</div>
          )}
          <div className={styles.menuSection}>
            {globalMenu.map((item) => (
              <MenuItem key={item.key} item={item} collapsed={isCollapsed} />
            ))}
          </div>
        </nav>

        {/* Project Menu */}
        <nav className={styles.navigation}>
          {!isCollapsed && (
            <div className={styles.sectionTitle}>프로젝트 워크플로우</div>
          )}
          <div className={styles.menuSection}>
            {projectMenu.map((item) => (
              <MenuItem key={item.key} item={item} collapsed={isCollapsed} />
            ))}
          </div>
        </nav>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className={styles.footer}>
          <div className={styles.footerContent}>
            <Text size={200} weight="medium">
              Version 1.0.0
            </Text>
            <Caption1 color="subtle">
              © 2025 Weaver Pro
            </Caption1>
          </div>
        </div>
      )}
    </aside>
  );
}
