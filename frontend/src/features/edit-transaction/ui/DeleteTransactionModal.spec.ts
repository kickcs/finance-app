import { describe, it, expect, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { bodyText } from '@/test/test-utils';
import type { Transaction } from '@/shared/api/database.types';
import DeleteTransactionModal from './DeleteTransactionModal.vue';

const SETTLEMENT_WARNING =
  'Это запись расчёта по долгу — удалится весь расчёт целиком, а долгам этого расчёта вернётся остаток.';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    category_id: 'food',
    amount: 60000,
    currency: 'UZS',
    type: 'expense',
    account_id: 'acc-1',
    is_informational: false,
    settlement_id: null,
    payment_sibling: null,
    ...overrides,
  } as Transaction;
}

/** `UModal` уносит содержимое в портал — искать его надо в body, не в обёртке. */
async function mountModal(transaction: Transaction) {
  const wrapper = mount(DeleteTransactionModal, {
    props: { modelValue: true, transaction, currency: 'UZS' },
    attachTo: document.body,
  });
  await nextTick();
  return wrapper;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DeleteTransactionModal', () => {
  it('предупреждает, что запись расчёта по долгу уйдёт вместе со всем расчётом', async () => {
    await mountModal(
      makeTx({ category_id: 'debt_return_to_me', type: 'income', settlement_id: 's-1' }),
    );

    expect(bodyText()).toContain(SETTLEMENT_WARNING);
    // Баланс одного счёта — не вся правда: расчёт может трогать несколько записей
    expect(bodyText()).not.toContain('Баланс будет');
  });

  it('у обычной записи называет изменение баланса', async () => {
    await mountModal(makeTx());

    expect(bodyText()).toContain('Баланс будет увеличен на');
    expect(bodyText()).not.toContain(SETTLEMENT_WARNING);
  });
});
