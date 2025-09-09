import React from "react";

const Card = ({ 
  children, 
  variant = "default",
  size = "medium",
  hover = true,
  className = "",
  style = {},
  ...props 
}) => {
  const variants = {
    default: {
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "24px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.06), 0 1px 0 rgba(255, 255, 255, 0.5) inset",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      position: "relative"
    },
    glass: {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "24px",
      boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    elevated: {
      backgroundColor: "#ffffff",
      border: "1px solid rgba(0, 0, 0, 0.08)",
      borderRadius: "16px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08)",
      transition: "all 0.3s ease",
    }
  };

  const sizes = {
    small: { padding: "16px" },
    medium: { padding: "24px" },
    large: { padding: "32px" },
  };

  const hoverEffects = {
    default: hover ? {
      ":hover": {
        transform: "translateY(-4px) scale(1.02)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1), 0 1px 0 rgba(255, 255, 255, 0.6) inset"
      }
    } : {},
    glass: hover ? {
      ":hover": {
        transform: "translateY(-2px)",
        backgroundColor: "rgba(255, 255, 255, 0.15)",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.15)"
      }
    } : {},
    elevated: hover ? {
      ":hover": {
        transform: "translateY(-2px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)"
      }
    } : {}
  };

  const cardStyle = {
    ...variants[variant],
    ...sizes[size],
    ...style
  };

  return (
    <div 
      className={className}
      style={cardStyle}
      onMouseEnter={(e) => {
        if (hover && hoverEffects[variant][":hover"]) {
          Object.assign(e.target.style, hoverEffects[variant][":hover"]);
        }
      }}
      onMouseLeave={(e) => {
        if (hover) {
          Object.assign(e.target.style, {
            transform: "none",
            ...variants[variant]
          });
        }
      }}
      {...props}
    >
      {variant === "default" && (
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
      )}
      <div style={{ position: "relative", zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default Card;