import { useEffect, useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Button,
  Badge,
  Spinner,
  Tooltip,
  Text,
  mergeClasses,
} from "@fluentui/react-components";
import {
  CheckmarkCircleRegular,
  DismissCircleRegular,
  ArrowClockwiseRegular,
  SettingsRegular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  header: {
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    ...shorthands.padding("0", tokens.spacingHorizontalXL),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  container: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalM),
  },
  statusItem: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    cursor: "default",
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      ...shorthands.borderColor(tokens.colorBrandStroke1),
    },
  },
  statusDot: {
    width: "8px",
    height: "8px",
    ...shorthands.borderRadius("50%"),
  },
  statusOnline: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
  },
  statusOffline: {
    backgroundColor: tokens.colorPaletteRedBackground3,
  },
  statusPending: {
    backgroundColor: tokens.colorPaletteYellowBackground3,
  },
  networkStatus: {
    display: "flex",
    alignItems: "center",
    ...shorthands.gap(tokens.spacingHorizontalS),
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
  },
  onlineIcon: {
    color: tokens.colorPaletteGreenForeground1,
  },
  offlineIcon: {
    color: tokens.colorPaletteRedForeground1,
  },
});

function StatusDot({ state }) {
  const styles = useStyles();
  const className = 
    state === "ok"
      ? styles.statusOnline
      : state === "fail"
      ? styles.statusOffline
      : styles.statusPending;
  
  return <span className={mergeClasses(styles.statusDot, className)} />;
}

export default function HeaderBar({ onOpenSettings }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const styles = useStyles();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await window.api.healthCheck();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();

    const h = () => refresh();
    window.addEventListener("health:refresh", h);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("health:refresh", h);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const StatusItem = ({ name, r }) => (
    <Tooltip
      content={r ? `${name}: ${r.state} (${String(r.detail)})` : `${name}: -`}
      relationship="label"
    >
      <div
        className={styles.statusItem}
        onDoubleClick={onOpenSettings}
      >
        <StatusDot state={r?.state} />
        <Text size={200} weight="medium">{name}</Text>
      </div>
    </Tooltip>
  );

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* Network Status */}
        <Tooltip
          content={isOnline ? "온라인" : "오프라인"}
          relationship="label"
        >
          <div className={styles.networkStatus}>
            {isOnline ? (
              <CheckmarkCircleRegular className={styles.onlineIcon} />
            ) : (
              <DismissCircleRegular className={styles.offlineIcon} />
            )}
            <Text size={200} weight="medium">
              {isOnline ? "Online" : "Offline"}
            </Text>
          </div>
        </Tooltip>

        {/* API Status */}
        <StatusItem name="Anthropic" r={data?.anthropic} />
        <StatusItem name="Replicate" r={data?.replicate} />

        {/* Buttons */}
        <Button
          appearance="primary"
          icon={loading ? <Spinner size="tiny" /> : <ArrowClockwiseRegular />}
          disabled={loading}
          onClick={refresh}
        >
          {loading ? "새로고침 중..." : "새로고침"}
        </Button>
        
        <Button
          appearance="secondary"
          icon={<SettingsRegular />}
          onClick={onOpenSettings}
        >
          설정
        </Button>
      </div>
    </header>
  );
}