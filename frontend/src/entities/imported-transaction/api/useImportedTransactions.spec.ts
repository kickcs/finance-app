import { describe, it, expect, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { useImportedTransactions } from './useImportedTransactions';

const INBOX_RESPONSE = {
  items: [
    {
      id: 'imp-1',
      type: 'expense',
      amount: 1700,
      currency: 'UZS',
      merchant: 'TRANSPORT TOLOV>TOS',
      cardMask: '*1951',
      occurredAt: '2026-06-12T17:11:00.000Z',
      balanceAfter: 12543101.08,
      status: 'pending',
      transactionId: null,
      suggestedAccountId: 'acc-1',
      suggestedCategoryId: 'cat-1',
      createdAt: '2026-06-12T17:12:00.000Z',
    },
  ],
  count: 1,
};

let wrapper: ReturnType<typeof renderWithProviders> | null = null;

function mountComposable() {
  let result!: ReturnType<typeof useImportedTransactions>;
  const Stub = defineComponent({
    setup() {
      result = useImportedTransactions(() => 'user-1');
      return () => h('div');
    },
  });
  wrapper = renderWithProviders(Stub);
  return result;
}

afterEach(async () => {
  server.resetHandlers();
  wrapper?.unmount();
  wrapper = null;
  await flushPromises();
});

describe('useImportedTransactions', () => {
  it('загружает инбокс и трансформирует в snake_case', async () => {
    server.use(http.get('*/api/telegram-import/inbox', () => HttpResponse.json(INBOX_RESPONSE)));
    const result = mountComposable();
    await flushPromises();
    expect(result.pendingCount.value).toBe(1);
    expect(result.items.value[0]).toMatchObject({
      id: 'imp-1',
      card_mask: '*1951',
      suggested_account_id: 'acc-1',
      suggested_category_id: 'cat-1',
      occurred_at: '2026-06-12T17:11:00.000Z',
    });
  });

  it('confirm отправляет payload и инвалидирует инбокс', async () => {
    let confirmBody: unknown = null;
    server.use(
      http.get('*/api/telegram-import/inbox', () => HttpResponse.json(INBOX_RESPONSE)),
      http.post('*/api/telegram-import/inbox/imp-1/confirm', async ({ request }) => {
        confirmBody = await request.json();
        return HttpResponse.json({ success: true, counterpartId: null });
      }),
    );
    const result = mountComposable();
    await flushPromises();
    await result.confirmImported('imp-1', { transactionId: 'tx-9', accountId: 'acc-1' });
    expect(confirmBody).toEqual({ transactionId: 'tx-9', accountId: 'acc-1' });
  });
});
