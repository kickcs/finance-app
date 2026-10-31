import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { transactionQueryKeys, transactionsApi } from '@/entities/transaction';
import type { BulkResult, Transaction, TransactionsSummary } from '@/entities/transaction';
import { HttpError } from '@/shared/api/http';
import { queryClient } from '@/shared/api/queryClient';
import { useToast } from '@/shared/ui';
import { useBulkEditFlow } from './useBulkEditFlow';

const summary: TransactionsSummary = {
  count: 10,
  eligible_count: 9,
  locked_count: 1,
  totals: [{ currency: 'UZS', amount: 420000 }],
  as_of: '2026-10-31T10:00:00.000Z',
};

const preview: BulkResult = {
  changed: 9,
  skipped: [],
  balance_deltas: [],
  undo_token: null,
};

const tx = (id: string, extra: Partial<Transaction> = {}) =>
  ({ id, bulk_locked: false, created_at: '2026-10-31T09:00:00.000Z', ...extra }) as Transaction;

const TAXI = { category_ids: ['taxi'] };

/** Строки, загруженные лентой под фильтром `filter`, — в singleton-кэше, который читает поток. */
function seedList(filter: object, rows: Transaction[]) {
  queryClient.setQueryData(transactionQueryKeys.infinite('u-1', filter), {
    pages: [{ data: rows, nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
}

function setup(overrides: Partial<Parameters<typeof useBulkEditFlow>[0]> = {}) {
  const options = {
    userId: 'u-1',
    filters: () => TAXI,
    summary: () => summary,
    refetchSummary: vi.fn().mockResolvedValue(summary),
    selectedIds: () => ['m-1', 'm-2'],
    scheduleDelete: vi.fn(),
    onApplied: vi.fn(),
    onFinished: vi.fn(),
    ...overrides,
  };
  return { flow: useBulkEditFlow(options), options };
}

const category = { kind: 'category', category_id: 'transport' } as const;

describe('useBulkEditFlow', () => {
  beforeEach(() => {
    queryClient.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('«Изменить все» фиксирует выборку по итогу: фильтр, момент сервера и eligible_count', () => {
    const { flow } = setup();
    flow.openAll();
    expect(flow.step.value).toBe('scope');
    expect(flow.mode.value).toBe('all');
    expect(flow.scopeCount.value).toBe(9);
  });

  it('без итога «Изменить все» не открывается', () => {
    const { flow } = setup({ summary: () => undefined });
    flow.openAll();
    expect(flow.step.value).toBe('closed');
  });

  it('выбор цели ведёт на подтверждение и просит предпросмотр без записи', async () => {
    const spy = vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(preview);
    const { flow } = setup();
    flow.openAll();
    flow.go('pickCategory');
    flow.chooseAction(category, 'Транспорт');
    await flushPromises();

    expect(flow.step.value).toBe('confirm');
    expect(spy).toHaveBeenCalledWith({
      selection: {
        filter: { category_ids: ['taxi'] },
        as_of: summary.as_of,
        expected_count: 9,
      },
      action: category,
      dryRun: true,
    });
    expect(flow.preview.value).toEqual({ status: 'ready', result: preview });
  });

  it('ручной выбор уходит списком id', async () => {
    const spy = vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(preview);
    const { flow } = setup();
    flow.openManual();
    flow.chooseAction({ kind: 'tag', tag: 'кафе' });
    await flushPromises();

    expect(flow.mode.value).toBe('manual');
    expect(spy.mock.calls[0][0].selection).toEqual({ ids: ['m-1', 'm-2'] });
  });

  it('кнопка панели выбора открывает шторку сразу на цели, без шага назад', () => {
    const { flow } = setup();
    flow.openManual('pickCategory');

    expect(flow.step.value).toBe('pickCategory');
    expect(flow.canGoBack.value).toBe(false);
  });

  it('«Назад» идёт по пройденным шагам и со сводки сбрасывает действие', async () => {
    vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(preview);
    const { flow } = setup();
    flow.openAll();
    flow.go('pickCategory');
    flow.chooseAction(category, 'Транспорт');
    flow.back();
    expect(flow.step.value).toBe('pickCategory');
    expect(flow.action.value).toBeNull();
    flow.back();
    expect(flow.step.value).toBe('scope');
    flow.back();
    expect(flow.step.value).toBe('closed');
  });

  it('применение: запрос без dryRun, шторка закрыта, тост с «Отменить», кэши обновлены', async () => {
    const result = { ...preview, undo_token: 'tok-1' };
    const spy = vi
      .spyOn(transactionsApi, 'bulkUpdate')
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(result);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const { flow, options } = setup();
    flow.openAll();
    flow.chooseAction(category, 'Транспорт');
    await flushPromises();

    await flow.apply();

    expect(spy.mock.calls[1][0].dryRun).toBeUndefined();
    expect(flow.step.value).toBe('closed');
    expect(invalidate).toHaveBeenCalled();
    expect(options.onApplied).toHaveBeenCalledWith(category);
    expect(options.onFinished).toHaveBeenCalled();
    const toast = useToast().toasts.value[0];
    expect(toast.title).toBe('9 операций теперь в «Транспорт»');
    expect(toast.action?.label).toBe('Отменить');
  });

  it('«Отменить» в тосте зовёт undo с токеном', async () => {
    vi.spyOn(transactionsApi, 'bulkUpdate')
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, undo_token: 'tok-1' });
    const undo = vi.spyOn(transactionsApi, 'undoBulk').mockResolvedValue({ restored: 9 });
    const { flow } = setup();
    flow.openAll();
    flow.chooseAction(category, 'Транспорт');
    await flushPromises();
    await flow.apply();

    useToast().toasts.value[0].action!.onClick();
    await flushPromises();

    expect(undo).toHaveBeenCalledWith('tok-1');
    expect(useToast().toasts.value[0].title).toBe('Изменение отменено');
  });

  it('отказ отмены (409) объясняет, что строки уже менялись', async () => {
    vi.spyOn(transactionsApi, 'bulkUpdate')
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, undo_token: 'tok-1' });
    vi.spyOn(transactionsApi, 'undoBulk').mockRejectedValue(new HttpError(409, 'Conflict'));
    const { flow } = setup();
    flow.openAll();
    flow.chooseAction(category, 'Транспорт');
    await flushPromises();
    await flow.apply();

    useToast().toasts.value[0].action!.onClick();
    await flushPromises();

    expect(useToast().toasts.value[0]).toMatchObject({
      title: 'Операции уже менялись — отменить нельзя',
      variant: 'error',
    });
  });

  it('409 по фильтру: итог перезапрошен, тост, предпросмотр пересчитан по новой выборке', async () => {
    const fresh = { ...summary, eligible_count: 8, count: 9 };
    const spy = vi
      .spyOn(transactionsApi, 'bulkUpdate')
      .mockRejectedValueOnce(new HttpError(409, 'Conflict'))
      .mockResolvedValueOnce({ ...preview, changed: 8 });
    const { flow, options } = setup({ refetchSummary: vi.fn().mockResolvedValue(fresh) });
    flow.openAll();
    flow.chooseAction(category, 'Транспорт');
    await flushPromises();

    expect(options.refetchSummary).toHaveBeenCalled();
    expect(useToast().toasts.value[0].title).toBe('Список изменился, обновили итог');
    expect(spy.mock.calls[1][0].selection).toMatchObject({ expected_count: 8 });
    expect(flow.preview.value).toEqual({ status: 'ready', result: { ...preview, changed: 8 } });
    expect(flow.scopeCount.value).toBe(8);
  });

  it('удаление откладывается: прячутся только строки, которые сервер удалит', async () => {
    seedList(TAXI, [
      tx('a'),
      tx('locked', { bulk_locked: true }),
      // Пришла после момента итога: в выборку сервера не попадёт
      tx('late', { created_at: '2026-10-31T10:00:00.001Z' }),
      tx('pair', { payment_sibling: { id: 'pair-2', account_id: 'acc-2', amount: 1 } }),
      tx('edge', { created_at: summary.as_of }),
    ]);
    seedList({}, [tx('other-filter')]);
    const spy = vi
      .spyOn(transactionsApi, 'bulkUpdate')
      .mockResolvedValue({ ...preview, changed: 4 });
    const { flow, options } = setup();
    flow.openAll();
    flow.chooseAction({ kind: 'delete' });
    await flushPromises();

    await flow.apply();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(options.scheduleDelete).toHaveBeenCalledWith({
      selection: { filter: TAXI, as_of: summary.as_of, expected_count: 9 },
      filter: TAXI,
      hideIds: ['a', 'pair', 'pair-2', 'edge'],
      count: 4,
      // Итог ленты теряет строки под её фильтром; вторая половина пары живёт под другим
      filterCount: 9,
    });
    expect(flow.step.value).toBe('closed');
    expect(options.onFinished).toHaveBeenCalled();
  });

  it('пока лента фильтра не загружена, по фильтру ничего не прячется', async () => {
    seedList({}, [tx('other-filter')]);
    vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(preview);
    const { flow, options } = setup();
    flow.openAll();
    flow.chooseAction({ kind: 'delete' });
    await flushPromises();
    await flow.apply();

    expect(options.scheduleDelete).toHaveBeenCalledWith(expect.objectContaining({ hideIds: [] }));
  });

  it('удаление ручного выбора прячет отмеченные строки', async () => {
    vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(preview);
    const { flow, options } = setup();
    flow.openManual();
    flow.chooseAction({ kind: 'delete' });
    await flushPromises();
    await flow.apply();

    expect(options.scheduleDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: { ids: ['m-1', 'm-2'] },
        filter: TAXI,
        hideIds: ['m-1', 'm-2'],
      }),
    );
  });

  it('ручной выбор: вторые половины пар прячутся тоже, итог ленты — без чужих половин', async () => {
    const sibling = (id: string) => ({ id, account_id: 'acc-2', amount: 1 });
    seedList(TAXI, [
      tx('m-1', { payment_sibling: sibling('elsewhere') }),
      tx('m-2', { payment_sibling: sibling('m-3') }),
      tx('m-3', { payment_sibling: sibling('m-2') }),
    ]);
    vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue({ ...preview, changed: 4 });
    const { flow, options } = setup();
    flow.openManual();
    flow.chooseAction({ kind: 'delete' });
    await flushPromises();
    await flow.apply();

    expect(options.scheduleDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        hideIds: ['m-1', 'elsewhere', 'm-2', 'm-3'],
        count: 4,
        filterCount: 3,
      }),
    );
  });

  it('ошибка применения: шторка остаётся, тост с текстом сервера', async () => {
    vi.spyOn(transactionsApi, 'bulkUpdate')
      .mockResolvedValueOnce(preview)
      .mockRejectedValueOnce(
        new HttpError(400, 'Bad Request', { message: 'Сузьте фильтр: слишком много операций' }),
      );
    const { flow } = setup();
    flow.openAll();
    flow.chooseAction(category, 'Транспорт');
    await flushPromises();
    await flow.apply();

    expect(flow.step.value).toBe('confirm');
    expect(useToast().toasts.value[0]).toMatchObject({
      title: 'Сузьте фильтр: слишком много операций',
      variant: 'error',
    });
  });

  it('ошибка предпросмотра попадает в состояние, а не в тост', async () => {
    vi.spyOn(transactionsApi, 'bulkUpdate').mockRejectedValue(
      new HttpError(400, 'Bad Request', { message: 'Целевая категория не подходит' }),
    );
    const { flow } = setup();
    flow.openAll();
    flow.chooseAction(category, 'Транспорт');
    await flushPromises();

    expect(flow.preview.value).toEqual({
      status: 'error',
      message: 'Целевая категория не подходит',
    });
  });
});
