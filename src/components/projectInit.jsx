import { useState } from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Card,
  CardHeader,
  CardFooter,
  Title1,
  Title2,
  Title2,
  Body1,
  Input,
  Button,
  Text,
  Divider,
} from "@fluentui/react-components";
import {
  VideoRegular,
  AddRegular,
  DocumentRegular,
  SparkleRegular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "70vh",
    ...shorthands.padding(tokens.spacingVerticalXXL),
  },
  card: {
    maxWidth: "500px",
    width: "100%",
    textAlign: "center",
    ...shorthands.padding(tokens.spacingVerticalXXL, tokens.spacingHorizontalXXL),
    boxShadow: tokens.shadow28,
    animation: "fadeIn 0.4s ease-out",
  },
  header: {
    marginBottom: tokens.spacingVerticalXXL,
  },
  logoContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: tokens.spacingVerticalL,
  },
  logoBox: {
    width: "80px",
    height: "80px",
    backgroundImage: `linear-gradient(135deg, ${tokens.colorBrandBackground}, ${tokens.colorBrandBackground2})`,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: "36px",
    boxShadow: tokens.shadow16,
    marginBottom: tokens.spacingVerticalL,
  },
  title: {
    marginBottom: tokens.spacingVerticalM,
    background: `linear-gradient(135deg, ${tokens.colorBrandForeground1}, ${tokens.colorBrandForeground2})`,
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalXL,
  },
  form: {
    marginBottom: tokens.spacingVerticalXL,
  },
  inputField: {
    width: "100%",
    marginBottom: tokens.spacingVerticalL,
  },
  createButton: {
    width: "100%",
    minHeight: "44px",
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
  },
  featuresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    ...shorthands.gap(tokens.spacingHorizontalM),
    marginTop: tokens.spacingVerticalL,
  },
  featureItem: {
    textAlign: "center",
    ...shorthands.padding(tokens.spacingVerticalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground2,
    transition: "all 0.2s ease",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      transform: "translateY(-2px)",
    },
  },
  featureIcon: {
    fontSize: "24px",
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorBrandForeground1,
  },
  featureText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

export default function ProjectInit({ onCreate }) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const styles = useStyles();

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setIsCreating(true);
    try {
      await onCreate(name.trim());
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && name.trim()) {
      handleCreate();
    }
  };

  return (
    <div className={styles.container}>
      <Card className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <div className={styles.logoBox}>
              <VideoRegular />
            </div>
          </div>
          <div style={{ 
            fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif",
            fontWeight: 600,
            fontSize: "24px",
            lineHeight: "1.2",
            letterSpacing: "-0.01em",
            textRendering: "optimizeLegibility",
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          }}>새 프로젝트 시작</div>
          <Body1 className={styles.subtitle}>
            AI 기반 영상 제작 여정을 시작해보세요
          </Body1>
        </div>

        <div className={styles.form}>
          <Input
            className={styles.inputField}
            size="large"
            placeholder="프로젝트 이름을 입력하세요 (예: 여행 Vlog, 제품 소개영상)"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyPress={handleKeyPress}
            contentBefore={<DocumentRegular />}
          />

          <Button
            className={styles.createButton}
            appearance="primary"
            size="large"
            icon={isCreating ? undefined : <AddRegular />}
            disabled={!name.trim() || isCreating}
            onClick={handleCreate}
          >
            {isCreating ? "프로젝트 생성 중..." : "프로젝트 생성"}
          </Button>
        </div>

        <Divider />

        <div style={{ marginTop: tokens.spacingVerticalL }}>
          <Text size={300} weight="semibold" style={{ color: tokens.colorNeutralForeground2 }}>
            포함된 기능
          </Text>
          
          <div className={styles.featuresGrid}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>🎯</div>
              <Text className={styles.featureText}>AI 대본 생성</Text>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>🎨</div>
              <Text className={styles.featureText}>스마트 편집</Text>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>🔊</div>
              <Text className={styles.featureText}>음성 합성</Text>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}>✨</div>
              <Text className={styles.featureText}>자동 최적화</Text>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
