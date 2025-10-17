import React, { useEffect, useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Body1,
  Body2,
  Caption1,
  Button,
  Badge,
  Spinner,
  mergeClasses,
} from "@fluentui/react-components";
import {
  InfoRegular,
  DeleteRegular,
} from "@fluentui/react-icons";
import { useContainerStyles } from "../../../styles/commonStyles";
import { showGlobalToast } from "../../common/GlobalToast";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalL),
  },

  section: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.06)",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
  },

  sectionTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    margin: 0,
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    ...shorthands.gap(tokens.spacingVerticalM, tokens.spacingHorizontalM),
  },

  infoCard: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
  },

  infoLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    marginBottom: tokens.spacingVerticalXS,
  },

  infoValue: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    wordBreak: "break-all",
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
  },

  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginTop: tokens.spacingVerticalM,
  },

  logList: {
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap(tokens.spacingVerticalM),
    maxHeight: "400px",
    overflowY: "auto",
  },

  logItem: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  logItemContent: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },

  logItemTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },

  logItemMeta: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
  },

  logItemStatus: {
    flexShrink: 0,
    marginLeft: tokens.spacingHorizontalM,
  },

  emptyLog: {
    textAlign: "center",
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
  },
});

export default function AdminTab() {
  const containerStyles = useContainerStyles();
  const s = useStyles();

  // 상태
  const [tokenUsage, setTokenUsage] = useState({
    estimatedTokens: 0,
    requestCount: 0,
    lastRequest: null,
  });

  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // 초기 로드
  useEffect(() => {
    loadAdminData();
    // 1초마다 로그 갱신
    const interval = setInterval(loadLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);

      // 토큰 사용 정보 조회 (로컬스토리지에서)
      const storedTokenUsage = localStorage.getItem("tokenUsage");
      if (storedTokenUsage) {
        setTokenUsage(JSON.parse(storedTokenUsage));
      }

      loadLogs();
    } catch (error) {
      console.error("관리 정보 로드 실패:", error);
      showGlobalToast({
        type: "error",
        text: "관리 정보를 불러오는 데 실패했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = () => {
    try {
      const storedLogs = localStorage.getItem("activityLogs");
      if (storedLogs) {
        const logs = JSON.parse(storedLogs);
        // 최신순으로 정렬 (최대 50개 표시)
        setActivityLogs(logs.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50));
      }
    } catch (error) {
      console.error("로그 로드 실패:", error);
    }
  };

  const clearLogs = () => {
    try {
      localStorage.setItem("activityLogs", JSON.stringify([]));
      setActivityLogs([]);
      showGlobalToast({
        type: "success",
        text: "작업 로그가 초기화되었습니다.",
      });
    } catch (error) {
      console.error("로그 초기화 실패:", error);
      showGlobalToast({
        type: "error",
        text: "로그 초기화에 실패했습니다.",
      });
    }
  };

  const openDashboard = (url, name) => {
    try {
      window.electron?.shell?.openPath?.(url) || window.open(url, "_blank");
      showGlobalToast({
        type: "success",
        text: `${name} 대시보드를 열었습니다.`,
      });
    } catch (error) {
      console.error("대시보드 열기 실패:", error);
      showGlobalToast({
        type: "error",
        text: "대시보드를 열 수 없습니다.",
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "success";
      case "error":
        return "error";
      case "pending":
        return "informative";
      default:
        return "informative";
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case "llm":
        return "📝";
      case "image":
        return "🎨";
      case "thumbnail":
        return "🖼️";
      case "tts":
        return "🔊";
      case "subtitle":
        return "📄";
      case "video":
        return "🎬";
      default:
        return "⚙️";
    }
  };

  if (loading) {
    return (
      <div className={containerStyles.container} style={{ textAlign: "center", padding: "40px" }}>
        <Spinner /> 관리 정보를 불러오는 중…
      </div>
    );
  }

  return (
    <div className={mergeClasses(containerStyles.container, s.container)}>
      {/* 토큰 사용 현황 섹션 */}
      <div className={s.section}>
        <div className={s.sectionHeader}>
          <InfoRegular style={{ fontSize: "20px", color: tokens.colorBrandForeground1 }} />
          <h2 className={s.sectionTitle}>📊 토큰 사용 현황</h2>
        </div>

        <div className={s.infoGrid}>
          <div className={s.infoCard}>
            <Body2 className={s.infoLabel}>예상 토큰 소비</Body2>
            <div className={s.infoValue}>
              <Badge appearance="filled" color="informative">
                {tokenUsage.estimatedTokens.toLocaleString()} tokens
              </Badge>
            </div>
          </div>

          <div className={s.infoCard}>
            <Body2 className={s.infoLabel}>API 호출 횟수</Body2>
            <div className={s.infoValue}>
              <Badge appearance="filled" color="success">
                {tokenUsage.requestCount.toLocaleString()} calls
              </Badge>
            </div>
          </div>

          <div className={s.infoCard}>
            <Body2 className={s.infoLabel}>마지막 요청</Body2>
            <div className={s.infoValue}>
              <span>
                {tokenUsage.lastRequest
                  ? new Date(tokenUsage.lastRequest).toLocaleString()
                  : "없음"}
              </span>
            </div>
          </div>
        </div>

        {/* API 대시보드 링크 */}
        <div className={s.actionRow} style={{ marginTop: tokens.spacingVerticalL }}>
          <Body2 style={{ color: tokens.colorNeutralForeground3, marginRight: tokens.spacingHorizontalL }}>
            실시간 사용량 확인:
          </Body2>
          <Button
            appearance="secondary"
            onClick={() => openDashboard("https://console.anthropic.com", "Anthropic")}
          >
            Anthropic 대시보드
          </Button>
          <Button
            appearance="secondary"
            onClick={() => openDashboard("https://replicate.com/account/billing", "Replicate")}
          >
            Replicate 크레딧
          </Button>
          <Button
            appearance="secondary"
            onClick={() => openDashboard("https://console.cloud.google.com/billing", "Google Cloud")}
          >
            Google Cloud 빌링
          </Button>
        </div>
      </div>

      {/* 작업 기록 섹션 */}
      <div className={s.section}>
        <div className={s.sectionHeader}>
          <InfoRegular style={{ fontSize: "20px", color: tokens.colorBrandForeground1 }} />
          <h2 className={s.sectionTitle}>📋 작업 기록</h2>
          <span style={{ marginLeft: "auto", color: tokens.colorNeutralForeground3, fontSize: tokens.fontSizeBase200 }}>
            최근 {activityLogs.length}개 항목
          </span>
        </div>

        {activityLogs.length > 0 ? (
          <>
            <div className={s.logList}>
              {activityLogs.map((log, index) => (
                <div key={index} className={s.logItem}>
                  <div className={s.logItemContent}>
                    <div className={s.logItemTitle}>
                      {getActivityIcon(log.type)} {log.title}
                    </div>
                    <div className={s.logItemMeta}>
                      {new Date(log.timestamp).toLocaleString()} • {log.detail}
                    </div>
                  </div>
                  <Badge
                    appearance="filled"
                    color={getStatusColor(log.status)}
                    className={s.logItemStatus}
                  >
                    {log.status === "success" ? "성공" : log.status === "error" ? "실패" : "진행중"}
                  </Badge>
                </div>
              ))}
            </div>
            <Button
              appearance="subtle"
              onClick={clearLogs}
              style={{ marginTop: tokens.spacingVerticalM, color: tokens.colorPaletteRedForeground1 }}
            >
              로그 초기화
            </Button>
          </>
        ) : (
          <div className={s.emptyLog}>
            <Body2>아직 작업 기록이 없습니다.</Body2>
            <Caption1 style={{ marginTop: tokens.spacingVerticalS }}>
              대본 생성, 이미지 생성, 음성 합성 등의 작업이 여기 기록됩니다.
            </Caption1>
          </div>
        )}
      </div>
    </div>
  );
}
