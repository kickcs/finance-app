import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue';
import {
  cachedFilterRows,
  transactionsApi,
  type BulkAction,
  type BulkResult,
  type BulkSelection,
  type TransactionFilters,
  type TransactionsSummary,
} from '@/entities/transaction';
import { HttpError, getServerErrorMessage } from '@/shared/api/http';
import { queryClient } from '@/shared/api/queryClient';
import { invalidateAccountRelated, invalidateTransactionRelated } from '@/shared/api/invalidation';
import { useToast } from '@/shared/ui';
import { actionTexts } from './bulkTexts';
import type { DeferredDeleteRequest } from './useDeferredBulkDelete';

export type BulkStep =
  | 'closed'
  | 'scope'
  | 'verbs'
  | 'pickCategory'
  | 'pickTransferAccount'
  | 'pickAccount'
  | 'tag'
  | 'confirm';

export type BulkPreview =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: BulkResult }
  | { status: 'error'; message: string };

export interface BulkEditFlowOptions {
  userId: MaybeRefOrGetter<string | null>;
  /** Текущий фильтр ленты: уходит в запрос вместе со сверкой с показанным итогом. */
  filters: () => TransactionFilters;
  summary: () => TransactionsSummary | undefined;
  /** Перечитывает итог при 409: пока пользователь смотрел сводку, список изменился. */
  refetchSummary: () => Promise<TransactionsSummary | undefined>;
  /** Отмеченные вручную id (обе половины пар оплаты). */
  selectedIds: () => string[];
  scheduleDelete: (request: DeferredDeleteRequest) => void;
  /** Правка применена: страница переключает фильтр на то, куда переехали операции. */
  onApplied?: (action: BulkAction) => void;
  /** Операция доведена до конца (применена или поставлена на удаление): выйти из ручного выбора. */
  onFinished?: () => void;
}

/** Дольше обычного тоста: пользователь успевает прочитать итог и понять, что хочет откатить. */
const UNDO_TOAST_MS = 8000;

/**
 * Шторки массовой правки как последовательность шагов: охват и действия → цель → сводка.
 * Выборка фиксируется при открытии, поэтому предпросмотр и применение видят одно и то же.
 */
