import { useState, Suspense, lazy, useRef, useLayoutEffect } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Card,
  Body1,
  Title1,
  Title2,
  Subtitle1,
  Button,
  Tab,
  TabList,
  Spinner,
  Divider,
} from "@fluentui/react-components";
import {
  SettingsRegular,
  KeyRegular,
  BrainCircuitRegular,
  ImageRegular,
  SubtitlesRegular,
  PaintBrushRegular,
  ChevronLeftRegular,
} from "@fluentui/react-icons";

// lazy tabs
const DefaultsTab = lazy(() => import("./settings/tabs/DefaultsTab"));
const ApiTab = lazy(() => import("./settings/tabs/ApiTab"));
const PromptTab = lazy(() => import("./settings/tabs/PromptTab"));
const ThumbnailTab = lazy(() => import("./settings/tabs/ThumbnailTab"));
const SubtitleTab = lazy(() => import("./settings/tabs/SubtitleTab"));
const AppearanceTab = lazy(() => import("./settings/tabs/AppearanceTab"));

const useStyles = makeStyles({
  root: {
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    ...shorthands.padding(tokens.spacingVerticalXL, tokens.spacingHorizontalL),
  },

  pageHeader: {
    ...shorthands.margin(0, 0, tokens.spacingVerticalL),
  },
  pageTitle: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalM,
  },
  pageDesc: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
    fontSize: tokens.fontSizeBase300,
  },
  hairline: {
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    marginTop: tokens.spacingVerticalM,
  },

  mainCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    minHeight: "640px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  tabListWrap: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
  },

  tabContent: {
    flex: 1,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  sectionLead: {
    marginBottom: tokens.spacingVerticalM,
  },
  scroll: {
    flex: 1,
    overflowY: "auto",
    minWidth: 0,
  },

  backButton: {
    position: "absolute",
    top: tokens.spacingVerticalL,
    left: tokens.spacingHorizontalL,
    zIndex: 10,
  },
});

const tabs = [
  { key: "api", name: "API 설정", icon: <KeyRegular />, Comp: ApiTab, description: "외부 서비스 API 키 및 설정" },
  { key: "defaults", name: "기본값", icon: <SettingsRegular />, Comp: DefaultsTab, description: "애플리케이션 기본 설정" },
  { key: "prompt", name: "프롬프트", icon: <BrainCircuitRegular />, Comp: PromptTab, description: "AI 프롬프트 템플릿 관리" },
  { key: "thumbnail", name: "썸네일", icon: <ImageRegular />, Comp: ThumbnailTab, description: "썸네일 생성 설정" },
  { key: "subtitle", name: "자막", icon: <SubtitlesRegular />, Comp: SubtitleTab, description: "자막 및 텍스트 설정" },
  { key: "appearance", name: "외관", icon: <PaintBrushRegular />, Comp: AppearanceTab, description: "테마 및 UI 설정" },
];

export default function SettingsPage({ onBack }) {
  const styles = useStyles();
  const [selectedTab, setSelectedTab] = useState("api");
  const active = tabs.find((t) => t.key === selectedTab) ?? tabs[0];

  // 폭 고정 계산(스크롤바 점프 방지)
  const containerRef = useRef(null);
  const [fixedWidthPx, setFixedWidthPx] = useState(null);
  useLayoutEffect(() => {
    if (!fixedWidthPx && containerRef.current) {
      const w = Math.round(containerRef.current.getBoundingClientRect().width);
      if (w > 0) setFixedWidthPx(w);
    }
  }, [fixedWidthPx]);

  return (
    <div ref={containerRef} className={styles.root} style={fixedWidthPx ? { width: `${fixedWidthPx}px` } : undefined}>
      {onBack && (
        <Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={onBack} className={styles.backButton} size="small">
          돌아가기
        </Button>
      )}

      {/* 페이지 헤더 */}
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}>
          <SettingsRegular />
          <Title1>전역 설정</Title1>
        </div>
        <Body1 className={styles.pageDesc}>애플리케이션 전반의 설정을 관리합니다.</Body1>
        <div className={styles.hairline} />
      </div>

      {/* 본문 카드 */}
      <Card className={styles.mainCard}>
        <div className={styles.tabListWrap}>
          <TabList selectedValue={selectedTab} onTabSelect={(_, d) => setSelectedTab(d.value)} size="medium">
            {tabs.map((t) => (
              <Tab key={t.key} value={t.key} icon={t.icon}>
                {t.name}
              </Tab>
            ))}
          </TabList>
        </div>

        <div className={styles.tabContent}>
          <div className={styles.sectionLead}>
            <Title2 style={{ fontSize: tokens.fontSizeBase500, marginBottom: tokens.spacingVerticalXXS }}>{active.name}</Title2>
            <Body1 style={{ color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase300 }}>{active.description}</Body1>
          </div>
          <Divider style={{ marginBottom: tokens.spacingVerticalL }} />

          <div className={styles.scroll}>
            <Suspense
              fallback={
                <div style={{ padding: 40 }}>
                  <Spinner /> 불러오는 중…
                </div>
              }
            >
              <active.Comp />
            </Suspense>
          </div>
        </div>
      </Card>
    </div>
  );
}
