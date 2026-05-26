import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { CURRENT_VERSION } from '../../model/changelogData';
import { useChangelog } from '../useChangelog';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('useChangelog', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('hasUnseen is false when lastSeen is null (first launch)', async () => {
    const { result } = renderHook(() => useChangelog());
    // Before the effect resolves, lastSeen is null — hasUnseen must be false
    expect(result.current.hasUnseen).toBe(false);
    await act(async () => {});
    expect(result.current.hasUnseen).toBe(false);
  });

  it('hasUnseen is false after markSeen', async () => {
    const { result } = renderHook(() => useChangelog());
    await act(async () => {});
    await act(async () => {
      await result.current.markSeen();
    });
    expect(result.current.hasUnseen).toBe(false);
    expect(result.current.currentVersion).toBe(CURRENT_VERSION);
  });

  it('hasUnseen is true when stored version differs from current', async () => {
    await AsyncStorage.setItem('changelog-last-seen-version', '0.0.0');
    const { result } = renderHook(() => useChangelog());
    await act(async () => {});
    expect(result.current.hasUnseen).toBe(true);
  });

  it('entries array is non-empty', () => {
    const { result } = renderHook(() => useChangelog());
    expect(result.current.entries.length).toBeGreaterThan(0);
  });
});
