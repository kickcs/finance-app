import { computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { CURRENT_VERSION, CHANGELOG_ENTRIES } from './changelogData';

export function useChangelog() {
  const lastSeenVersion = useLocalStorage<string | null>('lastSeenChangelogVersion', null);

  const hasUnseenChanges = computed(() => lastSeenVersion.value !== CURRENT_VERSION);

  const latestEntry = computed(() => CHANGELOG_ENTRIES[0]);

  const allEntries = computed(() => CHANGELOG_ENTRIES);

  function markAsSeen() {
    lastSeenVersion.value = CURRENT_VERSION;
  }

  return {
    hasUnseenChanges,
    latestEntry,
    allEntries,
    markAsSeen,
  };
}
