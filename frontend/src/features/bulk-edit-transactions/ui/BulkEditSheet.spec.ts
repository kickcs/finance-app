import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import { transactionsApi, type BulkResult, type TransactionsSummary } from '@/entities/transaction';
import { queryClient } from '@/shared/api/queryClient';
import { useBulkEditFlow } from '../model/useBulkEditFlow';
import BulkEditSheet from './BulkEditSheet.vue';

// Закрытие настоящей шторки роняет jsdom — см. комментарий в стабе.
vi.mock('vaul-vue', async () => (await import('@/test/stubs/vaul')).vaulStub);

const summary: TransactionsSummary = {
  count: 10,
  eligible_count: 9,
  locked_count: 1,
  totals: [{ currency: 'UZS', amount: -420000 }],
  as_of: '2026-10-31T10:00:00.000Z',
};

const preview: BulkResult = {
  changed: 8,
  skipped: [{ reason: 'wrong_type', count: 1 }],
  balance_deltas: [],
  undo_token: null,
};

const categories: Category[] = [
  { id: 'taxi', name: 'Такси', icon: 'local_taxi', color: '#f59e0b', type: 'expense' },
  { id: 'transport', name: 'Транспорт', icon: 'directions_bus', color: '#0ea5e9', type: 'expense' },
  { id: 'salary', name: 'Зарплата', icon: 'payments', color: '#16a34a', type: 'income' },
];

const accounts = [
  {
    id: 'a-1',
    name: 'Карта',
    icon: 'credit_card',
    color: '#4f46e5',
    balances: [{ currency: 'UZS', balance: 100000 }],
  },
] as unknown as AccountWithBalances[];

const $ = <T extends Element = HTMLElement>(id: string) =>
  document.body.querySelector<T>(`[data-testid="${id}"]`);

function setup() {
  const flow = useBulkEditFlow({
    userId: 'u-1',
    filters: () => ({ category_ids: ['taxi'] }),
    summary: () => summary,
    refetchSummary: vi.fn().mockResolvedValue(summary),
    selectedIds: () => ['m-1', 'm-2'],
    scheduleDelete: vi.fn(),
  });
  const wrapper = mount(BulkEditSheet, {
    attachTo: document.body,
    props: {
      flow,
      scopeChips: [{ key: 'cat:taxi', label: 'Такси', icon: 'local_taxi', color: '#f59e0b' }],
      summary,
      categories,
      categoryTypes: ['expense'],
      sourceCategoryIds: ['taxi'],
      accounts,
      hashtags: ['кафе'],
    },
  });
  return { flow, wrapper };
}

describe('BulkEditSheet', () => {
  let wrapper: ReturnType<typeof mount> | null = null;

  beforeEach(() => queryClient.clear());
  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.restoreAllMocks();
  });

  it('«Изменить все»: охват с той же подписью, что на плашке, и заметка о строках вне правки', async () => {
    const ctx = setup();
    wrapper = ctx.wrapper;
    ctx.flow.openAll();
    await flushPromises();

    expect(document.body.textContent).toContain('Изменить все 9 операций');
    expect($('bulk-scope')?.textContent).toContain('10 операций, 1 не изменится');
    expect($('bulk-scope')?.textContent).toMatch(/[-−]420\s000\sUZS/);
    expect($('bulk-scope')?.textContent).toContain('Такси');
    expect($('bulk-locked-note')?.textContent).toMatch(/^\s*1 операция в выборку не входит/);
  });

  it('категория-цель: текущая недоступна, выбор ведёт на сводку с пропусками', async () => {
    const spy = vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(preview);
    const ctx = setup();
    wrapper = ctx.wrapper;
    ctx.flow.openAll();
    await flushPromises();

    $('bulk-verb-category')!.click();
    await flushPromises();
    expect($<HTMLButtonElement>('bulk-category-taxi')!.disabled).toBe(true);
    // Группы показываются только для типов выборки
    expect($('bulk-category-salary')).toBeNull();

    $('bulk-category-transport')!.click();
    await flushPromises();

    expect(spy.mock.calls[0][0]).toMatchObject({
      action: { kind: 'category', category_id: 'transport' },
      dryRun: true,
    });
    expect(document.body.textContent).toContain('Перенести в «Транспорт»');
    expect($('bulk-confirm-skip')?.textContent).toContain('1 операция другого типа');
    expect($('bulk-confirm-apply')?.textContent?.trim()).toBe('Перенести 8 операций');
  });

  it('«Назад» в шапке возвращает к списку действий', async () => {
    const ctx = setup();
    wrapper = ctx.wrapper;
    ctx.flow.openAll();
    await flushPromises();
    expect($('bulk-sheet-back')).toBeNull();

    $('bulk-verb-account')!.click();
    await flushPromises();
    // Область касания 44×44, хотя шапка шторки от неё не растёт
    expect($('bulk-sheet-back')!.className).toMatch(/\bsize-11\b/);
    $('bulk-sheet-back')!.click();
    await flushPromises();

    expect($('bulk-edit-sheet')?.dataset.step).toBe('scope');
  });

  it('тег из поля ввода уходит без решётки и пробелов', async () => {
    const spy = vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(preview);
    const ctx = setup();
    wrapper = ctx.wrapper;
    ctx.flow.openManual('tag');
    await flushPromises();

    const input = $<HTMLInputElement>('bulk-tag-input')!;
    input.value = '#кофе с собой';
    input.dispatchEvent(new Event('input'));
    await flushPromises();
    $('bulk-tag-add')!.click();
    await flushPromises();

    expect(spy.mock.calls[0][0]).toMatchObject({
      selection: { ids: ['m-1', 'm-2'] },
      action: { kind: 'tag', tag: 'кофе_с_собой' },
    });
  });

  it('«Ещё» в ручном выборе — только тег и удаление: остальное уже на панели', async () => {
    const ctx = setup();
    wrapper = ctx.wrapper;
    ctx.flow.openManual('verbs');
    await flushPromises();

    const verbs = [...document.body.querySelectorAll<HTMLElement>('[data-testid^="bulk-verb-"]')];
    expect(verbs.map((el) => el.dataset.testid)).toEqual(['bulk-verb-tag', 'bulk-verb-delete']);
  });

  it('«Изменить все» показывает все пять действий', async () => {
    const ctx = setup();
    wrapper = ctx.wrapper;
    ctx.flow.openAll();
    await flushPromises();

    expect(document.body.querySelectorAll('[data-testid^="bulk-verb-"]')).toHaveLength(5);
  });
});
