import { makeStyles, shorthands, tokens, Button } from "@fluentui/react-components";
import { SettingsRegular, DismissCircle28Regular } from "@fluentui/react-icons";
import { useFileManagement } from "../hooks/useFileManagement";

// ===== 스타일 옵션 (아래 중 하나 선택해서 사용) =====
const BUTTON_STYLE = "style1"; // "style1" | "style2" | "style3" | "style4" 선택

const useStyles = makeStyles({
  header: {
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "12px",
    ...shorthands.padding("0", tokens.spacingHorizontalXL),
    backgroundColor: tokens.colorNeutralBackground2,
  },

  // ===== Style 1: Subtle (설정 버튼과 동일) =====
  resetButton_style1: {
    minWidth: "140px",
    color: "#E81B23",
    fontWeight: tokens.fontWeightRegular,
    fontSize: tokens.fontSizeBase300,
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#C91220",
    },
    "&:active": {
      color: "#A00D1A",
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },

  // ===== Style 2: Subtle 진한 버전 =====
  resetButton_style2: {
    minWidth: "140px",
    color: "#D81118",
    fontWeight: tokens.fontWeightRegular,
    fontSize: tokens.fontSizeBase300,
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#B00D13",
    },
    "&:active": {
      color: "#900A0F",
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },

  // ===== Style 3: Subtle 더 진한 버전 =====
  resetButton_style3: {
    minWidth: "140px",
    color: "#CC0F16",
    fontWeight: tokens.fontWeightRegular,
    fontSize: tokens.fontSizeBase300,
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#B00A11",
    },
    "&:active": {
      color: "#94080D",
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },

  // ===== Style 4: Subtle 최고 진한 버전 =====
  resetButton_style4: {
    minWidth: "140px",
    color: "#B80914",
    fontWeight: tokens.fontWeightRegular,
    fontSize: tokens.fontSizeBase300,
    transition: "all 0.2s ease",
    "&:hover": {
      color: "#9A0710",
    },
    "&:active": {
      color: "#7C050C",
    },
    "&:disabled": {
      opacity: 0.6,
      cursor: "not-allowed",
    },
  },

  // 선택된 스타일을 적용할 resetButton
  resetButton: BUTTON_STYLE === "style1" ? {} : BUTTON_STYLE === "style2" ? {} : BUTTON_STYLE === "style3" ? {} : {},
});

// 스타일 맵 (동적으로 선택)
const getResetButtonStyle = (styleKey) => {
  const styleMap = {
    style1: "resetButton_style1",
    style2: "resetButton_style2",
    style3: "resetButton_style3",
    style4: "resetButton_style4",
  };
  return styleMap[styleKey] || "resetButton_style1";
};

export default function HeaderBar({ onOpenSettings }) {
  const styles = useStyles();
  const { handleReset } = useFileManagement();
  const resetButtonClassName = styles[getResetButtonStyle(BUTTON_STYLE)];

  return (
    <header className={styles.header}>
      <Button
        appearance="subtle"
        icon={<DismissCircle28Regular />}
        onClick={handleReset}
        aria-label="초기화"
        title="프로젝트 전체 초기화"
        className={resetButtonClassName}
        style={{ minWidth: "120px", fontSize: "14px" }}
      >
        초기화
      </Button>
      <Button appearance="subtle" icon={<SettingsRegular />} onClick={onOpenSettings} aria-label="설정" style={{ minWidth: "120px", fontSize: "14px" }}>
        설정
      </Button>
    </header>
  );
}
