import { describe, it, expect, afterEach, vi } from 'vitest';
import { defineComponent, h, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';

vi.mock('@/app/layouts/model/useLayoutData', () => ({
  useLayoutData: () => ({
    userName: { value: 'Тест' },
    greeting: { value: 'Добрый день' },
    totalBalance: { value: 1000 },
    currency: { value: 'UZS' },
    isHidden: { value: false },
    toggleHidden: vi.fn(),
    isLoading: { value: false },
  }),
}));

const Stub = defineComponent({ setup: () => () => h('div', 'страница') });

function mountLayout(component: unknown) {
  const router = createTestRouter([{ path: '/', component: Stub }]);
  return renderWithProviders(component as never, { router, provideAuth: { user: mockUser } });
}

afterEach(() => setIsDesktopForTests(null));

describe('оболочки приложения', () => {
  it('мобильная оболочка показывает нижнюю навигацию и не монтирует сайдбар', async () => {
    setIsDesktopForTests(false);
    const { default: MobileLayout } = await import('./MobileLayout.vue');
    const wrapper = mountLayout(MobileLayout);
    await flushPromises();
    // LiquidGlassBottomNav грузится через defineAsyncComponent реальным
    // динамическим import — микротасков flushPromises() не хватает, чтобы
    // дождаться его разрешения, нужно дождаться именно динамические импорты.
    await vi.dynamicImportSettled();
    await flushPromises();

    expect(wrapper.find('[data-testid="bottom-nav"]').exists()).toBe(true);
    expect(wrapper.find('aside[aria-label="Навигационная панель"]').exists()).toBe(false);
  });

  it('десктопная оболочка показывает сайдбар и не монтирует нижнюю навигацию', async () => {
    setIsDesktopForTests(true);
    const { default: DesktopLayout } = await import('./DesktopLayout.vue');
    const wrapper = mountLayout(DesktopLayout);
    await flushPromises();

    expect(wrapper.find('aside[aria-label="Навигационная панель"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="bottom-nav"]').exists()).toBe(false);
  });

  it('на десктопе разделы меняются без слайда', async () => {
    setIsDesktopForTests(true);
    const { transitionName, router: appRouter } = await import('@/app/router');
    await appRouter.push('/analytics');
    expect(transitionName.value).toBe('none');
  });

  it('на маршруте-оверлее десктопная оболочка держит фоновую страницу под модалкой', async () => {
    setIsDesktopForTests(true);
    const { default: DesktopLayout } = await import('./DesktopLayout.vue');

    const router = createTestRouter([
      { path: '/', component: { template: '<div data-testid="dashboard-stub">дашборд</div>' } },
      {
        path: '/transactions/new',
        meta: { desktopOverlay: true },
        component: { template: '<div data-testid="overlay-stub">оверлей</div>' },
      },
    ]);

    const wrapper = renderWithProviders(DesktopLayout, {
      router,
      provideAuth: { user: mockUser },
    });
    await flushPromises();

    await router.push('/transactions/new');
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="overlay-stub"]').exists()).toBe(true);
  });

  it('мобильная оболочка игнорирует desktopOverlay — маршрут остаётся полноэкранным', async () => {
    setIsDesktopForTests(false);
    const { default: MobileLayout } = await import('./MobileLayout.vue');

    const router = createTestRouter([
      { path: '/', component: { template: '<div data-testid="dashboard-stub">дашборд</div>' } },
      {
        path: '/transactions/new',
        meta: { desktopOverlay: true },
        component: { template: '<div data-testid="overlay-stub">оверлей</div>' },
      },
    ]);

    const wrapper = renderWithProviders(MobileLayout, {
      router,
      provideAuth: { user: mockUser },
    });
    await flushPromises();
    await vi.dynamicImportSettled();
    await flushPromises();

    await router.push('/transactions/new');
    await flushPromises();

    expect(wrapper.find('[data-testid="overlay-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-stub"]').exists()).toBe(false);
  });

  it('фон под оверлеем продолжает видеть собственный маршрут (query не теряется)', async () => {
    setIsDesktopForTests(true);
    const { default: DesktopLayout } = await import('./DesktopLayout.vue');

    // Имитирует AccountsDesktopPage: выбор счёта живёт в `route.query.id`.
    const AccountsStub = defineComponent({
      setup() {
        const bgRoute = useRoute();
        return () => h('div', { 'data-testid': 'bg-query' }, String(bgRoute.query.id ?? ''));
      },
    });

    const router = createTestRouter([
      { path: '/', component: { template: '<div />' } },
      { path: '/accounts', component: AccountsStub },
      {
        path: '/transactions/new',
        meta: { desktopOverlay: true },
        component: { template: '<div data-testid="overlay-stub">оверлей</div>' },
      },
    ]);

    const wrapper = renderWithProviders(DesktopLayout, {
      router,
      provideAuth: { user: mockUser },
    });

    await router.push('/accounts?id=acc-1');
    await flushPromises();
    expect(wrapper.find('[data-testid="bg-query"]').text()).toBe('acc-1');

    await router.push('/transactions/new');
    await flushPromises();

    // Фон остаётся на /accounts?id=acc-1 — useRoute() внутри него не должен
    // схлопнуться в роут оверлея.
    expect(wrapper.find('[data-testid="bg-query"]').text()).toBe('acc-1');
    expect(wrapper.find('[data-testid="overlay-stub"]').exists()).toBe(true);
  });

  it('фон не размонтируется при открытии и закрытии модального маршрута', async () => {
    setIsDesktopForTests(true);
    const { default: DesktopLayout } = await import('./DesktopLayout.vue');

    const mounts: string[] = [];
    const unmounts: string[] = [];
    const DashboardStub = defineComponent({
      setup() {
        onMounted(() => mounts.push('bg'));
        onUnmounted(() => unmounts.push('bg'));
        return () => h('div', 'дашборд');
      },
    });

    const router = createTestRouter([
      { path: '/', component: DashboardStub },
      {
        path: '/transactions/new',
        meta: { desktopOverlay: true },
        component: { template: '<div data-testid="overlay-stub">оверлей</div>' },
      },
    ]);

    renderWithProviders(DesktopLayout, { router, provideAuth: { user: mockUser } });
    await flushPromises();
    expect(mounts).toEqual(['bg']);

    await router.push('/transactions/new');
    await flushPromises();
    await router.push('/');
    await flushPromises();

    expect(mounts).toEqual(['bg']);
    expect(unmounts).toEqual([]);
  });

  it('навигация на фоне, меняющая только query, не перемонтирует страницу', async () => {
    // Регресс: `:key` фона был навешен на `backgroundPath` (fullPath, с
    // query) — router.replace({ query }) (так `AccountsDesktopPage` и
    // useDebtsPage пишут выбор в URL) менял `fullPath` и поэтому
    // размонтировал и заново монтировал страницу под ним.
    setIsDesktopForTests(true);
    const { default: DesktopLayout } = await import('./DesktopLayout.vue');

    const mounts: string[] = [];
    const DebtsStub = defineComponent({
      setup() {
        onMounted(() => mounts.push('debts'));
        return () => h('div', 'долги');
      },
    });

    const router = createTestRouter([
      { path: '/', component: { template: '<div />' } },
      { path: '/debts', component: DebtsStub },
    ]);

    await router.push('/debts');
    renderWithProviders(DesktopLayout, { router, provideAuth: { user: mockUser } });
    await flushPromises();
    expect(mounts).toEqual(['debts']);

    await router.replace('/debts?person=Alice');
    await flushPromises();

    expect(mounts).toEqual(['debts']);
  });
});
