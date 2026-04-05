import { computed } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export type NavbarStyle = 'classic' | 'liquid-glass';

const style = useLocalStorage<NavbarStyle>(STORAGE_KEYS.NAVBAR_STYLE, 'liquid-glass');
const isLiquidGlass = computed(() => style.value === 'liquid-glass');

export function useNavbarStyle() {
  return { style, isLiquidGlass };
}
