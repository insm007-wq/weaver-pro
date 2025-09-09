import { Body1, Caption1 } from "@fluentui/react-components";
import { TimerRegular } from "@fluentui/react-icons";
import { tokens } from "@fluentui/react-components";
import CircularProgress from "../ui/CircularProgress";

const ProgressDisplay = ({ 
  loading, 
  fxLoading, 
  progress, 
  remainingTime,
  loadingText = "처리 중...",
  fxLoadingText = "분석 중..."
}) => {
  if (!loading && !fxLoading) return null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: tokens.spacingVerticalM,
      padding: "32px",
      background: "linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)",
      borderRadius: "20px",
      marginTop: tokens.spacingVerticalM,
      backdropFilter: "blur(10px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
    }}>
      <CircularProgress 
        percentage={progress?.percentage || 0} 
        color={fxLoading ? "#10a37f" : "#0078d4"}
      />
      <div style={{ textAlign: "center" }}>
        <Body1 weight="semibold" style={{ marginBottom: tokens.spacingVerticalXS }}>
          {progress?.message || (fxLoading ? fxLoadingText : loadingText)}
        </Body1>
        {remainingTime !== null && remainingTime > 0 && (
          <Caption1 style={{ 
            color: tokens.colorNeutralForeground2,
            fontWeight: tokens.fontWeightMedium 
          }}>
            <TimerRegular style={{ marginRight: tokens.spacingHorizontalXXS }} />
            {fxLoading
              ? remainingTime > 1
                ? `분석 완료까지 약 ${Math.ceil(remainingTime)}초`
                : "분석 거의 완료..."
              : remainingTime > 1
              ? `완료까지 약 ${Math.ceil(remainingTime)}초`
              : "거의 완료..."}
          </Caption1>
        )}
      </div>
    </div>
  );
};

export default ProgressDisplay;