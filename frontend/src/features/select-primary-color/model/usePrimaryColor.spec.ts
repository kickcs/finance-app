import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { renderWithProviders } from '@/test/test-utils';
import { PRIMARY_COLORS, DEFAULT_COLOR_NAME, COLOR_NAMES } from './colors';

// ── Helpers ────────────────────────────────────────────────────────────────

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

/**
 * usePrimaryColor uses a module-level singleton (colorName via useLocalStorage).
 * We re-import the module fresh after vi.resetModules() to reset the singleton
 * between tests.
 */
async function importFresh() {
  vi.resetModules();
  const mod = await import('./usePrimaryColor');
  return mod;
}

function mountComposable(
  usePrimaryColorFn: () => ReturnType<Awaited<ReturnType<typeof importFresh>>['usePrimaryColor']>,
) {
  let result!: ReturnType<typeof usePrimaryColorFn>;
  const Stub = defineComponent({
    setup() {
      result = usePrimaryColorFn();
      return () => h('div');
    },
  });
  currentWrapper = renderWithProviders(Stub);
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('usePrimaryColor', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset CSS custom properties on documentElement
    document.documentElement.style.cssText = '';
  });

  afterEach(() => {
    currentWrapper?.unmount();
    currentWrapper = null;
    vi.restoreAllMocks();
  });

  // ── default state ─────────────────────────────────────────────────────

  describe('default state', () => {
    it('colorName defaults to indigo when localStorage is empty', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      expect(c.colorName.value).toBe(DEFAULT_COLOR_NAME);
    });

    it('DEFAULT_COLOR_NAME is "indigo"', () => {
      expect(DEFAULT_COLOR_NAME).toBe('indigo');
    });
  });

  // ── setColor ──────────────────────────────────────────────────────────

  describe('setColor', () => {
    it('updates colorName reactive ref', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('blue');

      expect(c.colorName.value).toBe('blue');
    });

    it('colorName reflects the last set color', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('rose');

      expect(c.colorName.value).toBe('rose');
    });

    it('applies CSS variables to documentElement for non-default color', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('blue');

      const el = document.documentElement;
      expect(el.style.getPropertyValue('--color-primary')).toBe(PRIMARY_COLORS.blue.base);
      expect(el.style.getPropertyValue('--color-primary-hover')).toBe(PRIMARY_COLORS.blue.hover);
      expect(el.style.getPropertyValue('--color-primary-pressed')).toBe(
        PRIMARY_COLORS.blue.pressed,
      );
      expect(el.style.getPropertyValue('--color-primary-light')).toBe(PRIMARY_COLORS.blue.light);
    });

    it('sets --color-info to the same base color as --color-primary', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('teal');

      const el = document.documentElement;
      expect(el.style.getPropertyValue('--color-info')).toBe(PRIMARY_COLORS.teal.base);
    });

    it('sets --color-info-light to match the chosen color light variant', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('teal');

      const el = document.documentElement;
      expect(el.style.getPropertyValue('--color-info-light')).toBe(PRIMARY_COLORS.teal.light);
    });

    it('sets shadcn-vue --primary RGB variable (space-separated)', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('blue');

      // blue base = '#3B82F6' → '59 130 246'
      const el = document.documentElement;
      expect(el.style.getPropertyValue('--primary')).toBe('59 130 246');
    });

    it('sets --ring to same RGB as --primary', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('blue');

      const el = document.documentElement;
      const primary = el.style.getPropertyValue('--primary');
      const ring = el.style.getPropertyValue('--ring');
      expect(ring).toBe(primary);
    });

    it('can switch between multiple colors updating colorName each time', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('red');
      expect(c.colorName.value).toBe('red');

      c.setColor('emerald');
      expect(c.colorName.value).toBe('emerald');
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
        PRIMARY_COLORS.emerald.base,
      );
    });

    it('works for all colors in COLOR_NAMES', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      for (const name of COLOR_NAMES) {
        c.setColor(name);
        expect(c.colorName.value).toBe(name);
        const primary = document.documentElement.style.getPropertyValue('--color-primary');
        expect(primary).toBe(PRIMARY_COLORS[name].base);
      }
    });

    it('falls back to default color variants for unknown color name', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.setColor('nonexistent-color');

      // Should use DEFAULT_COLOR_NAME (indigo) variants as fallback
      const el = document.documentElement;
      expect(el.style.getPropertyValue('--color-primary')).toBe(
        PRIMARY_COLORS[DEFAULT_COLOR_NAME].base,
      );
    });
  });

  // ── applyColor ────────────────────────────────────────────────────────

  describe('applyColor', () => {
    it('applies CSS variables without updating colorName', async () => {
      const { usePrimaryColor } = await importFresh();
      const c = mountComposable(usePrimaryColor);

      c.applyColor('purple');

      // colorName should still be the default (we didn't call setColor)
      expect(c.colorName.value).toBe(DEFAULT_COLOR_NAME);
      // But CSS should be applied
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
        PRIMARY_COLORS.purple.base,
      );
    });
  });

  // ── initPrimaryColor ──────────────────────────────────────────────────

  describe('initPrimaryColor', () => {
    it('does not apply CSS when color is default (indigo)', async () => {
      localStorage.setItem('primary_color', 'indigo');
      const { initPrimaryColor } = await importFresh();

      const setSpy = vi.spyOn(document.documentElement.style, 'setProperty');
      initPrimaryColor();

      expect(setSpy).not.toHaveBeenCalled();
    });

    it('applies CSS when stored color is non-default', async () => {
      localStorage.setItem('primary_color', 'amber');
      const { initPrimaryColor } = await importFresh();

      initPrimaryColor();

      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(
        PRIMARY_COLORS.amber.base,
      );
    });

    it('is idempotent — second call is a no-op', async () => {
      localStorage.setItem('primary_color', 'rose');
      const { initPrimaryColor } = await importFresh();

      initPrimaryColor();
      const primaryAfterFirst = document.documentElement.style.getPropertyValue('--color-primary');

      // Manually change CSS to detect if second call overwrites
      document.documentElement.style.setProperty('--color-primary', '#000000');

      initPrimaryColor(); // should be a no-op due to `initialized` flag
      // The manual override should remain since second call is skipped
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#000000');

      // Sanity: first call did apply rose
      expect(primaryAfterFirst).toBe(PRIMARY_COLORS.rose.base);
    });
  });

  // ── PRIMARY_COLORS structure ──────────────────────────────────────────

  describe('PRIMARY_COLORS', () => {
    it('all colors have base, hover, pressed, light variants as valid strings', () => {
      for (const [name, variants] of Object.entries(PRIMARY_COLORS)) {
        expect(variants.base, `${name}.base`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(variants.hover, `${name}.hover`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(variants.pressed, `${name}.pressed`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(typeof variants.light, `${name}.light`).toBe('string');
      }
    });

    it('COLOR_NAMES contains all keys from PRIMARY_COLORS', () => {
      expect(COLOR_NAMES).toEqual(expect.arrayContaining(Object.keys(PRIMARY_COLORS)));
      expect(COLOR_NAMES.length).toBe(Object.keys(PRIMARY_COLORS).length);
    });

    it('DEFAULT_COLOR_NAME is a key in PRIMARY_COLORS', () => {
      expect(PRIMARY_COLORS).toHaveProperty(DEFAULT_COLOR_NAME);
    });

    it('has 12 predefined colors', () => {
      expect(COLOR_NAMES.length).toBe(12);
    });
  });
});
