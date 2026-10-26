import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  setupDebtTestContext,
  createDebt,
  balanceOf,
  debtOf,
  recordsOf,
  recordsOfSettlement,
  INITIAL_BALANCE,
  type DebtTestContext,
} from './helpers/debt-test-db';
import { PayDebtCommand } from '../src/modules/debt/application/commands/pay-debt/pay-debt.command';
import { OffsetDebtsCommand } from '../src/modules/debt/application/commands/offset-debts/offset-debts.command';
import { ReopenDebtCommand } from '../src/modules/debt/application/commands/reopen-debt/reopen-debt.command';
import { ReverseSettlementCommand } from '../src/modules/debt/application/commands/reverse-settlement/reverse-settlement.command';
import { DeleteDebtCommand } from '../src/modules/debt/application/commands/delete-debt/delete-debt.command';
import { CreateTransactionCommand } from '../src/modules/accounting/application/commands/create-transaction/create-transaction.command';
import { DeleteTransactionCommand } from '../src/modules/accounting/application/commands/delete-transaction/delete-transaction.command';
import { UpdateTransactionCommand } from '../src/modules/accounting/application/commands/update-transaction/update-transaction.command';
import { GetTransactionsPaginatedQuery } from '../src/modules/accounting/application/queries/get-transactions-paginated/get-transactions-paginated.query';
import { TransactionOrmEntity } from '../src/modules/accounting/infrastructure/persistence/typeorm/transaction.orm-entity';
import { DebtOrmEntity } from '../src/modules/debt/infrastructure/persistence/typeorm/debt.orm-entity';
import type { DebtResponseDto } from '../src/modules/debt/application/mappers/debt-response.mapper';
import { DEBT_REPOSITORY, type IDebtRepository } from '../src/modules/debt/domain/repositories';
import { DEBT_CATEGORY_IDS } from '../src/modules/accounting/domain/constants/default-categories';

interface PayResult {
  debt: DebtResponseDto;
  paymentTransactionId: string | null;
  transactionIds: string[];
  settlementId: string;
}

interface OffsetResult {
  personName: string;
  currency: string;
  offsetAmount: number;
  debts: DebtResponseDto[];
  settlementId: string;
}

const DATE = new Date('2026-10-25T10:00:00.000Z');

