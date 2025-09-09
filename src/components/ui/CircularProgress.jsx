import { tokens } from "@fluentui/react-components";

const CircularProgress = ({ percentage, size = 80, strokeWidth = 6, color = "#0078d4" }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div style={{ 
      position: "relative", 
      width: size, 
      height: size 
    }}>
      <svg style={{
        transform: "rotate(-90deg)",
        width: "100%",
        height: "100%",
      }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e5e5"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dasharray 0.3s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontSize: tokens.fontSizeBase400,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorBrandForeground1,
      }}>
        {Math.round(percentage)}%
      </div>
    </div>
  );
};

export default CircularProgress;