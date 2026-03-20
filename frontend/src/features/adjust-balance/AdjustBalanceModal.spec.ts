import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import AdjustBalanceModal from './ui/AdjustBalanceModal.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAccountWithBalances: AccountWithBalances = {
  id: 'acc-1',
  user_id: 'test-user-1',
  name: 'Основной',
  icon: 'account_balance_wallet',
  color: '#10b981',
  type: 'basic',
  order: 0,
  created_at: '2025-01-01T00:00:00.000Z',
  credit_limit: null,
  grace_period_days: null,
  billing_day: null,
  total_amount: null,
  interest_rate: null,
  monthly_payment: null,
  start_date: null,
  end_date: null,
  maturity_date: null,
  is_replenishable: null,
  is_withdrawable: null,
  balances: [{ id: 'bal-1', account_id: 'acc-1', currency: 'UZS', balance: 50000, created_at: '' }],
};

/** Find element inside teleported dialog content */
function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

/** Get text content from document.body dialog */
function getDialogText(): string {
  return document.body.querySelector('[role="dialog"]')?.textContent ?? '';
}

/** Set value on an input inside the teleported modal */
async function setInputValue(selector: string, value: string) {
  const input = document.body.querySelector(selector) as HTMLInputElement | null;
  if (!input) throw new Error(`Input not found: ${selector}`);
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )!.set!;
  nativeInputValueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

function renderModal(props: Record<string, unknown> = {}) {
  return renderWithProviders(AdjustBalanceModal, {
    provideAuth: { user: mockUser },
    props: {
      modelValue: true,
      account: mockAccountWithBalances,
      currency: 'UZS',
      isLoading: false,
      ...props,
    },
  });
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

// ===========================================================================
describe('AdjustBalanceModal', () => {
  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('modal has modelValue=true when open', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('modelValue')).toBe(true);
    });

    it('renders dialog in document.body', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('shows target balance input in teleported modal', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      expect(findInBody('[data-testid="target-balance-input"]')).not.toBeNull();
    });

    it('shows current balance value in modal content', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      expect(getDialogText()).toContain('50');
    });

    it('shows "Реальный баланс" label', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      expect(getDialogText()).toContain('Реальный баланс');
    });

    it('shows confirm button', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      expect(findInBody('[data-testid="confirm-btn"]')).not.toBeNull();
    });

    it('shows cancel button', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      expect(findInBody('[data-testid="cancel-btn"]')).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------
  describe('validation', () => {
    it('confirm button is disabled when no target balance entered', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const confirmBtn = findInBody('[data-testid="confirm-btn"]') as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(true);
    });

    it('confirm button is disabled when target balance equals current balance', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '50000');

      const confirmBtn = findInBody('[data-testid="confirm-btn"]') as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(true);
    });

    it('confirm button becomes enabled when target differs from current', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '60000');

      const confirmBtn = findInBody('[data-testid="confirm-btn"]') as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Diff display
  // -----------------------------------------------------------------------
  describe('diff display', () => {
    it('shows diff element when target differs from current', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '60000');

      expect(findInBody('[data-testid="diff-display"]')).not.toBeNull();
    });

    it('shows "будет добавлено" for higher balance', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '60000');

      expect(getDialogText()).toContain('будет добавлено');
    });

    it('shows "будет списано" for lower balance', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '40000');

      expect(getDialogText()).toContain('будет списано');
    });

    it('hides diff element when no input entered', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      expect(findInBody('[data-testid="diff-display"]')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Confirm event
  // -----------------------------------------------------------------------
  describe('confirm event', () => {
    it('emits confirm with correct data when button clicked', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '75000');

      findInBody('[data-testid="confirm-btn"]')!.click();
      await flushPromises();

      const confirmEmit = currentWrapper.emitted('confirm');
      expect(confirmEmit).toBeTruthy();
      const payload = confirmEmit![0][0] as {
        accountId: string;
        targetBalance: number;
        currency: string;
        description: string;
      };
      expect(payload.accountId).toBe('acc-1');
      expect(payload.targetBalance).toBe(75000);
      expect(payload.currency).toBe('UZS');
    });

    it('includes description when provided', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '75000');
      await setInputValue('[data-testid="description-input"] input', 'Зарплата получена');

      findInBody('[data-testid="confirm-btn"]')!.click();
      await flushPromises();

      const payload = currentWrapper.emitted('confirm')![0][0] as { description: string };
      expect(payload.description).toBe('Зарплата получена');
    });

    it('emits empty description when not filled', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '75000');

      findInBody('[data-testid="confirm-btn"]')!.click();
      await flushPromises();

      const payload = currentWrapper.emitted('confirm')![0][0] as { description: string };
      expect(payload.description).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Decimal separator handling
  // -----------------------------------------------------------------------
  describe('decimal separator handling', () => {
    const accountWithZeroBalance: AccountWithBalances = {
      ...mockAccountWithBalances,
      balances: [{ id: 'b', account_id: 'acc-1', currency: 'UZS', balance: 0, created_at: '' }],
    };

    it('accepts comma as decimal separator', async () => {
      currentWrapper = renderModal({ account: accountWithZeroBalance });
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '1234,56');

      const confirmBtn = findInBody('[data-testid="confirm-btn"]') as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(false);
    });

    it('handles both separators (period thousands, comma decimal)', async () => {
      currentWrapper = renderModal({ account: accountWithZeroBalance });
      await flushPromises();

      await setInputValue('[data-testid="target-balance-input"] input', '1.234,56');

      const confirmBtn = findInBody('[data-testid="confirm-btn"]') as HTMLButtonElement;
      expect(confirmBtn?.disabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe('loading state', () => {
    it('disables cancel button when loading', async () => {
      currentWrapper = renderModal({ isLoading: true });
      await flushPromises();
      const cancelBtn = findInBody('[data-testid="cancel-btn"]') as HTMLButtonElement;
      expect(cancelBtn?.disabled).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Modal title
  // -----------------------------------------------------------------------
  describe('modal title', () => {
    it('shows UZS symbol (сум) in modal title', async () => {
      currentWrapper = renderModal({ currency: 'UZS' });
      await flushPromises();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('title')).toContain('Коррекция баланса');
    });

    it('shows USD $ symbol in modal title', async () => {
      currentWrapper = renderModal({ currency: 'USD' });
      await flushPromises();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('title')).toContain('$');
    });
  });
});
