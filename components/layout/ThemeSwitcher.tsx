'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@shopify/polaris';
import { CheckIcon } from '@shopify/polaris-icons';
import { useTheme, LIGHT_THEMES, WallpaperTheme } from '@/components/providers/ThemeContext';

interface ThemeMergePalette {
  color1: string;       // Vibrant tone (e.g. Golden Amber / Mint / Sky / Rose / Lilac)
  color1Light: string;  // Lightest highlight
  color2: string;       // Deep tone (e.g. Charcoal Grey / Pine / Navy / Garnet / Amethyst)
  color2Dark: string;   // Jet Black / Deep Obsidian base
  glowColor: string;    // Ambient fusion glow
  dot1Color: string;    // Right-side indicator 1
  dot2Color: string;    // Right-side indicator 2
  label: string;        // Palette description
}

const THEME_MERGE_PALETTES: Record<WallpaperTheme, ThemeMergePalette> = {
  emerald_forest: {
    color1: '#a7cd18',
    color1Light: '#f2fadc',
    color2: '#a7cd18',
    color2Dark: '#142403',
    glowColor: 'rgba(167, 205, 24, 0.45)',
    dot1Color: '#a7cd18',
    dot2Color: '#142403',
    label: 'Lime Green & Soft Pastel',
  },
  sky_azure: {
    color1: '#38bdf8',
    color1Light: '#7dd3fc',
    color2: '#0284c7',
    color2Dark: '#082f49',
    glowColor: 'rgba(56, 189, 248, 0.45)',
    dot1Color: '#38bdf8',
    dot2Color: '#082f49',
    label: 'Electric Cobalt & Navy',
  },
  crimson_ruby: {
    color1: '#fb7185',
    color1Light: '#fda4af',
    color2: '#be123c',
    color2Dark: '#4c0519',
    glowColor: 'rgba(251, 113, 133, 0.45)',
    dot1Color: '#fb7185',
    dot2Color: '#4c0519',
    label: 'Velvet Rose & Garnet',
  },
  lavender: {
    color1: '#c084fc',
    color1Light: '#e9d5ff',
    color2: '#7e22ce',
    color2Dark: '#3b0764',
    glowColor: 'rgba(192, 132, 252, 0.45)',
    dot1Color: '#c084fc',
    dot2Color: '#3b0764',
    label: 'Royal Violet & Lilac',
  },
  sand: {
    color1: '#facc15',
    color1Light: '#fef08a',
    color2: '#000000',
    color2Dark: '#000000',
    glowColor: 'rgba(250, 204, 21, 0.55)',
    dot1Color: '#facc15',
    dot2Color: '#000000',
    label: 'Yellow & Black',
  },
};

/**
 * 4K Dual-Color Merged Fluid Artwork Component
 * Features a balanced 50/50 diagonal fluid wave merging two vibrant colors with 4K glass sheen
 */
