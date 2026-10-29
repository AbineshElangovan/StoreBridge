/**
 * Global Application Branding Constants
 * 
 * Changing APP_NAME here (or setting NEXT_PUBLIC_APP_NAME in your environment)
 * automatically updates the store/app name everywhere throughout the entire application.
 */

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'StoreOrbit';

/**
 * 2-letter uppercase initials generated dynamically from APP_NAME:
 * - "StoreOrbit" -> "SO"
 * - "StoreBridge" -> "SB"
 * - "Shop Sync" -> "SS"
 */
export const APP_INITIALS = ((): string => {
  const capitals = APP_NAME.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return capitals.slice(0, 2).join('');
  }
  const words = APP_NAME.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return APP_NAME.slice(0, 2).toUpperCase();
})();

export const APP_TAGLINE = 'Multi-store sync';
export const APP_DESCRIPTION = 'Multi-store inventory synchronization';

