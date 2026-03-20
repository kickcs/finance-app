import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import EditAccountModal from './ui/EditAccountModal.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAccount: AccountWithBalances = {
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

/** Set value on UInput's internal <input> inside teleported modal */
async function setModalInputValue(selector: string, value: string) {
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
  return renderWithProviders(EditAccountModal, {
    provideAuth: { user: mockUser },
    props: {
      modelValue: true,
      account: mockAccount,
      isUpdating: false,
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
describe('EditAccountModal', () => {
  // -----------------------------------------------------------------------
  // Rendering via component prop inspection
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('has modelValue=true when open', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.exists()).toBe(true);
      expect(modal.props('modelValue')).toBe(true);
    });

    it('has correct title "Редактировать счёт"', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('title')).toBe('Редактировать счёт');
    });

    it('renders teleported form content in document.body when open', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      // The form content is teleported — find via document.body
      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
    });

    it('renders account name input in teleported modal', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const nameInput = findInBody('[data-testid="account-name-input"] input');
      expect(nameInput).not.toBeNull();
    });

    it('shows account name pre-filled from account prop', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const nameInput = findInBody('[data-testid="account-name-input"] input') as HTMLInputElement;
      expect(nameInput?.value).toBe('Основной');
    });

    it('renders type selector in modal', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const typeSelector = findInBody('[data-testid="account-type-selector"]');
      expect(typeSelector).not.toBeNull();
    });

    it('renders save button in modal', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const saveBtn = findInBody('[data-testid="save-btn"]');
      expect(saveBtn).not.toBeNull();
    });

    it('renders cancel button in modal', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const cancelBtn = findInBody('[data-testid="cancel-btn"]');
      expect(cancelBtn).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Initialization from account prop
  // -----------------------------------------------------------------------
  describe('initialization', () => {
    it('pre-selects basic type for basic account', async () => {
      currentWrapper = renderModal();
      await flushPromises();
      const basicBtn = findInBody('[data-testid="account-type-basic"]');
      expect(basicBtn?.classList.toString()).toContain('bg-primary');
    });

    it('pre-selects savings type when account is savings', async () => {
      currentWrapper = renderModal({ account: { ...mockAccount, type: 'savings' } });
      await flushPromises();
      const savingsBtn = findInBody('[data-testid="account-type-savings"]');
      expect(savingsBtn?.classList.toString()).toContain('bg-primary');
    });

    it('pre-fills name from account prop', async () => {
      currentWrapper = renderModal({ account: { ...mockAccount, name: 'Накопления' } });
      await flushPromises();
      const nameInput = findInBody('[data-testid="account-name-input"] input') as HTMLInputElement;
      expect(nameInput?.value).toBe('Накопления');
    });
  });

  // -----------------------------------------------------------------------
  // Emitted events
  // -----------------------------------------------------------------------
  describe('events', () => {
    it('emits confirm with updated name when save clicked', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      // Update name via native input event in teleported modal
      await setModalInputValue('[data-testid="account-name-input"] input', 'Новое название');

      const saveBtn = findInBody('[data-testid="save-btn"]');
      saveBtn!.click();
      await flushPromises();

      const confirmEmit = currentWrapper.emitted('confirm');
      expect(confirmEmit).toBeTruthy();
      expect((confirmEmit![0][0] as { name: string }).name).toBe('Новое название');
    });

    it('emits cancel when cancel button clicked', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      const cancelBtn = findInBody('[data-testid="cancel-btn"]');
      cancelBtn!.click();
      await nextTick();

      expect(currentWrapper.emitted('cancel')).toBeTruthy();
    });

    it('save button is disabled when name is empty', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setModalInputValue('[data-testid="account-name-input"] input', '');

      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      expect(saveBtn?.disabled).toBe(true);
    });

    it('emits confirm payload with all required account fields', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      const saveBtn = findInBody('[data-testid="save-btn"]');
      saveBtn!.click();
      await flushPromises();

      const confirmEmit = currentWrapper.emitted('confirm');
      expect(confirmEmit).toBeTruthy();
      const payload = confirmEmit![0][0] as Record<string, unknown>;
      expect(payload.name).toBeDefined();
      expect(payload.icon).toBeDefined();
      expect(payload.color).toBeDefined();
      expect(payload.type).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Not rendered when account is null
  // -----------------------------------------------------------------------
  describe('null account', () => {
    it('does not render form content when account is null', async () => {
      currentWrapper = renderModal({ account: null });
      await flushPromises();
      const form = findInBody('[data-testid="edit-account-form"]');
      expect(form).toBeNull();
    });

    it('modal still has modelValue=true when account is null', async () => {
      currentWrapper = renderModal({ account: null });
      await flushPromises();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('modelValue')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Update payload
  // -----------------------------------------------------------------------
  describe('update payload correctness', () => {
    it('confirm payload name is trimmed', async () => {
      currentWrapper = renderModal();
      await flushPromises();

      await setModalInputValue('[data-testid="account-name-input"] input', '  Обновлённый счёт  ');

      const saveBtn = findInBody('[data-testid="save-btn"]');
      saveBtn!.click();
      await flushPromises();

      const confirmEmit = currentWrapper.emitted('confirm');
      expect(confirmEmit).toBeTruthy();
      expect((confirmEmit![0][0] as { name: string }).name).toBe('Обновлённый счёт');
    });
  });
});
