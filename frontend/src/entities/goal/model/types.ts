// Re-export from database types for consistency
export type { Goal } from '@/shared/api/database.types'
export type GoalId = string

export const GOAL_ICONS = [
  'savings',
  'flight',
  'directions_car',
  'home',
  'phone_iphone',
  'laptop_mac',
  'school',
  'celebration',
  'diamond',
  'favorite',
] as const

export const GOAL_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
] as const
