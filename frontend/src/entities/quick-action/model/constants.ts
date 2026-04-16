import { FALLBACK_CATEGORY_COLOR } from '@/shared/config/colors';

/** Fallback category metadata used when a quick action references a missing category. */
export const DEFAULT_QUICK_ACTION_CATEGORY = {
  name: '',
  icon: 'receipt_long',
  color: FALLBACK_CATEGORY_COLOR,
} as const;
