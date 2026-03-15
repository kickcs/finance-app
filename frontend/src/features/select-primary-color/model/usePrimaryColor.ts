import { useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { PRIMARY_COLORS, DEFAULT_COLOR_NAME } from './colors';
import type { PrimaryColorVariants } from './colors';

/**
 * Convert hex color (#RRGGBB) to space-separated RGB integers.
 * Example: '#4F46E5' → '79 70 229'
 * Required by shadcn-vue CSS variables (--primary, --ring).
 */
function hexToRgbString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

// Singleton state — shared across all usePrimaryColor() calls
const colorName = useLocalStorage<string>(STORAGE_KEYS.PRIMARY_COLOR, DEFAULT_COLOR_NAME);
let initialized = false;

function getVariants(name: string): PrimaryColorVariants {
  return PRIMARY_COLORS[name] ?? PRIMARY_COLORS[DEFAULT_COLOR_NAME];
}

function applyColor(name: string): void {
  const variants = getVariants(name);
  const el = document.documentElement;

  // Tailwind v4 @theme tokens
  el.style.setProperty('--color-primary', variants.base);
  el.style.setProperty('--color-primary-hover', variants.hover);
  el.style.setProperty('--color-primary-pressed', variants.pressed);
  el.style.setProperty('--color-primary-light', variants.light);

  // Info color is aliased to primary
  el.style.setProperty('--color-info', variants.base);
  el.style.setProperty('--color-info-light', variants.light);

  // shadcn-vue :root RGB variables
  const rgb = hexToRgbString(variants.base);
  el.style.setProperty('--primary', rgb);
  el.style.setProperty('--ring', rgb);
}

/**
 * Apply stored primary color on app startup.
 * Skips when the default color (indigo) is active because CSS @theme
 * tokens already define indigo — no runtime override needed.
 * IMPORTANT: This assumes PRIMARY_COLORS.indigo always matches the
 * default values in app/styles/index.css. If those defaults change,
 * update them in sync.
 */
export function initPrimaryColor(): void {
  if (initialized) return;

  if (colorName.value !== DEFAULT_COLOR_NAME) {
    applyColor(colorName.value);
  }

  initialized = true;
}

export function usePrimaryColor() {
  function setColor(name: string): void {
    colorName.value = name;
    applyColor(name);
  }

  return {
    colorName,
    setColor,
    applyColor,
    initPrimaryColor,
  };
}
