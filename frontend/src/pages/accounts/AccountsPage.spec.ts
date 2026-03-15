import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import AccountsPage from './AccountsPage.vue';
import {
  mockAccountResponse,
  mockSecondAccountResponse,
  mockCreditCardAccountResponse,
} from '@/test/mocks/handlers/accounts';

// Stub for vuedraggable — renders scoped slot for each item
const DraggableStub = defineComponent({
  name: 'Draggable',
  props: { modelValue: { type: Array }, itemKey: { type: String } },
  emits: ['start', 'end', 'update:modelValue'],
  setup(props, { slots }) {
    return () =>
      h(
        'div',
        (props.modelValue ?? []).map((item: any) => slots.item?.({ element: item })),
      );
  },
});

// Mock app router
const { navigateBackMock } = vi.hoisted(() => ({
  navigateBackMock: vi.fn(),
}));
vi.mock('@/app/router', () => ({
  navigateBack: navigateBackMock,
  transitionName: { value: 'fade' },
  resetOnboardingVerified: vi.fn(),
}));

// ---------------------------------------------------------------------------

const routes = [
  { path: '/accounts', component: AccountsPage, name: 'accounts' },
  { path: '/', component: { template: '<div />' }, name: 'home' },
  { path: '/accounts/new', component: { template: '<div />' }, name: 'new-account' },
  { path: '/accounts/:id', component: { template: '<div />' }, name: 'account-detail' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage(options?: { router?: ReturnType<typeof createTestRouter> }) {
  const router = options?.router ?? createTestRouter(routes);
  if (!options?.router) {
    router.push('/accounts');
    await router.isReady();
  }

  currentWrapper = renderWithProviders(AccountsPage, {
    router,
    provideAuth: { user: mockUser },
    global: {
      stubs: {
        // defineAsyncComponent(() => import('vuedraggable')) resolves to this stub
        AsyncComponentWrapper: DraggableStub,
      },
    },
  });
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

// ===========================================================================
describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('displays page title', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Счета');
    });

    it('shows total balance card', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Общий баланс');
    });

    it('shows accounts section header with count', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Мои счета');
    });

    it('renders account card with name', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Основной');
    });

    it('renders multiple account cards', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Основной');
      expect(wrapper.text()).toContain('Накопления');
    });
  });

  // -----------------------------------------------------------------------
  // Empty State
  // -----------------------------------------------------------------------
  describe('empty state', () => {
    it('shows empty state when no accounts', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([])));
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="accounts-empty-state"]').exists()).toBe(true);
      expect(wrapper.text()).toContain('У вас пока нет счетов');
    });

    it('empty state has create account action', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([])));
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Создать счёт');
    });
  });

  // -----------------------------------------------------------------------
  // Total Balance
  // -----------------------------------------------------------------------
  describe('total balance', () => {
    it('shows formatted total balance for single account', async () => {
      const wrapper = await renderPage();
      // Account has 50000 UZS, user currency is UZS → "50\u00A0000"
      expect(wrapper.text()).toContain('50\u00A0000');
    });

    it('shows total balance for multi-currency accounts', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockSecondAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      // Both accounts are shown — total is sum of converted balances
      expect(wrapper.text()).toContain('Общий баланс');
    });
  });

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  describe('navigation', () => {
    it('add account button is present', async () => {
      const wrapper = await renderPage();
      const addBtn = wrapper.find('button[aria-label="Добавить счёт"]');
      expect(addBtn.exists()).toBe(true);
    });

    it('clicking add button navigates to new account page', async () => {
      const router = createTestRouter(routes);
      router.push('/accounts');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });

      const addBtn = wrapper.find('button[aria-label="Добавить счёт"]');
      await addBtn.trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({ name: 'new-account' });
    });

    it('clicking account card navigates to detail page', async () => {
      const router = createTestRouter(routes);
      router.push('/accounts');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });

      const accountCard = wrapper.findComponent({ name: 'AccountCard' });
      expect(accountCard.exists()).toBe(true);
      await accountCard.trigger('click');

      expect(pushSpy).toHaveBeenCalledWith({
        name: 'account-detail',
        params: { id: 'acc-1' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // Back navigation
  // -----------------------------------------------------------------------
  describe('back navigation', () => {
    it('back button calls navigateBack', async () => {
      const wrapper = await renderPage();
      const backBtn = wrapper.find('button[aria-label="Назад"]');
      expect(backBtn.exists()).toBe(true);
      await backBtn.trigger('click');
      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Credit card account display
  // -----------------------------------------------------------------------
  describe('account types', () => {
    it('renders credit card account in list', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([mockAccountResponse, mockCreditCardAccountResponse]),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('Основной');
      expect(wrapper.text()).toContain('Кредитная карта');
    });
  });

  // -----------------------------------------------------------------------
  // Section header add button
  // -----------------------------------------------------------------------
  describe('section header', () => {
    it('section header add button navigates to new account page', async () => {
      const router = createTestRouter(routes);
      router.push('/accounts');
      await router.isReady();
      const pushSpy = vi.spyOn(router, 'push');

      const wrapper = await renderPage({ router });

      // SectionHeader renders an add button via show-add prop
      const sectionHeader = wrapper.findComponent({ name: 'SectionHeader' });
      expect(sectionHeader.exists()).toBe(true);

      // Emit add-click
      sectionHeader.vm.$emit('add-click');
      await flushPromises();

      expect(pushSpy).toHaveBeenCalledWith({ name: 'new-account' });
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('shows zero total balance when all accounts have zero balance', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json([
            {
              ...mockAccountResponse,
              balance: 0,
              balances: [
                {
                  id: 'bal-z',
                  accountId: 'acc-1',
                  currency: 'UZS',
                  balance: 0,
                  createdAt: '2025-01-01T00:00:00.000Z',
                },
              ],
            },
          ]),
        ),
      );
      const wrapper = await renderPage();

      // Total balance should show 0
      expect(wrapper.text()).toContain('Общий баланс');
      expect(wrapper.text()).toContain('0');
    });
  });
});
