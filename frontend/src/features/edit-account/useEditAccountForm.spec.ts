import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { useEditAccountForm } from './model/useEditAccountForm';
import type { AccountWithBalances } from '@/shared/api/database.types';

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'u1',
    name: 'Основной',
    icon: 'account_balance_wallet',
    color: '#10b981',
    type: 'basic',
    order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
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
      { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 3_000_000, created_at: '' },
    ],
    ...over,
  } as AccountWithBalances;
}

function renderForm(account: AccountWithBalances) {
  let instance!: ReturnType<typeof useEditAccountForm>;
  const source = ref<AccountWithBalances | null>(account);
  const Wrapper = defineComponent({
    setup() {
      instance = useEditAccountForm(source);
      return {};
    },
    template: '<div />',
  });
  const wrapper = renderWithProviders(Wrapper, { provideAuth: { user: mockUser } });
  return { wrapper, source, get: () => instance };
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

describe('useEditAccountForm', () => {
  it('наполняется из счёта', () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    expect(get().formData.value.name).toBe('Основной');
    expect(get().formData.value.type).toBe('basic');
    expect(get().isDirty.value).toBe(false);
  });

  it('пустое имя и пробелы дают ошибку', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', '   ');
    await nextTick();
    expect(get().nameError.value).toBe('Название не может состоять из пробелов');
    expect(get().isValid.value).toBe(false);
  });

  it('слишком короткое и слишком длинное имя невалидны', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'A');
    await nextTick();
    expect(get().nameError.value).toBe('Минимум 2 символа');
    get().updateField('name', 'x'.repeat(51));
    await nextTick();
    expect(get().nameError.value).toBe('Максимум 50 символов');
  });

  it('isDirty реагирует на правку', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'Другой');
    await nextTick();
    expect(get().isDirty.value).toBe(true);
  });

  it('isConverting только при переходе из другого типа в кредитку', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    expect(get().isConverting.value).toBe(false);
    get().updateField('type', 'credit_card');
    await nextTick();
    expect(get().isConverting.value).toBe(true);
  });

  it('кредитка, которая уже кредитка, не конвертируется', async () => {
    const { wrapper, get } = renderForm(
      makeAccount({ type: 'credit_card', credit_limit: 10_000_000 }),
    );
    currentWrapper = wrapper;
    expect(get().isConverting.value).toBe(false);
  });

  it('долг первой валюты пересчитывается при смене лимита', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    await nextTick();
    get().updateField('creditLimit', 10_000_000);
    await nextTick();
    expect(get().debtByCurrency.value.UZS).toBe(7_000_000);
  });

  it('после ручной правки долг больше не пересчитывается', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    get().updateField('creditLimit', 10_000_000);
    await nextTick();
    get().setDebt('UZS', 1_000_000);
    await nextTick();
    get().updateField('creditLimit', 20_000_000);
    await nextTick();
    expect(get().debtByCurrency.value.UZS).toBe(1_000_000);
  });

  it('остальные валюты стартуют с нуля', async () => {
    const { wrapper, get } = renderForm(
      makeAccount({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 3_000_000, created_at: '' },
          { id: 'b2', account_id: 'acc-1', currency: 'USD', balance: 200, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    );
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    await nextTick();
    expect(get().debtByCurrency.value.USD).toBe(0);
  });

  it('buildUpdates отдаёт snake_case-патч', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', '  Кредитка  ');
    get().updateField('type', 'credit_card');
    get().updateField('creditLimit', 10_000_000);
    get().updateField('monthlyPayment', 500_000);
    await nextTick();
    const updates = get().buildUpdates();
    expect(updates.name).toBe('Кредитка');
    expect(updates.type).toBe('credit_card');
    expect(updates.credit_limit).toBe(10_000_000);
    expect(updates.monthly_payment).toBe(500_000);
  });

  it('смена типа сбрасывает поля чужого типа', async () => {
    const { wrapper, get } = renderForm(
      makeAccount({ type: 'deposit', interest_rate: 15, maturity_date: '2026-06-01' }),
    );
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    await nextTick();
    expect(get().formData.value.interestRate).toBeNull();
    expect(get().buildUpdates().interest_rate).toBeNull();
  });

  it('возврат к исходному типу восстанавливает его поля, но не трогает имя', async () => {
    const { wrapper, get } = renderForm(
      makeAccount({ type: 'deposit', interest_rate: 15, maturity_date: '2026-06-01' }),
    );
    currentWrapper = wrapper;
    get().updateField('name', 'Другой');
    get().updateField('type', 'credit_card');
    await nextTick();
    get().updateField('type', 'deposit');
    await nextTick();
    expect(get().formData.value.interestRate).toBe(15);
    expect(get().formData.value.name).toBe('Другой');
  });

  it('reset возвращает исходное состояние', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'Другой');
    await nextTick();
    get().reset();
    await nextTick();
    expect(get().formData.value.name).toBe('Основной');
    expect(get().isDirty.value).toBe(false);
  });

  it('фоновый рефетч того же счёта не стирает правки', async () => {
    const { wrapper, source, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'Черновик');
    await nextTick();
    // Тот же счёт, но новым объектом — так выглядит обновление кэша по рефетчу.
    source.value = makeAccount();
    await nextTick();
    expect(get().formData.value.name).toBe('Черновик');
  });

  it('грейс-период принимает только целое от 1 до 365', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    get().updateField('gracePeriodDays', 0);
    await nextTick();
    expect(get().typeFieldsError.value).toBe('Грейс-период — целое число от 1 до 365');
    expect(get().isValid.value).toBe(false);

    get().updateField('gracePeriodDays', 366);
    await nextTick();
    expect(get().typeFieldsError.value).toBe('Грейс-период — целое число от 1 до 365');

    get().updateField('gracePeriodDays', 55.5);
    await nextTick();
    expect(get().typeFieldsError.value).toBe('Грейс-период — целое число от 1 до 365');

    get().updateField('gracePeriodDays', 55);
    await nextTick();
    expect(get().typeFieldsError.value).toBeNull();
    expect(get().isValid.value).toBe(true);
  });

  it('день выписки принимает только целое от 1 до 31', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    get().updateField('billingDay', 32);
    await nextTick();
    expect(get().typeFieldsError.value).toBe('День выписки — целое число от 1 до 31');
    expect(get().isValid.value).toBe(false);

    get().updateField('billingDay', 5);
    await nextTick();
    expect(get().typeFieldsError.value).toBeNull();
  });

  it('пустые поля типа ошибкой не считаются', async () => {
    const { wrapper, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('type', 'credit_card');
    await nextTick();
    expect(get().typeFieldsError.value).toBeNull();
    expect(get().isValid.value).toBe(true);
  });

  it('смена счёта перезаполняет форму', async () => {
    const { wrapper, source, get } = renderForm(makeAccount());
    currentWrapper = wrapper;
    get().updateField('name', 'Другой');
    await nextTick();
    source.value = makeAccount({ id: 'acc-2', name: 'Наличные', type: 'cash' });
    await nextTick();
    expect(get().formData.value.name).toBe('Наличные');
    expect(get().formData.value.type).toBe('cash');
    expect(get().isDirty.value).toBe(false);
  });
});
