import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { CHANGELOG_ENTRIES, CURRENT_VERSION } from '../model/changelogData';

const STORAGE_KEY = 'changelog-last-seen-version';

export function useChangelog() {
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => setLastSeen(v));
  }, []);

  const hasUnseen = lastSeen !== null && lastSeen !== CURRENT_VERSION;

  const markSeen = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setLastSeen(CURRENT_VERSION);
  }, []);

  return { entries: CHANGELOG_ENTRIES, currentVersion: CURRENT_VERSION, hasUnseen, markSeen };
}
