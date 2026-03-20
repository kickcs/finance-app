import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, type Ref } from 'vue';
import { useDemoMode } from './model/useDemoMode';
import type { Profile } from '@/shared/api';

// ── useDemoMode — pure unit tests ────────────────────────────────────────────

// useTimestamp uses Date.now() under the hood; keep tests deterministic
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-20T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'test-user-1',
    name: 'Test User',
    email: 'test@example.com',
    currency: 'UZS',
    has_completed_onboarding: true,
    default_account_id: 'acc-1',
    created_at: '2026-01-01T00:00:00.000Z',
    is_demo: false,
    demo_expires_at: null,
    dashboard_settings: null,
    quick_actions_hidden: false,
    quick_actions_hint_dismissed: false,
    ...overrides,
  } as unknown as Profile;
}

describe('useDemoMode', () => {
  // ── isDemo ───────────────────────────────────────────────────────────────

  describe('isDemo', () => {
    it('is false for a non-demo profile', () => {
      const profile: Ref<Profile | null | undefined> = ref(makeProfile({ is_demo: false }));
      const { isDemo } = useDemoMode(profile);
      expect(isDemo.value).toBe(false);
    });

    it('is true for a demo profile', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T13:00:00.000Z' }),
      );
      const { isDemo } = useDemoMode(profile);
      expect(isDemo.value).toBe(true);
    });

    it('is false when profile is null', () => {
      const profile: Ref<Profile | null | undefined> = ref(null);
      const { isDemo } = useDemoMode(profile);
      expect(isDemo.value).toBe(false);
    });

    it('is false when profile is undefined', () => {
      const profile: Ref<Profile | null | undefined> = ref(undefined);
      const { isDemo } = useDemoMode(profile);
      expect(isDemo.value).toBe(false);
    });
  });

  // ── expiresAt ────────────────────────────────────────────────────────────

  describe('expiresAt', () => {
    it('is null when profile has no demo_expires_at', () => {
      const profile: Ref<Profile | null | undefined> = ref(makeProfile({ demo_expires_at: null }));
      const { expiresAt } = useDemoMode(profile);
      expect(expiresAt.value).toBeNull();
    });

    it('returns timestamp from demo_expires_at', () => {
      const expiresIso = '2026-03-20T13:00:00.000Z';
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: expiresIso }),
      );
      const { expiresAt } = useDemoMode(profile);
      expect(expiresAt.value).toBe(new Date(expiresIso).getTime());
    });
  });

  // ── remainingTime ────────────────────────────────────────────────────────

  describe('remainingTime', () => {
    it('is null when no expiry set', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: null }),
      );
      const { remainingTime } = useDemoMode(profile);
      expect(remainingTime.value).toBeNull();
    });

    it('returns positive ms when demo not yet expired', () => {
      // Current time: 12:00, expires at 13:00 → 1 hour remaining
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T13:00:00.000Z' }),
      );
      const { remainingTime } = useDemoMode(profile);
      expect(remainingTime.value).toBeGreaterThan(0);
    });

    it('returns 0 when demo is expired', () => {
      // Current time: 12:00, expired at 11:00
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T11:00:00.000Z' }),
      );
      const { remainingTime } = useDemoMode(profile);
      expect(remainingTime.value).toBe(0);
    });
  });

  // ── isExpired ────────────────────────────────────────────────────────────

  describe('isExpired', () => {
    it('is false for non-demo profile', () => {
      const profile: Ref<Profile | null | undefined> = ref(makeProfile({ is_demo: false }));
      const { isExpired } = useDemoMode(profile);
      expect(isExpired.value).toBe(false);
    });

    it('is false when demo has time remaining', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T13:00:00.000Z' }),
      );
      const { isExpired } = useDemoMode(profile);
      expect(isExpired.value).toBe(false);
    });

    it('is true when demo has expired', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T11:00:00.000Z' }),
      );
      const { isExpired } = useDemoMode(profile);
      expect(isExpired.value).toBe(true);
    });

    it('is false when demo has no expiry set', () => {
      // No expiry → remainingTime is null → isExpired stays false
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: null }),
      );
      const { isExpired } = useDemoMode(profile);
      expect(isExpired.value).toBe(false);
    });
  });

  // ── formattedRemaining ───────────────────────────────────────────────────

  describe('formattedRemaining', () => {
    it('returns 00:00 when no expiry', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: null }),
      );
      const { formattedRemaining } = useDemoMode(profile);
      expect(formattedRemaining.value).toBe('00:00');
    });

    it('returns MM:SS format when demo is active', () => {
      // 1 hour 30 min remaining → 90:00
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T13:30:00.000Z' }),
      );
      const { formattedRemaining } = useDemoMode(profile);
      // Should match MM:SS pattern
      expect(formattedRemaining.value).toMatch(/^\d{2}:\d{2}$/);
    });

    it('returns 00:00 when expired', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T11:00:00.000Z' }),
      );
      const { formattedRemaining } = useDemoMode(profile);
      expect(formattedRemaining.value).toBe('00:00');
    });
  });

  // ── remainingMinutes / remainingSeconds ──────────────────────────────────

  describe('remainingMinutes and remainingSeconds', () => {
    it('returns 0 when no expiry set', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: null }),
      );
      const { remainingMinutes, remainingSeconds } = useDemoMode(profile);
      expect(remainingMinutes.value).toBe(0);
      expect(remainingSeconds.value).toBe(0);
    });

    it('returns positive values when demo is active', () => {
      const profile: Ref<Profile | null | undefined> = ref(
        makeProfile({ is_demo: true, demo_expires_at: '2026-03-20T13:00:00.000Z' }),
      );
      const { remainingMinutes, remainingSeconds } = useDemoMode(profile);
      expect(remainingMinutes.value).toBeGreaterThan(0);
      expect(remainingSeconds.value).toBeGreaterThan(0);
    });
  });
});