describe('Расчёт по долгу: запись расчётов', () => {
  let ctx: DebtTestContext;

  beforeEach(async () => {
    ctx = await setupDebtTestContext();
  });

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  const pay = (command: PayDebtCommand) =>
    ctx.commandBus.execute<PayDebtCommand, PayResult>(command);

  describe('платёж', () => {
    it('с переплатой пишет две записи одного расчёта: возврат с debt_id и переплату без него', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });

      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 350, ctx.accountId, DATE, false, 'other_income'),
      );

      expect(result.settlementId).toEqual(expect.any(String));

      const settlement = await recordsOfSettlement(ctx, result.settlementId);
      expect(settlement).toHaveLength(2);
      const payment = settlement.find((r) => r.categoryId === DEBT_CATEGORY_IDS.RETURN_TO_ME);
      const excess = settlement.find((r) => r.categoryId === 'other_income');
      expect(payment).toMatchObject({ debtId, amount: 300, type: 'income' });
      expect(excess).toMatchObject({ debtId: null, amount: 50, type: 'income' });

      // Запись выдачи — не расчёт; переплата в записи долга не видна: её связь только settlement_id.
      const ofDebt = await recordsOf(ctx, debtId);
      expect(ofDebt).toHaveLength(2);
      expect(ofDebt.find((r) => r.categoryId === DEBT_CATEGORY_IDS.GIVEN)?.settlementId).toBeNull();
      expect(ofDebt.map((r) => r.id)).not.toContain(excess!.id);

      const state = await debtOf(ctx, debtId);
      expect(state).toMatchObject({ isClosed: true, remainingAmount: 0, forgivenAmount: 0 });
      expect(state.closeTransactionId).toBe(payment!.id);
      expect(result.paymentTransactionId).toBe(payment!.id);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE - 300 + 350);
    });

    it('частичный платёж с прощением: возврат и debt_forgiven одного расчёта, долг закрыт', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });

      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE, true),
      );

      const settlement = await recordsOfSettlement(ctx, result.settlementId);
      expect(settlement).toHaveLength(2);
      const payment = settlement.find((r) => r.categoryId === DEBT_CATEGORY_IDS.RETURN_TO_ME);
      const forgiven = settlement.find((r) => r.categoryId === DEBT_CATEGORY_IDS.FORGIVEN);
      expect(payment).toMatchObject({ debtId, amount: 100, isInformational: false });
      expect(forgiven).toMatchObject({ debtId, amount: 200, isInformational: true });

      const state = await debtOf(ctx, debtId);
      expect(state).toMatchObject({ isClosed: true, remainingAmount: 0, forgivenAmount: 200 });
      expect(state.closeTransactionId).toBe(payment!.id);
      // Прощение денег не двигает: на счёт вернулось только 100.
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE - 300 + 100);
    });

    it('отработка с категорией: нога работы и возврат одного расчёта, баланс счёта не меняется', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);

      // Платёж указан со второго счёта, но обе ноги уходят на счёт долга.
      const result = await pay(
        new PayDebtCommand(
          ctx.userId,
          debtId,
          300,
          ctx.secondAccountId,
          DATE,
          false,
          undefined,
          true,
          'ремонт',
          'other_expense',
        ),
      );

      const settlement = await recordsOfSettlement(ctx, result.settlementId);
      expect(settlement).toHaveLength(2);
      const work = settlement.find((r) => r.categoryId === 'other_expense');
      const back = settlement.find((r) => r.categoryId === DEBT_CATEGORY_IDS.RETURN_TO_ME);
      expect(work).toMatchObject({
        debtId,
        type: 'expense',
        amount: 300,
        isDebtRelated: false,
        isInformational: false,
        accountId: ctx.accountId,
      });
      expect(back).toMatchObject({ debtId, type: 'income', amount: 300, accountId: ctx.accountId });

      const state = await debtOf(ctx, debtId);
      expect(state.isClosed).toBe(true);
      expect(state.closeTransactionId).toBe(back!.id);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      expect(await balanceOf(ctx, ctx.secondAccountId)).toBe(INITIAL_BALANCE);
    });
  });

  describe('порядок долгов', () => {
    it('открытые долги человека идут старыми первыми, при равной дате — по id', async () => {
      const person = 'Эрмурат';
      const same = new Date('2026-03-01T10:00:00.000Z');
      const newest = await createDebt(ctx, {
        debtType: 'given',
        amount: 10,
        personName: person,
        createdAt: new Date('2026-04-01T10:00:00.000Z'),
      });
      // Пять долгов с одной датой: случайно совпасть с порядком вставки по id почти невозможно.
      const twins: string[] = [];
      for (let i = 0; i < 5; i++) {
        twins.push(
          await createDebt(ctx, {
            debtType: i % 2 === 0 ? 'given' : 'taken',
            amount: 10,
            personName: person,
            createdAt: same,
          }),
        );
      }
      const oldest = await createDebt(ctx, {
        debtType: 'taken',
        amount: 10,
        personName: person,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      });

      const repository = ctx.app.get<IDebtRepository>(DEBT_REPOSITORY);
      const debts = await repository.findActiveByPerson(ctx.userId, person, 'UZS');

      expect(debts.map((d) => d.id)).toEqual([oldest, ...[...twins].sort(), newest]);
    });
  });

  describe('зачёт', () => {
    it('записи debt_offset всех затронутых долгов несут один settlement_id, старые гасятся первыми', async () => {
      const person = 'Эрмурат';
      // Новый долг заводится первым: порядок гашения идёт по дате долга, а не по порядку создания.
      const givenNew = await createDebt(ctx, {
        debtType: 'given',
        amount: 100,
        personName: person,
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      });
      const givenOld = await createDebt(ctx, {
        debtType: 'given',
        amount: 200,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      const taken = await createDebt(ctx, {
        debtType: 'taken',
        amount: 250,
        personName: person,
        createdAt: new Date('2026-01-15T10:00:00.000Z'),
      });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);

      const result = await ctx.commandBus.execute<OffsetDebtsCommand, OffsetResult>(
        new OffsetDebtsCommand(ctx.userId, person, 'UZS'),
      );

      expect(result.offsetAmount).toBe(250);
      expect(result.settlementId).toEqual(expect.any(String));

      const settlement = await recordsOfSettlement(ctx, result.settlementId);
      expect(settlement).toHaveLength(3);
      for (const record of settlement) {
        expect(record).toMatchObject({
          categoryId: DEBT_CATEGORY_IDS.OFFSET,
          isInformational: true,
        });
      }
      const amountOf = (debtId: string) =>
        settlement.find((r) => r.debtId === debtId)?.amount ?? null;
      expect(amountOf(givenOld)).toBe(200);
      expect(amountOf(givenNew)).toBe(50);
      expect(amountOf(taken)).toBe(250);

      expect(await debtOf(ctx, givenOld)).toMatchObject({ isClosed: true, remainingAmount: 0 });
      expect(await debtOf(ctx, givenNew)).toMatchObject({ isClosed: false, remainingAmount: 50 });
      expect(await debtOf(ctx, taken)).toMatchObject({ isClosed: true, remainingAmount: 0 });

      // Деньги при зачёте не двигаются.
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });
  });
});

