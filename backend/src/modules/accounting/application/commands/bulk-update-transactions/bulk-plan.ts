import { BadRequestException } from '@nestjs/common';
import type { Transaction } from '../../../domain/aggregates/transaction';
import {
  ALL_DEBT_CATEGORY_IDS,
  INFORMATIONAL_ONLY_CATEGORY_IDS,
  getDefaultCategoryById,
} from '../../../domain/constants/default-categories';
import {
  BalanceCalculationService,
  type BalanceAffectingRow,
} from '../../../domain/services/balance-calculation.service';
import { BalanceLedger, type BalanceDelta } from '../../bulk/balance-ledger';
import { snapshotRow } from '../../bulk/bulk-row-state';
import { appendTag, hasTag, normalizeTag } from './bulk-tag';

export type { BalanceDelta };

// Порядок причин в ответе: одинаковый у предпросмотра и у применения.
export const SKIP_REASONS = [
  'locked',
  'wrong_type',
  'already_in_category',
  'same_account',
  'pair_on_target',
  'pair_split',
  'already_tagged',
  'transfer_not_movable',
] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

/** Виды действия, которые принимает API: из этого списка — и проверка тела, и тип. */
export const BULK_ACTION_KINDS = [
  'category',
  'transfer',
  'account',
  'tag',
  'delete',
] as const satisfies readonly BulkAction['kind'][];

export type BulkActionKind = (typeof BULK_ACTION_KINDS)[number];

export type BulkAction =
  | { kind: 'category'; categoryId: string }
  | { kind: 'transfer'; toAccountId: string }
  | { kind: 'account'; accountId: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'delete' };

/**
 * Одна позиция ленты: строка или обе половины пары оплаты (`paymentGroupId`).
 * `selectedIds` — какие из `rows` попали в выборку; `locked` — серверный признак «вне правки».
 */
export interface BulkItem {
  rows: Transaction[];
  selectedIds: string[];
  locked: boolean;
}

export interface BulkContext {
  /** Целевая категория, найденная обработчиком; `null` или отсутствие — не найдена. */
  targetCategory?: { id: string; type: string } | null;
}

export interface BulkUpdateChanges {
  categoryId?: string;
  accountId?: string;
  description?: string;
}

/** Что записать в строку; `toTransfer` — строка становится переводом и выходит из пары оплаты. */
export type BulkWrite =
  | { kind: 'update'; id: string; changes: BulkUpdateChanges }
  | { kind: 'toTransfer'; id: string; toAccountId: string; toAmount: number; toCurrency: string }
  | { kind: 'delete'; id: string };

export interface SkippedCount {
  reason: SkipReason;
  count: number;
}

export interface BulkPlan {
  writes: BulkWrite[];
  /** Число записанных строк выборки; невыбранная половина пары пишется, но не считается. */
  changed: number;
  skipped: SkippedCount[];
  balanceDeltas: BalanceDelta[];
}

/** Действие с проверенной целью: тип категории найден, тег приведён к виду без `#`. */
type ResolvedAction =
  | { kind: 'category'; categoryId: string; categoryType: 'income' | 'expense' }
  | { kind: 'tag'; tag: string }
  | Extract<BulkAction, { kind: 'transfer' | 'account' | 'delete' }>;

/**
 * План правки без БД: каждая строка выборки — в `changed` или ровно в одной причине `skipped`.
 * Пара правится целиком, но её невыбранная половина в счёт не входит. Недопустимая цель — 400.
 */
export function planBulk(items: BulkItem[], action: BulkAction, ctx: BulkContext): BulkPlan {
  // Цель проверяется до разбора позиций: предпросмотр и применение отказывают одинаково.
  const resolved = resolveAction(action, ctx);
  const plan = new PlanBuilder(items.flatMap((item) => item.selectedIds));

  for (const item of items) {
    if (isLocked(item)) {
      plan.skip('locked', item.rows);
      continue;
    }

    switch (resolved.kind) {
      case 'category':
        planCategory(item, resolved.categoryId, resolved.categoryType, plan);
        break;
      case 'transfer':
        planTransfer(item, resolved.toAccountId, plan);
        break;
      case 'account':
        planAccount(item, resolved.accountId, plan);
        break;
      case 'tag':
        planTag(item, resolved.tag, plan);
        break;
      case 'delete':
        planDelete(item, plan);
        break;
    }
  }

  return plan.build();
}

function resolveAction(action: BulkAction, ctx: BulkContext): ResolvedAction {
  switch (action.kind) {
    case 'category':
      return { ...action, categoryType: resolveCategoryType(action.categoryId, ctx) };
    case 'tag':
      return { kind: 'tag', tag: normalizeTag(action.tag) };
    case 'transfer':
    case 'account':
    case 'delete':
      return action;
  }
}

/** Тип целевой категории; служебная, долговая, маркер или не найденная — отказ всей операции. */
function resolveCategoryType(categoryId: string, ctx: BulkContext): 'income' | 'expense' {
  const category = ctx.targetCategory;
  if (!category) {
    throw new BadRequestException('Категория не найдена');
  }
  // Обычный update целевую категорию не проверяет, поэтому отказ здесь.
  const forbidden = [categoryId, category.id].some((id) => {
    const builtinType = getDefaultCategoryById(id)?.type;
    return (
      ALL_DEBT_CATEGORY_IDS.includes(id) ||
      INFORMATIONAL_ONLY_CATEGORY_IDS.includes(id) ||
      builtinType === 'transfer' ||
      builtinType === 'adjustment'
    );
  });
  if (forbidden) {
    throw new BadRequestException(
      'В эту категорию нельзя переносить операции: она служебная или связана с долгом',
    );
  }
  if (category.type !== 'income' && category.type !== 'expense') {
    throw new BadRequestException('Категория должна быть расходной или доходной');
  }
  return category.type;
}

