import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useEffect } from 'react';

const STORAGE_KEY = 'primary-color';
const DEFAULT_COLOR = '#4f46e5';

interface PrimaryColorState {
  color: string;
  ready: boolean;
  setColor: (c: string) => void;
  hydrate: () => Promise<void>;
}

export const usePrimaryColorStore = create<PrimaryColorState>((set) => ({
  color: DEFAULT_COLOR,
  ready: false,
  setColor: (color) => {
    set({ color });
    void AsyncStorage.setItem(STORAGE_KEY, color);
  },
  hydrate: async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    set({ color: stored ?? DEFAULT_COLOR, ready: true });
  },
}));

export function usePrimaryColor() {
  const { color, setColor, hydrate, ready } = usePrimaryColorStore();
  useEffect(() => {
    if (!ready) void hydrate();
  }, [ready, hydrate]);
  return { color, setColor };
}

export const PRIMARY_COLOR_OPTIONS = [
  '#4f46e5', // indigo (default)
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
] as const;
