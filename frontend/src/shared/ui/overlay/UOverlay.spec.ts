import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import UOverlay from './UOverlay.vue';

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

  it('мобильный предел высоты задаётся через --overlay-max-h', async () => {
    setIsDesktopForTests(false);
    mountOverlay({ maxHeight: '85dvh' });
    await flushPromises();

    const sheet = findInBody('[data-testid="overlay-sheet"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.style.getPropertyValue('--overlay-max-h')).toBe('85dvh');
  });

  it('fill: шторка растянута между safe-area сверху и низом экрана, без --overlay-max-h', async () => {
    setIsDesktopForTests(false);
    mountOverlay({ fill: true });
    await flushPromises();

    const sheet = findInBody('[data-testid="overlay-sheet"]');
    expect(sheet?.style.top).toBe('calc(var(--safe-area-inset-top) + 0.5rem)');
    expect(sheet?.style.getPropertyValue('--overlay-max-h')).toBe('');
  });

  it('слот action рисуется в шапке перед кнопкой закрытия', async () => {
    setIsDesktopForTests(false);
    currentWrapper = mount(UOverlay, {
      props: { modelValue: true, title: 'Комментарий', fill: true },
      slots: {
        default: '<p>содержимое</p>',
        action: '<button data-testid="fill-action">Сохранить</button>',
      },
    });
    await flushPromises();

    expect(findInBody('[data-testid="fill-action"]')).not.toBeNull();
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
