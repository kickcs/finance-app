import { BadRequestException } from '@nestjs/common';
import { Transaction } from '../../../domain/aggregates/transaction';
import { BalanceCalculationService } from '../../../domain/services/balance-calculation.service';
import {
  ALL_DEBT_CATEGORY_IDS,
  INFORMATIONAL_ONLY_CATEGORY_IDS,
} from '../../../domain/constants/default-categories';
import {
  planBulk,
  type BulkAction,
  type BulkContext,
  type BulkItem,
  type BulkPlan,
} from './bulk-plan';

const NOW = new Date('2026-10-31T12:00:00Z');
const USER = 'user-1';

interface RowOpts {
  currency?: string;
  category?: string;
  description?: string;
}

const expense = (id: string, accountId: string, amount: number, o: RowOpts = {}): Transaction =>
  Transaction.createExpense(
    id,
    USER,
    accountId,
    o.category ?? 'cafe',
    amount,
    o.currency ?? 'UZS',
    NOW,
    o.description,
  );

const income = (id: string, accountId: string, amount: number, o: RowOpts = {}): Transaction =>
  Transaction.createIncome(
    id,
    USER,
    accountId,
    o.category ?? 'salary',
    amount,
    o.currency ?? 'UZS',
    NOW,
    o.description,
  );

const transfer = (
  id: string,
  from: string,
  to: string,
  amount: number,
  currency = 'UZS',
  toAmount = amount,
  toCurrency = currency,
  description?: string,
): Transaction =>
  Transaction.createTransfer(
    id,
    USER,
    from,
    to,
    'transfer',
    amount,
    currency,
    toAmount,
    toCurrency,
    NOW,
    description,
  );

const adjustment = (id: string, accountId: string, amount: number): Transaction =>
  Transaction.createAdjustment(id, USER, accountId, amount, 'UZS', NOW, false);

/** Пара оплаты с двух счетов: две половины в одной группе. */
const pair = (a: Transaction, b: Transaction, group = 'grp-1'): Transaction[] => {
  a.joinPaymentGroup(group);
  b.joinPaymentGroup(group);
  return [a, b];
};

const item = (rows: Transaction[], selected?: string[], locked = false): BulkItem => ({
  rows,
  selectedIds: selected ?? rows.map((r) => r.id),
  locked,
});

const single = (tx: Transaction): BulkItem => item([tx]);

const category = (categoryId: string): BulkAction => ({ kind: 'category', categoryId });
const ctxFor = (id: string, type: string) => ({ targetCategory: { id, type } });

const skippedOf = (plan: BulkPlan, reason: string): number =>
  plan.skipped.find((s) => s.reason === reason)?.count ?? 0;

const deltaOf = (plan: BulkPlan, accountId: string, currency: string): number =>
  plan.balanceDeltas.find((d) => d.accountId === accountId && d.currency === currency)?.delta ?? 0;

