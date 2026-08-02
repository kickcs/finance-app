import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, createTestRouter, mockUser } from '@/test/test-utils';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import { server } from '@/test/mocks/server';
import { mockProfileResponse } from '@/test/mocks/handlers/profiles';
import DashboardDesktopPage from './DashboardDesktopPage.vue';

vi.mock('vaul-vue', () => import('@/test/stubs/vaul'));

afterEach(() => setIsDesktopForTests(null));

function mountPage() {
  setIsDesktopForTests(true);
  const router = createTestRouter([
    { path: '/', component: { template: '<div />' } },
    { path: '/accounts', component: { template: '<div />' } },
    { path: '/dashboard/settings', component: { template: '<div />' } },
  ]);
  return renderWithProviders(DashboardDesktopPage, { router, provideAuth: { user: mockUser } });
}

describe('десктопная Главная', () => {
  it('показывает шапку страницы, которой нет в мобильной версии', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-desktop-header"]').exists()).toBe(true);
  });

  it('раскладывает контент на основную и боковую колонки', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-desktop-main"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="dashboard-desktop-aside"]').exists()).toBe(true);
  });

  it('не резервирует место под нижнюю навигацию', async () => {
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.html()).not.toContain('pb-28');
  });

  it('игнорирует компактный режим: он мобильная оптимизация', async () => {
    localStorage.setItem('dashboard_compact_mode', 'true');
    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.find('[data-testid="dashboard-desktop-main"]').exists()).toBe(true);
    localStorage.removeItem('dashboard_compact_mode');
  });

  describe('настройка hiddenWidgets', () => {
    it('прячет секцию «Счета» в основной колонке, когда accounts выключен в настройках', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            ...mockProfileResponse,
            dashboardSettings: {
              widgetOrder: [
                'quick_actions',
                'accounts',
                'top_expenses',
                'transactions',
                'budget',
                'debts',
              ],
              hiddenWidgets: ['accounts'],
              hiddenAccountIds: [],
            },
          }),
        ),
      );
      const wrapper = mountPage();
      await flushPromises();

      // Секция «Счета» скрыта, но боковая панель со своими виджетами осталась
      expect(wrapper.text()).not.toContain('Счета');
      expect(wrapper.find('[data-testid="dashboard-desktop-aside"]').exists()).toBe(true);
    });

    it('прячет секцию «Последние операции», когда transactions выключен в настройках', async () => {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            ...mockProfileResponse,
            dashboardSettings: {
              widgetOrder: [
                'quick_actions',
                'accounts',
                'top_expenses',
                'transactions',
                'budget',
                'debts',
              ],
              hiddenWidgets: ['transactions'],
              hiddenAccountIds: [],
            },
          }),
        ),
      );
      const wrapper = mountPage();
      await flushPromises();

      expect(wrapper.text()).not.toContain('Последние операции');
      expect(wrapper.find('[data-testid="dashboard-desktop-aside"]').exists()).toBe(true);
    });
  });

  describe('порядок виджетов из настроек', () => {
    /** Порядок блоков в основной колонке по тому, что раньше встречается в тексте. */
    async function mainColumnOrder(widgetOrder: string[]) {
      server.use(
        http.post('*/api/profiles/get-or-create', () =>
          HttpResponse.json({
            ...mockProfileResponse,
            dashboardSettings: { widgetOrder, hiddenWidgets: [], hiddenAccountIds: [] },
          }),
        ),
      );
      const wrapper = mountPage();
      await flushPromises();

      const text = wrapper.find('[data-testid="dashboard-desktop-main"]').text();
      return { accounts: text.indexOf('Счета'), transactions: text.indexOf('Последние операции') };
    }

    it('счета идут перед операциями, когда так задано в настройках', async () => {
      const { accounts, transactions } = await mainColumnOrder([
        'quick_actions',
        'accounts',
        'transactions',
        'budget',
      ]);

      expect(accounts).toBeGreaterThanOrEqual(0);
      expect(transactions).toBeGreaterThanOrEqual(0);
      expect(accounts).toBeLessThan(transactions);
    });

    it('операции идут перед счетами, когда порядок в настройках обратный', async () => {
      const { accounts, transactions } = await mainColumnOrder([
        'quick_actions',
        'transactions',
        'accounts',
        'budget',
      ]);

      expect(accounts).toBeGreaterThanOrEqual(0);
      expect(transactions).toBeGreaterThanOrEqual(0);
      expect(transactions).toBeLessThan(accounts);
    });
  });
});
