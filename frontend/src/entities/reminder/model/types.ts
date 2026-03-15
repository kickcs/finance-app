// Re-export from database types for consistency
export type { Reminder } from '@/shared/api/database.types';

export const REMINDER_ICONS = [
  'receipt_long',
  'electric_bolt',
  'water_drop',
  'wifi',
  'phone_android',
  'subscriptions',
  'fitness_center',
  'school',
  'medical_services',
  'payments',
  'cottage',
  'directions_car',
  'music_note',
  'tv',
  'sports_esports',
  'local_cafe',
  'movie',
  'credit_card',
  'notifications',
  'laptop_mac',
  'pets',
  'cardiology',
  'local_gas_station',
  'flight',
  'shopping_cart',
] as const;

export const FREQUENCY_LABELS: Record<'weekly' | 'monthly' | 'yearly' | 'once', string> = {
  weekly: 'Неделя',
  monthly: 'Месяц',
  yearly: 'Год',
  once: 'Разово',
};
