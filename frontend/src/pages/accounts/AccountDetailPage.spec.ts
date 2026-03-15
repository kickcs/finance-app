import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser, createTestRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import AccountDetailPage from './AccountDetailPage.vue';
import {
  mockAccountResponse,
  mockSecondAccountResponse,
  mockCreditCardAccountResponse,
} from '@/test/mocks/handlers/accounts';
import { mockAccountTransactionResponse } from '@/test/mocks/handlers/transactions';

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
  { path: '/accounts/:id', component: AccountDetailPage, name: 'account-detail' },
  { path: '/', component: { template: '<div />' }, name: 'home' },
  { path: '/accounts', component: { template: '<div />' }, name: 'accounts' },
  { path: '/transactions/new', component: { template: '<div />' }, name: 'new-transaction' },
];

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

async function renderPage(accountId: string = 'acc-1') {
  const router = createTestRouter(routes);
  router.push(`/accounts/${accountId}`);
  await router.isReady();

  currentWrapper = renderWithProviders(AccountDetailPage, {
    router,
    provideAuth: { user: mockUser },
  });
  await flushPromises();
  await flushPromises();
  return currentWrapper;
}

/** Helper: find the delete button (has !text-danger class) */
function findDeleteButton(wrapper: ReturnType<typeof renderWithProviders>) {
  const btns = wrapper
    .findAll('button')
    .filter((b) => b.classes().some((c) => c.includes('text-danger')));
  if (!btns.length) throw new Error('Delete button not found');
  return btns[0];
}