describe('Расчёт по долгу: отмена', () => {
  let ctx: DebtTestContext;

  beforeEach(async () => {
    ctx = await setupDebtTestContext();
  });

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  const pay = (command: PayDebtCommand) =>
    ctx.commandBus.execute<PayDebtCommand, PayResult>(command);
  const reopen = (debtId: string) =>
    ctx.commandBus.execute<ReopenDebtCommand, DebtResponseDto>(
      new ReopenDebtCommand(debtId, ctx.userId),
    );
  const offset = (personName: string) =>
    ctx.commandBus.execute<OffsetDebtsCommand, OffsetResult>(
      new OffsetDebtsCommand(ctx.userId, personName, 'UZS'),
    );
  const reverse = (settlementId: string, userId = ctx.userId) =>
    ctx.commandBus.execute<ReverseSettlementCommand, DebtResponseDto[]>(
      new ReverseSettlementCommand(settlementId, userId),
    );

  // Старый возврат без settlement_id: так выглядели записи до появления расчётов.
  const legacyReturn = (debtId: string, amount: number) =>
    ctx.commandBus.execute<CreateTransactionCommand, { id: string }>(
      new CreateTransactionCommand(
        ctx.userId,
        ctx.accountId,
        DEBT_CATEGORY_IDS.RETURN_TO_ME,
        amount,
        'UZS',
        'income',
        DATE,
        'Частичный платёж',
        true,
        undefined,
        undefined,
        undefined,
        debtId,
      ),
    );

  describe('отмена закрытия', () => {
    it('после переплаты на тот же счёт: обе записи удалены, баланс как до платежа', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 350, ctx.accountId, DATE, false, 'other_income'),
      );
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore + 350);

      const reopened = await reopen(debtId);

      expect(reopened).toMatchObject({ id: debtId, isClosed: false });
      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      // Остаётся только запись выдачи: возврат и переплата ушли вместе.
      const left = await recordsOf(ctx, debtId);
      expect(left.map((r) => r.categoryId)).toEqual([DEBT_CATEGORY_IDS.GIVEN]);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 300,
        forgivenAmount: 0,
        isClosed: false,
        closeTransactionId: null,
        closedAt: null,
      });
    });

    it('закрытие только прощением: прощение снято, остаток восстановлен', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 0, ctx.accountId, DATE, true),
      );
      const settlement = await recordsOfSettlement(ctx, result.settlementId);
      expect(settlement.map((r) => r.categoryId)).toEqual([DEBT_CATEGORY_IDS.FORGIVEN]);
      expect(await debtOf(ctx, debtId)).toMatchObject({ isClosed: true, forgivenAmount: 300 });

      await reopen(debtId);

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 300,
        forgivenAmount: 0,
        isClosed: false,
        closeTransactionId: null,
      });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('прощение после частичного платежа: платёж уцелел, остаток вернулся к тому, что было до прощения', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const partial = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      await pay(new PayDebtCommand(ctx.userId, debtId, 0, ctx.accountId, DATE, true));
      expect(await debtOf(ctx, debtId)).toMatchObject({ isClosed: true, forgivenAmount: 200 });

      await reopen(debtId);

      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 200,
        forgivenAmount: 0,
        isClosed: false,
        closeTransactionId: null,
      });
      expect(await recordsOfSettlement(ctx, partial.settlementId)).toHaveLength(1);
    });

    it('платёж с прощением остатка: возврат и прощение уходят вместе, остаток полный', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE, true));

      await reopen(debtId);

      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 300,
        forgivenAmount: 0,
        isClosed: false,
      });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      expect((await recordsOf(ctx, debtId)).map((r) => r.categoryId)).toEqual([
        DEBT_CATEGORY_IDS.GIVEN,
      ]);
    });

    it('отработка с категорией: обе ноги удалены, баланс прежний', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(
        new PayDebtCommand(
          ctx.userId,
          debtId,
          300,
          ctx.accountId,
          DATE,
          false,
          undefined,
          true,
          'ремонт',
          'other_expense',
        ),
      );
      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(2);

      await reopen(debtId);

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 300,
        isClosed: false,
        closeTransactionId: null,
      });
    });

    it('отработка без категории: отметка удалена, остаток вернулся', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 300, ctx.accountId, DATE, false, undefined, true),
      );
      const [marker] = await recordsOfSettlement(ctx, result.settlementId);
      expect(marker.categoryId).toBe(DEBT_CATEGORY_IDS.WORKED_OFF);

      await reopen(debtId);

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 300, isClosed: false });
    });

    it('зачёт: отмена с закрытой стороны открывает оба долга, записи зачёта удалены', async () => {
      const person = 'Эрмурат';
      const given = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      const taken = await createDebt(ctx, {
        debtType: 'taken',
        amount: 100,
        personName: person,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await offset(person);
      expect(await debtOf(ctx, taken)).toMatchObject({ isClosed: true });
      expect(await debtOf(ctx, given)).toMatchObject({ isClosed: false, remainingAmount: 200 });

      await reopen(taken);

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await debtOf(ctx, taken)).toMatchObject({
        isClosed: false,
        remainingAmount: 100,
        closeTransactionId: null,
      });
      expect(await debtOf(ctx, given)).toMatchObject({ isClosed: false, remainingAmount: 300 });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('порядок: расчёт заблокирован более поздним платежом по другому долгу — 409 с именем, ничего не изменилось', async () => {
      const person = 'Эрмурат';
      const given = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      const taken = await createDebt(ctx, {
        debtType: 'taken',
        amount: 100,
        personName: person,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      });
      const offsetResult = await offset(person);
      await pay(new PayDebtCommand(ctx.userId, given, 50, ctx.accountId, DATE));
      const balanceBefore = await balanceOf(ctx, ctx.accountId);

      const attempt = reopen(taken);

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(
        `Сначала отмените более поздний расчёт по долгу «${person}»`,
      );
      expect(await recordsOfSettlement(ctx, offsetResult.settlementId)).toHaveLength(2);
      expect(await debtOf(ctx, taken)).toMatchObject({ isClosed: true, remainingAmount: 0 });
      expect(await debtOf(ctx, given)).toMatchObject({ isClosed: false, remainingAmount: 150 });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it.each([
      ['без close_transaction_id', false],
      ['с close_transaction_id на запись без расчёта', true],
    ])(
      'закрытый долг без расчёта %s: остаток total − Σ возвратов, записи не тронуты',
      async (_n, linkClose) => {
        const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
        const legacy = await legacyReturn(debtId, 100);
        // Закрытие патчем: долг закрыт, записей закрытия нет.
        await ctx.dataSource.getRepository(DebtOrmEntity).update(
          { id: debtId },
          {
            isClosed: true,
            remainingAmount: 0,
            closedAt: new Date(),
            closeTransactionId: linkClose ? legacy.id : null,
          },
        );
        const balanceBefore = await balanceOf(ctx, ctx.accountId);

        await reopen(debtId);

        expect(await debtOf(ctx, debtId)).toMatchObject({
          remainingAmount: 200,
          forgivenAmount: 0,
          isClosed: false,
          closeTransactionId: null,
          closedAt: null,
        });
        const legacyAfter = (await recordsOf(ctx, debtId)).find((r) => r.id === legacy.id);
        expect(legacyAfter).toMatchObject({ amount: 100, settlementId: null });
        expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      },
    );

    it.each([
      ['ровно покрыли долг', [200, 100]],
      ['перекрыли долг', [200, 150]],
    ])(
      'закрытый долг без расчёта, чьи возвраты %s: 409, долг остаётся закрытым',
      async (_n, amounts) => {
        const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
        for (const amount of amounts) await legacyReturn(debtId, amount);
        // Закрытие патчем: долг закрыт, записей закрытия нет.
        await ctx.dataSource
          .getRepository(DebtOrmEntity)
          .update({ id: debtId }, { isClosed: true, remainingAmount: 0, closedAt: new Date() });
        const recordsBefore = await recordsOf(ctx, debtId);
        const balanceBefore = await balanceOf(ctx, ctx.accountId);

        const attempt = reopen(debtId);

        await expect(attempt).rejects.toBeInstanceOf(ConflictException);
        await expect(attempt).rejects.toThrow(
          'Долг погашен платежами полностью — отмените последний платёж в истории',
        );
        expect(await debtOf(ctx, debtId)).toMatchObject({
          remainingAmount: 0,
          isClosed: true,
          closeTransactionId: null,
        });
        expect((await debtOf(ctx, debtId)).closedAt).not.toBeNull();
        expect(await recordsOf(ctx, debtId)).toEqual(recordsBefore);
        expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      },
    );

    it('не закрытый долг, чужой и неизвестный: прежние ошибки', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });

      await expect(reopen(debtId)).rejects.toBeInstanceOf(ConflictException);
      await expect(reopen(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        ctx.commandBus.execute(new ReopenDebtCommand(debtId, randomUUID())),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('отмена расчёта по id', () => {
    it('частичный платёж на открытом долге: остаток и баланс как до платежа', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 200 });

      const affected = await reverse(result.settlementId);

      expect(affected.map((d) => d.id)).toEqual([debtId]);
      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 300, isClosed: false });
      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('долг в валюте, которой нет на счёте: запись несёт сумму в валюте долга, остаток восстанавливается точно', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300, currency: 'USD' });
      const first = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      const usdAfterFirst = await balanceOf(ctx, ctx.accountId, 'USD');
      const uzsAfterFirst = await balanceOf(ctx, ctx.accountId);
      const second = await pay(new PayDebtCommand(ctx.userId, debtId, 20, ctx.accountId, DATE));
      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 180 });

      await reverse(second.settlementId);

      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 200, isClosed: false });
      expect(await balanceOf(ctx, ctx.accountId, 'USD')).toBe(usdAfterFirst);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(uzsAfterFirst);
      expect(await recordsOfSettlement(ctx, first.settlementId)).toHaveLength(1);
    });

    it('неизвестный расчёт — 404, чужой — 403', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));

      await expect(reverse(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
      await expect(reverse(result.settlementId, randomUUID())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(1);
    });

    it('во внешней транзакции: откат внешней транзакции возвращает всё как было', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 350, ctx.accountId, DATE, false, 'other_income'),
      );
      const balanceAfterPayment = await balanceOf(ctx, ctx.accountId);

      await expect(
        ctx.dataSource.transaction(async (manager) => {
          await ctx.commandBus.execute(
            new ReverseSettlementCommand(result.settlementId, ctx.userId, manager),
          );
          throw new Error('откат');
        }),
      ).rejects.toThrow('откат');

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(2);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceAfterPayment);
      expect(await debtOf(ctx, debtId)).toMatchObject({ isClosed: true, remainingAmount: 0 });
    });
  });
});

