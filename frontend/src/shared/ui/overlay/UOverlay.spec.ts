import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import UOverlay from './UOverlay.vue';

/**
 * Стаб window.visualViewport для регресс-теста клавиатурного хака. jsdom не
 * предоставляет visualViewport вовсе, поэтому без него useDrawerKeyboard рано
 * выходит из onResize (см. `if (!vv) return`) и баг не воспроизводится — тест
 * обязан подставить его сам, как в реальном мобильном браузере.
 */
function stubVisualViewport(overrides: Partial<VisualViewport> = {}) {
  const listeners: Record<string, Array<() => void>> = {};
  const viewport = {
    height: 800,
    offsetTop: 0,
    addEventListener: (type: string, handler: () => void) => {
      (listeners[type] ??= []).push(handler);
    },
    removeEventListener: (type: string, handler: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((h) => h !== handler);
    },
    ...overrides,
  } as VisualViewport;

  const original = window.visualViewport;
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  return () =>
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: original });
}

// Закрытие настоящей шторки роняет jsdom на чтении style отсоединённого узла —
// см. комментарий в стабе.
vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

// Обе ветки (vaul-стаб и настоящий reka-ui Dialog) телепортируют содержимое в
// document.body, поэтому ищем его там, а не в дереве wrapper'а — тот же приём,
// что и в остальных тестах на reka-ui модалки (см. EditAccountDrawer.spec.ts).
// Стаб `teleport: true` здесь не подходит: реальный DialogPortal передаёт
// детей как slots-объект, а не как «сырой» массив вершин, который ожидает
// стаб-компонент vue-test-utils — с ним содержимое исчезает молча.
let currentWrapper: VueWrapper | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  setIsDesktopForTests(null);
  await flushPromises();
});

function mountOverlay(props: Record<string, unknown> = {}) {
  currentWrapper = mount(UOverlay, {
    props: { modelValue: true, title: 'Выбор счёта', ...props },
    slots: { default: '<p>содержимое</p>' },
  });
  return currentWrapper;
}

function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

describe('UOverlay', () => {
  it('на мобильной ширине рисует нижнюю шторку', async () => {
    setIsDesktopForTests(false);
    mountOverlay();
    await flushPromises();

    expect(findInBody('[data-testid="overlay-sheet"]')).not.toBeNull();
    expect(findInBody('[data-testid="overlay-dialog"]')).toBeNull();
  });

  it('на десктопе в режиме dialog рисует центрированный диалог', async () => {
    setIsDesktopForTests(true);
    mountOverlay({ desktop: 'dialog' });
    await flushPromises();

    expect(findInBody('[data-testid="overlay-dialog"]')).not.toBeNull();
    expect(findInBody('[data-testid="overlay-sheet"]')).toBeNull();
  });

  it('на десктопе в режиме panel рисует правую панель', async () => {
    setIsDesktopForTests(true);
    mountOverlay({ desktop: 'panel' });
    await flushPromises();

    expect(findInBody('[data-testid="overlay-panel"]')).not.toBeNull();
  });

  it('показывает заголовок и содержимое', async () => {
    setIsDesktopForTests(false);
    mountOverlay();
    await flushPromises();

    expect(document.body.textContent).toContain('Выбор счёта');
    expect(document.body.textContent).toContain('содержимое');
  });

  it('закрытие поднимает update:modelValue со значением false', async () => {
    setIsDesktopForTests(true);
    const wrapper = mountOverlay({ desktop: 'dialog' });
    await flushPromises();

    findInBody('[data-testid="overlay-close"]')?.click();
    await flushPromises();

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  it('мобильный предел высоты переживает клавиатурный хак при открытии (window.visualViewport подставлен)', async () => {
    setIsDesktopForTests(false);
    const restoreViewport = stubVisualViewport();

    try {
      // Открытие должно быть настоящей false→true транзицией: watch внутри
      // UOverlay не immediate, а именно на транзиции useDrawerKeyboard
      // впервые вызывает onResize() и (до фикса) стирал style.maxHeight.
      currentWrapper = mount(UOverlay, {
        props: { modelValue: false, title: 'Выбор счёта', maxHeight: '85dvh' },
        slots: { default: '<p>содержимое</p>' },
      });
      await flushPromises();

      await currentWrapper.setProps({ modelValue: true });
      await flushPromises();
      await flushPromises();

      const sheet = findInBody('[data-testid="overlay-sheet"]');
      expect(sheet).not.toBeNull();
      expect(sheet?.style.getPropertyValue('--overlay-max-h')).toBe('85dvh');
    } finally {
      restoreViewport();
    }
  });

  it('заголовок диалога — реальный DialogTitle: aria-labelledby резолвится в существующий элемент', async () => {
    setIsDesktopForTests(true);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      mountOverlay({ desktop: 'dialog' });
      await flushPromises();

      const dialog = findInBody('[data-testid="overlay-dialog"]');
      const labelledBy = dialog?.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(document.getElementById(labelledBy ?? '')?.textContent).toBe('Выбор счёта');

      const describedBy = dialog?.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy ?? '')).not.toBeNull();

      // reka-ui предупреждает в консоль, если DialogTitle/Description не
      // находятся по этим id — до фикса падали оба предупреждения.
      const warnedAboutA11y = warnSpy.mock.calls.some((call) =>
        String(call[0]).includes('accessible for screen reader'),
      );
      expect(warnedAboutA11y).toBe(false);
    } finally {
      warnSpy.mockRestore();
    }
  });
});
