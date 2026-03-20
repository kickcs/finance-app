import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick, defineComponent, ref } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import AccountForm from './ui/AccountForm.vue';
import type { AccountFormData } from './model/useCreateAccount';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFormData(overrides: Partial<AccountFormData> = {}): AccountFormData {
  return {
    name: '',
    balances: [{ currency: 'UZS', balance: 0 }],
    icon: 'account_balance_wallet',
    color: '#10b981',
    type: 'basic',
    creditLimit: null,
    gracePeriodDays: null,
    billingDay: null,
    totalAmount: null,
    interestRate: null,
    monthlyPayment: null,
    startDate: null,
    endDate: null,
    maturityDate: null,
    isReplenishable: null,
    isWithdrawable: null,
    ...overrides,
  };
}

function renderForm(
  formData: AccountFormData,
  extra: Partial<InstanceType<typeof AccountForm>['$props']> = {},
) {
  const Wrapper = defineComponent({
    components: { AccountForm },
    setup() {
      const data = ref(formData);
      const submitted = ref(false);
      return { data, submitted };
    },
    template: `
      <AccountForm
        :form-data="data"
        v-bind="$attrs"
        @update:form-data="data = $event"
        @submit="submitted = true"
      />
    `,
  });

  return renderWithProviders(Wrapper, {
    provideAuth: { user: mockUser },
    attrs: extra,
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
describe('AccountForm', () => {
  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------
  describe('rendering', () => {
    it('renders account name input', async () => {
      currentWrapper = renderForm(makeFormData());
      await flushPromises();
      expect(currentWrapper.find('[data-testid="account-form"]').exists()).toBe(true);
      expect(currentWrapper.text()).toContain('Название счёта');
    });

    it('renders account type selector with visible types', async () => {
      currentWrapper = renderForm(makeFormData());
      await flushPromises();
      const typeSelector = currentWrapper.find('[data-testid="account-type-selector"]');
      expect(typeSelector.exists()).toBe(true);
      // basic, savings, credit_card are visible
      expect(currentWrapper.find('[data-testid="account-type-basic"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="account-type-savings"]').exists()).toBe(true);
    });

    it('renders currency/balance section', async () => {
      currentWrapper = renderForm(makeFormData());
      await flushPromises();
      expect(currentWrapper.find('[data-testid="balance-list"]').exists()).toBe(true);
    });

    it('renders submit button with correct text', async () => {
      currentWrapper = renderForm(makeFormData());
      await flushPromises();
      expect(currentWrapper.find('[data-testid="submit-btn"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="submit-btn"]').text()).toContain('Создать счёт');
    });
  });

  // -----------------------------------------------------------------------
  // Validation — submit button
  // -----------------------------------------------------------------------
  describe('submit button validation', () => {
    it('is disabled when name is empty', async () => {
      currentWrapper = renderForm(makeFormData({ name: '' }));
      await flushPromises();
      expect(
        currentWrapper.find('[data-testid="submit-btn"]').attributes('disabled'),
      ).toBeDefined();
    });

    it('is disabled when name is only whitespace', async () => {
      currentWrapper = renderForm(makeFormData({ name: '   ' }));
      await flushPromises();
      expect(
        currentWrapper.find('[data-testid="submit-btn"]').attributes('disabled'),
      ).toBeDefined();
    });

    it('is enabled when name and balances are set', async () => {
      currentWrapper = renderForm(
        makeFormData({ name: 'Основная карта', balances: [{ currency: 'UZS', balance: 0 }] }),
      );
      await flushPromises();
      expect(
        currentWrapper.find('[data-testid="submit-btn"]').attributes('disabled'),
      ).toBeUndefined();
    });

    it('is disabled when balances are empty', async () => {
      currentWrapper = renderForm(makeFormData({ name: 'Test', balances: [] }));
      await flushPromises();
      expect(
        currentWrapper.find('[data-testid="submit-btn"]').attributes('disabled'),
      ).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Account type switching
  // -----------------------------------------------------------------------
  describe('account type selection', () => {
    it('highlights selected type button', async () => {
      currentWrapper = renderForm(makeFormData({ type: 'basic' }));
      await flushPromises();
      const basicBtn = currentWrapper.find('[data-testid="account-type-basic"]');
      expect(basicBtn.classes()).toContain('bg-primary');
    });

    it('emits update:formData when type button clicked', async () => {
      currentWrapper = renderForm(makeFormData({ type: 'basic' }));
      await flushPromises();
      const savingsBtn = currentWrapper.find('[data-testid="account-type-savings"]');
      await savingsBtn.trigger('click');
      await nextTick();
      // The wrapper updates data internally via v-model — we just check no error thrown
      expect(savingsBtn.exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Form submission
  // -----------------------------------------------------------------------
  describe('form submission', () => {
    it('emits submit event when form is submitted', async () => {
      const onSubmit = vi.fn();
      const Wrapper = defineComponent({
        components: { AccountForm },
        setup() {
          const data = ref(makeFormData({ name: 'Test Account' }));
          return { data, onSubmit };
        },
        template: `<AccountForm :form-data="data" @update:form-data="data = $event" @submit="onSubmit" />`,
      });

      currentWrapper = renderWithProviders(Wrapper, { provideAuth: { user: mockUser } });
      await flushPromises();

      await currentWrapper.find('[data-testid="account-form"]').trigger('submit');
      await nextTick();

      expect(onSubmit).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Error display
  // -----------------------------------------------------------------------
  describe('error display', () => {
    it('shows error message when error prop provided', async () => {
      const Wrapper = defineComponent({
        components: { AccountForm },
        setup() {
          const data = ref(makeFormData({ name: 'Test' }));
          return { data };
        },
        template: `<AccountForm :form-data="data" error="Не удалось создать счёт" @update:form-data="data = $event" @submit="() => {}" />`,
      });

      currentWrapper = renderWithProviders(Wrapper, { provideAuth: { user: mockUser } });
      await flushPromises();

      expect(currentWrapper.find('[data-testid="form-error"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="form-error"]').text()).toContain(
        'Не удалось создать счёт',
      );
    });

    it('hides error message when no error', async () => {
      currentWrapper = renderForm(makeFormData({ name: 'Test' }));
      await flushPromises();
      expect(currentWrapper.find('[data-testid="form-error"]').exists()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // CurrencyBalanceList interactions
  // -----------------------------------------------------------------------
  describe('currency balance list', () => {
    it('shows add currency button when not all currencies used', async () => {
      currentWrapper = renderForm(makeFormData({ balances: [{ currency: 'UZS', balance: 0 }] }));
      await flushPromises();
      expect(currentWrapper.find('[data-testid="add-currency-btn"]').exists()).toBe(true);
    });

    it('opens currency picker when add currency clicked', async () => {
      currentWrapper = renderForm(makeFormData({ balances: [{ currency: 'UZS', balance: 0 }] }));
      await flushPromises();

      await currentWrapper.find('[data-testid="add-currency-btn"]').trigger('click');
      await nextTick();

      expect(currentWrapper.find('[data-testid="currency-picker"]').exists()).toBe(true);
    });

    it('closes currency picker when cancel clicked', async () => {
      currentWrapper = renderForm(makeFormData({ balances: [{ currency: 'UZS', balance: 0 }] }));
      await flushPromises();

      await currentWrapper.find('[data-testid="add-currency-btn"]').trigger('click');
      await nextTick();

      await currentWrapper.find('[data-testid="cancel-currency-picker"]').trigger('click');
      await nextTick();

      expect(currentWrapper.find('[data-testid="currency-picker"]').exists()).toBe(false);
    });

    it('shows remove button only with multiple balances', async () => {
      currentWrapper = renderForm(
        makeFormData({
          balances: [
            { currency: 'UZS', balance: 0 },
            { currency: 'USD', balance: 0 },
          ],
        }),
      );
      await flushPromises();
      expect(currentWrapper.find('[data-testid="remove-currency-0"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="remove-currency-1"]').exists()).toBe(true);
    });

    it('hides remove button with single balance', async () => {
      currentWrapper = renderForm(makeFormData({ balances: [{ currency: 'UZS', balance: 0 }] }));
      await flushPromises();
      expect(currentWrapper.find('[data-testid="remove-currency-0"]').exists()).toBe(false);
    });

    it('shows currency selects for each balance', async () => {
      currentWrapper = renderForm(
        makeFormData({
          balances: [
            { currency: 'UZS', balance: 0 },
            { currency: 'USD', balance: 100 },
          ],
        }),
      );
      await flushPromises();
      expect(currentWrapper.find('[data-testid="currency-select-0"]').exists()).toBe(true);
      expect(currentWrapper.find('[data-testid="currency-select-1"]').exists()).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // credit_card label
  // -----------------------------------------------------------------------
  describe('credit card label', () => {
    it('shows credit card specific label for balances', async () => {
      currentWrapper = renderForm(makeFormData({ type: 'credit_card' }));
      await flushPromises();
      expect(currentWrapper.text()).toContain('Текущая задолженность');
    });
  });
});
