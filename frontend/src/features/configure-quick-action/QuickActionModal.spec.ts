import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import QuickActionModal from './ui/QuickActionModal.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';
import type { Category } from '@/entities/category';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAccounts: AccountWithBalances[] = [
  {
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
    balances: [
      { id: 'bal-1', account_id: 'acc-1', currency: 'UZS', balance: 50000, created_at: '' },
    ],
  },
];

const mockExpenseCategories: Category[] = [
  {
    id: 'cat-groceries',
    name: 'Продукты',
    icon: 'shopping_basket',
    color: '#10b981',
    type: 'expense',
  },
  {
    id: 'cat-transport',
    name: 'Транспорт',
    icon: 'directions_car',
    color: '#3b82f6',
    type: 'expense',
  },
];

/** Find element inside teleported dialog content */
function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

/** Get text content from document.body dialog */
function getDialogText(): string {
  return document.body.querySelector('[role="dialog"]')?.textContent ?? '';
}

/**
 * Render modal starting CLOSED (modelValue: false) then open it.
 * The QuickActionModal watch fires on modelValue false→true to initialize form state.
 */
async function renderAndOpen(props: Record<string, unknown> = {}) {
  const wrapper = renderWithProviders(QuickActionModal, {
    provideAuth: { user: mockUser },
    props: {
      modelValue: false,
      accounts: mockAccounts,
      expenseCategories: mockExpenseCategories,
      editAction: null,
      ...props,
    },
  });

  // Open the modal (triggers watch)
  await wrapper.setProps({ modelValue: true });
  await flushPromises();
  return wrapper;
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

// ===========================================================================
describe('QuickActionModal', () => {
  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('renders dialog in document.body when open', async () => {
      currentWrapper = await renderAndOpen();
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('shows "Новое действие" title for new action', async () => {
      currentWrapper = await renderAndOpen();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('title')).toBe('Новое действие');
    });

    it('shows "Изменить действие" title for edit', async () => {
      currentWrapper = await renderAndOpen({
        editAction: {
          id: 'qa-1',
          label: 'Продукты',
          categoryId: 'cat-groceries',
          accountId: 'acc-1',
        },
      });
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('title')).toBe('Изменить действие');
    });

    it('shows expense categories in teleported dialog', async () => {
      currentWrapper = await renderAndOpen();
      expect(getDialogText()).toContain('Продукты');
      expect(getDialogText()).toContain('Транспорт');
    });

    it('shows account selector in teleported dialog', async () => {
      currentWrapper = await renderAndOpen();
      expect(getDialogText()).toContain('Основной');
    });

    it('shows save button in teleported dialog', async () => {
      currentWrapper = await renderAndOpen();
      expect(findInBody('[data-testid="save-btn"]')).not.toBeNull();
    });

    it('hides delete button for new action', async () => {
      currentWrapper = await renderAndOpen();
      expect(findInBody('[data-testid="delete-btn"]')).toBeNull();
    });

    it('shows delete button in edit mode', async () => {
      currentWrapper = await renderAndOpen({
        editAction: {
          id: 'qa-1',
          label: 'Продукты',
          categoryId: 'cat-groceries',
          accountId: 'acc-1',
        },
      });
      expect(findInBody('[data-testid="delete-btn"]')).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------
  describe('validation', () => {
    it('save button is disabled without category selection (new mode)', async () => {
      currentWrapper = await renderAndOpen();
      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      // In new mode, no category is selected initially
      expect(saveBtn?.disabled).toBe(true);
    });

    it('save button becomes enabled after category chip clicked', async () => {
      currentWrapper = await renderAndOpen();

      // Click the Продукты category chip
      const categoryBtn = Array.from(document.body.querySelectorAll('[role="dialog"] button')).find(
        (b) => b.textContent?.trim() === 'Продукты',
      ) as HTMLButtonElement | undefined;
      expect(categoryBtn).toBeDefined();
      categoryBtn!.click();
      await nextTick();

      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      expect(saveBtn?.disabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Save event
  // -----------------------------------------------------------------------
  describe('save event', () => {
    it('emits save with category, account, and label when saved', async () => {
      currentWrapper = await renderAndOpen();

      // Select category
      const categoryBtn = Array.from(document.body.querySelectorAll('[role="dialog"] button')).find(
        (b) => b.textContent?.trim() === 'Продукты',
      ) as HTMLButtonElement | undefined;
      categoryBtn!.click();
      await nextTick();

      findInBody('[data-testid="save-btn"]')!.click();
      await nextTick();

      const saveEmit = currentWrapper.emitted('save');
      expect(saveEmit).toBeTruthy();
      const payload = saveEmit![0][0] as { label: string; categoryId: string; accountId: string };
      expect(payload.categoryId).toBe('cat-groceries');
      expect(payload.accountId).toBe('acc-1');
      expect(payload.label).toBe('Продукты');
    });

    it('emits update:modelValue=false after save', async () => {
      currentWrapper = await renderAndOpen();

      const categoryBtn = Array.from(document.body.querySelectorAll('[role="dialog"] button')).find(
        (b) => b.textContent?.trim() === 'Транспорт',
      ) as HTMLButtonElement | undefined;
      categoryBtn!.click();
      await nextTick();

      findInBody('[data-testid="save-btn"]')!.click();
      await nextTick();

      const closeEmit = currentWrapper.emitted('update:modelValue');
      expect(closeEmit).toBeTruthy();
      expect(closeEmit![0][0]).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Delete event
  // -----------------------------------------------------------------------
  describe('delete event', () => {
    it('emits delete when delete button clicked', async () => {
      currentWrapper = await renderAndOpen({
        editAction: {
          id: 'qa-1',
          label: 'Продукты',
          categoryId: 'cat-groceries',
          accountId: 'acc-1',
        },
      });

      findInBody('[data-testid="delete-btn"]')!.click();
      await nextTick();

      expect(currentWrapper.emitted('delete')).toBeTruthy();
    });

    it('emits update:modelValue=false after delete', async () => {
      currentWrapper = await renderAndOpen({
        editAction: {
          id: 'qa-1',
          label: 'Продукты',
          categoryId: 'cat-groceries',
          accountId: 'acc-1',
        },
      });

      findInBody('[data-testid="delete-btn"]')!.click();
      await nextTick();

      const closeEmit = currentWrapper.emitted('update:modelValue');
      expect(closeEmit).toBeTruthy();
      expect(closeEmit![0][0]).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Edit mode initialization
  // -----------------------------------------------------------------------
  describe('edit mode initialization', () => {
    it('save button is enabled in edit mode (both fields pre-selected via watch)', async () => {
      currentWrapper = await renderAndOpen({
        editAction: {
          id: 'qa-1',
          label: 'Продукты',
          categoryId: 'cat-groceries',
          accountId: 'acc-1',
        },
      });
      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      expect(saveBtn?.disabled).toBe(false);
    });

    it('shows correct save button text in edit mode', async () => {
      currentWrapper = await renderAndOpen({
        editAction: {
          id: 'qa-1',
          label: 'Продукты',
          categoryId: 'cat-groceries',
          accountId: 'acc-1',
        },
      });
      expect(findInBody('[data-testid="save-btn"]')?.textContent).toContain('Сохранить изменения');
    });

    it('shows correct save button text in create mode', async () => {
      currentWrapper = await renderAndOpen();
      expect(findInBody('[data-testid="save-btn"]')?.textContent).toContain('Добавить действие');
    });
  });

  // -----------------------------------------------------------------------
  // API integration
  // -----------------------------------------------------------------------
  describe('API integration', () => {
    it('emits correct save payload for POST quick-actions', async () => {
      currentWrapper = await renderAndOpen();

      const categoryBtn = Array.from(document.body.querySelectorAll('[role="dialog"] button')).find(
        (b) => b.textContent?.trim() === 'Продукты',
      ) as HTMLButtonElement | undefined;
      expect(categoryBtn).toBeDefined();
      categoryBtn!.click();
      await nextTick();

      findInBody('[data-testid="save-btn"]')!.click();
      await nextTick();

      const saveEmit = currentWrapper.emitted('save');
      expect(saveEmit).toBeTruthy();
      const payload = saveEmit![0][0] as Record<string, string>;
      expect(payload.categoryId).toBe('cat-groceries');
      expect(payload.accountId).toBe('acc-1');
      expect(payload.label).toBeTruthy();
    });
  });
});
