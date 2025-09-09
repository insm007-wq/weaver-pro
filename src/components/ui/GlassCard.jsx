import React from "react";
import { tokens } from "@fluentui/react-components";
import "../../styles/common.css";

const GlassCard = ({ 
  children, 
  title,
  icon,
  iconColor = "var(--gradient-brand)",
  className = "",
  style = {},
  hover = true,
  ...props 
}) => {
  const cardStyle = {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "24px",
    padding: "24px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 0 rgba(255, 255, 255, 0.5) inset",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    position: "relative",
    ...style
  };

  return (
    <div 
      className={className}
      style={cardStyle}
      onMouseEnter={(e) => {
        if (hover) {
          e.target.style.transform = "translateY(-4px) scale(1.02)";
          e.target.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.6) inset";
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          e.target.style.transform = "none";
          e.target.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 0 rgba(255, 255, 255, 0.5) inset";
        }
      }}
      {...props}
    >
      {/* Glass effect overlay */}
      <div style={{
        content: "",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)",
        borderRadius: "24px",
        pointerEvents: "none"
      }} />
      
      {/* Content */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {(title || icon) && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: title ? "20px" : "0"
          }}>
            {icon && (
              <div style={{
                background: iconColor,
                borderRadius: "8px",
                padding: "6px",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {icon}
              </div>
            )}
            {title && (
              <span style={{
                fontWeight: tokens.fontWeightSemibold,
                fontSize: tokens.fontSizeBase400,
                color: tokens.colorNeutralForeground1
              }}>
                {title}
              </span>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

export default GlassCard;