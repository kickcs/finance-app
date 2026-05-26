import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { useEffect } from 'react';

const STORAGE_KEY = 'navbar-style';
export type NavbarStyle = 'compact' | 'full';

interface State {
  style: NavbarStyle;
  ready: boolean;
  setStyle: (s: NavbarStyle) => void;
  hydrate: () => Promise<void>;
}

export const useNavbarStyleStore = create<State>((set) => ({
  style: 'full',
  ready: false,
  setStyle: (style) => {
    set({ style });
    void AsyncStorage.setItem(STORAGE_KEY, style);
  },
  hydrate: async () => {
    const v = (await AsyncStorage.getItem(STORAGE_KEY)) as NavbarStyle | null;
    set({ style: v ?? 'full', ready: true });
  },
}));

export function useNavbarStyle() {
  const state = useNavbarStyleStore();
  useEffect(() => {
    if (!state.ready) void state.hydrate();
  }, [state.ready, state.hydrate]);
  return { style: state.style, setStyle: state.setStyle };
}
