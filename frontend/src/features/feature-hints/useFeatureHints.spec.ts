import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { HINT_CONFIGS } from './model/constants';

// ── useFeatureHints — unit tests ─────────────────────────────────────────────
//
// useFeatureHints uses module-level singletons (hintShownThisSession, dismissed,
// counters, dotsDismissed). We use vi.resetModules() + dynamic import to get a
// fresh module state for each test, which also reinitializes the useLocalStorage
// refs from localStorage.

async function importFresh() {
  vi.resetModules();
  const mod = await import('./model/useFeatureHints');
  return mod;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useFeatureHints', () => {
  // ── incrementCounter ──────────────────────────────────────────────────────

  describe('incrementCounter', () => {
    it('increments counter reactively from 0 to 1', async () => {
      const { useFeatureHints } = await importFresh();
      const { incrementCounter, shouldShowHint } = useFeatureHints();

      // split-expense threshold is 3 — it is false at 0
      expect(shouldShowHint('split-expense')).toBe(false);
      incrementCounter('expenses_count');
      incrementCounter('expenses_count');
      incrementCounter('expenses_count');
      // Exactly at threshold → true
      expect(shouldShowHint('split-expense')).toBe(true);
    });

    it('increments multiple times correctly', async () => {
      const { useFeatureHints } = await importFresh();
      const { incrementCounter, shouldShowHint } = useFeatureHints();

      // dashboard-settings threshold is 7
      expect(shouldShowHint('dashboard-settings')).toBe(false);
      for (let i = 0; i < 7; i++) incrementCounter('dashboard_visits');
      expect(shouldShowHint('dashboard-settings')).toBe(true);
    });

    it('tracks different counters independently', async () => {
      const { useFeatureHints } = await importFresh();
      const { incrementCounter, shouldShowHint } = useFeatureHints();

      // Increment expenses only — dashboard-settings (dashboard_visits) stays false
      for (let i = 0; i < 5; i++) incrementCounter('expenses_count');
      expect(shouldShowHint('dashboard-settings')).toBe(false);

      // Increment dashboard visits — now dashboard-settings becomes true
      for (let i = 0; i < 7; i++) incrementCounter('dashboard_visits');
      expect(shouldShowHint('dashboard-settings')).toBe(true);
    });
  });

  // ── shouldShowHint ────────────────────────────────────────────────────────

  describe('shouldShowHint', () => {
    it('returns false when counter is below threshold', async () => {
      const { useFeatureHints } = await importFresh();
      const { shouldShowHint, incrementCounter } = useFeatureHints();
      // split-expense threshold is 3
      incrementCounter('expenses_count');
      incrementCounter('expenses_count');
      expect(shouldShowHint('split-expense')).toBe(false);
    });

    it('returns true when counter exactly meets threshold', async () => {
      const { useFeatureHints } = await importFresh();
      const { shouldShowHint, incrementCounter } = useFeatureHints();
      for (let i = 0; i < 3; i++) incrementCounter('expenses_count');
      expect(shouldShowHint('split-expense')).toBe(true);
    });

    it('returns false when hint config does not exist', async () => {
      const { useFeatureHints } = await importFresh();
      const { shouldShowHint } = useFeatureHints();
      expect(shouldShowHint('nonexistent-hint' as any)).toBe(false);
    });

    it('returns false when hint is already dismissed', async () => {
      const { useFeatureHints } = await importFresh();
      const { shouldShowHint, incrementCounter, dismissHint } = useFeatureHints();
      for (let i = 0; i < 3; i++) incrementCounter('expenses_count');
      dismissHint('split-expense');
      expect(shouldShowHint('split-expense')).toBe(false);
    });

    it('returns false when hintShownThisSession is true', async () => {
      const { useFeatureHints } = await importFresh();
      const { shouldShowHint, incrementCounter, markHintShown } = useFeatureHints();
      for (let i = 0; i < 3; i++) incrementCounter('expenses_count');
      markHintShown();
      expect(shouldShowHint('split-expense')).toBe(false);
    });
  });

  // ── dismissHint ───────────────────────────────────────────────────────────

  describe('dismissHint', () => {
    it('makes shouldShowHint return false after dismissal', async () => {
      const { useFeatureHints } = await importFresh();
      const { dismissHint, shouldShowHint, incrementCounter } = useFeatureHints();
      for (let i = 0; i < 7; i++) incrementCounter('dashboard_visits');
      expect(shouldShowHint('dashboard-settings')).toBe(true);

      dismissHint('dashboard-settings');
      expect(shouldShowHint('dashboard-settings')).toBe(false);
    });

    it('sets hintShownThisSession — prevents other hints from showing', async () => {
      const { useFeatureHints } = await importFresh();
      const { dismissHint, shouldShowHint, incrementCounter } = useFeatureHints();
      // Put split-expense above threshold
      for (let i = 0; i < 3; i++) incrementCounter('expenses_count');
      // Put dashboard-settings above threshold too
      for (let i = 0; i < 7; i++) incrementCounter('dashboard_visits');
      expect(shouldShowHint('split-expense')).toBe(true);

      dismissHint('split-expense');

      // Session flag means no other hint shows either
      expect(shouldShowHint('dashboard-settings')).toBe(false);
    });
  });

  // ── markHintShown ─────────────────────────────────────────────────────────

  describe('markHintShown', () => {
    it('prevents all hints from showing for the rest of the session', async () => {
      const { useFeatureHints } = await importFresh();
      const { markHintShown, shouldShowHint, incrementCounter } = useFeatureHints();
      for (let i = 0; i < 3; i++) incrementCounter('expenses_count');
      for (let i = 0; i < 7; i++) incrementCounter('dashboard_visits');

      markHintShown();

      expect(shouldShowHint('split-expense')).toBe(false);
      expect(shouldShowHint('dashboard-settings')).toBe(false);
    });
  });

  // ── dot dismissal ─────────────────────────────────────────────────────────

  describe('isDotDismissed / dismissDot', () => {
    it('isDotDismissed returns false for a fresh dot', async () => {
      const { useFeatureHints } = await importFresh();
      const { isDotDismissed } = useFeatureHints();
      expect(isDotDismissed('add-button')).toBe(false);
      expect(isDotDismissed('dashboard-settings')).toBe(false);
    });

    it('isDotDismissed returns true after dismissDot called', async () => {
      const { useFeatureHints } = await importFresh();
      const { dismissDot, isDotDismissed } = useFeatureHints();
      dismissDot('dashboard-settings');
      expect(isDotDismissed('dashboard-settings')).toBe(true);
    });

    it('dismissing one dot does not affect others', async () => {
      const { useFeatureHints } = await importFresh();
      const { dismissDot, isDotDismissed } = useFeatureHints();
      dismissDot('add-button');
      expect(isDotDismissed('dashboard-settings')).toBe(false);
    });

    it('dismissDot reflects immediately in the same instance', async () => {
      const { useFeatureHints } = await importFresh();
      const { dismissDot, isDotDismissed } = useFeatureHints();
      expect(isDotDismissed('dashboard-settings')).toBe(false);
      dismissDot('dashboard-settings');
      expect(isDotDismissed('dashboard-settings')).toBe(true);
    });
  });

  // ── getHintConfig ─────────────────────────────────────────────────────────

  describe('getHintConfig', () => {
    it('returns config for known hint id', async () => {
      const { useFeatureHints } = await importFresh();
      const { getHintConfig } = useFeatureHints();
      const config = getHintConfig('split-expense');
      expect(config).toEqual(HINT_CONFIGS['split-expense']);
    });

    it('returns null for unknown hint id', async () => {
      const { useFeatureHints } = await importFresh();
      const { getHintConfig } = useFeatureHints();
      expect(getHintConfig('unknown' as any)).toBeNull();
    });

    it('all hint configs have required fields', async () => {
      const { useFeatureHints } = await importFresh();
      const { getHintConfig } = useFeatureHints();
      const hintIds = ['split-expense', 'dashboard-settings'] as const;
      hintIds.forEach((id) => {
        const config = getHintConfig(id);
        expect(config).not.toBeNull();
        expect(config?.title).toBeTruthy();
        expect(config?.description).toBeTruthy();
        expect(config?.actionLabel).toBeTruthy();
        expect(config?.triggerCounter).toBeTruthy();
        expect(config?.triggerThreshold).toBeGreaterThan(0);
      });
    });

    it('split-expense uses expenses_count with threshold 3', async () => {
      const { useFeatureHints } = await importFresh();
      const config = useFeatureHints().getHintConfig('split-expense');
      expect(config?.triggerCounter).toBe('expenses_count');
      expect(config?.triggerThreshold).toBe(3);
    });

    it('dashboard-settings uses dashboard_visits with threshold 7', async () => {
      const { useFeatureHints } = await importFresh();
      const config = useFeatureHints().getHintConfig('dashboard-settings');
      expect(config?.triggerCounter).toBe('dashboard_visits');
      expect(config?.triggerThreshold).toBe(7);
    });
  });

  // ── fresh module reads from localStorage ─────────────────────────────────

  describe('localStorage persistence (fresh module reads prior state)', () => {
    it('counter increments from first session are visible after module reset', async () => {
      // First session: hit threshold
      const { useFeatureHints: use1 } = await importFresh();
      const session1 = use1();
      for (let i = 0; i < 3; i++) session1.incrementCounter('expenses_count');

      // Await nextTick to ensure VueUse flushes to localStorage
      await nextTick();

      // Second session: fresh module reads from localStorage
      const { useFeatureHints: use2 } = await importFresh();
      const session2 = use2();
      // hintShownThisSession resets to false in new module scope
      // Counter was persisted to localStorage, so shouldShowHint should be true
      expect(session2.shouldShowHint('split-expense')).toBe(true);
    });

    it('dismissed hints persist across module reloads', async () => {
      const { useFeatureHints: use1 } = await importFresh();
      const session1 = use1();
      for (let i = 0; i < 7; i++) session1.incrementCounter('dashboard_visits');
      session1.dismissHint('dashboard-settings');
      await nextTick();

      const { useFeatureHints: use2 } = await importFresh();
      const session2 = use2();
      for (let i = 0; i < 7; i++) session2.incrementCounter('dashboard_visits');
      // Dismissed in previous session, should still be false
      expect(session2.shouldShowHint('dashboard-settings')).toBe(false);
    });
  });
});
