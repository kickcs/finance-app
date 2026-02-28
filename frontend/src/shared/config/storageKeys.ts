export const STORAGE_KEYS = {
  /** JWT access token (set by http.ts on login/refresh) */
  ACCESS_TOKEN: 'access_token',

  /** User's primary display currency code (e.g. 'UZS', 'USD') */
  SELECTED_CURRENCY: 'selectedCurrency',

  /** Flag set to 'true' once the user completes onboarding */
  ONBOARDING_COMPLETE: 'onboardingComplete',

  /** Flag set to 'true' once the welcome slides have been shown */
  HAS_SEEN_ONBOARDING: 'hasSeenOnboarding',

  /** ISO timestamp when a demo account expires */
  DEMO_EXPIRES_AT: 'demoExpiresAt',

  /** JSON array of additional account currency codes */
  ACCOUNT_CURRENCIES: 'accountCurrencies',

  /** UI theme: 'light' | 'dark' | 'system' */
  THEME: 'theme',

  /** Last changelog version seen by the user */
  CHANGELOG_LAST_SEEN_VERSION: 'lastSeenChangelogVersion',

  /** Whether the balance is hidden on the dashboard / layout header */
  BALANCE_HIDDEN: 'balance_hidden',

  /** Persisted TanStack Query cache blob */
  QUERY_CACHE: 'ouro-query-cache',

  /** Quick-action slots configuration (JSON array) */
  QUICK_ACTIONS: 'quick_actions',

  /** Whether the quick-actions section is collapsed */
  QUICK_ACTIONS_HIDDEN: 'quick_actions_hidden',

  /** Whether the quick-actions onboarding hint has been dismissed */
  QUICK_ACTIONS_HINT_DISMISSED: 'quick_actions_hint_dismissed',

  /** Whether the PWA install banner has been dismissed */
  PWA_INSTALL_DISMISSED: 'pwa-install-dismissed',
} as const;
