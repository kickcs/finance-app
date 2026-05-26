/**
 * Error reporting facade.
 *
 * Real implementation will be `@sentry/react-native` once an Expo plugin is
 * configured and SENTRY_DSN is set in `eas.json` build profiles. Until then
 * this module is a no-op in production / console.error in __DEV__, so we
 * can safely add reportError() / breadcrumb() call-sites everywhere without
 * pulling the native SDK into the binary yet.
 *
 * When wiring real Sentry:
 *   1. `npx expo install @sentry/react-native`
 *   2. Add plugin to app.json:
 *        ["@sentry/react-native/expo", { "organization": "...", "project": "..." }]
 *   3. `Sentry.init({ dsn: process.env.EXPO_PUBLIC_SENTRY_DSN, ... })`
 *      at the top of _layout.tsx (before any imports that use this facade).
 *   4. Replace the bodies below with Sentry.captureException /
 *      Sentry.addBreadcrumb / Sentry.setUser / Sentry.wrap.
 */

import type { ComponentType } from 'react';

export interface ErrorContext {
  scope?: string;
  extras?: Record<string, unknown>;
  tags?: Record<string, string>;
}

export function reportError(error: unknown, context?: ErrorContext): void {
  if (__DEV__) {
    console.error('[errorReporter]', context?.scope ?? 'unknown', error, context?.extras ?? {});
  }
  // TODO(Phase 6): Sentry.captureException(error, { tags, extra });
}

export function breadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log('[breadcrumb]', category, message, data ?? {});
  }
  // TODO(Phase 6): Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

export function setUserContext(userId: string | null, email?: string | null): void {
  if (__DEV__) {
    console.log('[errorReporter:user]', userId, email);
  }
  // TODO(Phase 6): Sentry.setUser(userId ? { id: userId, email: email ?? undefined } : null);
}

/**
 * HOC placeholder that mirrors Sentry.wrap signature. Currently returns the
 * component unmodified — the eventual replacement adds an ErrorBoundary that
 * captures rendering exceptions.
 */
export function wrapRoot<P>(Component: ComponentType<P>): ComponentType<P> {
  return Component;
}
