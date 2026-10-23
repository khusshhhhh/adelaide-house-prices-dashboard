import { useEffect, useState } from 'react';

export type Mode = 'light' | 'dark';

// Validated reference palette (categorical order is the CVD-safety mechanism - keep it).
export const PALETTES = {
  light: {
    surface: '#fcfcfb',
    ink: '#0b0b0b',
    ink2: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    // Sequential blue, near-zero → max.
    seq: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
    // Ordinal (price bands): starts at step 250 so the lightest band still clears 2:1.
    ordinal: ['#86b6ef', '#5598e7', '#3987e5', '#2a78d6', '#1c5cab', '#184f95', '#0d366b'],
    // Diverging: red (fall) ← gray → blue (rise); strongest first on each arm.
    neg: ['#a32d2d', '#e34948', '#f2a3a1'],
    mid: '#e6e4de',
    pos: ['#9ec5f4', '#3987e5', '#184f95'],
    noData: '#efeee9',
    up: '#256abf',
    down: '#d03b3b',
  },
  dark: {
    surface: '#1a1a19',
    ink: '#f0efec',
    ink2: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    seq: ['#0d366b', '#104281', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#b7d3f6'],
    ordinal: ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#6da7ec', '#9ec5f4'],
    neg: ['#f08a89', '#d04848', '#7d3131'],
    mid: '#383835',
    pos: ['#1c5cab', '#3987e5', '#86b6ef'],
    noData: '#262624',
    up: '#6da7ec',
    down: '#e66767',
  },
};

export type Palette = (typeof PALETTES)['light'];

function initialMode(): Mode {
  try {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [mode, setMode] = useState<Mode>(initialMode);
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    try { localStorage.setItem('theme', mode); } catch { /* ignore */ }
  }, [mode]);
  return { mode, palette: PALETTES[mode], toggle: () => setMode((m) => (m === 'light' ? 'dark' : 'light')) };
}

/** Shared ECharts chrome: recessive axes, hairline grid, system sans. */
export function baseOption(p: Palette) {
  return {
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', color: p.ink2 },
    animationDuration: 500,
    tooltip: {
      backgroundColor: p.surface,
      borderColor: p.axis,
      borderWidth: 1,
      textStyle: { color: p.ink, fontSize: 12 },
      extraCssText: 'border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.14);',
    },
  };
}

export function axisStyle(p: Palette) {
  return {
    axisLine: { lineStyle: { color: p.axis } },
    axisTick: { show: false },
    axisLabel: { color: p.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: p.grid, type: 'solid' as const } },
  };
}