function DualColorMergeArtwork({
  themeId,
  size = 44,
  isSelected = false,
}: {
  themeId: WallpaperTheme;
  size?: number;
  isSelected?: boolean;
}) {
  const p = THEME_MERGE_PALETTES[themeId] || THEME_MERGE_PALETTES.emerald_forest;
  const idPrefix = `merge-${themeId}-${size}`;

  return (
    <div
      className="relative flex items-center justify-center rounded-xl overflow-hidden transition-all duration-300 group-hover:scale-105 flex-shrink-0 shadow-sm border border-black/10"
      style={{
        width: size,
        height: size,
        boxShadow: isSelected
          ? `0 0 16px ${p.glowColor}, 0 2px 8px rgba(0,0,0,0.18)`
          : `0 2px 6px rgba(0,0,0,0.1)`,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          {/* Base Layer: Deep Color 2 & Jet Dark Gradient (Bottom-Right Half) */}
          <linearGradient id={`${idPrefix}-base`} x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={p.color2} />
            <stop offset="100%" stopColor={p.color2Dark} />
          </linearGradient>

          {/* Flowing Wave: Vibrant Color 1 Gradient (Top-Left Half) */}
          <linearGradient id={`${idPrefix}-wave`} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={p.color1Light} />
            <stop offset="60%" stopColor={p.color1} />
            <stop offset="100%" stopColor={p.color2} />
          </linearGradient>

          {/* Secondary Swirl Wave Highlight */}
          <linearGradient id={`${idPrefix}-accent`} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="100%" stopColor={p.color1Light} stopOpacity="0" />
          </linearGradient>

          {/* Diagonal 4K Specular Glass Reflection */}
          <linearGradient id={`${idPrefix}-glass`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.2" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          {/* Specular Edge Rim */}
          <linearGradient id={`${idPrefix}-rim`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* 1. Base Layer: Deep Color 2 (Dark/Black/Navy/Garnet/Pine) */}
        <rect width="48" height="48" rx="10" fill={`url(#${idPrefix}-base)`} />

        {/* 2. Fluid Wave Layer: Vibrant Color 1 (Amber/Mint/Sky/Rose/Lilac) across diagonal */}
        <path
          d="M 0,0 L 48,0 C 38,14 26,18 24,24 C 22,30 10,34 0,48 Z"
          fill={`url(#${idPrefix}-wave)`}
        />

        {/* 3. Soft Organic Harmonic Swirl (enhances merge depth) */}
        <path
          d="M 0,0 L 32,0 C 24,12 18,18 14,24 C 10,30 6,38 0,48 Z"
          fill={`url(#${idPrefix}-accent)`}
        />

        {/* 4. Fluid Wave Edge Sheen (highlighting the merge boundary) */}
        <path
          d="M 48,0 C 38,14 26,18 24,24 C 22,30 10,34 0,48"
          stroke="#ffffff"
          strokeWidth="0.8"
          strokeOpacity="0.4"
          fill="none"
        />

        {/* 5. 4K Diagonal Glass Reflection */}
        <path
          d="M 0,0 L 26,0 C 14,14 8,20 0,30 Z"
          fill={`url(#${idPrefix}-glass)`}
        />

        {/* 6. Crystal Edge Rim */}
        <rect
          x="0.75"
          y="0.75"
          width="46.5"
          height="46.5"
          rx="9.25"
          fill="none"
          stroke={`url(#${idPrefix}-rim)`}
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}

export function ThemeSwitcher() {
  const { activeWallpaper, setWallpaper, activeOption } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeFirstName = mounted ? activeOption.name.split(' ')[0] : 'Theme';

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button with full SSR hydration safety */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        suppressHydrationWarning
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[var(--theme-border-accent)] transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs group bg-white/90 backdrop-blur-sm"
        title={mounted ? `Active Studio Theme: ${activeOption.name} — Click to switch` : 'Switch Studio Theme'}
        aria-label="Switch Studio Theme"
        aria-expanded={isOpen}
      >
        {/* 4K Dual-Color Merged Icon Indicator */}
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          <DualColorMergeArtwork themeId={mounted ? activeWallpaper : 'emerald_forest'} size={20} isSelected={true} />
        </div>

        {/* Theme Name */}
        <span className="text-xs font-bold text-gray-800 tracking-tight flex items-center gap-1.5">
          <span className="hidden sm:inline">{activeFirstName}</span>
          <span className="sm:hidden">Theme</span>
        </span>

        {/* Dropdown chevron */}
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="fixed inset-x-3 top-[65px] sm:inset-auto sm:absolute sm:right-0 sm:top-full sm:mt-2 w-auto sm:w-[410px] max-w-[calc(100vw-24px)] sm:max-w-[410px] mx-auto sm:mx-0 bg-white/98 backdrop-blur-2xl rounded-2xl border border-gray-200/90 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-2.5"
        >
          {/* Menu Header */}
          <div className="px-3 py-2.5 border-b border-gray-100 mb-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                Studio Color Themes
              </div>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Select your 4K workspace color palette
              </p>
            </div>
            <span
              className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
              style={{
                backgroundColor: (activeOption.primaryColor || '#047857') + '15',
                color: activeOption.primaryColor || '#047857',
                borderColor: (activeOption.primaryColor || '#047857') + '30',
              }}
            >
              {activeFirstName}
            </span>
          </div>

          {/* Theme List */}
          <div className="flex flex-col gap-1.5 max-h-[410px] overflow-y-auto pr-1 ys-sidebar-scroll">
            {LIGHT_THEMES.map((item) => {
              const isSelected = item.id === activeWallpaper;
              const palette = THEME_MERGE_PALETTES[item.id] || THEME_MERGE_PALETTES.emerald_forest;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setWallpaper(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 group ${
                    isSelected
                      ? 'shadow-xs font-semibold'
                      : 'border-transparent hover:bg-gray-50/90 hover:border-gray-200'
                  }`}
                  style={{
                    backgroundColor: isSelected ? item.accentColor : undefined,
                    borderColor: isSelected ? item.primaryColor + '60' : undefined,
                  }}
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Innovative 4K Dual-Color Merged Artwork Preview Box */}
                    <div className="flex-shrink-0">
                      <DualColorMergeArtwork themeId={item.id} size={42} isSelected={isSelected} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-bold whitespace-nowrap"
                          style={{
                            color: isSelected ? item.darkColor : '#1e293b',
                          }}
                        >
                          {item.name}
                        </span>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded font-medium bg-black/5 text-gray-600">
                          {palette.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Right side check or 2-color indicator swatches */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                    {isSelected ? (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-2xs"
                        style={{ backgroundColor: item.primaryColor }}
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center text-white">
                          <Icon source={CheckIcon} tone="inherit" />
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <span
                          className="w-2.5 h-2.5 rounded-full shadow-2xs border border-black/10"
                          style={{ backgroundColor: palette.dot1Color }}
                          title={`Color 1: ${palette.dot1Color}`}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full shadow-2xs border border-black/10"
                          style={{ backgroundColor: palette.dot2Color }}
                          title={`Color 2: ${palette.dot2Color}`}
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Footer info */}
          <div className="mt-2 pt-2 border-t border-gray-100 px-3 pb-1 text-center">
            <span className="text-[10px] text-gray-400 font-medium">
              Real-time synchronization across all pages & components
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher;
