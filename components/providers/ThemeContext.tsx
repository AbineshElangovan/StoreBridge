'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type WallpaperTheme =
  | 'sky_azure'
  | 'emerald_forest'
  | 'crimson_ruby'
  | 'lavender'
  | 'sand';

// Backward compatibility alias
export type InventoryThemeId = WallpaperTheme;

export interface WallpaperOption {
  id: WallpaperTheme;
  name: string;
  description: string;
  previewGradient: string;
  primaryBtn: string;
  secondaryBtn: string;
  accentText: string;
  highlightText: string;
  badgeColor: string;
  stockBadge: string;
  glowBtn: string;
  cardBorder: string;
  activeNavPill: string;
  ringColor: string;
  brandLogo: string;
  heroBadge: string;
  tableHeaderBg: string;
  tableOddRow: string;
  tableEvenRow: string;
  // Core colors for CSS variables and table engines
  primaryColor: string;
  accentColor: string;
  darkColor: string;
  navbarBg: string;
  navbarBorder: string;
  sidebarBg: string;
  sidebarBorder: string;
  cardBg: string;
  tagline: string;
}

// Backward compatibility alias
export type InventoryTheme = WallpaperOption;

export const LIGHT_THEMES: WallpaperOption[] = [
  {
    id: 'emerald_forest',
    name: 'Nordic Emerald Studio',
    description: 'Deep alpine pine & rich Scandinavian emerald studio backdrop',
    tagline: 'Deep Alpine Forest & Pine Emerald',
    previewGradient: 'from-emerald-600 via-teal-500 to-emerald-800',
    primaryColor: '#047857',
    accentColor: '#d1fae5',
    darkColor: '#022c22',
    navbarBg: 'rgba(209, 250, 229, 0.98)',
    navbarBorder: '#34d399',
    sidebarBg: 'rgba(209, 250, 229, 0.98)',
    sidebarBorder: '#34d399',
    cardBg: 'rgba(240, 253, 248, 0.95)',
    primaryBtn: 'bg-emerald-900 text-emerald-50 hover:bg-emerald-800 shadow-emerald-950/20',
    secondaryBtn: 'bg-emerald-100 text-emerald-950 border border-emerald-300 hover:bg-emerald-200',
    accentText: 'text-emerald-800',
    highlightText: 'text-emerald-950',
    badgeColor: 'bg-emerald-100/90 text-emerald-950 border-emerald-300 font-bold',
    stockBadge: 'bg-emerald-200/80 text-emerald-950 border-emerald-400 font-bold',
    glowBtn: 'bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-950 text-emerald-50 shadow-emerald-900/20',
    cardBorder: 'border-emerald-300/90 hover:border-emerald-500/60 shadow-emerald-950/10',
    activeNavPill: 'bg-emerald-900 text-white shadow-md',
    ringColor: 'focus:ring-emerald-500 focus:border-emerald-500',
    brandLogo: 'bg-emerald-900 text-emerald-300',
    heroBadge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    tableHeaderBg: 'bg-emerald-200/80 text-emerald-950 border-b border-emerald-300',
    tableOddRow: 'bg-white/95 hover:bg-emerald-100/70 transition-colors',
    tableEvenRow: 'bg-emerald-100/60 hover:bg-emerald-200/80 transition-colors',
  },
  {
    id: 'sky_azure',
    name: 'Sky Azure Studio',
    description: 'Electric cobalt ocean & deep crisp azure studio stage',
    tagline: 'Electric Azure & Deep Cobalt',
    previewGradient: 'from-sky-500 via-blue-400 to-indigo-600',
    primaryColor: '#0284c7',
    accentColor: '#e0f2fe',
    darkColor: '#082f49',
    navbarBg: 'rgba(186, 230, 253, 0.98)',
    navbarBorder: '#38bdf8',
    sidebarBg: 'rgba(186, 230, 253, 0.98)',
    sidebarBorder: '#38bdf8',
    cardBg: 'rgba(240, 249, 255, 0.95)',
    primaryBtn: 'bg-sky-900 text-sky-50 hover:bg-sky-800 shadow-sky-950/20',
    secondaryBtn: 'bg-sky-100 text-sky-950 border border-sky-300 hover:bg-sky-200',
    accentText: 'text-sky-800',
    highlightText: 'text-sky-950',
    badgeColor: 'bg-sky-100/90 text-sky-950 border-sky-300 font-bold',
    stockBadge: 'bg-sky-200/80 text-sky-950 border-sky-400 font-bold',
    glowBtn: 'bg-gradient-to-r from-sky-800 via-blue-900 to-indigo-950 text-sky-50 shadow-sky-900/20',
    cardBorder: 'border-sky-300/90 hover:border-sky-500/60 shadow-sky-950/10',
    activeNavPill: 'bg-sky-900 text-white shadow-md',
    ringColor: 'focus:ring-sky-500 focus:border-sky-500',
    brandLogo: 'bg-sky-900 text-sky-300',
    heroBadge: 'bg-sky-100 text-sky-900 border-sky-300',
    tableHeaderBg: 'bg-sky-200/80 text-sky-950 border-b border-sky-300',
    tableOddRow: 'bg-white/95 hover:bg-sky-100/70 transition-colors',
    tableEvenRow: 'bg-sky-100/60 hover:bg-sky-200/80 transition-colors',
  },
  {
    id: 'crimson_ruby',
    name: 'Crimson Ruby Studio',
    description: 'Rich velvet crimson & deep garnet studio stage',
    tagline: 'Velvet Garnet & Crimson Ruby',
    previewGradient: 'from-red-600 via-rose-500 to-red-800',
    primaryColor: '#991b1b',
    accentColor: '#fee2e2',
    darkColor: '#450a0a',
    navbarBg: 'rgba(254, 202, 202, 0.98)',
    navbarBorder: '#f87171',
    sidebarBg: 'rgba(254, 202, 202, 0.98)',
    sidebarBorder: '#f87171',
    cardBg: 'rgba(255, 245, 245, 0.95)',
    primaryBtn: 'bg-red-900 text-red-50 hover:bg-red-800 shadow-red-950/20',
    secondaryBtn: 'bg-red-100 text-red-950 border border-red-300 hover:bg-red-200',
    accentText: 'text-red-800',
    highlightText: 'text-red-950',
    badgeColor: 'bg-red-100/90 text-red-950 border-red-300 font-bold',
    stockBadge: 'bg-red-200/80 text-red-950 border-red-400 font-bold',
    glowBtn: 'bg-gradient-to-r from-red-800 via-rose-900 to-red-950 text-red-50 shadow-red-900/20',
    cardBorder: 'border-red-300/90 hover:border-red-500/60 shadow-red-950/10',
    activeNavPill: 'bg-red-900 text-white shadow-md',
    ringColor: 'focus:ring-red-500 focus:border-red-500',
    brandLogo: 'bg-red-900 text-red-300',
    heroBadge: 'bg-red-100 text-red-900 border-red-300',
    tableHeaderBg: 'bg-red-200/80 text-red-950 border-b border-red-300',
    tableOddRow: 'bg-white/95 hover:bg-red-100/70 transition-colors',
    tableEvenRow: 'bg-red-100/60 hover:bg-red-200/80 transition-colors',
  },
  {
    id: 'lavender',
    name: 'Pastel Lavender Studio',
    description: 'Deep royal purple & soothing lilac studio backdrop',
    tagline: 'Royal Violet & Soothing Lilac',
    previewGradient: 'from-purple-500 via-pink-400 to-indigo-600',
    primaryColor: '#6b21a8',
    accentColor: '#f3e8ff',
    darkColor: '#3b0764',
    navbarBg: 'rgba(233, 213, 255, 0.98)',
    navbarBorder: '#c084fc',
    sidebarBg: 'rgba(233, 213, 255, 0.98)',
    sidebarBorder: '#c084fc',
    cardBg: 'rgba(250, 245, 255, 0.95)',
    primaryBtn: 'bg-purple-900 text-purple-50 hover:bg-purple-800 shadow-purple-950/20',
    secondaryBtn: 'bg-purple-100 text-purple-950 border border-purple-300 hover:bg-purple-200',
    accentText: 'text-purple-800',
    highlightText: 'text-purple-950',
    badgeColor: 'bg-purple-100/90 text-purple-950 border-purple-300 font-bold',
    stockBadge: 'bg-purple-200/80 text-purple-950 border-purple-400 font-bold',
    glowBtn: 'bg-gradient-to-r from-purple-800 via-fuchsia-900 to-indigo-950 text-purple-50 shadow-purple-900/20',
    cardBorder: 'border-purple-300/90 hover:border-purple-500/60 shadow-purple-950/10',
    activeNavPill: 'bg-purple-900 text-white shadow-md',
    ringColor: 'focus:ring-purple-500 focus:border-purple-500',
    brandLogo: 'bg-purple-900 text-purple-300',
    heroBadge: 'bg-purple-100 text-purple-900 border-purple-300',
    tableHeaderBg: 'bg-purple-200/80 text-purple-950 border-b border-purple-300',
    tableOddRow: 'bg-white/95 hover:bg-purple-100/70 transition-colors',
    tableEvenRow: 'bg-purple-100/60 hover:bg-purple-200/80 transition-colors',
  },
  {
    id: 'sand',
    name: 'Yellow Obsidian Studio',
    description: 'Vibrant canary yellow & deep jet obsidian black studio stage',
    tagline: 'Vibrant Yellow & Jet Black',
    previewGradient: 'from-yellow-400 via-amber-400 to-black',
    primaryColor: '#eab308',
    accentColor: '#fef08a',
    darkColor: '#000000',
    navbarBg: 'rgba(254, 240, 138, 0.96)',
    navbarBorder: '#facc15',
    sidebarBg: 'rgba(254, 240, 138, 0.96)',
    sidebarBorder: '#facc15',
    cardBg: 'rgba(255, 255, 255, 0.98)',
    primaryBtn: 'bg-black text-yellow-300 hover:bg-neutral-900 shadow-black/25 font-bold',
    secondaryBtn: 'bg-yellow-100 text-black border border-yellow-400 hover:bg-yellow-200 font-bold',
    accentText: 'text-yellow-700',
    highlightText: 'text-black',
    badgeColor: 'bg-yellow-200 text-black border-yellow-400 font-bold',
    stockBadge: 'bg-yellow-300 text-black border-yellow-500 font-bold',
    glowBtn: 'bg-gradient-to-r from-yellow-500 via-amber-500 to-black text-white shadow-yellow-900/20',
    cardBorder: 'border-yellow-300/90 hover:border-yellow-500/60 shadow-black/10',
    activeNavPill: 'bg-black text-yellow-300 shadow-md',
    ringColor: 'focus:ring-yellow-500 focus:border-yellow-500',
    brandLogo: 'bg-black text-yellow-300',
    heroBadge: 'bg-yellow-100 text-black border-yellow-400',
    tableHeaderBg: 'bg-yellow-200 text-black border-b border-yellow-400',
    tableOddRow: 'bg-white/95 hover:bg-yellow-50/90 transition-colors',
    tableEvenRow: 'bg-yellow-50/60 hover:bg-yellow-100/70 transition-colors',
  },
];

