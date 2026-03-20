import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import SetBudgetSheet from './ui/SetBudgetSheet.vue';
import { mockBudgetResponse } from '@/test/mocks/handlers/budgets';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find element inside teleported dialog content */
function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

/** Get text content from document.body dialog */
function getDialogText(): string {
  return document.body.querySelector('[role="dialog"]')?.textContent ?? '';
}

/** Set value on UInput's internal <input> inside teleported modal */
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

/**
 * Render sheet starting CLOSED then open it.
 * The SetBudgetSheet watch fires on modelValue false→true to sync amount.
 */
async function renderAndOpen(props: Record<string, unknown> = {}) {
  const wrapper = renderWithProviders(SetBudgetSheet, {
    provideAuth: { user: mockUser },
    props: {
      modelValue: false,
      currentAmount: undefined,
      isOverride: false,
      isSaving: false,
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
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

// ===========================================================================
describe('SetBudgetSheet', () => {
  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('renders dialog in document.body when open', async () => {
      currentWrapper = await renderAndOpen();
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it('shows "Установить бюджет" title when no current amount', async () => {
      currentWrapper = await renderAndOpen();
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('title')).toBe('Установить бюджет');
    });

    it('shows "Изменить бюджет" title when current amount provided', async () => {
      currentWrapper = await renderAndOpen({ currentAmount: 1000000 });
      const modal = currentWrapper.findComponent({ name: 'UModal' });
      expect(modal.props('title')).toBe('Изменить бюджет');
    });

    it('shows budget amount input', async () => {
      currentWrapper = await renderAndOpen();
      expect(findInBody('[data-testid="budget-amount-input"]')).not.toBeNull();
    });

    it('shows save button', async () => {
      currentWrapper = await renderAndOpen();
      expect(findInBody('[data-testid="save-btn"]')).not.toBeNull();
    });

    it('hides reset button when not override', async () => {
      currentWrapper = await renderAndOpen({ isOverride: false });
      expect(findInBody('[data-testid="reset-btn"]')).toBeNull();
    });

    it('shows reset button when isOverride is true', async () => {
      currentWrapper = await renderAndOpen({ isOverride: true, currentAmount: 500000 });
      expect(findInBody('[data-testid="reset-btn"]')).not.toBeNull();
    });

    it('shows "Сумма бюджета" label in dialog', async () => {
      currentWrapper = await renderAndOpen();
      expect(getDialogText()).toContain('Сумма бюджета');
    });
  });

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------
  describe('initialization', () => {
    it('pre-fills amount when currentAmount provided and modal opens', async () => {
      currentWrapper = await renderAndOpen({ currentAmount: 750000 });
      const input = findInBody('[data-testid="budget-amount-input"] input') as HTMLInputElement;
      // UInput currency variant formats the number with spaces
      expect(input?.value).toContain('750');
    });

    it('starts with empty input when no currentAmount', async () => {
      currentWrapper = await renderAndOpen();
      const input = findInBody('[data-testid="budget-amount-input"] input') as HTMLInputElement;
      expect(input?.value).toBe('');
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------
  describe('validation', () => {
    it('save button is disabled when no amount entered', async () => {
      currentWrapper = await renderAndOpen();
      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      expect(saveBtn?.disabled).toBe(true);
    });

    it('save button is disabled when amount is 0', async () => {
      currentWrapper = await renderAndOpen();

      await setInputValue('[data-testid="budget-amount-input"] input', '0');

      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      expect(saveBtn?.disabled).toBe(true);
    });

    it('save button becomes enabled with valid positive amount', async () => {
      currentWrapper = await renderAndOpen();

      await setInputValue('[data-testid="budget-amount-input"] input', '500000');

      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      expect(saveBtn?.disabled).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Save event
  // -----------------------------------------------------------------------
  describe('save event', () => {
    it('emits save with numeric amount when save clicked', async () => {
      currentWrapper = await renderAndOpen();

      await setInputValue('[data-testid="budget-amount-input"] input', '500000');

      findInBody('[data-testid="save-btn"]')!.click();
      await nextTick();

      const saveEmit = currentWrapper.emitted('save');
      expect(saveEmit).toBeTruthy();
      expect(saveEmit![0][0]).toBe(500000);
    });

    it('does not emit save when amount is empty', async () => {
      currentWrapper = await renderAndOpen();

      findInBody('[data-testid="save-btn"]')?.click();
      await nextTick();

      expect(currentWrapper.emitted('save')).toBeFalsy();
    });
  });

  // -----------------------------------------------------------------------
  // Reset event
  // -----------------------------------------------------------------------
  describe('reset event', () => {
    it('emits reset when reset button clicked', async () => {
      currentWrapper = await renderAndOpen({ isOverride: true, currentAmount: 500000 });

      findInBody('[data-testid="reset-btn"]')!.click();
      await nextTick();

      expect(currentWrapper.emitted('reset')).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  describe('loading state', () => {
    it('save button is disabled when isSaving', async () => {
      currentWrapper = await renderAndOpen({ isSaving: true, currentAmount: 500000 });
      const saveBtn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
      expect(saveBtn?.disabled).toBe(true);
    });

    it('reset button is disabled when isSaving', async () => {
      currentWrapper = await renderAndOpen({
        isSaving: true,
        isOverride: true,
        currentAmount: 500000,
      });
      const resetBtn = findInBody('[data-testid="reset-btn"]') as HTMLButtonElement;
      expect(resetBtn?.disabled).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // API integration
  // -----------------------------------------------------------------------
  describe('API integration', () => {
    it('emits correct save amount for PUT /api/budgets/default', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.put('*/api/budgets/default', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            budget: { ...mockBudgetResponse.budget, amount: capturedPayload.amount },
          });
        }),
      );

      // The component just emits 'save' — the parent calls the API
      currentWrapper = await renderAndOpen();

      await setInputValue('[data-testid="budget-amount-input"] input', '1000000');

      findInBody('[data-testid="save-btn"]')!.click();
      await nextTick();

      const saveEmit = currentWrapper.emitted('save');
      expect(saveEmit).toBeTruthy();
      expect(saveEmit![0][0]).toBe(1000000);
    });
  });
});
