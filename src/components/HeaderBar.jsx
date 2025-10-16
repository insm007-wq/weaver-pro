import {
  makeStyles,
  shorthands,
  tokens,
  Button,
} from "@fluentui/react-components";
import {
  SettingsRegular,
} from "@fluentui/react-icons";

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

  return (
    <header className={styles.header}>
      <Button
        appearance="subtle"
        icon={<SettingsRegular />}
        onClick={onOpenSettings}
        aria-label="설정"
      />
    </header>
  );
}