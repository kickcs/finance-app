import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockAccountResponse } from '@/test/mocks/handlers/accounts';
import { useCreateAccount } from './model/useCreateAccount';

// The composable uses a singleton queryClient from @/shared/api/queryClient,
// so we test it via a wrapper component with VueQuery context.

function renderComposable() {
  let instance: ReturnType<typeof useCreateAccount>;

  const Wrapper = defineComponent({
    setup() {
      instance = useCreateAccount();
      return {};
    },
    template: '<div />',
  });

  const wrapper = renderWithProviders(Wrapper, { provideAuth: { user: mockUser } });
  return { wrapper, get: () => instance! };
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

// ===========================================================================
describe('useCreateAccount', () => {
  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------
  describe('initial state', () => {
    it('starts with empty name', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      expect(get().formData.value.name).toBe('');
    });

    it('starts with UZS as primary currency', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      expect(get().formData.value.balances[0].currency).toBe('UZS');
    });

    it('starts with basic account type', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      expect(get().formData.value.type).toBe('basic');
    });

    it('isValid is false with empty name', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      expect(get().isValid.value).toBe(false);
    });

    it('isSubmitting starts as false', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      expect(get().isSubmitting.value).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------
  describe('validation', () => {
    it('isValid becomes true when name is set', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'My Account');
      expect(get().isValid.value).toBe(true);
    });

    it('nameError is null when name is empty (no typing yet)', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      expect(get().nameError.value).toBeNull();
    });

    it('nameError when name is only whitespace', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', '   ');
      expect(get().nameError.value).toBeTruthy();
    });

    it('nameError when name is single char (too short)', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'A');
      expect(get().nameError.value).toBeTruthy();
    });

    it('nameError is null when name is valid', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'My Account');
      expect(get().nameError.value).toBeNull();
    });

    it('nameError when name exceeds 50 chars', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'A'.repeat(51));
      expect(get().nameError.value).toBeTruthy();
    });
  });

  // -----------------------------------------------------------------------
  // Balance management
  // -----------------------------------------------------------------------
  describe('balance management', () => {
    it('addCurrency adds new balance entry', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().addCurrency('USD');
      expect(get().formData.value.balances).toHaveLength(2);
      expect(get().formData.value.balances[1].currency).toBe('USD');
    });

    it('addCurrency does not add duplicate currency', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().addCurrency('UZS'); // UZS already exists
      expect(get().formData.value.balances).toHaveLength(1);
    });

    it('removeCurrency removes entry by index', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().addCurrency('USD');
      get().removeCurrency(1);
      expect(get().formData.value.balances).toHaveLength(1);
      expect(get().formData.value.balances[0].currency).toBe('UZS');
    });

    it('removeCurrency does not remove last entry', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().removeCurrency(0);
      expect(get().formData.value.balances).toHaveLength(1);
    });

    it('updateBalance updates balance for index', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateBalance(0, 50000);
      expect(get().formData.value.balances[0].balance).toBe(50000);
    });

    it('updateCurrency updates currency for index', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateCurrency(0, 'EUR');
      expect(get().formData.value.balances[0].currency).toBe('EUR');
    });

    it('primaryCurrency reflects first balance currency', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      expect(get().primaryCurrency.value).toBe('UZS');
      get().updateCurrency(0, 'USD');
      expect(get().primaryCurrency.value).toBe('USD');
    });
  });

  // -----------------------------------------------------------------------
  // createAccount API call
  // -----------------------------------------------------------------------
  describe('createAccount', () => {
    it('returns account id on success', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/accounts', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            ...mockAccountResponse,
            id: 'new-acc-1',
            name: capturedPayload.name as string,
          });
        }),
      );

      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'My Account');

      const result = await get().createAccount('test-user-1');

      await flushPromises();
      expect(result).toBe('new-acc-1');
    });

    it('sends correct payload to API', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/accounts', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockAccountResponse, id: 'new-acc-2' });
        }),
      );

      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'Тестовый счёт');
      get().updateBalance(0, 100000);

      await get().createAccount('test-user-1');
      await flushPromises();

      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload!.name).toBe('Тестовый счёт');
      expect((capturedPayload!.balances as Array<{ balance: number }>)[0].balance).toBe(100000);
    });

    it('returns null when name is empty (invalid)', async () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      // name is empty, isValid = false
      const result = await get().createAccount('test-user-1');
      await flushPromises();
      expect(result).toBeNull();
    });

    it('sets error and returns null on API failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      server.use(
        http.post('*/api/accounts', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 }),
        ),
      );

      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'Test');

      const result = await get().createAccount('test-user-1');
      await flushPromises();

      expect(result).toBeNull();
      expect(get().error.value).toBeTruthy();
      consoleSpy.mockRestore();
    });

    it('negates credit card balance before sending (debt as positive input)', async () => {
      let capturedPayload: Record<string, unknown> | null = null;
      server.use(
        http.post('*/api/accounts', async ({ request }) => {
          capturedPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ...mockAccountResponse, id: 'cc-1', type: 'credit_card' });
        }),
      );

      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'Credit Card');
      get().updateField('type', 'credit_card');
      get().updateBalance(0, 50000); // User enters 50000 as debt

      await get().createAccount('test-user-1');
      await flushPromises();

      const balances = capturedPayload!.balances as Array<{ balance: number }>;
      expect(balances[0].balance).toBe(-50000); // should be negated
    });

    it('resets form after resetForm called', () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('name', 'Test');
      get().resetForm();
      expect(get().formData.value.name).toBe('');
      expect(get().error.value).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Type-specific fields reset
  // -----------------------------------------------------------------------
  describe('type-specific field clearing', () => {
    it('clears credit card fields when switching from credit_card to basic', async () => {
      const { wrapper, get } = renderComposable();
      currentWrapper = wrapper;
      get().updateField('type', 'credit_card');
      await nextTick();
      get().updateField('creditLimit', 500000);
      // Change type - the watch fires on next flush
      get().updateField('type', 'basic');
      await flushPromises();
      expect(get().formData.value.creditLimit).toBeNull();
    });
  });
});
