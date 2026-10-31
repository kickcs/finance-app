import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import type { TransactionsSummary } from '@/entities/transaction';
import BulkDock from './BulkDock.vue';

const summary: TransactionsSummary = {
  count: 10,
  eligible_count: 9,
  locked_count: 1,
  totals: [{ currency: 'UZS', amount: -420000 }],
  as_of: '2026-10-31T10:00:00.000Z',
};

const text = (wrapper: ReturnType<typeof mount>, id: string) =>
  wrapper.find(`[data-testid="${id}"]`).text().replace(/\s+/g, ' ');

describe('BulkDock', () => {
  it('подпись и число на кнопке сходятся: строки вне правки названы отдельно', () => {
    const wrapper = mount(BulkDock, { props: { summary, isFiltered: true } });

    expect(wrapper.text()).toContain('10 операций, 1 не изменится');
    expect(text(wrapper, 'bulk-edit-all-btn')).toBe('Изменить все 9');
  });

  it('без строк вне правки подпись говорит «по фильтру»', () => {
    const wrapper = mount(BulkDock, {
      props: { summary: { ...summary, count: 9, locked_count: 0 }, isFiltered: true },
    });

    expect(wrapper.text()).toContain('9 операций по фильтру');
    expect(text(wrapper, 'bulk-edit-all-btn')).toBe('Изменить все 9');
  });

  it('без фильтра «Изменить все» нет, только ручной выбор', () => {
    const wrapper = mount(BulkDock, { props: { summary, isFiltered: false } });

    expect(wrapper.find('[data-testid="bulk-edit-all-btn"]').exists()).toBe(false);
    expect(text(wrapper, 'bulk-select-btn')).toBe('Выбрать');
  });

  it('когда менять нечего, «Изменить все» не предлагается', () => {
    const wrapper = mount(BulkDock, {
      props: { summary: { ...summary, count: 1, eligible_count: 0 }, isFiltered: true },
    });

    expect(wrapper.find('[data-testid="bulk-edit-all-btn"]').exists()).toBe(false);
  });

  it('пока итога нет — скелетон, кнопки не дают открыть пустую шторку', () => {
    const wrapper = mount(BulkDock, { props: { isFiltered: true } });

    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="bulk-edit-all-btn"]').exists()).toBe(false);
  });

  it('пока считается новый фильтр, «Изменить все» с прежним числом недоступно', () => {
    const wrapper = mount(BulkDock, { props: { summary, isFiltered: true, stale: true } });

    expect(
      wrapper.find<HTMLButtonElement>('[data-testid="bulk-edit-all-btn"]').element.disabled,
    ).toBe(true);
  });
});
