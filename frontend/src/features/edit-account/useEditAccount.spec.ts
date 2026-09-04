import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { renderWithProviders, mockUser } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockCreditCardAccountResponse } from '@/test/mocks/handlers/accounts';
import { useEditAccount } from './model/useEditAccount';

const { adjustBalanceMock, toastMock, invalidateAccountMock, invalidateTransactionMock } =
  vi.hoisted(() => ({
    adjustBalanceMock: vi.fn(),
    toastMock: vi.fn(),
    invalidateAccountMock: vi.fn(() => Promise.resolve()),
    invalidateTransactionMock: vi.fn(() => Promise.resolve()),
  }));

vi.mock('@/entities/transaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    transactionsApi: {
      ...(actual.transactionsApi as Record<string, unknown>),
      adjustBalance: adjustBalanceMock,
    },
  };
});

vi.mock('@/shared/ui', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/api/invalidation', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    invalidateAccountRelated: invalidateAccountMock,
    invalidateTransactionRelated: invalidateTransactionMock,
  };
});

/** Тот же acc-3, но с двумя валютами: UZS 300 000 и USD 200. */
const twoCurrencyAccountResponse = {
  ...mockCreditCardAccountResponse,
  balances: [
    {
      id: 'bal-3',
      accountId: 'acc-3',
      currency: 'UZS',
      balance: 300_000,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'bal-6',
      accountId: 'acc-3',
      currency: 'USD',
      balance: 200,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

function renderComposable() {
  let instance!: ReturnType<typeof useEditAccount>;
  const Wrapper = defineComponent({
    setup() {
      instance = useEditAccount(() => mockUser.id);
      return {};
    },
    template: '<div />',
  });
  const wrapper = renderWithProviders(Wrapper, { provideAuth: { user: mockUser } });
  return { wrapper, get: () => instance };
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  adjustBalanceMock.mockResolvedValue({});
  // acc-3: кредитка с балансом −120 000 UZS
  server.use(http.get('*/api/accounts', () => HttpResponse.json([mockCreditCardAccountResponse])));
});

afterEach(async () => {
  server.resetHandlers();
  currentWrapper?.unmount();
  currentWrapper = null;
  await flushPromises();
});

describe('useEditAccount.update', () => {
  it('без debtByCurrency корректировку не зовёт', async () => {
    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update('acc-3', { name: 'Новая' });
    expect(ok).toBe(true);
    expect(adjustBalanceMock).not.toHaveBeenCalled();
  });

  it('корректирует баланс до −долга после PATCH', async () => {
    const patchCalls: string[] = [];
    server.use(
      http.patch('*/api/accounts/:id', async () => {
        patchCalls.push('patch');
        return HttpResponse.json({ ...mockCreditCardAccountResponse });
      }),
    );
    adjustBalanceMock.mockImplementation(() => {
      patchCalls.push('adjust');
      return Promise.resolve({});
    });

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 2_000_000 } },
    );

    expect(ok).toBe(true);
    expect(patchCalls).toEqual(['patch', 'adjust']);
    expect(adjustBalanceMock).toHaveBeenCalledWith({
      accountId: 'acc-3',
      targetBalance: -2_000_000,
      currency: 'UZS',
      description: 'Перевод счёта в кредитную карту',
    });
  });

  it('пропускает валюту, где цель уже совпадает с балансом', async () => {
    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    // текущий баланс acc-3 = −120 000, цель −120 000
    const ok = await get().update('acc-3', {}, { debtByCurrency: { UZS: 120_000 } });

    expect(ok).toBe(true);
    expect(adjustBalanceMock).not.toHaveBeenCalled();
    expect(invalidateAccountMock).not.toHaveBeenCalled();
  });

  it('падение корректировки не отменяет смену типа: true + предупреждение', async () => {
    adjustBalanceMock.mockRejectedValue(new Error('boom'));

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 2_000_000 } },
    );

    expect(ok).toBe(true);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Счёт переведён, но баланс не скорректирован',
        variant: 'warning',
      }),
    );
  });

  it('падение второй валюты не отменяет инвалидацию кэша', async () => {
    server.use(http.get('*/api/accounts', () => HttpResponse.json([twoCurrencyAccountResponse])));
    adjustBalanceMock.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('boom'));

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 200_000, USD: 50 } },
    );

    expect(ok).toBe(true);
    expect(adjustBalanceMock).toHaveBeenCalledTimes(2);
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Счёт переведён, но баланс не скорректирован',
        variant: 'warning',
      }),
    );
    expect(invalidateAccountMock).toHaveBeenCalledTimes(1);
    expect(invalidateTransactionMock).toHaveBeenCalledTimes(1);
  });

  it('нулевой долг не обнуляет собственные деньги в этой валюте', async () => {
    server.use(http.get('*/api/accounts', () => HttpResponse.json([twoCurrencyAccountResponse])));

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 200_000, USD: 0 } },
    );

    expect(ok).toBe(true);
    expect(adjustBalanceMock).toHaveBeenCalledTimes(1);
    expect(adjustBalanceMock).toHaveBeenCalledWith({
      accountId: 'acc-3',
      targetBalance: -200_000,
      currency: 'UZS',
      description: 'Перевод счёта в кредитную карту',
    });
  });

  it('нулевой долг при отрицательном балансе выводит валюту в ноль', async () => {
    // acc-3 из фикстуры уже в минусе: −120 000 UZS
    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update('acc-3', { type: 'basic' }, { debtByCurrency: { UZS: 0 } });

    expect(ok).toBe(true);
    expect(adjustBalanceMock).toHaveBeenCalledWith({
      accountId: 'acc-3',
      targetBalance: 0,
      currency: 'UZS',
      description: 'Перевод счёта в кредитную карту',
    });
  });

  it('падение PATCH возвращает false и корректировку не зовёт', async () => {
    server.use(http.patch('*/api/accounts/:id', () => new HttpResponse(null, { status: 500 })));

    const { wrapper, get } = renderComposable();
    currentWrapper = wrapper;
    await flushPromises();

    const ok = await get().update(
      'acc-3',
      { type: 'credit_card' },
      { debtByCurrency: { UZS: 2_000_000 } },
    );

    expect(ok).toBe(false);
    expect(adjustBalanceMock).not.toHaveBeenCalled();
  });
});
