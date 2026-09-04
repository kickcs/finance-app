import { describe, it, expect, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import AccountTypeFields from './AccountTypeFields.vue';
import type { AccountTypeFieldValues } from '../model/types';

const EMPTY: AccountTypeFieldValues = {
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
};

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

function render(type: string, fields: Partial<AccountTypeFieldValues> = {}) {
  return renderWithProviders(AccountTypeFields, {
    provideAuth: { user: mockUser },
    props: { type, fields: { ...EMPTY, ...fields } },
  });
}

describe('AccountTypeFields — кредитная карта', () => {
  it('показывает лимит, минимальный платёж, грейс и день выписки', async () => {
    currentWrapper = render('credit_card');
    await flushPromises();
    const text = currentWrapper.text();
    expect(text).toContain('Кредитный лимит');
    expect(text).toContain('Минимальный платёж');
    expect(text).toContain('Грейс-период (дней)');
    expect(text).toContain('День выписки');
  });

  it('не показывает поля кредита и вклада', async () => {
    currentWrapper = render('credit_card');
    await flushPromises();
    expect(currentWrapper.text()).not.toContain('Сумма кредита');
    expect(currentWrapper.text()).not.toContain('Ставка (%)');
  });

  it('минимальный платёж пишется в monthlyPayment', async () => {
    currentWrapper = render('credit_card');
    await flushPromises();
    const labels = currentWrapper.findAll('label');
    const paymentLabel = labels.find((l) => l.text().includes('Минимальный платёж'));
    expect(paymentLabel).toBeDefined();
    const inputId = paymentLabel!.attributes('for');
    const input = currentWrapper.find(`#${inputId}`);
    await input.setValue('500000');
    const emitted = currentWrapper.emitted('update:field') as unknown[][] | undefined;
    expect(emitted).toBeDefined();
    expect(emitted!.some((args) => args[0] === 'monthlyPayment' && args[1] === 500000)).toBe(true);
  });

  it('заполненные значения приходят в поля', async () => {
    currentWrapper = render('credit_card', {
      creditLimit: 10000000,
      monthlyPayment: 500000,
      gracePeriodDays: 55,
      billingDay: 5,
    });
    await flushPromises();
    const values = currentWrapper
      .findAll('input')
      .map((i) => (i.element as HTMLInputElement).value);
    expect(values).toContain('55');
    expect(values).toContain('5');
  });

  it('для loan разметка не изменилась', async () => {
    currentWrapper = render('loan');
    await flushPromises();
    expect(currentWrapper.text()).toContain('Сумма кредита');
    expect(currentWrapper.text()).toContain('Ежемесячный платёж');
  });
});