// ===========================================================================
describe('AccountDetailPage', () => {
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
    it('shows account name', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Основной');
    });

    it('shows account type label', async () => {
      // Use savings account to distinguish type label from account name
      server.use(http.get('*/api/accounts', () => HttpResponse.json([mockSecondAccountResponse])));
      const wrapper = await renderPage('acc-2');
      expect(wrapper.text()).toContain('Накопительный');
    });

    it('shows balance section', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Баланс');
    });

    it('shows formatted balance amount', async () => {
      const wrapper = await renderPage();
      // Account has 50000 UZS balance → formatted as "50\u00A0000"
      expect(wrapper.text()).toContain('50\u00A0000');
    });

    it('shows balance currency', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('UZS');
    });
  });

  // -----------------------------------------------------------------------
  // Not Found State
  // -----------------------------------------------------------------------
  describe('not found state', () => {
    it('shows not found and hides detail when account does not exist', async () => {
      const wrapper = await renderPage('non-existent-id');

      expect(wrapper.find('[data-testid="account-not-found"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="account-detail"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('Счёт не найден');
    });
  });

  // -----------------------------------------------------------------------
  // Multi-currency balances
  // -----------------------------------------------------------------------
  describe('multi-currency account', () => {
    it('shows balances for each currency', async () => {
      const multiCurrencyAccount = {
        ...mockAccountResponse,
        balances: [
          {
            id: 'bal-1',
            accountId: 'acc-1',
            currency: 'UZS',
            balance: 50000,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'bal-1b',
            accountId: 'acc-1',
            currency: 'USD',
            balance: 500,
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      };
      server.use(http.get('*/api/accounts', () => HttpResponse.json([multiCurrencyAccount])));
      const wrapper = await renderPage();

      expect(wrapper.text()).toContain('UZS');
      expect(wrapper.text()).toContain('USD');
    });
  });

  // -----------------------------------------------------------------------
  // Credit Card Account
  // -----------------------------------------------------------------------
  describe('credit card account', () => {
    beforeEach(() => {
      server.use(
        http.get('*/api/accounts', () => HttpResponse.json([mockCreditCardAccountResponse])),
      );
    });

    it('shows credit card specific info', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('Кредитная карта');
    });

    it('shows credit limit', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('Лимит');
    });

    it('shows available balance', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('Доступно');
    });

    it('shows debt label when balance is negative', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('Задолженность');
    });

    it('shows credit card parameters section', async () => {
      const wrapper = await renderPage('acc-3');
      expect(wrapper.text()).toContain('Параметры кредитной карты');
      expect(wrapper.text()).toContain('Грейс-период');
      expect(wrapper.text()).toContain('55 дней');
      expect(wrapper.text()).toContain('День выписки');
      expect(wrapper.text()).toContain('15-е число');
    });

    it('shows usage progress bar', async () => {
      const wrapper = await renderPage('acc-3');
      const progressbar = wrapper.find('[role="progressbar"]');
      expect(progressbar.exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Transactions Section
  // -----------------------------------------------------------------------
  describe('transactions section', () => {
    it('shows transactions header', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Транзакции');
    });

    it('shows empty state when no transactions', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Здесь пока пусто');
    });

    it('empty state has add transaction action', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Добавить');
    });

    it('shows transactions when present', async () => {
      server.use(
        http.get('*/api/transactions/by-account/:id/paginated', () =>
          HttpResponse.json({
            data: [mockAccountTransactionResponse],
            nextCursor: null,
            hasMore: false,
          }),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.text()).not.toContain('Здесь пока пусто');
    });
  });

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  describe('actions', () => {
    it('shows edit button', async () => {
      const wrapper = await renderPage();
      expect(wrapper.text()).toContain('Изменить');
    });

    it('shows delete button', async () => {
      const wrapper = await renderPage();
      expect(() => findDeleteButton(wrapper)).not.toThrow();
    });

    it('shows adjust balance button', async () => {
      const wrapper = await renderPage();
      const adjustBtn = wrapper.find('button[aria-label="Скорректировать баланс"]');
      expect(adjustBtn.exists()).toBe(true);
    });

    it('shows default account star button for non-default account', async () => {
      server.use(http.get('*/api/accounts', () => HttpResponse.json([mockSecondAccountResponse])));
      const wrapper = await renderPage('acc-2');

      const starBtn = wrapper.find('button[aria-label="Сделать по умолчанию"]');
      expect(starBtn.exists()).toBe(true);
    });

    it('shows filled star for default account', async () => {
      const wrapper = await renderPage();
      const starBtn = wrapper.find('button[aria-label="Сделать по умолчанию"]');
      expect(starBtn.exists()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Back Navigation
  // -----------------------------------------------------------------------
  describe('back navigation', () => {
    it('back navigates via navigateBack', async () => {
      const wrapper = await renderPage();
      const backBtn = wrapper.find('button[aria-label="Назад"]');
      expect(backBtn.exists()).toBe(true);
      await backBtn.trigger('click');
      expect(navigateBackMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edit Account Flow
  // -----------------------------------------------------------------------
  describe('edit account flow', () => {
    it('opens edit modal when edit button clicked', async () => {
      const wrapper = await renderPage();

      const editBtn = wrapper.findAll('button').find((b) => b.text().includes('Изменить'));
      expect(editBtn).toBeDefined();
      await editBtn!.trigger('click');

      const editModal = wrapper.findComponent({ name: 'EditAccountModal' });
      expect(editModal.exists()).toBe(true);
      expect(editModal.props('modelValue')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Delete Account Flow
  // -----------------------------------------------------------------------
  describe('delete account flow', () => {
    it('opens delete modal and passes account when delete button clicked', async () => {
      const wrapper = await renderPage();

      await findDeleteButton(wrapper).trigger('click');

      const deleteModal = wrapper.findComponent({ name: 'DeleteAccountModal' });
      expect(deleteModal.exists()).toBe(true);
      expect(deleteModal.props('modelValue')).toBe(true);
      expect(deleteModal.props('account')).toBeTruthy();
      expect(deleteModal.props('account').id).toBe('acc-1');
    });
  });

  // -----------------------------------------------------------------------
  // API Error Handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('handles account API error gracefully', async () => {
      server.use(
        http.get('*/api/accounts', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );
      const wrapper = await renderPage();

      expect(wrapper.find('[data-testid="account-not-found"]').exists()).toBe(true);
    });
  });
});
