import React, { useEffect, useState } from 'react';
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
  createLightTheme,
  createDarkTheme,
} from '@fluentui/react-components';
import { applyPlatformClasses, watchThemeChanges, getPlatform } from '../../utils/platform';

// Custom brand colors for the app
const brandRamp = {
  10: "#020305",
  20: "#111723",
  30: "#16263D",
  40: "#193253",
  50: "#1B3F6A",
  60: "#1C4C82",
  70: "#1C5A9A",
  80: "#1A68B3",
  90: "#1776CD",
  100: "#1285E7",
  110: "#2B94F3",
  120: "#47A3F5",
  130: "#62B2F7",
  140: "#7CC1F9",
  150: "#96D0FB",
  160: "#B0DFFD"
};

// Create custom themes
const lightTheme = createLightTheme(brandRamp);
const darkTheme = createDarkTheme(brandRamp);

// Platform-specific theme adjustments
const getEnhancedTheme = (baseTheme, platform, isDark) => {
  const enhanced = { ...baseTheme };
  
  if (platform === 'windows') {
    // Windows Fluent Design adjustments
    enhanced.colorNeutralBackground1 = isDark ? '#202020' : '#F3F2F1';
    enhanced.colorNeutralBackground2 = isDark ? '#2A2A2A' : '#FAF9F8';
    enhanced.borderRadiusNone = '0px';
    enhanced.borderRadiusSmall = '2px';
    enhanced.borderRadiusMedium = '4px';
    enhanced.borderRadiusLarge = '8px';
  } else if (platform === 'macos') {
    // macOS Human Interface adjustments
    enhanced.colorNeutralBackground1 = isDark ? '#1E1E1E' : '#FFFFFF';
    enhanced.colorNeutralBackground2 = isDark ? '#2D2D2D' : '#F5F5F7';
    enhanced.borderRadiusNone = '0px';
    enhanced.borderRadiusSmall = '4px';
    enhanced.borderRadiusMedium = '6px';
    enhanced.borderRadiusLarge = '12px';
  }
  
  return enhanced;
};

export default function FluentThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const [platform] = useState(getPlatform());
  
  useEffect(() => {
    // Apply platform classes on mount
    applyPlatformClasses();
    
    // Watch for theme changes
    const cleanup = watchThemeChanges((theme) => {
      setIsDark(theme === 'dark');
    });
    
    return cleanup;
  }, []);
  
  // Select and enhance theme based on platform and preference
  const baseTheme = isDark ? darkTheme : lightTheme;
  const theme = getEnhancedTheme(baseTheme, platform, isDark);
  
  return (
    <FluentProvider 
      theme={theme}
      style={{ 
        height: '100%',
        minHeight: '100vh'
      }}
    >
      <div className={`app-window ${platform === 'windows' ? 'windows-blur' : ''}`}>
        {children}
      </div>
    </FluentProvider>
  );
}

// Hook to use theme context
export function useFluentTheme() {
  const [isDark, setIsDark] = useState(() => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const platform = getPlatform();
  
  useEffect(() => {
    const cleanup = watchThemeChanges((theme) => {
      setIsDark(theme === 'dark');
    });
    
    return cleanup;
  }, []);
  
  return {
    isDark,
    platform,
    isWindows: platform === 'windows',
    isMacOS: platform === 'macos',
    isLinux: platform === 'linux'
  };
}