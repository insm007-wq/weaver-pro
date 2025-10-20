import {
  makeStyles,
  shorthands,
  tokens,
  Button,
} from "@fluentui/react-components";
import {
  SettingsRegular,
  DismissCircle24Regular,
} from "@fluentui/react-icons";
import { useFileManagement } from "../hooks/useFileManagement";

const useStyles = makeStyles({
  header: {
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    ...shorthands.padding("0", tokens.spacingHorizontalXL),
    backgroundColor: tokens.colorNeutralBackground2,
  },
});

export default function HeaderBar({ onOpenSettings }) {
  const styles = useStyles();
  const { handleReset } = useFileManagement();

  return (
    <header className={styles.header}>
      <Button
        appearance="subtle"
        icon={<DismissCircle24Regular />}
        onClick={handleReset}
        aria-label="초기화"
        title="프로젝트 전체 초기화"
        style={{ minWidth: "150px" }}
      >
        초기화
      </Button>
      <Button
        appearance="subtle"
        icon={<SettingsRegular />}
        onClick={onOpenSettings}
        aria-label="설정"
        style={{ minWidth: "120px" }}
      >
        설정
      </Button>
    </header>
  );
}