// Platform detection utilities for cross-platform native styling

/**
 * Get the current platform
 * @returns {'windows' | 'macos' | 'linux'}
 */
export function getPlatform() {
  if (typeof window !== 'undefined' && window.electron) {
    // In Electron environment
    return window.electron.platform || 'windows';
  }
  
  // Fallback for development/web
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('mac')) return 'macos';
  if (userAgent.includes('linux')) return 'linux';
  return 'windows';
}

/**
 * Check if current platform is Windows
 */
export function isWindows() {
  return getPlatform() === 'windows';
}

/**
 * Check if current platform is macOS
 */
export function isMacOS() {
  return getPlatform() === 'macos';
}

/**
 * Check if current platform is Linux
 */
export function isLinux() {
  return getPlatform() === 'linux';
}

/**
 * Get OS-specific class name for styling
 */
export function getPlatformClass() {
  return `os-${getPlatform()}`;
}

/**
 * Check if system prefers dark theme
 */
export function prefersDarkTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Get system accent color (if available)
 */
export function getSystemAccentColor() {
  if (typeof window !== 'undefined' && window.electron?.getSystemAccentColor) {
    return window.electron.getSystemAccentColor();
  }
  return null;
}

/**
 * Apply platform-specific classes to document
 */
export function applyPlatformClasses() {
  const platformClass = getPlatformClass();
  const darkClass = prefersDarkTheme() ? 'dark' : 'light';
  
  document.documentElement.className = `${platformClass} ${darkClass}`;
  document.body.className = `${platformClass} ${darkClass}`;
  
  return { platform: getPlatform(), theme: darkClass };
}

/**
 * Listen for theme changes
 */
export function watchThemeChanges(callback) {
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      const theme = e.matches ? 'dark' : 'light';
      applyPlatformClasses();
      callback?.(theme);
    };
    
    mediaQuery.addEventListener('change', handler);
    
    // Return cleanup function
    return () => mediaQuery.removeEventListener('change', handler);
  }
  
  return () => {}; // No-op cleanup
}