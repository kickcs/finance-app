/**
 * Event tracking facade.
 *
 * Until a real analytics SDK (PostHog / Amplitude / Mixpanel) is wired up,
 * track() is a no-op in production and logs to console in __DEV__. Adding
 * call-sites now means the eventual SDK swap is a single-file change.
 *
 * Conventions:
 *  - Event names: snake_case, past-tense verbs. e.g. "transaction_created".
 *  - Props: flat key-value, primitive values only. No PII (email, name,
 *    raw amounts in currency the user is paid in).
 */

export type TrackProps = Record<string, string | number | boolean | null | undefined>;

export type AnalyticsEvent =
  | 'app_open'
  | 'sign_in'
  | 'sign_up'
  | 'sign_in_anonymous'
  | 'sign_out'
  | 'transaction_created'
  | 'transaction_edited'
  | 'transaction_deleted'
  | 'account_created'
  | 'account_balance_adjusted'
  | 'debt_created'
  | 'debt_partial_payment'
  | 'debt_closed'
  | 'goal_created'
  | 'receipt_scanned'
  | 'premium_upgrade_modal_opened'
  | 'premium_purchase_initiated'
  | 'premium_purchase_succeeded'
  | 'premium_purchase_failed'
  | 'premium_restore_initiated'
  | 'theme_changed';

export function track(event: AnalyticsEvent, props?: TrackProps): void {
  if (__DEV__) {
    console.log('[analytics]', event, props ?? {});
  }
  // TODO(Phase 6): wire to PostHog (or Amplitude) RN SDK here. Pseudocode:
  //   posthog.capture(event, props);
}

export function identify(userId: string, traits?: TrackProps): void {
  if (__DEV__) {
    console.log('[analytics:identify]', userId, traits ?? {});
  }
  // TODO(Phase 6): posthog.identify(userId, traits);
}

export function reset(): void {
  if (__DEV__) {
    console.log('[analytics:reset]');
  }
  // TODO(Phase 6): posthog.reset();
}
