import { Test, type TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { DebtSettlementService } from './debt-settlement.service';
import { PayDebtCommand } from '../commands/pay-debt/pay-debt.command';
import { DEBT_REPOSITORY } from '../../domain/repositories';
import { Debt } from '../../domain/aggregates/debt';
import type { CreateTransactionCommand } from '../../../accounting/application/commands/create-transaction/create-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../accounting/domain/constants/default-categories';

// Правила суммы и переплаты проверяет settlement-plan.spec, расчёты на живой БД — e2e.
// Здесь — оркестрация: какие записи, на какой счёт и с каким settlement_id пишет сервис.
describe('DebtSettlementService', () => {
  let service: DebtSettlementService;

  const mockRepository = {
    findById: jest.fn(),
    findActiveByPerson: jest.fn(),
    save: jest.fn(),
  };
  const mockCommandBus = { execute: jest.fn() };
  const mockManager = { query: jest.fn() };
  const mockDataSource = {
    query: jest.fn(),
    transaction: jest.fn((cb: (m: typeof mockManager) => Promise<unknown>) => cb(mockManager)),
  };

  const DATE = new Date('2026-08-31T10:00:00.000Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DebtSettlementService,
        { provide: DEBT_REPOSITORY, useValue: mockRepository },
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(DebtSettlementService);
    jest.clearAllMocks();
    mockCommandBus.execute.mockReset();
    let counter = 0;
    mockCommandBus.execute.mockImplementation(() => Promise.resolve({ id: `tx-${++counter}` }));
    mockRepository.save.mockImplementation((debt: Debt) => Promise.resolve(debt));
    // Счёт долга существует — информационные отметки ложатся на него
    mockManager.query.mockResolvedValue([{ id: 'account-debt' }]);
    mockDataSource.query.mockResolvedValue([{ id: 'acc-fallback' }]);
  });

  /** Аргументы n-й созданной записи. */
  function txArg(nth: number): CreateTransactionCommand {
    const calls = mockCommandBus.execute.mock.calls as CreateTransactionCommand[][];
    return calls[nth][0];
  }

  describe('платёж', () => {
    function createDebt(
      overrides: {
        debtType?: 'given' | 'taken';
        totalAmount?: number;
        transactionId?: string | null;
        accountId?: string;
      } = {},
    ): Debt {
      const debt = Debt.create({
        id: 'debt-1',
        userId: 'user-1',
        name: 'Долг от Алексея',
        totalAmount: overrides.totalAmount ?? 1000,
        currency: 'USD',
        debtType: overrides.debtType ?? 'given',
        personName: 'Алексей',
        accountId: overrides.accountId,
      });
      debt.update({
        transactionId: 'transactionId' in overrides ? overrides.transactionId : 'tx-origin',
      });
      return debt;
    }

    function command(overrides: Partial<PayDebtCommand> = {}) {
      return new PayDebtCommand(
        overrides.userId ?? 'user-1',
        overrides.debtId ?? 'debt-1',
        overrides.amount ?? 300,
        overrides.accountId ?? 'account-1',
        overrides.date ?? DATE,
        overrides.forgiveRemainder ?? false,
        overrides.excessCategoryId,
        overrides.settleWithWork ?? false,
        overrides.workNote,
        overrides.workCategoryId,
      );
    }

    describe('частичный платёж', () => {
      it('уменьшает остаток и оставляет долг открытым', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(command({ amount: 300 }));

        expect(result.debt.remainingAmount).toBe(700);
        expect(result.debt.isClosed).toBe(false);
        expect(result.transactionIds).toEqual(['tx-1']);
        expect(result.paymentTransactionId).toBe('tx-1');
      });

      it('пишет возврат доходом в категорию возврата мне', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ debtType: 'given' }));

        await service.pay(command({ amount: 300 }));

        const tx = txArg(0);
        expect(tx.type).toBe('income');
        expect(tx.categoryId).toBe(DEBT_CATEGORY_IDS.RETURN_TO_ME);
        expect(tx.amount).toBe(300);
        expect(tx.description).toBe('Частичный платёж: Алексей');
        expect(tx.debtId).toBe('debt-1');
      });

      it('по взятому долгу возврат уходит расходом', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ debtType: 'taken' }));

        await service.pay(command({ amount: 300 }));

        const tx = txArg(0);
        expect(tx.type).toBe('expense');
        expect(tx.categoryId).toBe(DEBT_CATEGORY_IDS.RETURN_FROM_ME);
      });

      it('долг без движения денег возвращается такой же записью без баланса', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ transactionId: null }));

        await service.pay(command({ amount: 300 }));

        expect(txArg(0).isDebtRelated).toBe(false);
      });
    });

    describe('полное погашение', () => {
      it('закрывает долг и запоминает закрывающую запись', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(command({ amount: 1000 }));

        expect(result.debt.remainingAmount).toBe(0);
        expect(result.debt.isClosed).toBe(true);
        expect(result.debt.closeTransactionId).toBe('tx-1');
        expect(txArg(0).description).toBe('Закрытие долга: Алексей');
      });
    });

    describe('переплата', () => {
      it('создаёт вторую запись на излишек в выбранной категории, без debt_id', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(command({ amount: 1200, excessCategoryId: 'cat-bonus' }));

        expect(result.transactionIds).toEqual(['tx-1', 'tx-2']);
        expect(txArg(0).amount).toBe(1000);
        expect(txArg(1).amount).toBe(200);
        expect(txArg(1).categoryId).toBe('cat-bonus');
        expect(txArg(1).description).toBe('Переплата по долгу: Алексей');
        expect(txArg(1).debtId).toBeUndefined();
        expect(result.debt.isClosed).toBe(true);
      });
    });

    describe('прощение остатка', () => {
      it('закрывает долг, пишет информационную запись и заполняет прощённое', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(command({ amount: 300, forgiveRemainder: true }));

        expect(result.debt.isClosed).toBe(true);
        expect(result.debt.remainingAmount).toBe(0);
        expect(result.debt.forgivenAmount).toBe(700);

        const forgiven = txArg(1);
        expect(forgiven.categoryId).toBe(DEBT_CATEGORY_IDS.FORGIVEN);
        expect(forgiven.amount).toBe(700);
        expect(forgiven.isInformational).toBe(true);
        expect(forgiven.type).toBe('expense');
        expect(forgiven.description).toBe('Прощение долга: Алексей');
      });

      it('прощение без платежа не создаёт записи возврата', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(command({ amount: 0, forgiveRemainder: true }));

        expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
        expect(txArg(0).categoryId).toBe(DEBT_CATEGORY_IDS.FORGIVEN);
        expect(result.debt.forgivenAmount).toBe(1000);
        expect(result.debt.closeTransactionId).toBe('tx-1');
        expect(result.paymentTransactionId).toBeNull();
      });

      it('запись прощения ложится на счёт долга, а не платежа', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ accountId: 'account-debt' }));

        await service.pay(command({ amount: 0, forgiveRemainder: true }));

        expect(txArg(0).accountId).toBe('account-debt');
      });

      it('удалённый счёт долга не роняет прощение — запись уходит на счёт платежа', async () => {
        mockManager.query.mockResolvedValue([]);
        mockRepository.findById.mockResolvedValue(createDebt({ accountId: 'account-gone' }));

        await service.pay(command({ amount: 0, forgiveRemainder: true }));

        expect(txArg(0).accountId).toBe('account-1');
      });
    });

    describe('отработка', () => {
      it('гасит долг информационной отметкой, не трогая баланс', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(command({ amount: 300, settleWithWork: true }));

        expect(result.debt.remainingAmount).toBe(700);
        const tx = txArg(0);
        expect(tx.categoryId).toBe(DEBT_CATEGORY_IDS.WORKED_OFF);
        expect(tx.isInformational).toBe(true);
        expect(tx.isDebtRelated).toBe(false);
        expect(tx.amount).toBe(300);
      });

      it('закрывает долг, когда отработан весь остаток', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(command({ amount: 1000, settleWithWork: true }));

        expect(result.debt.isClosed).toBe(true);
        expect(result.debt.remainingAmount).toBe(0);
        expect(result.debt.closeTransactionId).toBe('tx-1');
      });

      it('заметка о работе попадает в описание', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        await service.pay(
          command({ amount: 300, settleWithWork: true, workNote: '  ремонт машины  ' }),
        );

        expect(txArg(0).description).toBe('Отработка долга: Алексей — ремонт машины');
      });

      it('без заметки описание остаётся коротким', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        await service.pay(command({ amount: 300, settleWithWork: true }));

        expect(txArg(0).description).toBe('Отработка долга: Алексей');
      });

      it('отметка ложится на счёт долга, а не на счёт платежа', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ accountId: 'account-debt' }));

        await service.pay(command({ amount: 300, settleWithWork: true }));

        expect(txArg(0).accountId).toBe('account-debt');
      });

      it('с категорией пишет пару записей: трату по категории и возврат долга', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ debtType: 'given' }));

        const result = await service.pay(
          command({ amount: 300, settleWithWork: true, workCategoryId: 'repair' }),
        );

        const work = txArg(0);
        expect(work.categoryId).toBe('repair');
        expect(work.type).toBe('expense');
        expect(work.amount).toBe(300);
        expect(work.isInformational).toBe(false);
        expect(work.debtId).toBe('debt-1');

        const back = txArg(1);
        expect(back.categoryId).toBe(DEBT_CATEGORY_IDS.RETURN_TO_ME);
        expect(back.type).toBe('income');
        expect(back.amount).toBe(300);
        expect(back.isInformational).toBe(false);

        // Пара даёт по балансу ноль, а долг гаснет обычным возвратом
        expect(result.debt.remainingAmount).toBe(700);
        expect(result.transactionIds).toEqual(['tx-1', 'tx-2']);
      });

      it('по взятому долгу пара зеркальная: доход за работу и возврат расходом', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ debtType: 'taken' }));

        await service.pay(
          command({ amount: 300, settleWithWork: true, workCategoryId: 'freelance' }),
        );

        expect(txArg(0).type).toBe('income');
        expect(txArg(0).categoryId).toBe('freelance');
        expect(txArg(1).type).toBe('expense');
        expect(txArg(1).categoryId).toBe(DEBT_CATEGORY_IDS.RETURN_FROM_ME);
      });

      it('обе ноги пары ложатся на один счёт — иначе ноль по балансу разъедется', async () => {
        mockRepository.findById.mockResolvedValue(createDebt({ accountId: 'account-debt' }));

        await service.pay(command({ amount: 300, settleWithWork: true, workCategoryId: 'repair' }));

        expect(txArg(0).accountId).toBe('account-debt');
        expect(txArg(1).accountId).toBe('account-debt');
      });

      it('закрытие парой ссылается на возврат, а не на трату', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(
          command({ amount: 1000, settleWithWork: true, workCategoryId: 'repair' }),
        );

        expect(result.debt.isClosed).toBe(true);
        expect(result.debt.closeTransactionId).toBe('tx-2');
      });

      it('остаток можно простить поверх отработки', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(
          command({ amount: 300, settleWithWork: true, forgiveRemainder: true }),
        );

        expect(txArg(0).categoryId).toBe(DEBT_CATEGORY_IDS.WORKED_OFF);
        expect(txArg(1).categoryId).toBe(DEBT_CATEGORY_IDS.FORGIVEN);
        expect(result.debt.forgivenAmount).toBe(700);
        expect(result.debt.isClosed).toBe(true);
      });
    });

    describe('расчёт', () => {
      it('все записи платежа несут один settlement_id, он же в ответе', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        const result = await service.pay(
          command({ amount: 1200, forgiveRemainder: true, excessCategoryId: 'cat-bonus' }),
        );

        expect(mockCommandBus.execute).toHaveBeenCalledTimes(2);
        expect(result.settlementId).toEqual(expect.any(String));
        expect(txArg(0).settlementId).toBe(result.settlementId);
        expect(txArg(1).settlementId).toBe(result.settlementId);
      });

      it('новый платёж получает новый settlement_id', async () => {
        mockRepository.findById.mockImplementation(() => Promise.resolve(createDebt()));

        const first = await service.pay(command({ amount: 100 }));
        const second = await service.pay(command({ amount: 100 }));

        expect(first.settlementId).not.toBe(second.settlementId);
      });
    });

    describe('отказы', () => {
      it('чужой долг', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());
        await expect(service.pay(command({ userId: 'user-2' }))).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('несуществующий долг', async () => {
        mockRepository.findById.mockResolvedValue(null);
        await expect(service.pay(command())).rejects.toThrow(NotFoundException);
      });

      it('закрытый долг платежей больше не принимает', async () => {
        const debt = createDebt();
        debt.update({ isClosed: true });
        mockRepository.findById.mockResolvedValue(debt);

        await expect(service.pay(command())).rejects.toThrow(ConflictException);
      });

      it('отказ плана приходит до первой записи', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        await expect(service.pay(command({ amount: 1200 }))).rejects.toThrow(BadRequestException);
        expect(mockCommandBus.execute).not.toHaveBeenCalled();
        expect(mockDataSource.transaction).not.toHaveBeenCalled();
      });
    });

    describe('атомарность', () => {
      it('всё происходит внутри одной транзакции БД', async () => {
        mockRepository.findById.mockResolvedValue(createDebt());

        await service.pay(command({ amount: 300 }));

        expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
        expect(mockRepository.save).toHaveBeenCalledWith(expect.any(Debt), mockManager);
        expect(txArg(0).manager).toBe(mockManager);
      });

      it('падение записи не оставляет долг изменённым', async () => {
        const debt = createDebt();
        mockRepository.findById.mockResolvedValue(debt);
        mockCommandBus.execute.mockRejectedValue(new Error('boom'));

        await expect(service.pay(command({ amount: 300 }))).rejects.toThrow('boom');
        expect(debt.remainingAmountValue).toBe(1000);
        expect(mockRepository.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('зачёт', () => {
    function makeDebt(
      id: string,
      debtType: 'given' | 'taken',
      remaining: number,
      options: { accountId?: string; createdAt?: Date } = {},
    ): Debt {
      return Debt.create({
        id,
        userId: 'user-1',
        name: `Долг ${id}`,
        totalAmount: remaining,
        currency: 'UZS',
        debtType,
        personName: 'Эрмурат',
        accountId: options.accountId ?? 'acc-1',
        createdAt: options.createdAt,
      });
    }

    const input = { userId: 'user-1', personName: 'Эрмурат', currency: 'UZS' };

    it('закрывает меньшую сторону и уменьшает большую', async () => {
      const given = makeDebt('d-given', 'given', 30381);
      const taken = makeDebt('d-taken', 'taken', 137170);
      mockRepository.findActiveByPerson.mockResolvedValue([given, taken]);

      const result = await service.offset(input);

      expect(result.offsetAmount).toBe(30381);
      expect(given.isClosed).toBe(true);
      expect(given.remainingAmountValue).toBe(0);
      expect(given.closeTransactionId).toBe('tx-1');
      expect(taken.isClosed).toBe(false);
      expect(taken.remainingAmountValue).toBe(106789);
      expect(result.debts).toHaveLength(2);
    });

    it('пишет по информационной записи на каждую сторону одной отметкой времени и одним расчётом', async () => {
      mockRepository.findActiveByPerson.mockResolvedValue([
        makeDebt('d-given', 'given', 500),
        makeDebt('d-taken', 'taken', 500),
      ]);

      const result = await service.offset(input);

      expect(mockCommandBus.execute).toHaveBeenCalledTimes(2);
      const [first, second] = [txArg(0), txArg(1)];
      expect(first.categoryId).toBe(DEBT_CATEGORY_IDS.OFFSET);
      expect(first.isInformational).toBe(true);
      expect(first.isDebtRelated).toBe(false);
      expect(first.type).toBe('income');
      expect(first.debtId).toBe('d-given');
      expect(second.type).toBe('expense');
      expect(second.debtId).toBe('d-taken');
      expect(first.date).toEqual(second.date);
      expect(first.settlementId).toBe(result.settlementId);
      expect(second.settlementId).toBe(result.settlementId);
      expect(first.manager).toBe(mockManager);
    });

    it('гасит несколько долгов одной стороны, начиная со старых', async () => {
      // Старый долг лежит в списке вторым: порядок задаёт дата долга, а не очередь в списке
      const newer = makeDebt('d-new', 'given', 400, { createdAt: new Date('2026-02-01') });
      const older = makeDebt('d-old', 'given', 400, { createdAt: new Date('2026-01-01') });
      const taken = makeDebt('d-taken', 'taken', 500);
      mockRepository.findActiveByPerson.mockResolvedValue([newer, older, taken]);

      const result = await service.offset(input);

      expect(result.offsetAmount).toBe(500);
      expect(older.isClosed).toBe(true);
      expect(newer.remainingAmountValue).toBe(300);
      expect(taken.isClosed).toBe(true);
    });

    it('обе стороны закрываются, когда суммы равны', async () => {
      const given = makeDebt('d-given', 'given', 1000);
      const taken = makeDebt('d-taken', 'taken', 1000);
      mockRepository.findActiveByPerson.mockResolvedValue([given, taken]);

      await service.offset(input);

      expect(given.isClosed).toBe(true);
      expect(taken.isClosed).toBe(true);
    });

    it('подставляет запасной счёт, когда счёт долга удалён', async () => {
      mockRepository.findActiveByPerson.mockResolvedValue([
        makeDebt('d-given', 'given', 100, { accountId: 'acc-deleted' }),
        makeDebt('d-taken', 'taken', 100, { accountId: 'acc-fallback' }),
      ]);

      await service.offset(input);

      expect(txArg(0).accountId).toBe('acc-fallback');
    });

    it('отказывается зачитывать, когда встречной стороны нет', async () => {
      mockRepository.findActiveByPerson.mockResolvedValue([makeDebt('d-given', 'given', 100)]);

      await expect(service.offset(input)).rejects.toThrow(ConflictException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('отказывается зачитывать без единого счёта', async () => {
      mockRepository.findActiveByPerson.mockResolvedValue([
        makeDebt('d-given', 'given', 100),
        makeDebt('d-taken', 'taken', 100),
      ]);
      mockDataSource.query.mockResolvedValue([]);

      await expect(service.offset(input)).rejects.toThrow(BadRequestException);
    });
  });
});