export function useBulkEditFlow(options: BulkEditFlowOptions) {
  const { toast } = useToast();

  const history = ref<BulkStep[]>([]);
  const step = computed<BulkStep>(() => history.value[history.value.length - 1] ?? 'closed');
  const mode = ref<'all' | 'manual'>('all');
  const selection = ref<BulkSelection | null>(null);
  const scopeCount = ref(0);
  const action = ref<BulkAction | null>(null);
  const targetName = ref<string | undefined>();
  const preview = ref<BulkPreview>({ status: 'idle' });
  const isApplying = ref(false);

  // Предпросмотры могут обгонять друг друга (цель сменили, пока сводка считалась).
  let previewSeq = 0;

  function freezeAll(fresh: TransactionsSummary) {
    selection.value = {
      filter: options.filters(),
      as_of: fresh.as_of,
      expected_count: fresh.eligible_count,
    };
    scopeCount.value = fresh.eligible_count;
  }

  function openAll() {
    const current = options.summary();
    if (!current) return;
    mode.value = 'all';
    freezeAll(current);
    resetAction();
    history.value = ['scope'];
  }

  /** Кнопки панели выбора ведут сразу к цели, «Ещё» — к списку действий. */
  function openManual(first: BulkStep = 'verbs') {
    const ids = options.selectedIds();
    if (ids.length === 0) return;
    mode.value = 'manual';
    selection.value = { ids };
    scopeCount.value = ids.length;
    resetAction();
    history.value = [first];
  }

  function resetAction() {
    previewSeq++;
    action.value = null;
    targetName.value = undefined;
    preview.value = { status: 'idle' };
  }

  function close() {
    history.value = [];
    resetAction();
  }

  function go(next: BulkStep) {
    history.value = [...history.value, next];
  }

  function back() {
    if (step.value === 'confirm') resetAction();
    history.value = history.value.slice(0, -1);
    if (history.value.length === 0) resetAction();
  }

  async function runPreview() {
    if (!selection.value || !action.value) return;
    const seq = ++previewSeq;
    preview.value = { status: 'loading' };
    try {
      const result = await transactionsApi.bulkUpdate({
        selection: selection.value,
        action: action.value,
        dryRun: true,
      });
      if (seq === previewSeq) preview.value = { status: 'ready', result };
    } catch (e) {
      if (seq !== previewSeq) return;
      if (await recoverFromConflict(e)) return;
      preview.value = {
        status: 'error',
        message: getServerErrorMessage(e) ?? 'Не удалось подготовить сводку',
      };
    }
  }

  /** 409 по фильтру: итог устарел — перечитываем, фиксируем заново и считаем сводку снова. */
  async function recoverFromConflict(error: unknown): Promise<boolean> {
    const isFilterConflict =
      error instanceof HttpError &&
      error.status === 409 &&
      selection.value !== null &&
      'filter' in selection.value;
    if (!isFilterConflict) return false;

    const fresh = await options.refetchSummary();
    toast({ title: 'Список изменился, обновили итог', variant: 'warning' });
    if (!fresh) return false;
    freezeAll(fresh);
    await runPreview();
    return true;
  }

  function chooseAction(next: BulkAction, name?: string) {
    action.value = next;
    targetName.value = name;
    go('confirm');
    void runPreview();
  }

  async function refreshCaches() {
    const uid = toValue(options.userId);
    if (!uid) return;
    await Promise.all([
      invalidateTransactionRelated(queryClient, uid),
      invalidateAccountRelated(queryClient, uid),
    ]);
  }

  async function undo(token: string) {
    try {
      await transactionsApi.undoBulk(token);
      await refreshCaches();
      toast({ title: 'Изменение отменено', variant: 'success' });
    } catch (e) {
      const conflict = e instanceof HttpError && e.status === 409;
      toast({
        title: conflict
          ? 'Операции уже менялись — отменить нельзя'
          : (getServerErrorMessage(e) ?? 'Не удалось отменить изменение'),
        variant: 'error',
      });
    }
  }

  /**
   * Что спрятать сразу — ровно то, что удалит сервер, иначе после ответа строки «воскреснут».
   * Пара оплаты удаляется целиком, поэтому её вторая половина прячется тоже.
   */
  function planDelete(current: BulkSelection, filter: TransactionFilters) {
    const uid = toValue(options.userId);
    const listed = uid ? cachedFilterRows(queryClient, uid, filter) : [];
    const listedIds = new Set(listed.map((row) => row.id));
    const siblingOf = new Map(listed.map((row) => [row.id, row.payment_sibling?.id]));

    const ids =
      'ids' in current
        ? current.ids
        : listed
            .filter(
              (row) => !row.bulk_locked && Date.parse(row.created_at) <= Date.parse(current.as_of),
            )
            .map((row) => row.id);
    const hideIds = [
      ...new Set(
        ids.flatMap((id) => {
          const sibling = siblingOf.get(id);
          return sibling ? [id, sibling] : [id];
        }),
      ),
    ];
    // Итог ленты теряет только свои строки: половина пары под другим фильтром его не трогает.
    const filterCount =
      'ids' in current
        ? hideIds.filter((id) => listedIds.has(id) || current.ids.includes(id)).length
        : current.expected_count;
    return { hideIds, filterCount };
  }

  function deleteLater(current: BulkSelection, count: number) {
    const filter = options.filters();
    options.scheduleDelete({ selection: current, filter, count, ...planDelete(current, filter) });
    close();
    options.onFinished?.();
  }

  async function apply() {
    const current = selection.value;
    const chosen = action.value;
    if (!current || !chosen || isApplying.value || preview.value.status !== 'ready') return;

    if (chosen.kind === 'delete') {
      deleteLater(current, preview.value.result.changed);
      return;
    }

    isApplying.value = true;
    try {
      const result = await transactionsApi.bulkUpdate({ selection: current, action: chosen });
      const name = targetName.value;
      close();
      toast({
        title: actionTexts(chosen, result.changed, name).applied,
        variant: 'success',
        duration: UNDO_TOAST_MS,
        action: result.undo_token
          ? { label: 'Отменить', onClick: () => void undo(result.undo_token!) }
          : undefined,
      });
      options.onApplied?.(chosen);
      options.onFinished?.();
      await refreshCaches();
    } catch (e) {
      if (await recoverFromConflict(e)) return;
      toast({
        title: getServerErrorMessage(e) ?? 'Не удалось применить изменения',
        variant: 'error',
      });
    } finally {
      isApplying.value = false;
    }
  }

  return {
    step,
    isOpen: computed(() => step.value !== 'closed'),
    canGoBack: computed(() => history.value.length > 1),
    mode,
    scopeCount,
    action,
    targetName,
    preview,
    isApplying,
    openAll,
    openManual,
    close,
    go,
    back,
    chooseAction,
    apply,
  };
}

export type BulkEditFlow = ReturnType<typeof useBulkEditFlow>;
