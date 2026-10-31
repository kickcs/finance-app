import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { effectScope } from 'vue';
import { queryClient } from '@/shared/api/queryClient';
import { HttpError } from '@/shared/api/http';
import { transactionQueryKeys, transactionsApi, type BulkResult } from '@/entities/transaction';
import type { Transaction } from '@/shared/api/database.types';
import {
  UNDO_WINDOW_MS,
  useDeferredBulkDelete,
  __resetDeferredDeletesForTests,
} from './useDeferredBulkDelete';

const { toastMock, dismissMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  dismissMock: vi.fn(),
}));

vi.mock('@/shared/ui', async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return { ...orig, useToast: () => ({ toast: toastMock }) };
});

vi.mock('@/shared/api/invalidation', () => ({
  invalidateTransactionRelated: vi.fn().mockResolvedValue(undefined),
  invalidateAccountRelated: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';

const USER_ID = 'user-1';
const DELETE = { kind: 'delete' } as const;
const RESULT: BulkResult = { changed: 1, skipped: [], balance_deltas: [], undo_token: null };

function makeTx(id: string): Transaction {
  return {
    id,
    user_id: USER_ID,
    account_id: 'acc-1',
    category_id: 'cat-1',
    amount: 1000,
    currency: 'UZS',
    type: 'expense',
    description: null,
    date: '2025-06-01T00:00:00.000Z',
    created_at: '2025-06-01T12:00:00.000Z',
    is_debt_related: false,
    is_informational: false,
    debt_id: null,
    to_account_id: null,
    to_amount: null,
    to_currency: null,
    returned_amount: 0,
    net_amount: 1000,
    has_debt_returns: false,
    payment_group_id: null,
    settlement_id: null,
    payment_sibling: null,
  };
}

const NO_FILTER = {};
const SUMMARY_KEY = transactionQueryKeys.summary(USER_ID, NO_FILTER);

function seedCaches(ids = ['tx-1', 'tx-2', 'tx-3', 'tx-4']) {
  const rows = ids.map(makeTx);
  queryClient.setQueryData(transactionQueryKeys.recent(USER_ID), rows);
  queryClient.setQueryData(transactionQueryKeys.infinite(USER_ID), {
    pages: [{ data: rows, nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
  queryClient.setQueryData(SUMMARY_KEY, {
    count: ids.length,
    eligible_count: ids.length,
    locked_count: 0,
    totals: [{ currency: 'UZS', amount: -1000 * ids.length }],
    as_of: '2025-06-01T12:00:00.000Z',
  });
}

const listedIds = () =>
  queryClient
    .getQueryData<{ pages: { data: Transaction[] }[] }>(transactionQueryKeys.infinite(USER_ID))
    ?.pages[0].data.map((t) => t.id);
const recentIds = () =>
  queryClient.getQueryData<Transaction[]>(transactionQueryKeys.recent(USER_ID))?.map((t) => t.id);
const summaryCount = () => queryClient.getQueryData<{ count: number }>(SUMMARY_KEY)?.count;

/** Вызвать onClick кнопки «Отменить» последнего показанного тоста. */
function clickUndo(callIndex = toastMock.mock.calls.length - 1) {
  toastMock.mock.calls[callIndex][0].action.onClick();
}

/** Пропустить микрозадачи, не двигая часы: отправка и инвалидация идут по `await`. */
const settle = () => vi.advanceTimersByTimeAsync(0);

/** UUID, как у настоящих строк: лимит keepalive считается в байтах тела, а не в штуках. */
const uuids = (n: number) =>
  Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useDeferredBulkDelete', () => {
  let bulkSpy: MockInstance<typeof transactionsApi.bulkUpdate>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    queryClient.clear();
    __resetDeferredDeletesForTests();
    toastMock.mockReturnValue({ id: 't', dismiss: dismissMock, update: vi.fn() });
    bulkSpy = vi.spyOn(transactionsApi, 'bulkUpdate').mockResolvedValue(RESULT);
  });

  afterEach(() => {
    __resetDeferredDeletesForTests();
    delete (document as unknown as Record<string, unknown>).visibilityState;
    queryClient.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('scheduleDelete', () => {
    it('hides the rows at once in every cache and shrinks the summary', () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);

      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1', 'tx-2'] },
        hideIds: ['tx-1', 'tx-2'],
        count: 2,
        filterCount: 2,
      });

      expect(listedIds()).toEqual(['tx-3', 'tx-4']);
      expect(recentIds()).toEqual(['tx-3', 'tx-4']);
      expect(summaryCount()).toBe(2);
      expect(bulkSpy).not.toHaveBeenCalled();
    });

    it('shrinks only the summary of the list filter and marks the others stale', () => {
      seedCaches();
      const otherKey = transactionQueryKeys.summary(USER_ID, { type: 'expense' });
      queryClient.setQueryData(otherKey, queryClient.getQueryData(SUMMARY_KEY));
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);

      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      expect(summaryCount()).toBe(3);
      expect(queryClient.getQueryData<{ count: number }>(otherKey)?.count).toBe(4);
      expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(true);
    });

    it('the toast names what the server deletes, the summary loses only rows under the filter', () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);

      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1', 'tx-2'] },
        hideIds: ['tx-1', 'tx-2', 'pair-elsewhere'],
        count: 3,
        filterCount: 2,
      });

      expect(summaryCount()).toBe(2);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Удалено: 3 операции' }),
      );
    });

    it('shows an undo toast that lives exactly as long as the undo window', () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);

      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      expect(UNDO_WINDOW_MS).toBe(6000);
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Удалено: 1 операция',
          duration: UNDO_WINDOW_MS,
          action: { label: 'Отменить', onClick: expect.any(Function) },
        }),
      );
    });

    it.each([
      [1, 'Удалено: 1 операция'],
      [2, 'Удалено: 2 операции'],
      [4, 'Удалено: 4 операции'],
      [5, 'Удалено: 5 операций'],
      [11, 'Удалено: 11 операций'],
      [14, 'Удалено: 14 операций'],
      [21, 'Удалено: 21 операция'],
      [3200, 'Удалено: 3200 операций'],
    ])('declines the toast title for %i', (count, title) => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);

      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count,
        filterCount: count,
      });

      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title }));
    });

    it('does nothing without a user', () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(() => null);

      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });
      vi.advanceTimersByTime(UNDO_WINDOW_MS);

      expect(listedIds()).toHaveLength(4);
      expect(toastMock).not.toHaveBeenCalled();
      expect(bulkSpy).not.toHaveBeenCalled();
    });
  });

  describe('undo', () => {
    it('brings the rows and the summary back and never sends the request', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1', 'tx-2'] },
        hideIds: ['tx-1', 'tx-2'],
        count: 2,
        filterCount: 2,
      });

      clickUndo();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);

      expect(listedIds()).toEqual(['tx-1', 'tx-2', 'tx-3', 'tx-4']);
      expect(recentIds()).toEqual(['tx-1', 'tx-2', 'tx-3', 'tx-4']);
      expect(summaryCount()).toBe(4);
      expect(bulkSpy).not.toHaveBeenCalled();
      expect(invalidateTransactionRelated).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'Удаление отменено' }),
      );
    });

    it('ignores a second tap on «Отменить»', () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });
      const undo = toastMock.mock.calls[0][0].action.onClick;

      undo();
      undo();

      expect(toastMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('timer', () => {
    it('sends exactly one delete request when the window ends', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      const selection = { ids: ['tx-1', 'tx-2'] };
      scheduleDelete({
        filter: NO_FILTER,
        selection,
        hideIds: ['tx-1', 'tx-2'],
        count: 2,
        filterCount: 2,
      });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 1);
      expect(bulkSpy).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 3);

      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith({ selection, action: DELETE });
    });

    it('sends a big manual selection in one piece when nothing forces keepalive', async () => {
      const ids = Array.from({ length: 3200 }, (_, i) => `id-${i}`);
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids },
        hideIds: [],
        count: ids.length,
        filterCount: ids.length,
      });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith({ selection: { ids }, action: DELETE });
    });

    it('refreshes transaction and account caches after success', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(invalidateTransactionRelated).toHaveBeenCalledWith(queryClient, USER_ID);
      expect(invalidateAccountRelated).toHaveBeenCalledWith(queryClient, USER_ID);
      expect(listedIds()).toEqual(['tx-2', 'tx-3', 'tx-4']);
    });
  });

  describe('leaving for the background', () => {
    it('visibilitychange to hidden sends at once with keepalive and the timer does not repeat it', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      const selection = { ids: ['tx-1'] };
      scheduleDelete({ filter: NO_FILTER, selection, hideIds: ['tx-1'], count: 1, filterCount: 1 });

      setVisibility('hidden');
      await settle();

      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith({ selection, action: DELETE }, { keepalive: true });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(invalidateTransactionRelated).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the page becomes visible again', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      setVisibility('visible');
      await settle();

      expect(bulkSpy).not.toHaveBeenCalled();
    });

    it('pagehide sends at once with keepalive', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      const selection = { ids: ['tx-1'] };
      scheduleDelete({ filter: NO_FILTER, selection, hideIds: ['tx-1'], count: 1, filterCount: 1 });

      window.dispatchEvent(new Event('pagehide'));
      await settle();

      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith({ selection, action: DELETE }, { keepalive: true });
    });

    it('visibilitychange followed by pagehide still sends once', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      setVisibility('hidden');
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(bulkSpy).toHaveBeenCalledTimes(1);
    });

    it('closes the toast, so «Отменить» cannot promise what is already sent', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      setVisibility('hidden');
      await settle();
      clickUndo();

      expect(dismissMock).toHaveBeenCalledTimes(1);
      expect(listedIds()).toEqual(['tx-2', 'tx-3', 'tx-4']);
      expect(toastMock).toHaveBeenCalledTimes(1);
    });

    it('sends a filter selection as is, it is already compact', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      const selection = {
        filter: { type: 'expense' as const },
        as_of: '2025-06-01T12:00:00.000Z',
        expected_count: 40000,
      };
      scheduleDelete({
        filter: NO_FILTER,
        selection,
        hideIds: ['tx-1'],
        count: 40000,
        filterCount: 40000,
      });

      setVisibility('hidden');
      await settle();

      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith({ selection, action: DELETE }, { keepalive: true });
    });

    it('a body over 60 KB goes as one plain request already on hidden, while the page is alive', async () => {
      const ids = uuids(1700);
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids },
        hideIds: [],
        count: ids.length,
        filterCount: ids.length,
      });

      setVisibility('hidden');
      await settle();
      // Ушёл до pagehide: выгружаемая страница обычный запрос уже не довезла бы
      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith({ selection: { ids }, action: DELETE });

      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);
      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(invalidateTransactionRelated).toHaveBeenCalledTimes(1);
      expect(dismissMock).toHaveBeenCalledTimes(1);
    });

    it('pending deletes share one keepalive budget: the one that no longer fits goes plain', async () => {
      seedCaches();
      const first = uuids(900);
      const second = uuids(900);
      useDeferredBulkDelete(USER_ID).scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: first },
        hideIds: [],
        count: first.length,
        filterCount: first.length,
      });
      useDeferredBulkDelete(USER_ID).scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: second },
        hideIds: [],
        count: second.length,
        filterCount: second.length,
      });

      window.dispatchEvent(new Event('pagehide'));
      await settle();

      expect(bulkSpy).toHaveBeenCalledTimes(2);
      expect(bulkSpy.mock.calls[0]).toEqual([
        { selection: { ids: first }, action: DELETE },
        { keepalive: true },
      ]);
      expect(bulkSpy.mock.calls[1]).toEqual([{ selection: { ids: second }, action: DELETE }]);
    });

    it('still uses keepalive while the body fits 60 KB', async () => {
      const ids = uuids(1500);
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids },
        hideIds: [],
        count: ids.length,
        filterCount: ids.length,
      });

      setVisibility('hidden');
      await settle();

      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith(
        { selection: { ids }, action: DELETE },
        { keepalive: true },
      );
    });

    it('failing in the background still rolls the rows back', async () => {
      seedCaches();
      bulkSpy.mockRejectedValue(new TypeError('Failed to fetch'));
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      setVisibility('hidden');
      await settle();

      expect(listedIds()).toEqual(['tx-1', 'tx-2', 'tx-3', 'tx-4']);
      expect(invalidateTransactionRelated).toHaveBeenCalledWith(queryClient, USER_ID);
    });
  });

  describe('errors', () => {
    it('brings the rows back, tells why and refreshes the caches anyway', async () => {
      seedCaches();
      bulkSpy.mockRejectedValue(
        new HttpError(409, 'Conflict', { message: 'Список изменился, обновили итог' }),
      );
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1', 'tx-2'] },
        hideIds: ['tx-1', 'tx-2'],
        count: 2,
        filterCount: 2,
      });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(listedIds()).toEqual(['tx-1', 'tx-2', 'tx-3', 'tx-4']);
      expect(summaryCount()).toBe(4);
      expect(toastMock).toHaveBeenLastCalledWith({
        title: 'Список изменился, обновили итог',
        variant: 'error',
      });
      expect(invalidateTransactionRelated).toHaveBeenCalledWith(queryClient, USER_ID);
      expect(invalidateAccountRelated).toHaveBeenCalledWith(queryClient, USER_ID);
    });

    it('falls back to a generic message when the server gave none', async () => {
      seedCaches();
      bulkSpy.mockRejectedValue(new HttpError(500, 'Internal Server Error'));
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(toastMock).toHaveBeenLastCalledWith({
        title: 'Не удалось удалить операции',
        variant: 'error',
      });
    });
  });

  describe('module-level state', () => {
    it('survives the page that scheduled it being torn down', async () => {
      seedCaches();
      const scope = effectScope();
      const { scheduleDelete } = scope.run(() => useDeferredBulkDelete(USER_ID))!;
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });

      scope.stop();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);

      expect(bulkSpy).toHaveBeenCalledTimes(1);
    });

    it('scheduled from inside the page scope, it still fires once after the page is gone', async () => {
      seedCaches();
      const scope = effectScope();
      scope.run(() =>
        useDeferredBulkDelete(USER_ID).scheduleDelete({
          filter: NO_FILTER,
          selection: { ids: ['tx-1'] },
          hideIds: ['tx-1'],
          count: 1,
          filterCount: 1,
        }),
      );

      scope.stop();
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);

      expect(bulkSpy).toHaveBeenCalledTimes(1);
    });

    it('listeners registered from inside the page scope outlive it', async () => {
      seedCaches();
      const scope = effectScope();
      scope.run(() =>
        useDeferredBulkDelete(USER_ID).scheduleDelete({
          filter: NO_FILTER,
          selection: { ids: ['tx-1'] },
          hideIds: ['tx-1'],
          count: 1,
          filterCount: 1,
        }),
      );
      scope.stop();

      window.dispatchEvent(new Event('pagehide'));
      await settle();

      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith(
        { selection: { ids: ['tx-1'] }, action: DELETE },
        { keepalive: true },
      );
    });

    it('a tap on «Отменить» still works after the page that showed it is gone', () => {
      seedCaches();
      const scope = effectScope();
      const { scheduleDelete } = scope.run(() => useDeferredBulkDelete(USER_ID))!;
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });
      scope.stop();

      clickUndo();

      expect(listedIds()).toEqual(['tx-1', 'tx-2', 'tx-3', 'tx-4']);
    });

    it('registers the background listeners once, however many deletes are scheduled', () => {
      seedCaches();
      const docSpy = vi.spyOn(document, 'addEventListener');
      const winSpy = vi.spyOn(window, 'addEventListener');

      useDeferredBulkDelete(USER_ID).scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });
      useDeferredBulkDelete(USER_ID).scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-2'] },
        hideIds: ['tx-2'],
        count: 1,
        filterCount: 1,
      });

      expect(docSpy.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);
      expect(winSpy.mock.calls.filter(([type]) => type === 'pagehide')).toHaveLength(1);
    });

    it('one background event flushes every pending delete exactly once', async () => {
      seedCaches();
      const first = {
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      };
      const second = {
        filter: NO_FILTER,
        selection: { ids: ['tx-2'] },
        hideIds: ['tx-2'],
        count: 1,
        filterCount: 1,
      };
      useDeferredBulkDelete(USER_ID).scheduleDelete(first);
      useDeferredBulkDelete(USER_ID).scheduleDelete(second);

      setVisibility('hidden');
      window.dispatchEvent(new Event('pagehide'));
      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS * 2);

      expect(bulkSpy).toHaveBeenCalledTimes(2);
      expect(bulkSpy).toHaveBeenCalledWith(
        { selection: first.selection, action: DELETE },
        { keepalive: true },
      );
      expect(bulkSpy).toHaveBeenCalledWith(
        { selection: second.selection, action: DELETE },
        { keepalive: true },
      );
    });

    it('independent deletes: undoing one keeps the other hidden and still sent', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-2'] },
        hideIds: ['tx-2'],
        count: 1,
        filterCount: 1,
      });
      expect(listedIds()).toEqual(['tx-3', 'tx-4']);

      clickUndo(0);

      expect(listedIds()).toEqual(['tx-1', 'tx-3', 'tx-4']);
      expect(summaryCount()).toBe(3);

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS);
      expect(bulkSpy).toHaveBeenCalledTimes(1);
      expect(bulkSpy).toHaveBeenCalledWith({ selection: { ids: ['tx-2'] }, action: DELETE });
    });

    it('independent deletes: undoing the later one does not lose the earlier undo', () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-2'] },
        hideIds: ['tx-2'],
        count: 1,
        filterCount: 1,
      });

      clickUndo(0);
      clickUndo(1);

      expect(listedIds()).toEqual(['tx-1', 'tx-2', 'tx-3', 'tx-4']);
      expect(summaryCount()).toBe(4);
    });

    it('independent deletes: the earlier timer fires first and the later one follows', async () => {
      seedCaches();
      const { scheduleDelete } = useDeferredBulkDelete(USER_ID);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-1'] },
        hideIds: ['tx-1'],
        count: 1,
        filterCount: 1,
      });
      await vi.advanceTimersByTimeAsync(2000);
      scheduleDelete({
        filter: NO_FILTER,
        selection: { ids: ['tx-2'] },
        hideIds: ['tx-2'],
        count: 1,
        filterCount: 1,
      });

      await vi.advanceTimersByTimeAsync(UNDO_WINDOW_MS - 2000);
      expect(bulkSpy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(bulkSpy).toHaveBeenCalledTimes(2);
    });
  });
});