describe('planBulk', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('категория', () => {
    it('расход уходит в расходную категорию: запись update, балансы не двигаются', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 100))],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'e1', changes: { categoryId: 'transport' } },
      ]);
      expect(plan.changed).toBe(1);
      expect(plan.skipped).toEqual([]);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('доход уходит в доходную категорию со slug-id', () => {
      const plan = planBulk(
        [single(income('i1', 'A', 100))],
        category('gifts_income'),
        ctxFor('gifts_income', 'income'),
      );

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'i1', changes: { categoryId: 'gifts_income' } },
      ]);
    });

    it('пользовательская категория (uuid) принимается так же', () => {
      const id = '7b6f8a52-1d6e-4b57-9c3a-0d4f2e8a1b11';
      const plan = planBulk([single(expense('e1', 'A', 100))], category(id), ctxFor(id, 'expense'));

      expect(plan.changed).toBe(1);
    });

    it('категория другого типа, чем строка: пропуск wrong_type, остальные строки идут', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 100)), single(income('i1', 'A', 50))],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes.map((w) => w.kind === 'update' && w.id)).toEqual(['e1']);
      expect(skippedOf(plan, 'wrong_type')).toBe(1);
    });

    it('перевод и корректировка не участвуют: wrong_type / locked', () => {
      const plan = planBulk(
        [single(transfer('t1', 'A', 'B', 100)), single(adjustment('adj1', 'A', 10))],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'wrong_type')).toBe(1);
      expect(skippedOf(plan, 'locked')).toBe(1);
    });

    it('строка уже в целевой категории: пропуск already_in_category', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 100, { category: 'transport' }))],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes).toEqual([]);
      expect(plan.changed).toBe(0);
      expect(plan.skipped).toEqual([{ reason: 'already_in_category', count: 1 }]);
    });

    it('пара, одна половина уже в целевой категории: пишется только вторая', () => {
      const rows = pair(expense('e1', 'A', 60, { category: 'transport' }), expense('e2', 'B', 40));
      const plan = planBulk([item(rows)], category('transport'), ctxFor('transport', 'expense'));

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'e2', changes: { categoryId: 'transport' } },
      ]);
      expect(plan.skipped).toEqual([{ reason: 'already_in_category', count: 1 }]);
    });

    it('позиция с замком пропускается как locked, счёт идёт в строках', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk(
        [item(rows, undefined, true), item([expense('e3', 'A', 5)], undefined, true)],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'locked')).toBe(3);
    });

    it('пара, выбрана одна половина: категория пишется в обе, в changed — только выбранная', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk(
        [item(rows, ['e1'])],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'e1', changes: { categoryId: 'transport' } },
        { kind: 'update', id: 'e2', changes: { categoryId: 'transport' } },
      ]);
      expect(plan.changed).toBe(1);
      expect(plan.skipped).toEqual([]);
    });

    it('пара, выбрана одна половина, а она уже в целевой категории: пишется вторая, changed 0', () => {
      const rows = pair(expense('e1', 'A', 60, { category: 'transport' }), expense('e2', 'B', 40));
      const plan = planBulk(
        [item(rows, ['e1'])],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'e2', changes: { categoryId: 'transport' } },
      ]);
      expect(plan.changed).toBe(0);
      expect(plan.skipped).toEqual([{ reason: 'already_in_category', count: 1 }]);
    });

    it('пара под замком, выбрана одна половина: locked считает только её', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk(
        [item(rows, ['e1'], true)],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.writes).toEqual([]);
      expect(plan.skipped).toEqual([{ reason: 'locked', count: 1 }]);
    });

    it('цель не найдена: отказ всей операции', () => {
      expect(() =>
        planBulk([single(expense('e1', 'A', 100))], category('nope'), { targetCategory: null }),
      ).toThrow(BadRequestException);
      expect(() => planBulk([single(expense('e1', 'A', 100))], category('nope'), {})).toThrow(
        BadRequestException,
      );
    });

    it.each([...ALL_DEBT_CATEGORY_IDS])('долговая категория %s: отказ всей операции', (id) => {
      expect(() =>
        planBulk([single(expense('e1', 'A', 100))], category(id), ctxFor(id, 'expense')),
      ).toThrow(BadRequestException);
    });

    it.each([...INFORMATIONAL_ONLY_CATEGORY_IDS])('маркер %s: отказ всей операции', (id) => {
      expect(() =>
        planBulk([single(expense('e1', 'A', 100))], category(id), ctxFor(id, 'expense')),
      ).toThrow(BadRequestException);
    });

    it('transfer и balance_adjustment: отказ всей операции', () => {
      expect(() =>
        planBulk(
          [single(expense('e1', 'A', 1))],
          category('transfer'),
          ctxFor('transfer', 'transfer'),
        ),
      ).toThrow(BadRequestException);
      expect(() =>
        planBulk(
          [single(expense('e1', 'A', 1))],
          category('balance_adjustment'),
          ctxFor('balance_adjustment', 'adjustment'),
        ),
      ).toThrow(BadRequestException);
    });

    it('категория не расходного и не доходного типа: отказ', () => {
      expect(() =>
        planBulk([single(expense('e1', 'A', 1))], category('weird'), ctxFor('weird', 'transfer')),
      ).toThrow(BadRequestException);
    });

    it('отказ приходит и при пустой выборке: предпросмотр и запись ведут себя одинаково', () => {
      expect(() => planBulk([], category('debt_given'), ctxFor('debt_given', 'expense'))).toThrow(
        BadRequestException,
      );
    });
  });

  describe('перевод на свой счёт', () => {
    const toT: BulkAction = { kind: 'transfer', toAccountId: 'T' };

    it('расход становится переводом в своей сумме и валюте; приход только на целевой счёт', () => {
      const plan = planBulk([single(expense('e1', 'A', 100, { currency: 'USD' }))], toT, {});

      expect(plan.writes).toEqual([
        { kind: 'toTransfer', id: 'e1', toAccountId: 'T', toAmount: 100, toCurrency: 'USD' },
      ]);
      expect(plan.changed).toBe(1);
      expect(plan.balanceDeltas).toEqual([{ accountId: 'T', currency: 'USD', delta: 100 }]);
    });

    it('доход, перевод и корректировка: wrong_type / locked', () => {
      const plan = planBulk(
        [
          single(income('i1', 'A', 10)),
          single(transfer('t1', 'A', 'B', 10)),
          single(adjustment('adj1', 'A', 10)),
        ],
        toT,
        {},
      );

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'wrong_type')).toBe(2);
      expect(skippedOf(plan, 'locked')).toBe(1);
    });

    it('расход уже на целевом счёте: same_account', () => {
      const plan = planBulk([single(expense('e1', 'T', 100))], toT, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'same_account')).toBe(1);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('пара: два перевода, каждый в валюте своей половины; целевой счёт получает сумму половин', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk([item(rows)], toT, {});

      expect(plan.writes).toEqual([
        { kind: 'toTransfer', id: 'e1', toAccountId: 'T', toAmount: 60, toCurrency: 'UZS' },
        { kind: 'toTransfer', id: 'e2', toAccountId: 'T', toAmount: 40, toCurrency: 'UZS' },
      ]);
      expect(plan.changed).toBe(2);
      // Счета-источники: деньги уже ушли расходом, перевод списывает ту же сумму.
      expect(plan.balanceDeltas).toEqual([{ accountId: 'T', currency: 'UZS', delta: 100 }]);
    });

    it('пара, выбрана одна половина: переводами становятся обе, в changed — только выбранная', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk([item(rows, ['e2'])], toT, {});

      expect(plan.writes.map((w) => w.kind === 'toTransfer' && w.id)).toEqual(['e1', 'e2']);
      expect(plan.changed).toBe(1);
      expect(plan.skipped).toEqual([]);
      expect(plan.balanceDeltas).toEqual([{ accountId: 'T', currency: 'UZS', delta: 100 }]);
    });

    it('пара с разными валютами половин: приход на целевой счёт раздельно по валютам', () => {
      const rows = pair(expense('e1', 'A', 60, { currency: 'USD' }), expense('e2', 'B', 40));
      const plan = planBulk([item(rows)], toT, {});

      expect(plan.writes).toEqual([
        { kind: 'toTransfer', id: 'e1', toAccountId: 'T', toAmount: 60, toCurrency: 'USD' },
        { kind: 'toTransfer', id: 'e2', toAccountId: 'T', toAmount: 40, toCurrency: 'UZS' },
      ]);
      expect(deltaOf(plan, 'T', 'USD')).toBe(60);
      expect(deltaOf(plan, 'T', 'UZS')).toBe(40);
      expect(plan.balanceDeltas).toHaveLength(2);
    });

    it('пара, у которой одна половина уже на целевом счёте: пропуск всей пары', () => {
      const rows = pair(expense('e1', 'T', 60), expense('e2', 'B', 40));
      const plan = planBulk([item(rows)], toT, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'pair_on_target')).toBe(2);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('пара, выбрана одна половина, другая на целевом счёте: pair_on_target считает только выбранную', () => {
      const rows = pair(expense('e1', 'T', 60), expense('e2', 'B', 40));
      const plan = planBulk([item(rows, ['e2'])], toT, {});

      expect(plan.writes).toEqual([]);
      expect(plan.skipped).toEqual([{ reason: 'pair_on_target', count: 1 }]);
    });

    it('пара из доходов, выбрана одна половина: wrong_type 1', () => {
      const rows = pair(income('i1', 'A', 60), income('i2', 'B', 40));
      const plan = planBulk([item(rows, ['i1'])], toT, {});

      expect(plan.skipped).toEqual([{ reason: 'wrong_type', count: 1 }]);
    });

    it('пара из доходов: wrong_type на обе половины', () => {
      const rows = pair(income('i1', 'A', 60), income('i2', 'B', 40));
      const plan = planBulk([item(rows)], toT, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'wrong_type')).toBe(2);
    });

    it('приходы с нескольких позиций складываются в один счёт и валюту', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 10.1)), single(expense('e2', 'B', 20.2))],
        toT,
        {},
      );

      expect(plan.balanceDeltas).toEqual([{ accountId: 'T', currency: 'UZS', delta: 30.3 }]);
    });
  });

  describe('смена счёта', () => {
    const toB: BulkAction = { kind: 'account', accountId: 'B' };

    it('расход: старый счёт получает сумму обратно, новый списывается', () => {
      const plan = planBulk([single(expense('e1', 'A', 100))], toB, {});

      expect(plan.writes).toEqual([{ kind: 'update', id: 'e1', changes: { accountId: 'B' } }]);
      expect(plan.balanceDeltas).toEqual([
        { accountId: 'A', currency: 'UZS', delta: 100 },
        { accountId: 'B', currency: 'UZS', delta: -100 },
      ]);
    });

    it('доход: старый счёт теряет сумму, новый получает', () => {
      const plan = planBulk([single(income('i1', 'A', 100, { currency: 'USD' }))], toB, {});

      expect(deltaOf(plan, 'A', 'USD')).toBe(-100);
      expect(deltaOf(plan, 'B', 'USD')).toBe(100);
    });

    it('знак берётся из BalanceCalculationService.nonTransferDirection', () => {
      const spy = jest.spyOn(BalanceCalculationService, 'nonTransferDirection');

      planBulk([single(expense('e1', 'A', 100))], toB, {});

      expect(spy).toHaveBeenCalledWith('expense', false);
    });

    it('перевод: transfer_not_movable', () => {
      const plan = planBulk([single(transfer('t1', 'A', 'C', 100))], toB, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'transfer_not_movable')).toBe(1);
    });

    it('строка уже на целевом счёте: same_account', () => {
      const plan = planBulk([single(expense('e1', 'B', 100))], toB, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'same_account')).toBe(1);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('пара, выбрана одна половина: переезжает она, группа остаётся', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'C', 40));
      const plan = planBulk([item(rows, ['e1'])], toB, {});

      expect(plan.writes).toEqual([{ kind: 'update', id: 'e1', changes: { accountId: 'B' } }]);
      expect(plan.changed).toBe(1);
      expect(deltaOf(plan, 'A', 'UZS')).toBe(60);
      expect(deltaOf(plan, 'B', 'UZS')).toBe(-60);
    });

    it('пара, выбрана одна половина, а вторая уже на целевом счёте: pair_on_target', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk([item(rows, ['e1'])], toB, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'pair_on_target')).toBe(1);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('пара, выбранная половина уже на целевом счёте: same_account', () => {
      const rows = pair(expense('e1', 'B', 60), expense('e2', 'C', 40));
      const plan = planBulk([item(rows, ['e1'])], toB, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'same_account')).toBe(1);
    });

    it('пара, выбраны обе половины: pair_split, обе не переезжают', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'C', 40));
      const plan = planBulk([item(rows, ['e1', 'e2'])], toB, {});

      expect(plan.writes).toEqual([]);
      expect(plan.skipped).toEqual([{ reason: 'pair_split', count: 2 }]);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('пара, выбраны обе половины и одна уже на целевом счёте: тоже pair_split', () => {
      const rows = pair(expense('e1', 'B', 60), expense('e2', 'C', 40));
      const plan = planBulk([item(rows, ['e1', 'e2'])], toB, {});

      expect(plan.skipped).toEqual([{ reason: 'pair_split', count: 2 }]);
    });

    it('дельты нескольких позиций суммируются по счёту и валюте', () => {
      const plan = planBulk(
        [
          single(expense('e1', 'A', 100)),
          single(expense('e2', 'A', 50)),
          single(expense('e3', 'A', 5, { currency: 'USD' })),
        ],
        toB,
        {},
      );

      expect(plan.balanceDeltas).toEqual([
        { accountId: 'A', currency: 'USD', delta: 5 },
        { accountId: 'A', currency: 'UZS', delta: 150 },
        { accountId: 'B', currency: 'USD', delta: -5 },
        { accountId: 'B', currency: 'UZS', delta: -150 },
      ]);
    });

    it('расход и доход одной суммы между теми же счетами взаимно гасятся: нулевые записи опущены', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 100)), single(income('i1', 'A', 100))],
        toB,
        {},
      );

      expect(plan.changed).toBe(2);
      expect(plan.balanceDeltas).toEqual([]);
    });
  });

  describe('тег', () => {
    const tag = (t: string): BulkAction => ({ kind: 'tag', tag: t });

    it('дописывает тег в описание', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 1, { description: 'обед' }))],
        tag('кафе'),
        {},
      );

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'e1', changes: { description: 'обед #кафе' } },
      ]);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('вход нормализуется: #Кафе с пробелами пишется как #Кафе', () => {
      const plan = planBulk([single(expense('e1', 'A', 1))], tag('  #Кафе '), {});

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'e1', changes: { description: '#Кафе' } },
      ]);
    });

    it('тег уже есть без учёта регистра и со знаком после: already_tagged', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 1, { description: 'обед #Кафе, с коллегами' }))],
        tag('кафе'),
        {},
      );

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'already_tagged')).toBe(1);
    });

    it('#кафе2 не считается тегом #кафе: строка получает тег', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 1, { description: 'обед #кафе2' }))],
        tag('кафе'),
        {},
      );

      expect(plan.writes).toEqual([
        { kind: 'update', id: 'e1', changes: { description: 'обед #кафе2 #кафе' } },
      ]);
    });

    it('переводы тоже получают тег', () => {
      const plan = planBulk(
        [single(transfer('t1', 'A', 'B', 10, 'UZS', 10, 'UZS', 'на карту'))],
        tag('копилка'),
        {},
      );

      expect(plan.writes).toEqual([
        { kind: 'update', id: 't1', changes: { description: 'на карту #копилка' } },
      ]);
    });

    it('пара, выбрана одна половина: тег пишется в обе, в changed — только выбранная', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk([item(rows, ['e2'])], tag('кафе'), {});

      expect(plan.writes.map((w) => w.kind === 'update' && w.id)).toEqual(['e1', 'e2']);
      expect(plan.changed).toBe(1);
    });

    it('пара, выбрана одна половина и тег у неё уже есть: пишется вторая, already_tagged 1', () => {
      const rows = pair(
        expense('e1', 'A', 60, { description: 'обед #кафе' }),
        expense('e2', 'B', 40, { description: 'обед' }),
      );
      const plan = planBulk([item(rows, ['e1'])], tag('кафе'), {});

      expect(plan.writes.map((w) => w.kind === 'update' && w.id)).toEqual(['e2']);
      expect(plan.changed).toBe(0);
      expect(plan.skipped).toEqual([{ reason: 'already_tagged', count: 1 }]);
    });

    it('позиция с замком: locked', () => {
      const plan = planBulk([item([expense('e1', 'A', 1)], undefined, true)], tag('кафе'), {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'locked')).toBe(1);
    });

    it.each(['', '   ', '#', 'два слова', 'с.точкой', 'со,запятой', 'с)скобкой'])(
      'недопустимый тег %j: отказ всей операции, и при пустой выборке тоже',
      (bad) => {
        expect(() => planBulk([], tag(bad), {})).toThrow(BadRequestException);
        expect(() => planBulk([single(expense('e1', 'A', 1))], tag(bad), {})).toThrow(
          BadRequestException,
        );
      },
    );
  });

  describe('удаление', () => {
    const del: BulkAction = { kind: 'delete' };

    it('расход: счёт получает сумму обратно', () => {
      const plan = planBulk([single(expense('e1', 'A', 100))], del, {});

      expect(plan.writes).toEqual([{ kind: 'delete', id: 'e1' }]);
      expect(plan.changed).toBe(1);
      expect(plan.balanceDeltas).toEqual([{ accountId: 'A', currency: 'UZS', delta: 100 }]);
    });

    it('доход: счёт теряет сумму', () => {
      const plan = planBulk([single(income('i1', 'A', 100))], del, {});

      expect(plan.balanceDeltas).toEqual([{ accountId: 'A', currency: 'UZS', delta: -100 }]);
    });

    it('перевод: источник получает сумму, получатель теряет сумму прихода в своей валюте', () => {
      const plan = planBulk(
        [single(transfer('t1', 'A', 'B', 100, 'USD', 1250000, 'UZS'))],
        del,
        {},
      );

      expect(plan.balanceDeltas).toEqual([
        { accountId: 'A', currency: 'USD', delta: 100 },
        { accountId: 'B', currency: 'UZS', delta: -1250000 },
      ]);
    });

    it('пара: удаляются обе половины, даже если выбрана одна; в changed — только выбранная', () => {
      const rows = pair(expense('e1', 'A', 60), expense('e2', 'B', 40));
      const plan = planBulk([item(rows, ['e1'])], del, {});

      expect(plan.writes).toEqual([
        { kind: 'delete', id: 'e1' },
        { kind: 'delete', id: 'e2' },
      ]);
      expect(plan.changed).toBe(1);
      expect(deltaOf(plan, 'A', 'UZS')).toBe(60);
      expect(deltaOf(plan, 'B', 'UZS')).toBe(40);
    });

    it('позиции с замком и информационные строки не удаляются', () => {
      const informational = Transaction.createExpense(
        'inf',
        USER,
        'A',
        'debt_forgiven',
        10,
        'UZS',
        NOW,
        undefined,
        false,
        undefined,
        true,
      );
      const plan = planBulk(
        [item([expense('e1', 'A', 5)], undefined, true), single(informational)],
        del,
        {},
      );

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'locked')).toBe(2);
      expect(plan.balanceDeltas).toEqual([]);
    });

    it('строки долга и расчёта по признакам агрегата тоже locked, даже если флаг не поднят', () => {
      const withDebt = Transaction.createExpense(
        'd1',
        USER,
        'A',
        'cafe',
        10,
        'UZS',
        NOW,
        undefined,
        false,
        'debt-1',
      );
      const withSettlement = Transaction.createIncome(
        's1',
        USER,
        'A',
        'cafe',
        10,
        'UZS',
        NOW,
        undefined,
        false,
        undefined,
        false,
        'settlement-1',
      );
      const plan = planBulk([single(withDebt), single(withSettlement)], del, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'locked')).toBe(2);
    });

    it('корректировка locked: баланс её не разворачивается массовой правкой', () => {
      const plan = planBulk([single(adjustment('adj1', 'A', 10))], del, {});

      expect(plan.writes).toEqual([]);
      expect(skippedOf(plan, 'locked')).toBe(1);
    });

    it('дельты разных позиций суммируются и взаимно гасящиеся записи опускаются', () => {
      const plan = planBulk(
        [
          single(expense('e1', 'A', 100)),
          single(income('i1', 'A', 100)),
          single(expense('e2', 'B', 30)),
          single(expense('e3', 'B', 20, { currency: 'USD' })),
        ],
        del,
        {},
      );

      expect(plan.balanceDeltas).toEqual([
        { accountId: 'B', currency: 'USD', delta: 20 },
        { accountId: 'B', currency: 'UZS', delta: 30 },
      ]);
    });

    it('суммы округляются до копеек: 0.1 + 0.2 даёт 0.3', () => {
      const plan = planBulk(
        [single(expense('e1', 'A', 0.1)), single(expense('e2', 'A', 0.2))],
        del,
        {},
      );

      expect(plan.balanceDeltas).toEqual([{ accountId: 'A', currency: 'UZS', delta: 0.3 }]);
    });
  });

  describe('пропуски', () => {
    it('одинаковые причины с разных позиций складываются, порядок причин стабилен', () => {
      const plan = planBulk(
        [
          single(expense('e2', 'A', 1, { category: 'transport' })),
          single(income('i1', 'A', 1)),
          item([expense('e1', 'A', 1)], undefined, true),
          single(income('i2', 'A', 1)),
        ],
        category('transport'),
        ctxFor('transport', 'expense'),
      );

      expect(plan.skipped).toEqual([
        { reason: 'locked', count: 1 },
        { reason: 'wrong_type', count: 2 },
        { reason: 'already_in_category', count: 1 },
      ]);
    });

    describe('каждая строка выборки — в changed или ровно в одной причине skipped', () => {
      // Невыбранная половина пары правится вместе с выбранной, но в счёт не входит.
      const selection = (): BulkItem[] => [
        single(expense('e1', 'A', 100)),
        single(expense('e2', 'B', 50, { category: 'transport', description: 'обед #кафе' })),
        single(income('i1', 'A', 30)),
        single(transfer('t1', 'A', 'C', 10)),
        single(adjustment('adj1', 'A', 5)),
        item(pair(expense('p1', 'A', 60), expense('p2', 'C', 40))),
        item(pair(expense('q1', 'B', 60), expense('q2', 'C', 40), 'grp-2')),
        item(pair(expense('r1', 'A', 60), expense('r2', 'C', 40), 'grp-3'), ['r1']),
        item(pair(expense('s1', 'B', 60), expense('s2', 'C', 40), 'grp-4'), ['s2']),
        item(pair(expense('u1', 'A', 60), expense('u2', 'C', 40), 'grp-5'), ['u1'], true),
        item([expense('l1', 'A', 1)], undefined, true),
      ];

      it.each<[string, BulkAction, BulkContext]>([
        ['category', category('transport'), ctxFor('transport', 'expense')],
        ['transfer', { kind: 'transfer', toAccountId: 'B' }, {}],
        ['account', { kind: 'account', accountId: 'B' }, {}],
        ['tag', { kind: 'tag', tag: 'кафе' }, {}],
        ['delete', { kind: 'delete' }, {}],
      ])('%s', (_kind, action, ctx) => {
        const items = selection();
        const rowCount = items.reduce((sum, it) => sum + it.selectedIds.length, 0);

        const plan = planBulk(items, action, ctx);

        const skippedCount = plan.skipped.reduce((sum, s) => sum + s.count, 0);
        expect(plan.changed + skippedCount).toBe(rowCount);
      });
    });

    it('пустая выборка: пустой план', () => {
      expect(planBulk([], { kind: 'delete' }, {})).toEqual({
        writes: [],
        changed: 0,
        skipped: [],
        balanceDeltas: [],
      });
    });
  });
});
