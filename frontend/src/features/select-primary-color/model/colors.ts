export interface PrimaryColorVariants {
  base: string;
  hover: string;
  pressed: string;
  light: string;
}

export const PRIMARY_COLORS: Record<string, PrimaryColorVariants> = {
  indigo: {
    base: '#4F46E5',
    hover: '#6366F1',
    pressed: '#3730A3',
    light: 'rgba(79,70,229,0.12)',
  },
  blue: {
    base: '#3B82F6',
    hover: '#60A5FA',
    pressed: '#2563EB',
    light: 'rgba(59,130,246,0.12)',
  },
  sky: {
    base: '#0EA5E9',
    hover: '#38BDF8',
    pressed: '#0284C7',
    light: 'rgba(14,165,233,0.12)',
  },
  cyan: {
    base: '#06B6D4',
    hover: '#22D3EE',
    pressed: '#0891B2',
    light: 'rgba(6,182,212,0.12)',
  },
  teal: {
    base: '#14B8A6',
    hover: '#2DD4BF',
    pressed: '#0D9488',
    light: 'rgba(20,184,166,0.12)',
  },
  emerald: {
    base: '#10B981',
    hover: '#34D399',
    pressed: '#059669',
    light: 'rgba(16,185,129,0.12)',
  },
  lime: {
    base: '#84CC16',
    hover: '#A3E635',
    pressed: '#65A30D',
    light: 'rgba(132,204,22,0.12)',
  },
  amber: {
    base: '#F59E0B',
    hover: '#FBBF24',
    pressed: '#D97706',
    light: 'rgba(245,158,11,0.12)',
  },
  orange: {
    base: '#F97316',
    hover: '#FB923C',
    pressed: '#EA580C',
    light: 'rgba(249,115,22,0.12)',
  },
  red: {
    base: '#EF4444',
    hover: '#F87171',
    pressed: '#DC2626',
    light: 'rgba(239,68,68,0.12)',
  },
  rose: {
    base: '#F43F5E',
    hover: '#FB7185',
    pressed: '#E11D48',
    light: 'rgba(244,63,94,0.12)',
  },
  purple: {
    base: '#A855F7',
    hover: '#C084FC',
    pressed: '#9333EA',
    light: 'rgba(168,85,247,0.12)',
  },
};

export const DEFAULT_COLOR_NAME = 'indigo';

export const COLOR_NAMES = Object.keys(PRIMARY_COLORS);
