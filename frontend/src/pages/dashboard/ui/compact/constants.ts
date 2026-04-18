// Shared style/class fragments for compact dashboard widgets.
// Centralised so every section card visually agrees: same labels,
// same headers, same View-All button treatment.

export const SECTION_LABEL_CLASS =
  'text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark';

export const VIEW_ALL_BTN_CLASS =
  'text-caption font-semibold text-primary hover:opacity-80 transition-opacity';

export const SECTION_CARD_CLASS =
  'rounded-2xl bg-card-light dark:bg-card-dark shadow-sm overflow-hidden';

export const SECTION_HEADER_CLASS =
  'flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-border-light dark:border-border-dark';

export const STATS_LABEL_CLASS =
  'text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark';

// Hex alpha suffixes used to tint a category/brand color at various intensities.
// Kept in one place so icon chips, amount badges and filled buttons agree.
export const TINT_ALPHA = {
  subtle: '0A', //  4% — filled quick-action background (light)
  soft: '0F', //   6% — filled compact quick-action background (light)
  chip: '18', //  9% — icon tile background (accounts, debts, subs, top expenses)
  badge: '22', // 13% — amount badge pill next to a quick action
} as const;

/** Soft tinted background used for icon chips (accounts, top-expenses, transactions, debts, subscriptions). */
export function iconTileStyle(color: string): { backgroundColor: string } {
  return { backgroundColor: `${color}${TINT_ALPHA.chip}` };
}

/** Background tint for a "filled" quick-action card in the standard grid. */
export function quickActionFillStyle(color: string): {
  '--qa-color': string;
  backgroundColor: string;
} {
  return { '--qa-color': color, backgroundColor: `${color}${TINT_ALPHA.subtle}` };
}

/** Background tint for a "filled" compact quick-action button. */
export function compactQuickActionFillStyle(color: string): {
  '--qa-color': string;
  backgroundColor: string;
} {
  return { '--qa-color': color, backgroundColor: `${color}${TINT_ALPHA.soft}` };
}

/** Colored amount-badge pill style used on a quick action. */
export function quickActionBadgeStyle(color: string): { color: string; backgroundColor: string } {
  return { color, backgroundColor: `${color}${TINT_ALPHA.badge}` };
}