describe('Расчёт по долгу: удаление и правка записей, удаление долга, лента', () => {
  let ctx: DebtTestContext;

  beforeEach(async () => {
    ctx = await setupDebtTestContext();
  });

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  const pay = (command: PayDebtCommand) =>
    ctx.commandBus.execute<PayDebtCommand, PayResult>(command);
  const offset = (personName: string) =>
    ctx.commandBus.execute<OffsetDebtsCommand, OffsetResult>(
      new OffsetDebtsCommand(ctx.userId, personName, 'UZS'),
    );
  // Удаление из ленты истории: без skipDebtCheck, как делает пользователь.
  const deleteRecord = (recordId: string) =>
    ctx.commandBus.execute(new DeleteTransactionCommand(recordId, ctx.userId));
  const updateRecord = (recordId: string, data: UpdateTransactionCommand['data']) =>
    ctx.commandBus.execute(new UpdateTransactionCommand(recordId, ctx.userId, data));
  const removeDebt = (debtId: string, userId = ctx.userId) =>
    ctx.commandBus.execute(new DeleteDebtCommand(debtId, userId));

  const recordOf = async (settlementId: string, categoryId: string) => {
    const found = (await recordsOfSettlement(ctx, settlementId)).find(
      (r) => r.categoryId === categoryId,
    );
    if (!found) throw new Error(`В расчёте нет записи ${categoryId}`);
    return found;
  };
  const debtRows = (debtId: string) =>
    ctx.dataSource.getRepository(DebtOrmEntity).count({ where: { id: debtId } });
  const userRecords = () =>
    ctx.dataSource.getRepository(TransactionOrmEntity).count({ where: { userId: ctx.userId } });

  describe('удаление записи расчёта из ленты', () => {
    it('частичный платёж: остаток и баланс как до платежа', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      const payment = await recordOf(result.settlementId, DEBT_CATEGORY_IDS.RETURN_TO_ME);

      await deleteRecord(payment.id);

      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 300, isClosed: false });
      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('закрывающий платёж: долг открывается, ссылка на закрытие снята', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 300, ctx.accountId, DATE));
      expect(await debtOf(ctx, debtId)).toMatchObject({ isClosed: true });

      await deleteRecord(result.paymentTransactionId!);

      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 300,
        isClosed: false,
        closeTransactionId: null,
        closedAt: null,
      });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('запись переплаты: снимается весь расчёт, включая платёж', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 350, ctx.accountId, DATE, false, 'other_income'),
      );
      const excess = await recordOf(result.settlementId, 'other_income');
      expect(excess.debtId).toBeNull();

      await deleteRecord(excess.id);

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 300,
        isClosed: false,
        closeTransactionId: null,
      });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('запись прощения: снимается весь расчёт, остаток полный', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE, true),
      );
      const forgiven = await recordOf(result.settlementId, DEBT_CATEGORY_IDS.FORGIVEN);

      await deleteRecord(forgiven.id);

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await debtOf(ctx, debtId)).toMatchObject({
        remainingAmount: 300,
        forgivenAmount: 0,
        isClosed: false,
      });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('нога работы и отметка отработки уходят вместе с расчётом', async () => {
      const withLeg = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: 'Тимур',
      });
      const marker = await createDebt(ctx, { debtType: 'given', amount: 200, personName: 'Азиз' });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const legResult = await pay(
        new PayDebtCommand(
          ctx.userId,
          withLeg,
          300,
          ctx.accountId,
          DATE,
          false,
          undefined,
          true,
          'ремонт',
          'other_expense',
        ),
      );
      const markerResult = await pay(
        new PayDebtCommand(ctx.userId, marker, 200, ctx.accountId, DATE, false, undefined, true),
      );

      await deleteRecord((await recordOf(legResult.settlementId, 'other_expense')).id);
      await deleteRecord(
        (await recordOf(markerResult.settlementId, DEBT_CATEGORY_IDS.WORKED_OFF)).id,
      );

      expect(await debtOf(ctx, withLeg)).toMatchObject({ remainingAmount: 300, isClosed: false });
      expect(await debtOf(ctx, marker)).toMatchObject({ remainingAmount: 200, isClosed: false });
      expect(await recordsOfSettlement(ctx, legResult.settlementId)).toHaveLength(0);
      expect(await recordsOfSettlement(ctx, markerResult.settlementId)).toHaveLength(0);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('запись зачёта: оба долга открываются, остатки как до зачёта', async () => {
      const person = 'Эрмурат';
      const given = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      const taken = await createDebt(ctx, {
        debtType: 'taken',
        amount: 100,
        personName: person,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      });
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const result = await offset(person);
      const takenSide = (await recordsOfSettlement(ctx, result.settlementId)).find(
        (r) => r.debtId === taken,
      )!;

      await deleteRecord(takenSide.id);

      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await debtOf(ctx, taken)).toMatchObject({
        remainingAmount: 100,
        isClosed: false,
        closeTransactionId: null,
      });
      expect(await debtOf(ctx, given)).toMatchObject({ remainingAmount: 300, isClosed: false });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('расчёт заблокирован более поздним: 409 с именем, записи и остатки на месте', async () => {
      const person = 'Эрмурат';
      const given = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      await createDebt(ctx, {
        debtType: 'taken',
        amount: 100,
        personName: person,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      });
      const offsetResult = await offset(person);
      await pay(new PayDebtCommand(ctx.userId, given, 50, ctx.accountId, DATE));
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const [anySide] = await recordsOfSettlement(ctx, offsetResult.settlementId);

      const attempt = deleteRecord(anySide.id);

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(
        `Сначала отмените более поздний расчёт по долгу «${person}»`,
      );
      expect(await recordsOfSettlement(ctx, offsetResult.settlementId)).toHaveLength(2);
      expect(await debtOf(ctx, given)).toMatchObject({ remainingAmount: 150 });
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('чужая запись расчёта — 403, записи на месте', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      const payment = await recordOf(result.settlementId, DEBT_CATEGORY_IDS.RETURN_TO_ME);

      await expect(
        ctx.commandBus.execute(new DeleteTransactionCommand(payment.id, randomUUID())),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(1);
    });

    it('запись выдачи открытого долга не расчёт: прежний запрет — 400', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const [issue] = await recordsOf(ctx, debtId);

      await expect(deleteRecord(issue.id)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('запись зачёта без settlement_id из ленты не удаляется — 400', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const legacy = await ctx.commandBus.execute<CreateTransactionCommand, { id: string }>(
        new CreateTransactionCommand(
          ctx.userId,
          ctx.accountId,
          DEBT_CATEGORY_IDS.OFFSET,
          100,
          'UZS',
          'income',
          DATE,
          'Взаимозачёт: Friend',
          false,
          undefined,
          undefined,
          undefined,
          debtId,
          undefined,
          undefined,
          true,
        ),
      );

      await expect(deleteRecord(legacy.id)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('правка записи расчёта', () => {
    const SETTLEMENT_ERROR =
      'Запись расчёта по долгу меняется со стороны долга: отмените расчёт и проведите заново';

    it('сумма, валюта, тип и категория не меняются — 400 с пояснением, запись и баланс прежние', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      const payment = await recordOf(result.settlementId, DEBT_CATEGORY_IDS.RETURN_TO_ME);
      const balanceBefore = await balanceOf(ctx, ctx.accountId);

      for (const data of [
        { amount: 50 },
        { currency: 'USD' },
        { type: 'expense' },
        { categoryId: 'food' },
        { categoryId: DEBT_CATEGORY_IDS.RETURN_FROM_ME },
      ]) {
        const attempt = updateRecord(payment.id, data);
        await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
        await expect(attempt).rejects.toThrow(SETTLEMENT_ERROR);
      }

      expect(await recordsOfSettlement(ctx, result.settlementId)).toEqual([payment]);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 200 });
    });

    it('описание и дата правятся; те же сумма и категория, присланные формой, не мешают', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      const payment = await recordOf(result.settlementId, DEBT_CATEGORY_IDS.RETURN_TO_ME);
      const newDate = new Date('2026-10-20T10:00:00.000Z');

      await updateRecord(payment.id, { description: 'Вернул наличными', date: newDate });
      await updateRecord(payment.id, {
        amount: 100,
        currency: 'UZS',
        type: 'income',
        categoryId: DEBT_CATEGORY_IDS.RETURN_TO_ME,
        description: 'Вернул переводом',
      });

      const after = await recordOf(result.settlementId, DEBT_CATEGORY_IDS.RETURN_TO_ME);
      expect(after).toMatchObject({
        description: 'Вернул переводом',
        amount: 100,
        settlementId: result.settlementId,
      });
      expect(after.date).toEqual(newDate);
    });

    it('нога работы: недолговая категория меняется, долговая — 400', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const result = await pay(
        new PayDebtCommand(
          ctx.userId,
          debtId,
          300,
          ctx.accountId,
          DATE,
          false,
          undefined,
          true,
          'ремонт',
          'other_expense',
        ),
      );
      const leg = await recordOf(result.settlementId, 'other_expense');

      await updateRecord(leg.id, { categoryId: 'food' });
      await expect(
        updateRecord(leg.id, { categoryId: DEBT_CATEGORY_IDS.GIVEN }),
      ).rejects.toBeInstanceOf(BadRequestException);

      const records = await recordsOfSettlement(ctx, result.settlementId);
      expect(records.map((r) => r.categoryId).sort()).toEqual(
        ['food', DEBT_CATEGORY_IDS.RETURN_TO_ME].sort(),
      );
    });

    it('смена счёта переносит влияние записи на баланс, а отмена расчёта потом возвращает оба счёта', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      const mainBefore = await balanceOf(ctx, ctx.accountId);
      const result = await pay(new PayDebtCommand(ctx.userId, debtId, 100, ctx.accountId, DATE));
      const payment = await recordOf(result.settlementId, DEBT_CATEGORY_IDS.RETURN_TO_ME);

      await updateRecord(payment.id, { accountId: ctx.secondAccountId });

      expect(await balanceOf(ctx, ctx.accountId)).toBe(mainBefore);
      expect(await balanceOf(ctx, ctx.secondAccountId)).toBe(INITIAL_BALANCE + 100);

      await deleteRecord(payment.id);

      expect(await balanceOf(ctx, ctx.accountId)).toBe(mainBefore);
      expect(await balanceOf(ctx, ctx.secondAccountId)).toBe(INITIAL_BALANCE);
      expect(await debtOf(ctx, debtId)).toMatchObject({ remainingAmount: 300 });
    });
  });

  describe('удаление долга', () => {
    const person = 'Эрмурат';

    /** Выданный 300 и взятый 100: после зачёта взятый закрыт, выданный остался на 200. */
    const givenAndTaken = async () => {
      const given = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      const taken = await createDebt(ctx, {
        debtType: 'taken',
        amount: 100,
        personName: person,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      });
      return { given, taken };
    };

    it('закрытый зачётом долг: встречный восстановлен, записи зачёта и долга удалены, выдача снята', async () => {
      const { given, taken } = await givenAndTaken();
      const result = await offset(person);

      await removeDebt(taken);

      expect(await debtRows(taken)).toBe(0);
      expect(await recordsOf(ctx, taken)).toHaveLength(0);
      expect(await recordsOfSettlement(ctx, result.settlementId)).toHaveLength(0);
      expect(await debtOf(ctx, given)).toMatchObject({
        remainingAmount: 300,
        isClosed: false,
        closeTransactionId: null,
      });
      // Остались только выдача первого долга; доход от взятого долга снят.
      expect((await recordsOf(ctx, given)).map((r) => r.categoryId)).toEqual([
        DEBT_CATEGORY_IDS.GIVEN,
      ]);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE - 300);
    });

    it('открытая сторона зачёта: закрытый встречный долг тоже открывается', async () => {
      const { given, taken } = await givenAndTaken();
      await offset(person);

      await removeDebt(given);

      expect(await debtRows(given)).toBe(0);
      expect(await debtOf(ctx, taken)).toMatchObject({
        remainingAmount: 100,
        isClosed: false,
        closeTransactionId: null,
      });
      expect((await recordsOf(ctx, taken)).map((r) => r.categoryId)).toEqual([
        DEBT_CATEGORY_IDS.TAKEN,
      ]);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE + 100);
    });

    it('собственный более поздний платёж не мешает удалить долг с зачётом', async () => {
      const { given, taken } = await givenAndTaken();
      await offset(person);
      await pay(new PayDebtCommand(ctx.userId, given, 50, ctx.accountId, DATE));

      await removeDebt(given);

      expect(await debtRows(given)).toBe(0);
      expect(await debtOf(ctx, taken)).toMatchObject({ remainingAmount: 100, isClosed: false });
      expect(await userRecords()).toBe(1);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE + 100);
    });

    it('два зачёта с разными встречными долгами снимаются от нового к старому', async () => {
      const { given, taken } = await givenAndTaken();
      await offset(person);
      const takenLater = await createDebt(ctx, {
        debtType: 'taken',
        amount: 50,
        personName: person,
        createdAt: new Date('2026-01-03T10:00:00.000Z'),
      });
      await offset(person);
      expect(await debtOf(ctx, given)).toMatchObject({ remainingAmount: 150 });

      await removeDebt(given);

      expect(await debtRows(given)).toBe(0);
      expect(await debtOf(ctx, taken)).toMatchObject({ remainingAmount: 100, isClosed: false });
      expect(await debtOf(ctx, takenLater)).toMatchObject({ remainingAmount: 50, isClosed: false });
      expect(await userRecords()).toBe(2);
    });

    it('зачёт заблокирован поздним платежом по встречному: 409, долг и все записи на месте', async () => {
      const given = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      const taken = await createDebt(ctx, {
        debtType: 'taken',
        amount: 150,
        personName: person,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      });
      // Собственный платёж по взятому долгу: удаляется раньше зачёта и должен вернуться при откате.
      await pay(new PayDebtCommand(ctx.userId, taken, 50, ctx.accountId, DATE));
      const offsetResult = await offset(person);
      await pay(new PayDebtCommand(ctx.userId, given, 50, ctx.accountId, DATE));
      const recordsBefore = [...(await recordsOf(ctx, given)), ...(await recordsOf(ctx, taken))];
      const balanceBefore = await balanceOf(ctx, ctx.accountId);
      const takenBefore = await debtOf(ctx, taken);
      const givenBefore = await debtOf(ctx, given);

      const attempt = removeDebt(taken);

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toThrow(
        `Сначала отмените более поздний расчёт по долгу «${person}»`,
      );
      expect(await debtRows(taken)).toBe(1);
      expect(await debtOf(ctx, taken)).toEqual(takenBefore);
      expect(await debtOf(ctx, given)).toEqual(givenBefore);
      expect(await recordsOfSettlement(ctx, offsetResult.settlementId)).toHaveLength(2);
      expect([...(await recordsOf(ctx, given)), ...(await recordsOf(ctx, taken))]).toEqual(
        recordsBefore,
      );
      expect(await balanceOf(ctx, ctx.accountId)).toBe(balanceBefore);
    });

    it('платёж с переплатой: записи долга и переплата без debt_id удалены, баланс как до долга', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });
      await pay(
        new PayDebtCommand(ctx.userId, debtId, 350, ctx.accountId, DATE, false, 'other_income'),
      );
      expect(await userRecords()).toBe(3);

      await removeDebt(debtId);

      expect(await debtRows(debtId)).toBe(0);
      expect(await userRecords()).toBe(0);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE);
    });

    it('долг с комиссией: запись комиссии тоже удалена, баланс как до долга', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300, feeAmount: 10 });
      const { feeTransactionId } = await debtOf(ctx, debtId);
      expect(feeTransactionId).toEqual(expect.any(String));
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE - 300 - 10);

      await removeDebt(debtId);

      expect(await debtRows(debtId)).toBe(0);
      expect(
        await ctx.dataSource
          .getRepository(TransactionOrmEntity)
          .count({ where: { id: feeTransactionId! } }),
      ).toBe(0);
      expect(await userRecords()).toBe(0);
      expect(await balanceOf(ctx, ctx.accountId)).toBe(INITIAL_BALANCE);
    });

    it('неизвестный долг — 404, чужой — 403', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300 });

      await expect(removeDebt(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
      await expect(removeDebt(debtId, randomUUID())).rejects.toBeInstanceOf(ForbiddenException);
      expect(await debtRows(debtId)).toBe(1);
      expect(await userRecords()).toBe(1);
    });
  });

  describe('лента долга', () => {
    const feed = async (debtId: string) => {
      const page = await ctx.queryBus.execute<
        GetTransactionsPaginatedQuery,
        { data: { id: string }[] }
      >(
        new GetTransactionsPaginatedQuery(
          ctx.userId,
          50,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          debtId,
        ),
      );
      return page.data.map((r) => r.id);
    };

    it('отдаёт запись переплаты расчёта долга, но не записи других долгов', async () => {
      const debtId = await createDebt(ctx, { debtType: 'given', amount: 300, personName: 'Тимур' });
      const otherId = await createDebt(ctx, { debtType: 'given', amount: 200, personName: 'Азиз' });
      const result = await pay(
        new PayDebtCommand(ctx.userId, debtId, 350, ctx.accountId, DATE, false, 'other_income'),
      );
      const otherResult = await pay(
        new PayDebtCommand(ctx.userId, otherId, 250, ctx.accountId, DATE, false, 'other_income'),
      );
      const excess = await recordOf(result.settlementId, 'other_income');
      const otherExcess = await recordOf(otherResult.settlementId, 'other_income');
      const unrelated = await ctx.commandBus.execute<CreateTransactionCommand, { id: string }>(
        new CreateTransactionCommand(
          ctx.userId,
          ctx.accountId,
          'other_income',
          10,
          'UZS',
          'income',
          DATE,
          'Без долга',
        ),
      );

      const ids = await feed(debtId);

      expect(ids).toContain(excess.id);
      expect(ids).toContain(result.paymentTransactionId);
      expect(ids).toHaveLength(3);
      expect(ids).not.toContain(otherExcess.id);
      expect(ids).not.toContain(unrelated.id);
    });

    it('запись зачёта другого долга в ленту не попадает: у неё свой debt_id', async () => {
      const person = 'Эрмурат';
      const given = await createDebt(ctx, {
        debtType: 'given',
        amount: 300,
        personName: person,
        createdAt: new Date('2026-01-01T10:00:00.000Z'),
      });
      const taken = await createDebt(ctx, {
        debtType: 'taken',
        amount: 100,
        personName: person,
        createdAt: new Date('2026-01-02T10:00:00.000Z'),
      });
      const result = await ctx.commandBus.execute<OffsetDebtsCommand, OffsetResult>(
        new OffsetDebtsCommand(ctx.userId, person, 'UZS'),
      );
      const settlement = await recordsOfSettlement(ctx, result.settlementId);

      const ids = await feed(given);

      expect(ids).toContain(settlement.find((r) => r.debtId === given)!.id);
      expect(ids).not.toContain(settlement.find((r) => r.debtId === taken)!.id);
    });
  });
});
