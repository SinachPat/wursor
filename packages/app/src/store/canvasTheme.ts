'use client';

import { useTheme } from './theme';

/**
 * Shared design tokens for every canvas panel (Toolbar, ArtboardNavigator,
 * Inspector, Canvas). Toggling the theme store flips all tokens at once.
 */
export interface CanvasTokens {
  // Panel surfaces
  bg:          string;
  bgDeep:      string;   // slightly deeper than bg (inner cards, inputs)
  border:      string;
  sep:         string;
  // Text
  fg:          string;
  fgMuted:     string;
  fgDim:       string;
  label:       string;
  key:         string;
  dim:         string;
  // Interactive
  accent:      string;
  accentBg:    string;
  activeBg:    string;
  hoverBg:     string;
  selBg:       string;
  selFg:       string;
  // List items
  item:        string;
  itemHov:     string;
  // Tabs
  tabFg:       string;
  tabOn:       string;
  // Live indicator
  live:        string;
  liveBg:      string;
  liveBorder:  string;
  // Canvas drawing area
  canvasBg:    string;
  dotColor:    string;   // grid dot colour
}

export const DARK_TOKENS: CanvasTokens = {
  bg:          '#111115',
  bgDeep:      '#0D0D11',
  border:      'rgba(255,255,255,0.055)',
  sep:         'rgba(255,255,255,0.04)',
  fg:          'rgba(255,255,255,0.88)',
  fgMuted:     'rgba(255,255,255,0.38)',
  fgDim:       'rgba(255,255,255,0.22)',
  label:       'rgba(255,255,255,0.22)',
  key:         'rgba(255,255,255,0.32)',
  dim:         'rgba(255,255,255,0.22)',
  accent:      '#3385FF',
  accentBg:    'rgba(51,133,255,0.14)',
  activeBg:    'rgba(255,255,255,0.07)',
  hoverBg:     'rgba(255,255,255,0.04)',
  selBg:       'rgba(51,133,255,0.12)',
  selFg:       'rgba(255,255,255,0.88)',
  item:        'rgba(255,255,255,0.42)',
  itemHov:     'rgba(255,255,255,0.72)',
  tabFg:       'rgba(255,255,255,0.28)',
  tabOn:       'rgba(255,255,255,0.88)',
  live:        '#10B981',
  liveBg:      'rgba(16,185,129,0.10)',
  liveBorder:  'rgba(16,185,129,0.20)',
  canvasBg:    '#0C0C10',
  dotColor:    'rgba(255,255,255,0.055)',
};

export const LIGHT_TOKENS: CanvasTokens = {
  bg:          '#F2F2F4',
  bgDeep:      '#E8E8EB',
  border:      'rgba(0,0,0,0.08)',
  sep:         'rgba(0,0,0,0.06)',
  fg:          '#1A1A2E',
  fgMuted:     'rgba(0,0,0,0.48)',
  fgDim:       'rgba(0,0,0,0.30)',
  label:       'rgba(0,0,0,0.38)',
  key:         'rgba(0,0,0,0.55)',
  dim:         'rgba(0,0,0,0.30)',
  accent:      '#0066FF',
  accentBg:    'rgba(0,102,255,0.10)',
  activeBg:    'rgba(0,0,0,0.05)',
  hoverBg:     'rgba(0,0,0,0.04)',
  selBg:       'rgba(0,102,255,0.10)',
  selFg:       '#0A0A0A',
  item:        'rgba(0,0,0,0.55)',
  itemHov:     '#0A0A0A',
  tabFg:       'rgba(0,0,0,0.38)',
  tabOn:       '#0A0A0A',
  live:        '#059669',
  liveBg:      'rgba(5,150,105,0.08)',
  liveBorder:  'rgba(5,150,105,0.18)',
  canvasBg:    '#DDDDE2',
  dotColor:    'rgba(0,0,0,0.10)',
};

/** Returns the token set matching the current user theme preference. */
export function useCanvasTheme(): CanvasTokens {
  const mode = useTheme((s) => s.mode);
  return mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
}
