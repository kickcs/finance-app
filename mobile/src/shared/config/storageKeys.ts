export const STORAGE_KEYS = {
  // Access token only — refresh_token lives in the backend httpOnly cookie.
  ACCESS_TOKEN: 'finance.accessToken',
  USER_ID: 'finance.userId',
  THEME: 'finance.theme',
  PRIMARY_COLOR: 'finance.primaryColor',
} as const;
