import { effectScope, toValue, type EffectScope, type MaybeRefOrGetter } from 'vue';
import { useEventListener, useTimeoutFn } from '@vueuse/core';
import {
  transactionsApi,
  bulkRequestBytes,
  snapshotTransactionCaches,
  removeTransactionsFromCaches,
  restoreTransactionCaches,
  shrinkSummaryCaches,
  type BulkSelection,
  type TransactionFilters,
} from '@/entities/transaction';
import { queryClient } from '@/shared/api/queryClient';
import { getServerErrorMessage } from '@/shared/api/http';
import { invalidateAccountRelated, invalidateTransactionRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { actionTexts } from './bulkTexts';

/** Сколько у пользователя есть, чтобы передумать, прежде чем запрос уйдёт на сервер. */
export const UNDO_WINDOW_MS = 6000;

// Браузер даёт keepalive-запросам 64 КБ на всех разом; запас — под заголовки и округления.
const KEEPALIVE_BODY_BYTES = 60 * 1024;
const DELETE_ACTION = { kind: 'delete' } as const;

export interface DeferredDeleteRequest {
  selection: BulkSelection;
  /** Фильтр ленты: его итог уменьшаем сразу, остальные пересчитает сервер. */
  filter: TransactionFilters;
  /** Строки, которые надо спрятать сразу. */
  hideIds: string[];
  /** Сколько строк выборки удалит сервер — для тоста. */
  count: number;
  /** Сколько из них под `filter` — на столько уменьшаем его итог. */
  filterCount: number;
}

interface PendingDelete extends DeferredDeleteRequest {
  id: number;
  userId: string;
  snapshot: ReturnType<typeof snapshotTransactionCaches>;
  stopTimer: () => void;
  toast: { dismiss: () => void };
}

// Реестр живёт в модуле, а не в компоненте: уход со страницы в окне отмены не должен
// ни терять удаление, ни отменять его. Ключи растут, так что порядок id = порядок показа.
const pending = new Map<number, PendingDelete>();
let lastId = 0;
// Отвязанный scope: слушатели не должны умирать вместе со страницей, начавшей удаление.
let listenersScope: EffectScope | null = null;

const showToast = (props: Parameters<ReturnType<typeof useToast>['toast']>[0]) =>
  useToast().toast(props);

function hide(entry: PendingDelete) {
  removeTransactionsFromCaches(queryClient, entry.userId, entry.hideIds);
  shrinkSummaryCaches(queryClient, entry.userId, entry.filter, entry.filterCount);
}

/** Достать запись из реестра и снять её таймер: тот, кто достал, отвечает за отправку или откат. */
function take(id: number): PendingDelete | undefined {
  const entry = pending.get(id);
  if (!entry) return undefined;
  entry.stopTimer();
  pending.delete(id);
  return entry;
}

// Поздние удаления переснимаем и прячем заново: их снимки сделаны без наших строк,
// и отмена такого удаления унесла бы то, что мы только что вернули.
function rollback(entry: PendingDelete) {
  restoreTransactionCaches(queryClient, entry.snapshot);
  for (const later of pending.values()) {
    if (later.id < entry.id) continue;
    later.snapshot = snapshotTransactionCaches(queryClient, later.userId);
    hide(later);
  }
}

async function sendDelete(selection: BulkSelection, keepalive: boolean) {
  const request = { selection, action: DELETE_ACTION };
  if (keepalive) await transactionsApi.bulkUpdate(request, { keepalive: true });
  else await transactionsApi.bulkUpdate(request);
}

async function submit(entry: PendingDelete, keepalive: boolean) {
  try {
    await sendDelete(entry.selection, keepalive);
  } catch (e) {
    console.error('Failed to delete transactions:', e);
    rollback(entry);
    showToast({
      title: getServerErrorMessage(e) ?? 'Не удалось удалить операции',
      variant: 'error',
    });
  }
  await Promise.all([
    invalidateTransactionRelated(queryClient, entry.userId),
    invalidateAccountRelated(queryClient, entry.userId),
  ]);
}

/** Окно отмены истекло: страница жива, обычного запроса достаточно. */
function send(id: number) {
  const entry = take(id);
  if (entry) void submit(entry, false);
}

function undo(id: number) {
  const entry = take(id);
  if (!entry) return;
  rollback(entry);
  showToast({ title: 'Удаление отменено' });
}

/**
 * Страница уходит в фон или выгружается: всё отложенное уходит сразу. Что влезает в общий
 * бюджет keepalive — с ним; остальное одним обычным запросом: на `visibilitychange` страница
 * ещё жива и довезёт его, а куски из выгруженной уйдут не все — частичное удаление хуже никакого.
 */
function flushAll() {
  let budget = KEEPALIVE_BODY_BYTES;
  for (const id of [...pending.keys()]) {
    const entry = take(id);
    if (!entry) continue;
    // Запрос уже ушёл — «Отменить» на тосте больше ничего не обещает.
    entry.toast.dismiss();
    const bytes = bulkRequestBytes({ selection: entry.selection, action: DELETE_ACTION });
    const keepalive = bytes <= budget;
    if (keepalive) budget -= bytes;
    void submit(entry, keepalive);
  }
}

function ensureListeners() {
  if (listenersScope) return;
  listenersScope = effectScope(true);
  listenersScope.run(() => {
    useEventListener(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAll();
    });
    useEventListener(window, 'pagehide', flushAll);
  });
}

/** Таймер в своём отвязанном scope: остановить его можно откуда угодно, страница его не снимет. */
function startTimer(id: number): () => void {
  const scope = effectScope(true);
  scope.run(() => useTimeoutFn(() => send(id), UNDO_WINDOW_MS));
  return () => scope.stop();
}

/**
 * Массовое удаление с отменой: строки пропадают сразу, запрос уходит через
 * `UNDO_WINDOW_MS` или раньше, если страница уходит в фон.
 */
export function useDeferredBulkDelete(userId: MaybeRefOrGetter<string | null>) {
  function scheduleDelete(request: DeferredDeleteRequest) {
    const currentUserId = toValue(userId);
    if (!currentUserId) return;
    ensureListeners();

    const id = ++lastId;
    const snapshot = snapshotTransactionCaches(queryClient, currentUserId);
    removeTransactionsFromCaches(queryClient, currentUserId, request.hideIds);
    shrinkSummaryCaches(queryClient, currentUserId, request.filter, request.filterCount);

    const { count } = request;
    pending.set(id, {
      ...request,
      id,
      userId: currentUserId,
      snapshot,
      stopTimer: startTimer(id),
      toast: showToast({
        title: actionTexts(DELETE_ACTION, count).applied,
        variant: 'undo',
        action: { label: 'Отменить', onClick: () => undo(id) },
        duration: UNDO_WINDOW_MS,
      }),
    });
  }

  return { scheduleDelete };
}

/** Только для тестов: сбросить реестр, таймеры и слушатели. */
export function __resetDeferredDeletesForTests() {
  for (const entry of pending.values()) entry.stopTimer();
  pending.clear();
  listenersScope?.stop();
  listenersScope = null;
}
