import React from "react";
import {
  makeStyles,
  shorthands,
  tokens,
  Card,
  Title3,
  Body1,
  Button,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";
import {
  ErrorCircleRegular,
  ArrowResetRegular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    ...shorthands.padding(tokens.spacingVerticalXXL),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    minHeight: "400px",
    justifyContent: "center",
  },

  errorCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    ...shorthands.padding(tokens.spacingVerticalXXL),
    maxWidth: "600px",
    width: "100%",
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
  },

  errorIcon: {
    fontSize: "48px",
    color: tokens.colorPaletteRedForeground1,
    marginBottom: tokens.spacingVerticalL,
  },

  errorTitle: {
    color: tokens.colorPaletteRedForeground1,
    marginBottom: tokens.spacingVerticalM,
  },

  errorMessage: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalL,
    lineHeight: "1.5",
  },

  actions: {
    display: "flex",
    ...shorthands.gap(tokens.spacingHorizontalM),
    justifyContent: "center",
    marginTop: tokens.spacingVerticalL,
  },

  details: {
    marginTop: tokens.spacingVerticalL,
    textAlign: "left",
  },

  errorDetails: {
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalM),
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    maxHeight: "200px",
    overflowY: "auto",
  },
});

function ErrorFallback({ error, resetErrorBoundary }) {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Card className={styles.errorCard}>
        <ErrorCircleRegular className={styles.errorIcon} />
        <Title3 className={styles.errorTitle}>
          오류가 발생했습니다
        </Title3>
        <Body1 className={styles.errorMessage}>
          예상치 못한 오류가 발생했습니다. 페이지를 새로고침하거나 다시 시도해보세요.
        </Body1>
        
        <MessageBar intent="error">
          <MessageBarBody>
            {error?.message || "알 수 없는 오류가 발생했습니다."}
          </MessageBarBody>
        </MessageBar>

        <div className={styles.actions}>
          <Button
            appearance="primary"
            icon={<ArrowResetRegular />}
            onClick={resetErrorBoundary}
          >
            다시 시도
          </Button>
          <Button
            appearance="secondary"
            onClick={() => window.location.reload()}
          >
            페이지 새로고침
          </Button>
        </div>

        {error?.stack && (
          <div className={styles.details}>
            <Body1 style={{ marginBottom: tokens.spacingVerticalS, fontWeight: tokens.fontWeightSemibold }}>
              오류 상세 정보:
            </Body1>
            <div className={styles.errorDetails}>
              {error.stack}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error} 
          resetErrorBoundary={() => this.setState({ hasError: false, error: null })}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;