import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import ReopenDebtModal from './ReopenDebtModal.vue';
import { makeDebt } from '@/test/fixtures/debt';
import { bodyText } from '@/test/test-utils';
import type { Debt, Transaction } from '@/shared/api/database.types';
import type { AccountWithBalances } from '@/entities/account';

const accounts = [
  { id: 'acc-1', name: 'Карта' },
  { id: 'acc-2', name: 'Наличные' },
] as unknown as AccountWithBalances[];

function makeRecord(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    description: 'Возврат долга',
    amount: 1000,
    currency: 'UZS',
    account_id: 'acc-1',
    is_informational: false,
    ...overrides,
  } as Transaction;
}

/** `UModal` уносит содержимое в портал — искать его надо в body, не в обёртке. */
async function mountModal(
  debt: Debt | null,
  closingRecords: Transaction[] = [],
  extraProps: Record<string, unknown> = {},
) {
  const wrapper = mount(ReopenDebtModal, {
    props: { modelValue: true, debt, closingRecords, accounts, ...extraProps },
    attachTo: document.body,
  });
  await nextTick();
  return wrapper;
}

const closedDebt = makeDebt({ is_closed: true, close_transaction_id: 'tx-1', person_name: 'Азиз' });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ReopenDebtModal', () => {
  it('перечисляет записи, которые снимет отмена', async () => {
    await mountModal(closedDebt, [makeRecord({ description: 'Возврат долга', amount: 1000 })]);

    expect(bodyText()).toContain('Возврат долга');
    expect(bodyText()).toContain('1 000');
  });

  it('называет счёт, чей баланс откатится', async () => {
    await mountModal(closedDebt, [makeRecord({ account_id: 'acc-2' })]);
    expect(bodyText()).toContain('«Наличные»');
  });

  it('перечисляет все затронутые счета, когда их несколько', async () => {
    await mountModal(closedDebt, [
      makeRecord({ id: 'tx-1', account_id: 'acc-1' }),
      makeRecord({ id: 'tx-2', account_id: 'acc-2' }),
    ]);

    expect(bodyText()).toContain('«Карта»');
    expect(bodyText()).toContain('«Наличные»');
  });

  // Прощение денег не двигало — обещать откат баланса тут было бы неправдой.
  it('информационные записи баланса не касались — так и написано', async () => {
    await mountModal(makeDebt({ is_closed: true, forgiven_amount: 500 }), [
      makeRecord({ is_informational: true }),
    ]);

    expect(bodyText()).toContain('баланса счёта они не касались');
    expect(bodyText()).not.toContain('вернётся к состоянию');
  });

  // Пустой список значит либо «снимать нечего», либо «ещё не приехало» —
  // различает их сам долг.
  it('пока записи не приехали, обещает откат и не утверждает, что снимать нечего', async () => {
    await mountModal(closedDebt, []);

    expect(bodyText()).toContain('платёж и, если остаток прощали, запись прощения');
    expect(bodyText()).toContain('Баланс счёта вернётся к состоянию до закрытия');
  });

  it('у долга без записей закрытия отмена только возвращает его в активные', async () => {
    await mountModal(makeDebt({ is_closed: true }), []);
    expect(bodyText()).toContain('Записей закрытия нет');
  });

  it('скрытый долг не называет человека', async () => {
    await mountModal(makeDebt({ is_closed: true, is_private: true }), []);
    expect(bodyText()).not.toContain('Азиз');
  });

  it('подтверждение отдаётся наружу, отказ закрывает окно', async () => {
    const w = await mountModal(closedDebt, [makeRecord()]);

    document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-reopen-btn"]')?.click();
    await nextTick();
    expect(w.emitted('confirm')).toHaveLength(1);

    [...document.body.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Оставить закрытым')
      ?.click();
    await nextTick();
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false]);
  });
});
