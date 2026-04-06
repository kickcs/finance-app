import { computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export type NavbarStyle = 'classic' | 'liquid-glass';

const isAndroid = /Android/.test(navigator.userAgent);

const style = useLocalStorage<NavbarStyle>(
  STORAGE_KEYS.NAVBAR_STYLE,
  isAndroid ? 'classic' : 'liquid-glass',
);

// Auto-reset existing Android users who had liquid-glass enabled
if (isAndroid && style.value === 'liquid-glass') {
  style.value = 'classic';
}

const isLiquidGlass = computed(() => style.value === 'liquid-glass');

export function useNavbarStyle() {
  return { style, isLiquidGlass, isAndroid };
}
