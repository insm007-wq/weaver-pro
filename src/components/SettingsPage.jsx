import { useState, Suspense, lazy, useRef, useLayoutEffect, useEffect } from "react";
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
import { useHeaderStyles } from "../styles/commonStyles";
import {
  SettingsRegular,
  KeyRegular,
  BrainCircuitRegular,
  SubtitlesRegular,
  ChevronLeftRegular,
  ShieldRegular,
  ArrowResetRegular,
  InfoRegular,
} from "@fluentui/react-icons";
import AdminPasswordDialog from "./settings/parts/AdminPasswordDialog";
import { showGlobalToast } from "./common";

// lazy tabs
const AdminTab = lazy(() => import("./settings/tabs/AdminTab"));
const DefaultsTab = lazy(() => import("./settings/tabs/DefaultsTab"));
const ApiTab = lazy(() => import("./settings/tabs/ApiTab"));
const PromptTab = lazy(() => import("./settings/tabs/PromptTab"));
const SubtitleTab = lazy(() => import("./settings/tabs/SubtitleTab"));

const useStyles = makeStyles({
  root: {
    maxWidth: "1200px",
    ...shorthands.margin("0", "auto"),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalL),
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

// 전체 탭 정의 (관리자 전용 탭 포함)
const allTabs = [
  { key: "admin", name: "관리자", icon: <ShieldRegular />, Comp: AdminTab, description: "시스템 관리 및 모니터링", adminOnly: true },
  { key: "api", name: "API 설정", icon: <KeyRegular />, Comp: ApiTab, description: "외부 서비스 API 키 및 설정", adminOnly: true },
  { key: "defaults", name: "기본값", icon: <SettingsRegular />, Comp: DefaultsTab, description: "애플리케이션 기본 설정", adminOnly: true },
  { key: "prompt", name: "프롬프트", icon: <BrainCircuitRegular />, Comp: PromptTab, description: "AI 프롬프트 템플릿 관리", adminOnly: false },
  { key: "subtitle", name: "자막", icon: <SubtitlesRegular />, Comp: SubtitleTab, description: "자막 및 텍스트 설정", adminOnly: false },
];

export default function SettingsPage({ onBack }) {
  const styles = useStyles();
  const headerStyles = useHeaderStyles();

  // 관리자 모드 상태
  const [isAdminMode, setIsAdminMode] = useState(() => {
    // sessionStorage에서 관리자 모드 복원
    return sessionStorage.getItem("adminMode") === "true";
  });
  const [clickCount, setClickCount] = useState(0);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showHeaderActions, setShowHeaderActions] = useState(false);
  const clickTimerRef = useRef(null);

  // 관리자 모드에 따라 탭 필터링
  const tabs = isAdminMode ? allTabs : allTabs.filter((t) => !t.adminOnly);

  const [selectedTab, setSelectedTab] = useState(tabs[0]?.key || "prompt");
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

  // 관리자 모드 변경 시 sessionStorage 저장
  useEffect(() => {
    sessionStorage.setItem("adminMode", isAdminMode.toString());
  }, [isAdminMode]);

  // 제목 클릭 핸들러 (12번 클릭 감지)
  const handleTitleClick = () => {
    // 모달이 이미 열려있으면 무시
    if (showPasswordDialog) return;

    const newCount = clickCount + 1;
    setClickCount(newCount);

    // 기존 타이머 제거
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    // 12번 클릭 도달 시 모달 오픈
    if (newCount >= 12) {
      setShowPasswordDialog(true);
      setClickCount(0);
      return;
    }

    // 3초 후 카운터 리셋
    clickTimerRef.current = setTimeout(() => {
      setClickCount(0);
    }, 3000);
  };

  // 인증 성공 핸들러
  const handleAdminSuccess = () => {
    setIsAdminMode(true);
    setSelectedTab("admin"); // 관리자 탭으로 자동 전환
  };

  // 더블클릭으로 관리자 모드 해제
  const handleTitleDoubleClick = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      setClickCount(0);
      setSelectedTab("prompt"); // 일반 사용자 첫 탭으로 돌아가기
    }
  };

  return (
    <div ref={containerRef} className={styles.root} style={fixedWidthPx ? { width: `${fixedWidthPx}px` } : undefined}>
      {onBack && (
        <Button appearance="subtle" icon={<ChevronLeftRegular />} onClick={onBack} className={styles.backButton} size="small">
          돌아가기
        </Button>
      )}

      {/* 페이지 헤더 */}
      <div className={headerStyles.pageHeader}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: tokens.spacingVerticalM
          }}
          onMouseEnter={() => setShowHeaderActions(true)}
          onMouseLeave={() => setShowHeaderActions(false)}
        >
          <div
            className={headerStyles.pageTitleWithIcon}
            onClick={handleTitleClick}
            onDoubleClick={handleTitleDoubleClick}
            style={{
              cursor: "pointer",
              userSelect: "none",
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: 8
            }}
          >
            <SettingsRegular />
            전역 설정
            {clickCount >= 10 && (
              <span
                style={{
                  fontSize: "12px",
                  color: tokens.colorBrandForeground1,
                  fontWeight: 600,
                  backgroundColor: tokens.colorBrandBackground2,
                  padding: "2px 8px",
                  borderRadius: "12px",
                  marginLeft: 8
                }}
              >
                {clickCount}/12
              </span>
            )}
          </div>

          {/* 헤더 액션 버튼 - hover 시 표시 */}
          {showHeaderActions && (
            <div style={{ display: "flex", gap: tokens.spacingHorizontalS }}>
              <Button
                size="small"
                appearance="subtle"
                icon={<ArrowResetRegular />}
                title="설정 초기화"
                onClick={() => {
                  if (window.confirm("모든 설정을 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                    window.api?.invoke("prompts:reset").then(() => {
                      showGlobalToast({
                        type: "success",
                        text: "설정이 초기화되었습니다."
                      });
                    }).catch(() => {
                      showGlobalToast({
                        type: "error",
                        text: "설정 초기화 중 오류가 발생했습니다."
                      });
                    });
                  }
                }}
              >
                초기화
              </Button>
              <Button
                size="small"
                appearance="subtle"
                icon={<InfoRegular />}
                title="설정 정보"
              >
                정보
              </Button>
            </div>
          )}
        </div>
        <div className={headerStyles.pageDescription}>애플리케이션 전반의 설정을 관리합니다.</div>
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

      {/* 관리자 인증 다이얼로그 */}
      <AdminPasswordDialog
        open={showPasswordDialog}
        onClose={() => setShowPasswordDialog(false)}
        onSuccess={handleAdminSuccess}
      />
    </div>
  );
}
