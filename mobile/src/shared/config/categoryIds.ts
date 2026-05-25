/** Canonical category ID constants used across the app for debt, gift, and transfer logic. */
export const CATEGORY_IDS = {
  DEBT_GIVEN: 'debt_given',
  DEBT_TAKEN: 'debt_taken',
  DEBT_RETURN_TO_ME: 'debt_return_to_me',
  DEBT_RETURN_FROM_ME: 'debt_return_from_me',
  DEBT_FORGIVEN: 'debt_forgiven',
  GIFTS: 'gifts',
  GIFTS_INCOME: 'gifts_income',
  TRANSFER: 'transfer',
  COMMISSION: 'commission',
  BALANCE_ADJUSTMENT: 'balance_adjustment',
} as const;
