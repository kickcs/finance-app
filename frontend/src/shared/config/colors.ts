/**
 * Shared color palette for entities (accounts, people, reminders, etc.)
 */
export const ENTITY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Hot Pink
  '#84cc16', // Lime
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#64748b', // Slate
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#0ea5e9', // Sky
  '#d946ef', // Fuchsia
  '#1f2937', // Dark
] as const;

/** Default color for transfer transactions (Indigo 600) */
export const TRANSFER_COLOR = '#4F46E5';

/** Pick a random color from ENTITY_COLORS */
export function getRandomEntityColor(): string {
  return ENTITY_COLORS[Math.floor(Math.random() * ENTITY_COLORS.length)];
}
