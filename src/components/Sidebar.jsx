import { useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Button,
  Text,
  Title3,
  Caption1,
  Tooltip,
  mergeClasses,
} from "@fluentui/react-components";
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
    justifyContent: "space-between",
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke1),
    transition: "width 0.3s ease",
  },
  expanded: {
    width: "320px",
  },
  collapsed: {
    width: "80px",
  },
  toggleContainer: {
    display: "flex",
    justifyContent: "flex-end",
    ...shorthands.padding(tokens.spacingVerticalL),
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalL),
    ...shorthands.padding("0", tokens.spacingHorizontalXL),
    marginBottom: tokens.spacingVerticalXL,
  },
  logoBox: {
    width: "48px",
    height: "48px",
    minWidth: "48px",
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackground}, ${tokens.colorBrandBackground2})`,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: tokens.fontSizeBase600,
    boxShadow: tokens.shadow16,
  },
  logoText: {
    animation: "fadeIn 0.3s ease-out",
  },
  navigation: {
    ...shorthands.padding("0", tokens.spacingHorizontalM),
  },
  menuSection: {
    marginBottom: tokens.spacingVerticalM,
  },
  menuItem: {
    display: "flex",
    alignItems: "flex-start",
    width: "100%",
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: "transparent",
    ...shorthands.border("1px", "solid", "transparent"),
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: tokens.spacingVerticalXS,
    position: "relative",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.borderColor(tokens.colorBrandStroke1),
      transform: "translateX(2px)",
    },
    "&:active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
  },
  menuItemCollapsed: {
    justifyContent: "center",
    ...shorthands.padding(tokens.spacingVerticalM),
  },
  iconContainer: {
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s ease",
    marginRight: tokens.spacingHorizontalM,
  },
  iconContainerCollapsed: {
    marginRight: "0",
  },
  menuContent: {
    flex: 1,
    animation: "fadeIn 0.3s ease-out",
  },
  divider: {
    ...shorthands.margin(tokens.spacingVerticalM, tokens.spacingHorizontalXL),
    ...shorthands.padding(tokens.spacingVerticalS, "0"),
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  dividerLabel: {
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
  },
  footer: {
    ...shorthands.padding(tokens.spacingVerticalXL),
    ...shorthands.borderTop("1px", "solid", tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
    animation: "fadeIn 0.3s ease-out",
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
      key: "project",
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
      label: "영상 구성",
      desc: "AI 전략 설정 및 타임라인 생성",
      key: "assemble",
      color: tokens.colorPalettePurpleForeground1,
    },
    {
      icon: <RocketRegular />,
      label: "초안 내보내기",
      desc: "Draft 영상 렌더링",
      key: "draft",
      color: tokens.colorPaletteMagentaForeground1,
    },
    {
      icon: <VideoRegular />,
      label: "편집 및 다듬기",
      desc: "세부 편집 및 교체",
      key: "refine",
      color: tokens.colorPaletteRedForeground1,
    },
    {
      icon: <TrophyRegular />,
      label: "최종 완성",
      desc: "최종 영상 출력",
      key: "finalize",
      color: tokens.colorPaletteYellowForeground1,
    },
    {
      icon: <WrenchScrewdriverRegular />,
      label: "프로젝트 설정",
      desc: "프롬프트 및 모델 설정",
      key: "projectSettings",
      color: tokens.colorNeutralForeground2,
    },
  ];

  const handleMenuClick = (key) => {
    if (onSelectMenu) onSelectMenu(key);
  };

  const MenuItem = ({ item, collapsed }) => {
    const content = (
      <div
        className={mergeClasses(
          styles.menuItem,
          collapsed && styles.menuItemCollapsed
        )}
        onClick={() => handleMenuClick(item.key)}
      >
        <div
          className={mergeClasses(
            styles.iconContainer,
            collapsed && styles.iconContainerCollapsed
          )}
          style={{ color: item.color }}
        >
          {item.icon}
        </div>
        {!collapsed && (
          <div className={styles.menuContent}>
            <Text weight="semibold" block>
              {item.label}
            </Text>
            <Caption1 block color="subtle">
              {item.desc}
            </Caption1>
          </div>
        )}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip content={item.label} relationship="label" positioning="after">
          {content}
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside
      className={mergeClasses(
        styles.sidebar,
        isCollapsed ? styles.collapsed : styles.expanded
      )}
    >
      <div>
        {/* Toggle Button */}
        <div className={styles.toggleContainer}>
          <Button
            appearance="subtle"
            icon={isCollapsed ? <ChevronRightRegular /> : <ChevronLeftRegular />}
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="small"
          />
        </div>

        {/* Logo */}
        <div className={styles.logoContainer}>
          <div className={styles.logoBox}>🎥</div>
          {!isCollapsed && (
            <div className={styles.logoText}>
              <Title3 block>Content Weaver Pro</Title3>
              <Caption1 block color="subtle">
                AI 영상 제작 솔루션
              </Caption1>
            </div>
          )}
        </div>

        {/* Global Menu */}
        <nav className={styles.navigation}>
          <div className={styles.menuSection}>
            {globalMenu.map((item) => (
              <MenuItem key={item.key} item={item} collapsed={isCollapsed} />
            ))}
          </div>
        </nav>

        {/* Divider */}
        {!isCollapsed && (
          <div className={styles.divider}>
            <Caption1 className={styles.dividerLabel} weight="semibold">
              프로젝트 작업 영역
            </Caption1>
          </div>
        )}

        {/* Project Menu */}
        <nav className={styles.navigation}>
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
          <Text size={100} weight="medium" block>
            Version 1.0.0
          </Text>
          <Caption1 block color="subtle">
            © 2025 Content Weaver
          </Caption1>
        </div>
      )}
    </aside>
  );
}