import type { Currency } from './types';

// Re-export from shared for backwards compatibility (canonical source: shared/config/currency.ts)
export { DEFAULT_CURRENCY } from '@/shared/config/currency';

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', flag: '🇷🇺' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'сўм', flag: '🇺🇿' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
];

export function getCurrencyByCode(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}
