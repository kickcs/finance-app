import { describe, it, expect, vi, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { formatCurrency } from '@/shared/lib/format/currency';
import { server } from '@/test/mocks/server';
import EditAccountDrawer from './ui/EditAccountDrawer.vue';
import type { AccountWithBalances } from '@/shared/api/database.types';

vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

function makeAccount(over: Partial<AccountWithBalances> = {}): AccountWithBalances {
  return {
    id: 'acc-1',
    user_id: 'test-user-1',
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

function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector(selector);
}

async function setBodyInputValue(selector: string, value: string) {
  const input = document.body.querySelector(selector) as HTMLInputElement | null;
  if (!input) throw new Error(`Input not found: ${selector}`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

function renderDrawer(props: Record<string, unknown> = {}) {
  return renderWithProviders(EditAccountDrawer, {
    provideAuth: { user: mockUser },
    props: { modelValue: true, account: makeAccount(), isUpdating: false, ...props },
  });
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  document.body.innerHTML = '';
  await flushPromises();
});

describe('EditAccountDrawer', () => {
  it('рисует форму в body с заголовком', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    expect(findInBody('[data-testid="edit-account-form"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Редактировать счёт');
  });

  it('предпросмотр показывает имя и подпись типа', async () => {
    currentWrapper = renderDrawer({ account: makeAccount({ name: 'Наличка', type: 'cash' }) });
    await flushPromises();
    const preview = findInBody('[data-testid="account-preview"]');
    expect(preview).not.toBeNull();
    expect(preview!.textContent).toContain('Наличка');
    expect(preview!.textContent).toContain('Наличные');
  });

  it('предпросмотр обновляется по мере ввода имени', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    await setBodyInputValue('[data-testid="account-name-input"] input', 'Кредитка');
    await flushPromises();
    expect(findInBody('[data-testid="account-preview"]')!.textContent).toContain('Кредитка');
  });

  it('«Сохранить» выключена без изменений', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    const btn = findInBody('[data-testid="save-btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('блока конвертации нет, пока тип не сменили на кредитку', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    expect(findInBody('[data-testid="conversion-block"]')).toBeNull();
  });

  it('блок конвертации появляется при смене типа на кредитку', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    (findInBody('[data-testid="account-type-credit_card"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(findInBody('[data-testid="conversion-block"]')).not.toBeNull();
    expect(document.body.textContent).toContain('Задолженность сейчас');
  });

  it('у счёта, который уже кредитка, блока конвертации нет', async () => {
    currentWrapper = renderDrawer({
      account: makeAccount({ type: 'credit_card', credit_limit: 10_000_000 }),
    });
    await flushPromises();
    expect(findInBody('[data-testid="conversion-block"]')).toBeNull();
  });

  it('долг предзаполняется и пересчитывается при смене лимита', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    (findInBody('[data-testid="account-type-credit_card"]') as HTMLButtonElement).click();
    await flushPromises();

    await setBodyInputValue('[data-testid="credit-limit-input"] input', '10000000');
    await flushPromises();

    const debtInput = findInBody('[data-testid="debt-input-UZS"] input') as HTMLInputElement;
    expect(debtInput.value.replace(/\s/g, '')).toBe('7000000');
  });

  it('confirm отдаёт updates и debtByCurrency', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    (findInBody('[data-testid="account-type-credit_card"]') as HTMLButtonElement).click();
    await flushPromises();
    await setBodyInputValue('[data-testid="credit-limit-input"] input', '10000000');
    await flushPromises();

    (findInBody('[data-testid="save-btn"]') as HTMLButtonElement).click();
    await flushPromises();

    const emitted = currentWrapper.emitted('confirm') as unknown[][] | undefined;
    expect(emitted).toBeDefined();
    const [updates, debts] = emitted![0] as [Record<string, unknown>, Record<string, number>];
    expect(updates.type).toBe('credit_card');
    expect(updates.credit_limit).toBe(10_000_000);
    expect(debts).toEqual({ UZS: 7_000_000 });
  });

  it('строка исхода считается по каждой валюте отдельно', async () => {
    currentWrapper = renderDrawer({
      account: makeAccount({
        balances: [
          { id: 'b1', account_id: 'acc-1', currency: 'UZS', balance: 3_000_000, created_at: '' },
          { id: 'b2', account_id: 'acc-1', currency: 'USD', balance: 500, created_at: '' },
        ],
      } as Partial<AccountWithBalances>),
    });
    await flushPromises();
    (findInBody('[data-testid="account-type-credit_card"]') as HTMLButtonElement).click();
    await flushPromises();
    await setBodyInputValue('[data-testid="credit-limit-input"] input', '10000000');
    await flushPromises();

    const uzs = findInBody('[data-testid="debt-input-UZS"]')!;
    expect(uzs.textContent).toContain(`Баланс станет ${formatCurrency(-7_000_000, 'UZS')}`);

    // USD не трогаем: долг ноль, а свои деньги на счёте обнулять не за что.
    const usd = findInBody('[data-testid="debt-input-USD"]')!;
    expect(usd.textContent).toContain('Баланс не изменится');
  });

  it('без счёта форма не рисуется и в консоль ничего не падает', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    currentWrapper = renderDrawer({ account: null });
    await flushPromises();

    expect(findInBody('[data-testid="edit-account-form"]')).toBeNull();
    expect(document.body.textContent).toContain('Редактировать счёт');
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();

    warn.mockRestore();
    error.mockRestore();
  });

  it('повторное открытие возвращает сохранённые значения', async () => {
    currentWrapper = renderDrawer();
    await flushPromises();
    await setBodyInputValue('[data-testid="account-name-input"] input', 'Черновик');
    await flushPromises();
    expect(findInBody('[data-testid="account-preview"]')!.textContent).toContain('Черновик');

    await currentWrapper.setProps({ modelValue: false });
    await flushPromises();
    await currentWrapper.setProps({ modelValue: true });
    await flushPromises();

    const name = findInBody('[data-testid="account-name-input"] input') as HTMLInputElement;
    expect(name.value).toBe('Основной');
    expect(findInBody('[data-testid="account-preview"]')!.textContent).toContain('Основной');
  });
});
