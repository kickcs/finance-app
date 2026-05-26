import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Appearance, useColorScheme as useDeviceColorScheme } from 'react-native';
import { create } from 'zustand';

import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
  hydrate: () => Promise<void>;
}

const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',
  setMode: async (mode) => {
    set({ mode });
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, mode);
    } catch {
      /* storage unavailable — keep the in-memory choice for the session */
    }
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  },
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        set({ mode: stored });
        Appearance.setColorScheme(stored === 'system' ? 'unspecified' : stored);
      }
    } catch {
      /* first launch — leave default 'system' */
    }
  },
}));

export function useThemeMode(): ThemeMode {
  return useThemeStore((s) => s.mode);
}

export function useSetThemeMode(): (mode: ThemeMode) => Promise<void> {
  return useThemeStore((s) => s.setMode);
}

export function useResolvedTheme(): ResolvedTheme {
  const mode = useThemeStore((s) => s.mode);
  const device = useDeviceColorScheme();
  if (mode === 'system') return device === 'dark' ? 'dark' : 'light';
  return mode;
}

/**
 * Mount once in the root layout to restore the saved preference before the
 * first frame renders. Without this the app flashes the system theme for one
 * frame on cold start when the user has chosen a manual override.
 */
export function useThemeBootstrap() {
  const hydrate = useThemeStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
}
