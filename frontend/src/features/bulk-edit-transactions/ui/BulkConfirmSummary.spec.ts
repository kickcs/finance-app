import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import BulkConfirmSummary from './BulkConfirmSummary.vue';

const accounts = [
  {
    id: 'a-1',
    name: 'Карта',
    icon: 'credit_card',
    color: '#4f46e5',
    balances: [{ currency: 'UZS', balance: 100000 }],
  },
  {
    id: 'a-2',
    name: 'Копилка',
    icon: 'savings',
    color: '#16a34a',
    balances: [{ currency: 'UZS', balance: 0 }],
  },
] as unknown as AccountWithBalances[];

describe('BulkConfirmSummary', () => {
  it('показывает пропуски и изменения балансов из предпросмотра', () => {
    const wrapper = mount(BulkConfirmSummary, {
      props: {
        action: { kind: 'account', account_id: 'a-2' },
        targetName: 'Копилка',
        categories: [],
        accounts,
        preview: {
          status: 'ready',
          result: {
            changed: 3,
            skipped: [
              { reason: 'same_account', count: 2 },
              { reason: 'transfer_not_movable', count: 1 },
            ],
            balance_deltas: [
              { account_id: 'a-1', currency: 'UZS', delta: 15000 },
              { account_id: 'a-2', currency: 'UZS', delta: -15000 },
            ],
            undo_token: null,
          },
        },
      },
    });

    const skips = wrapper.findAll('[data-testid="bulk-confirm-skip"]').map((n) => n.text());
    expect(skips).toEqual([
      '2 операции уже на этом счёте',
      '1 перевод нельзя перенести на другой счёт',
    ]);
    const text = wrapper.text().replace(/\s+/g, ' ');
    expect(text).toContain('Карта (UZS)');
    expect(text).toMatch(/100 000 → 115 000/);
    expect(text).toContain('Копилка (UZS)');
    expect(text).toMatch(/0 → [-−]15 000/);
  });

  it('перенос из одной категории показывает её слева, иначе — число операций', async () => {
    const categories = [
      { id: 'c-taxi', name: 'Такси', icon: 'local_taxi', color: '#f59e0b', type: 'expense' },
      {
        id: 'c-transport',
        name: 'Транспорт',
        icon: 'directions_bus',
        color: '#3b82f6',
        type: 'expense',
      },
    ] as unknown as Category[];
    const preview = {
      status: 'ready' as const,
      result: { changed: 9, skipped: [], balance_deltas: [], undo_token: null },
    };
    const wrapper = mount(BulkConfirmSummary, {
      props: {
        action: { kind: 'category', category_id: 'c-transport' },
        targetName: 'Транспорт',
        categories,
        accounts,
        preview,
        sourceCategoryId: 'c-taxi',
      },
    });
    const flow = () =>
      wrapper.find('[data-testid="bulk-confirm-flow"]').text().replace(/\s+/g, ' ');
    expect(flow()).toMatch(/^Такси.*Транспорт$/);

    await wrapper.setProps({ sourceCategoryId: undefined });
    expect(flow()).toMatch(/^9 операций.*Транспорт$/);
  });

  it('пока сводка считается — скелетон, ошибка — текстом сервера', async () => {
    const wrapper = mount(BulkConfirmSummary, {
      props: {
        action: { kind: 'delete' },
        categories: [],
        accounts,
        preview: { status: 'loading' },
      },
    });
    expect(wrapper.find('[data-testid="bulk-confirm-skeleton"]').exists()).toBe(true);

    await wrapper.setProps({ preview: { status: 'error', message: 'Сузьте фильтр' } });
    expect(wrapper.find('[role="alert"]').text()).toBe('Сузьте фильтр');
  });
});
