import { describe, it, expect, afterEach, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { platformPage } from './platformPage';
import { setIsDesktopForTests } from './useIsDesktop';

const Mobile = defineComponent({ name: 'Mobile', setup: () => () => h('div', 'мобильная') });
const Desktop = defineComponent({ name: 'Desktop', setup: () => () => h('div', 'десктопная') });

afterEach(() => {
  setIsDesktopForTests(null);
});

describe('platformPage', () => {
  it('на мобильной ширине отдаёт мобильный вариант и не трогает десктопный загрузчик', async () => {
    setIsDesktopForTests(false);
    const mobileLoader = vi.fn(async () => Mobile);
    const desktopLoader = vi.fn(async () => Desktop);

    const component = await platformPage(mobileLoader, desktopLoader)();

    expect(component).toBe(Mobile);
    expect(mobileLoader).toHaveBeenCalledTimes(1);
    expect(desktopLoader).not.toHaveBeenCalled();
  });

  it('на десктопной ширине отдаёт десктопный вариант и не трогает мобильный загрузчик', async () => {
    setIsDesktopForTests(true);
    const mobileLoader = vi.fn(async () => Mobile);
    const desktopLoader = vi.fn(async () => Desktop);

    const component = await platformPage(mobileLoader, desktopLoader)();

    expect(component).toBe(Desktop);
    expect(desktopLoader).toHaveBeenCalledTimes(1);
    expect(mobileLoader).not.toHaveBeenCalled();
  });

  it('принимает загрузчик в форме модуля с default', async () => {
    setIsDesktopForTests(false);
    const component = await platformPage(
      async () => ({ default: Mobile }),
      async () => Desktop,
    )();

    expect(component).toBe(Mobile);
  });

  it('платформа выбирается в момент вызова, а не при создании загрузчика', async () => {
    setIsDesktopForTests(false);
    const loader = platformPage(
      async () => Mobile,
      async () => Desktop,
    );

    expect(await loader()).toBe(Mobile);

    setIsDesktopForTests(true);
    expect(await loader()).toBe(Desktop);
  });

  it('роутер дожидается чанка страницы — иначе заставка гаснет на пустой экран', async () => {
    setIsDesktopForTests(false);

    let resolveChunk!: (c: typeof Mobile) => void;
    const held = new Promise<typeof Mobile>((resolve) => {
      resolveChunk = resolve;
    });

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          component: platformPage(
            () => held,
            async () => Desktop,
          ),
        },
      ],
    });

    let navigated = false;
    const navigation = router.push('/').then(() => {
      navigated = true;
    });

    // Чанк ещё в полёте — навигация обязана висеть, а не завершаться с пустым
    // компонентом.
    await Promise.resolve();
    expect(navigated).toBe(false);

    resolveChunk(Mobile);
    await navigation;

    expect(navigated).toBe(true);
    expect(router.currentRoute.value.matched[0].components?.default).toBe(Mobile);
  });
});
