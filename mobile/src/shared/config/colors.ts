export const ENTITY_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f43f5e',
  '#a855f7',
  '#f59e0b',
  '#f97316',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#6366f1',
  '#14b8a6',
  '#64748b',
  '#ef4444',
  '#8b5cf6',
  '#0ea5e9',
  '#d946ef',
  '#1f2937',
] as const;

export const TRANSFER_COLOR = '#4F46E5';

export const FALLBACK_CATEGORY_COLOR = '#64748b';

export function getRandomEntityColor(): string {
  const index = Math.floor(Math.random() * ENTITY_COLORS.length);
  return ENTITY_COLORS[index] ?? FALLBACK_CATEGORY_COLOR;
}
