/**
 * Shared color palette for entities (accounts, reminders, people, etc.)
 * Keep in sync with frontend/src/shared/config/colors.ts
 */
export const ENTITY_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#1f2937', // Dark
];

export function getRandomEntityColor(): string {
  return ENTITY_COLORS[Math.floor(Math.random() * ENTITY_COLORS.length)];
}
