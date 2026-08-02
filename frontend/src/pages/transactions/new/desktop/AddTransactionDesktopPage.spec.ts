import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import type * as AppRouter from '@/app/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import AddTransactionDesktopPage from './AddTransactionDesktopPage.vue';

vi.mock('vaul-vue', () => import('@/test/stubs/vaul'));
vi.mock('@/app/router', async (importOriginal) => ({
  ...(await importOriginal<typeof AppRouter>()),
  isPageTransitioning: { value: false },
}));

/**
 * `UOverlay` в режиме `dialog` рендерит содержимое через `reka-ui`
 * `DialogPortal` — оно телепортируется в реальный `document.body`, а не
 * остаётся в поддереве `wrapper`. Поэтому, как и в `UOverlay.spec.ts` /
 * `EditAccountModal.spec.ts`, ищем узлы в `document.body`, а не через
 * `wrapper.find()` (тот не видит телепортированный контент вовсе). По той же
 * причине обязателен `unmount()` в `afterEach` — иначе телепортированные узлы
 * прошлого теста остаются в `document.body`, и следующий `querySelector`
 * находит чужую кнопку.
 */
let currentWrapper: VueWrapper | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  setIsDesktopForTests(null);
  await flushPromises();
});

function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

async function mountPage() {
  setIsDesktopForTests(true);
  const router = createTestRouter([
    // Имя обязательно: закрытие без истории уходит на Главную по имени
    // маршрута, как в боевой таблице, а не по literal-пути.
    { path: '/', name: ROUTE_NAMES.DASHBOARD, component: { template: '<div />' } },
    { path: '/transactions/new', component: { template: '<div />' } },
  ]);
  await router.push('/transactions/new');
  currentWrapper = renderWithProviders(AddTransactionDesktopPage, {
    router,
    provideAuth: { user: mockUser },
  });
  await flushPromises();
  return { wrapper: currentWrapper, router };
}

describe('Новая операция на десктопе', () => {
  it('рисуется как центрированный диалог, а не как полноэкранная страница', async () => {
    await mountPage();
    expect(findInBody('[data-testid="overlay-dialog"]')).not.toBeNull();
  });

  it('закрытие возвращает на предыдущий маршрут', async () => {
    const { router } = await mountPage();

    findInBody('[data-testid="overlay-close"]')?.click();
    await flushPromises();
    await flushPromises();

    expect(router.currentRoute.value.path).not.toBe('/transactions/new');
  });

  it('SubmitBar рисуется без safe-area компенсации и без -mx-4', async () => {
    await mountPage();

    // `safe-area-inset-bottom` живёт только в scoped `<style>` компонента —
    // его никогда не будет в innerHTML, поэтому проверяем реальный класс
    // узла: `flush` должен подменить `-mx-4 px-4` на `submit-bar--flush`.
    const bar = findInBody('.submit-bar');
    expect(bar).not.toBeNull();
    expect(bar?.className).toContain('submit-bar--flush');
    expect(bar?.className).not.toContain('-mx-4');
  });
});
