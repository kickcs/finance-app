/**
 * Shared color palette for entities (accounts, reminders, etc.)
 */
export const ENTITY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#1f2937', // Dark
] as const;

/** Pick a random color from ENTITY_COLORS */
export function getRandomEntityColor(): string {
  return ENTITY_COLORS[Math.floor(Math.random() * ENTITY_COLORS.length)];
}
