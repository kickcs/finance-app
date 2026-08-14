import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { mountComposable } from '@/test/test-utils';
import type { renderWithProviders } from '@/test/test-utils';
import type { Debt } from '@/shared/api/database.types';

// ── Mocks ──────────────────────────────────────────────────────────────────
// usePartialPayment is mocked wholesale — this composable's job is only to
// wire the drawer state/onClosed callback around it, not the payment logic.

const { makePartialPaymentMock, isPayingRef } = vi.hoisted(() => ({
  makePartialPaymentMock: vi.fn(),
  isPayingRef: { value: false },
}));

vi.mock('./usePartialPayment', () => ({
  usePartialPayment: () => ({
    isPaying: isPayingRef,
    error: { value: null },
    makePartialPayment: makePartialPaymentMock,
  }),
}));

import { useDebtPaymentFlow } from './useDebtPaymentFlow';

// ── Helpers ────────────────────────────────────────────────────────────────

const USER_ID = 'test-user-1';

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    user_id: USER_ID,
    name: 'Долг от Алексей',
    total_amount: 50000,
    remaining_amount: 30000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2025-01-15T12:00:00.000Z',
    debt_type: 'given',
    person_name: 'Алексей',
    account_id: 'acc-1',
    transaction_id: 'tx-debt-1',
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    fee_amount: 0,
    ...overrides,
  };
}

let currentWrapper: ReturnType<typeof renderWithProviders> | null = null;

function mount(...args: Parameters<typeof useDebtPaymentFlow>) {
  const { result, wrapper } = mountComposable(() => useDebtPaymentFlow(...args));
  currentWrapper = wrapper;
  return result;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useDebtPaymentFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPayingRef.value = false;
  });

  afterEach(async () => {
    currentWrapper?.unmount();
    currentWrapper = null;
    await flushPromises();
  });

  it('closes the drawer optimistically before the server responds', async () => {
    let resolvePayment!: (value: boolean) => void;
    makePartialPaymentMock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePayment = resolve;
        }),
    );

    const flow = mount({ userId: USER_ID, debt: ref(makeDebt()) });
    flow.open();
    expect(flow.isOpen.value).toBe(true);

    const submitPromise = flow.submit({ amount: 10000, accountId: 'acc-1' });

    // Synchronous — the drawer must already be closed before we await the response.
    expect(flow.isOpen.value).toBe(false);

    resolvePayment(true);
    await submitPromise;
  });

  it('does not call onClosed for a partial payment that leaves the debt open', async () => {
    makePartialPaymentMock.mockResolvedValue(true);
    const onClosed = vi.fn();
    const flow = mount({
      userId: USER_ID,
      debt: ref(makeDebt({ remaining_amount: 30000 })),
      onClosed,
    });

    await flow.submit({ amount: 10000, accountId: 'acc-1' });

    expect(onClosed).not.toHaveBeenCalled();
  });

  it('calls onClosed when the payment amount closes the debt', async () => {
    makePartialPaymentMock.mockResolvedValue(true);
    const onClosed = vi.fn();
    const flow = mount({
      userId: USER_ID,
      debt: ref(makeDebt({ remaining_amount: 10000 })),
      onClosed,
    });

    await flow.submit({ amount: 10000, accountId: 'acc-1' });

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('calls onClosed when forgiveRemainder is set, even for a smaller amount', async () => {
    makePartialPaymentMock.mockResolvedValue(true);
    const onClosed = vi.fn();
    const flow = mount({
      userId: USER_ID,
      debt: ref(makeDebt({ remaining_amount: 30000 })),
      onClosed,
    });

    await flow.submit({ amount: 5000, accountId: 'acc-1', forgiveRemainder: true });

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it('reopens the drawer with the entered values when the payment fails', async () => {
    makePartialPaymentMock.mockResolvedValue(false);
    const flow = mount({ userId: USER_ID, debt: ref(makeDebt()) });

    const payload = { amount: 10000, accountId: 'acc-1' };
    await flow.submit(payload);

    expect(flow.isOpen.value).toBe(true);
    expect(flow.draft.value).toEqual(payload);
  });

  it('clears draft on a successful payment', async () => {
    makePartialPaymentMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const flow = mount({ userId: USER_ID, debt: ref(makeDebt()) });

    await flow.submit({ amount: 10000, accountId: 'acc-1' });
    expect(flow.draft.value).not.toBeNull();

    await flow.submit({ amount: 10000, accountId: 'acc-1' });
    expect(flow.draft.value).toBeNull();
  });

  it('does nothing when there is no debt', async () => {
    const flow = mount({ userId: USER_ID, debt: ref(null) });

    await flow.submit({ amount: 10000, accountId: 'acc-1' });

    expect(makePartialPaymentMock).not.toHaveBeenCalled();
  });

  it('does nothing when there is no userId', async () => {
    const flow = mount({ userId: ref(null), debt: ref(makeDebt()) });

    await flow.submit({ amount: 10000, accountId: 'acc-1' });

    expect(makePartialPaymentMock).not.toHaveBeenCalled();
  });

  it('open() does not reset an existing draft', async () => {
    makePartialPaymentMock.mockResolvedValue(false);
    const flow = mount({ userId: USER_ID, debt: ref(makeDebt()) });

    const payload = { amount: 10000, accountId: 'acc-1' };
    await flow.submit(payload);
    expect(flow.draft.value).toEqual(payload);

    flow.open();

    expect(flow.draft.value).toEqual(payload);
    expect(flow.isOpen.value).toBe(true);
  });

  it('refuses to reopen while a payment is still in flight', async () => {
    // Шторка закрывается до ответа сервера, а кэш уже показывает уменьшенный
    // остаток — второй заход провёл бы платёж дважды.
    let resolvePayment!: (value: boolean) => void;
    makePartialPaymentMock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePayment = resolve;
        }),
    );

    const flow = mount({ userId: USER_ID, debt: ref(makeDebt()) });
    const submitPromise = flow.submit({ amount: 10000, accountId: 'acc-1' });

    isPayingRef.value = true;
    flow.open();
    expect(flow.isOpen.value).toBe(false);

    isPayingRef.value = false;
    resolvePayment(true);
    await submitPromise;

    flow.open();
    expect(flow.isOpen.value).toBe(true);
  });

  it('drops the draft when the drawer reopens for a different debt', async () => {
    // Список долгов держит один поток на все долги: черновик неудавшегося
    // платежа по одному долгу не должен подставиться в платёж по другому —
    // иначе «Внести платёж» открылся бы с чужой суммой и чужим счётом.
    makePartialPaymentMock.mockResolvedValue(false);
    const selected = ref<Debt | null>(makeDebt({ id: 'debt-a', remaining_amount: 30000 }));
    const flow = mount({ userId: USER_ID, debt: selected });

    const payload = { amount: 30000, accountId: 'acc-1' };
    await flow.submit(payload);
    expect(flow.draft.value).toEqual(payload);

    selected.value = makeDebt({ id: 'debt-b', remaining_amount: 5000, account_id: 'acc-2' });
    flow.open();

    expect(flow.draft.value).toBeNull();
    expect(flow.isOpen.value).toBe(true);
  });
});
