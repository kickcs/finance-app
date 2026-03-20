import { describe, it, expect, beforeEach } from 'vitest';
import { useChangelog } from './model/useChangelog';
import { CURRENT_VERSION, CHANGELOG_ENTRIES } from './model/changelogData';

// ── useChangelog — pure unit tests (relies on useLocalStorage from @vueuse/core) ──

describe('useChangelog', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── hasUnseenChanges ─────────────────────────────────────────────────────

  describe('hasUnseenChanges', () => {
    it('is true when lastSeenVersion is null (first visit)', () => {
      const { hasUnseenChanges } = useChangelog();
      expect(hasUnseenChanges.value).toBe(true);
    });

    it('is true when lastSeenVersion is an older version', () => {
      localStorage.setItem('lastSeenChangelogVersion', '1.0.0');
      const { hasUnseenChanges } = useChangelog();
      expect(hasUnseenChanges.value).toBe(true);
    });

    it('is false when lastSeenVersion equals CURRENT_VERSION', () => {
      localStorage.setItem('lastSeenChangelogVersion', CURRENT_VERSION);
      const { hasUnseenChanges } = useChangelog();
      expect(hasUnseenChanges.value).toBe(false);
    });
  });

  // ── markAsSeen ───────────────────────────────────────────────────────────

  describe('markAsSeen', () => {
    it('sets lastSeenVersion to CURRENT_VERSION', () => {
      const { markAsSeen, hasUnseenChanges } = useChangelog();
      expect(hasUnseenChanges.value).toBe(true);

      markAsSeen();

      expect(hasUnseenChanges.value).toBe(false);
    });

    it('makes hasUnseenChanges false immediately on the same instance', () => {
      // useChangelog() creates a new useLocalStorage ref each call.
      // Test that markAsSeen updates the reactive ref on the same instance.
      const { markAsSeen, hasUnseenChanges } = useChangelog();
      expect(hasUnseenChanges.value).toBe(true); // starts unseen
      markAsSeen();
      expect(hasUnseenChanges.value).toBe(false); // now seen
    });

    it('calling markAsSeen twice does not throw', () => {
      const { markAsSeen, hasUnseenChanges } = useChangelog();
      markAsSeen();
      markAsSeen();
      expect(hasUnseenChanges.value).toBe(false);
    });
  });

  // ── latestEntry ──────────────────────────────────────────────────────────

  describe('latestEntry', () => {
    it('returns the first entry from CHANGELOG_ENTRIES', () => {
      const { latestEntry } = useChangelog();
      expect(latestEntry.value).toBe(CHANGELOG_ENTRIES[0]);
    });

    it('has the same version as CURRENT_VERSION', () => {
      const { latestEntry } = useChangelog();
      expect(latestEntry.value?.version).toBe(CURRENT_VERSION);
    });

    it('has a non-empty title', () => {
      const { latestEntry } = useChangelog();
      expect(latestEntry.value?.title).toBeTruthy();
    });

    it('has at least one item', () => {
      const { latestEntry } = useChangelog();
      expect(latestEntry.value?.items.length).toBeGreaterThan(0);
    });
  });

  // ── allEntries ───────────────────────────────────────────────────────────

  describe('allEntries', () => {
    it('returns the full CHANGELOG_ENTRIES array', () => {
      const { allEntries } = useChangelog();
      expect(allEntries.value).toBe(CHANGELOG_ENTRIES);
    });

    it('has entries sorted with most recent first', () => {
      const { allEntries } = useChangelog();
      const entries = allEntries.value;
      // First entry should be the current version
      expect(entries[0].version).toBe(CURRENT_VERSION);
      // Versions should be in descending order
      for (let i = 0; i < entries.length - 1; i++) {
        const currentVer = entries[i].version.split('.').map(Number);
        const nextVer = entries[i + 1].version.split('.').map(Number);
        const currentIsGreater =
          currentVer[0] > nextVer[0] ||
          (currentVer[0] === nextVer[0] && currentVer[1] > nextVer[1]) ||
          (currentVer[0] === nextVer[0] &&
            currentVer[1] === nextVer[1] &&
            currentVer[2] >= nextVer[2]);
        expect(currentIsGreater).toBe(true);
      }
    });

    it('contains at least 2 entries', () => {
      const { allEntries } = useChangelog();
      expect(allEntries.value.length).toBeGreaterThanOrEqual(2);
    });

    it('all items have valid types', () => {
      const { allEntries } = useChangelog();
      const validTypes = ['feature', 'fix', 'improvement'];
      allEntries.value.forEach((entry) => {
        entry.items.forEach((item) => {
          expect(validTypes).toContain(item.type);
        });
      });
    });

    it('all items have non-empty text', () => {
      const { allEntries } = useChangelog();
      allEntries.value.forEach((entry) => {
        entry.items.forEach((item) => {
          expect(item.text.trim()).toBeTruthy();
        });
      });
    });

    it('all entries have valid date format', () => {
      const { allEntries } = useChangelog();
      allEntries.value.forEach((entry) => {
        const date = new Date(entry.date);
        expect(isNaN(date.getTime())).toBe(false);
      });
    });
  });
});