/** Замок сервера плюс признаки, видимые в самом агрегате: их массовая правка не трогает никогда. */
function isLocked(item: BulkItem): boolean {
  return (
    item.locked ||
    item.rows.some(
      (row) =>
        row.isInformational ||
        row.type.isAdjustment() ||
        row.debtId !== null ||
        row.settlementId !== null,
    )
  );
}

/** Категория пишется построчно: у пары обе половины в `rows`. */
function planCategory(
  item: BulkItem,
  categoryId: string,
  categoryType: 'income' | 'expense',
  plan: PlanBuilder,
): void {
  for (const row of item.rows) {
    if (row.typeValue !== categoryType) {
      plan.skip('wrong_type', [row]);
    } else if (row.categoryId === categoryId) {
      plan.skip('already_in_category', [row]);
    } else {
      plan.write({ kind: 'update', id: row.id, changes: { categoryId } });
    }
  }
}

/** Расход становится переводом в той же валюте: источник уже потерял деньги, приход — только на целевой счёт. */
function planTransfer(item: BulkItem, toAccountId: string, plan: PlanBuilder): void {
  const { rows } = item;
  if (!rows.every((row) => row.type.isExpense())) {
    plan.skip('wrong_type', rows);
    return;
  }
  if (rows.some((row) => row.accountId === toAccountId)) {
    plan.skip(rows.length > 1 ? 'pair_on_target' : 'same_account', rows);
    return;
  }

  for (const row of rows) {
    const receive = { toAccountId, toAmount: row.amountValue, toCurrency: row.currency };
    const before = snapshotRow(row);
    plan.write({ kind: 'toTransfer', id: row.id, ...receive });
    plan.shift(before, { ...before, type: 'transfer', ...receive });
  }
}

/** У пары переезжает только выбранная половина: обе на одном счёте оказаться не могут. */
function planAccount(item: BulkItem, accountId: string, plan: PlanBuilder): void {
  const { rows } = item;
  if (rows.some((row) => row.type.isTransfer())) {
    plan.skip('transfer_not_movable', rows);
    return;
  }

  const movable = rows.length > 1 ? rows.filter((row) => item.selectedIds.includes(row.id)) : rows;
  if (movable.length === 0) return;
  if (movable.length > 1) {
    plan.skip('pair_split', movable);
    return;
  }
  const row = movable[0];

  if (row.accountId === accountId) {
    plan.skip('same_account', [row]);
    return;
  }
  if (rows.some((other) => other !== row && other.accountId === accountId)) {
    plan.skip('pair_on_target', [row]);
    return;
  }

  const before = snapshotRow(row);
  plan.write({ kind: 'update', id: row.id, changes: { accountId } });
  plan.shift(before, { ...before, accountId });
}

function planTag(item: BulkItem, tag: string, plan: PlanBuilder): void {
  for (const row of item.rows) {
    if (hasTag(row.description, tag)) {
      plan.skip('already_tagged', [row]);
    } else {
      plan.write({
        kind: 'update',
        id: row.id,
        changes: { description: appendTag(row.description, tag) },
      });
    }
  }
}

/** Удаляется вся позиция, у пары обе половины; остатки разворачиваются ровно на влияние строки. */
function planDelete(item: BulkItem, plan: PlanBuilder): void {
  for (const row of item.rows) {
    plan.write({ kind: 'delete', id: row.id });
    plan.shift(snapshotRow(row), null);
  }
}

/** Копилка результата плана: записи, пропуски и изменения остатков. */
class PlanBuilder {
  private readonly writes: BulkWrite[] = [];
  private readonly skipCounts = new Map<SkipReason, number>();
  private readonly ledger = new BalanceLedger();
  private readonly selected: ReadonlySet<string>;
  private changed = 0;

  /** Счёт `changed` и `skipped` идёт по строкам выборки: так он сходится с итогом, что видел пользователь. */
  constructor(selectedIds: string[]) {
    this.selected = new Set(selectedIds);
  }

  write(write: BulkWrite): void {
    this.writes.push(write);
    if (this.selected.has(write.id)) this.changed++;
  }

  skip(reason: SkipReason, rows: Transaction[]): void {
    const count = rows.filter((row) => this.selected.has(row.id)).length;
    this.skipCounts.set(reason, (this.skipCounts.get(reason) ?? 0) + count);
  }

  /** Остатки сдвигаются на разницу влияния строки после правки и до неё; `after` `null` — удалена. */
  shift(before: BalanceAffectingRow, after: BalanceAffectingRow | null): void {
    this.ledger.addEffects(BalanceCalculationService.balanceEffects(before), -1);
    if (after) this.ledger.addEffects(BalanceCalculationService.balanceEffects(after), 1);
  }

  build(): BulkPlan {
    const skipped = SKIP_REASONS.filter((reason) => (this.skipCounts.get(reason) ?? 0) > 0).map(
      (reason) => ({ reason, count: this.skipCounts.get(reason) ?? 0 }),
    );

    return {
      writes: this.writes,
      changed: this.changed,
      skipped,
      balanceDeltas: this.ledger.deltas(),
    };
  }
}