// Backward compatibility alias
export const INVENTORY_THEMES = LIGHT_THEMES;

const DEFAULT_THEME_ID: WallpaperTheme = 'emerald_forest';

const getInitialTheme = (): WallpaperTheme => {
  if (typeof window !== 'undefined') {
    try {
      const saved = (localStorage.getItem('product_app_light_wallpaper') ||
        localStorage.getItem('storebridge_inventory_theme')) as WallpaperTheme;
      if (saved && LIGHT_THEMES.some((opt) => opt.id === saved)) {
        return saved;
      }
    } catch (e) {}
  }
  return DEFAULT_THEME_ID;
};

interface ThemeContextType {
  activeWallpaper: WallpaperTheme;
  setWallpaper: (wallpaper: WallpaperTheme) => void;
  activeOption: WallpaperOption;
  // Aliases for compatibility
  theme: WallpaperTheme;
  currentTheme: WallpaperOption;
  setTheme: (themeId: WallpaperTheme) => void;
  themes: WallpaperOption[];
}

const ThemeContext = createContext<ThemeContextType>({
  activeWallpaper: DEFAULT_THEME_ID,
  setWallpaper: () => {},
  activeOption: LIGHT_THEMES[0],
  theme: DEFAULT_THEME_ID,
  currentTheme: LIGHT_THEMES[0],
  setTheme: () => {},
  themes: LIGHT_THEMES,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeWallpaper, setActiveWallpaperState] = useState<WallpaperTheme>(DEFAULT_THEME_ID);

  useEffect(() => {
    try {
      const saved = (localStorage.getItem('product_app_light_wallpaper') ||
        localStorage.getItem('storebridge_inventory_theme')) as WallpaperTheme;

      if (saved && LIGHT_THEMES.some((opt) => opt.id === saved)) {
        setActiveWallpaperState(saved);
        document.documentElement.setAttribute('data-theme', saved);
      } else {
        document.documentElement.setAttribute('data-theme', DEFAULT_THEME_ID);
      }
    } catch (e) {
      document.documentElement.setAttribute('data-theme', DEFAULT_THEME_ID);
    }
  }, []);

  const setWallpaper = (wallpaper: WallpaperTheme) => {
    setActiveWallpaperState(wallpaper);
    try {
      localStorage.setItem('product_app_light_wallpaper', wallpaper);
      localStorage.setItem('storebridge_inventory_theme', wallpaper);
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', wallpaper);
  };

  const activeOption = LIGHT_THEMES.find((opt) => opt.id === activeWallpaper) || LIGHT_THEMES[0];

  return (
    <ThemeContext.Provider
      value={{
        activeWallpaper,
        setWallpaper,
        activeOption,
        theme: activeWallpaper,
        currentTheme: activeOption,
        setTheme: setWallpaper,
        themes: LIGHT_THEMES,
      }}
    >
      <div className="relative min-h-screen w-full text-slate-900 font-sans antialiased bg-[var(--bg-page)]">
        {/* Main Content Container */}
        <div className="relative z-10 flex min-h-screen flex-col w-full">
          {children}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
