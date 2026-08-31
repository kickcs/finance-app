import { Test, type TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { PayDebtHandler } from './pay-debt.handler';
import { PayDebtCommand } from './pay-debt.command';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { Debt } from '../../../domain/aggregates/debt';
import type { CreateTransactionCommand } from '../../../../accounting/application/commands/create-transaction/create-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../../accounting/domain/constants/default-categories';

describe('PayDebtHandler', () => {
  let handler: PayDebtHandler;

  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTransactionId: jest.fn(),
    findByCloseTransactionId: jest.fn(),
    findActiveByPerson: jest.fn(),
    hasOpenDebtsForTransaction: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getPaginated: jest.fn(),
  };
  const mockCommandBus = { execute: jest.fn() };
  const mockManager = { query: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn((cb: (m: typeof mockManager) => Promise<void>) => cb(mockManager)),
  };

  const DATE = new Date('2026-08-31T10:00:00.000Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayDebtHandler,
        { provide: DEBT_REPOSITORY, useValue: mockRepository },
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<PayDebtHandler>(PayDebtHandler);
    jest.clearAllMocks();
    mockCommandBus.execute.mockReset();
    let counter = 0;
    mockCommandBus.execute.mockImplementation(() => Promise.resolve({ id: `tx-${++counter}` }));
    mockRepository.save.mockImplementation((debt: Debt) => Promise.resolve(debt));
  });

  function createDebt(
    overrides: {
      debtType?: 'given' | 'taken';
      totalAmount?: number;
      remainingAmount?: number;
      transactionId?: string | null;
      accountId?: string;
      personName?: string;
    } = {},
  ): Debt {
    const debt = Debt.create({
      id: 'debt-1',
      userId: 'user-1',
      name: 'Долг от Алексея',
      totalAmount: overrides.totalAmount ?? 1000,
      currency: 'USD',
      debtType: overrides.debtType ?? 'given',
      personName: overrides.personName ?? 'Алексей',
      accountId: overrides.accountId,
    });
    debt.update({
      remainingAmount: overrides.remainingAmount ?? overrides.totalAmount ?? 1000,
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
    );
  }

  /** Аргументы n-й созданной транзакции. */
  function txArg(nth: number): CreateTransactionCommand {
    const calls = mockCommandBus.execute.mock.calls as CreateTransactionCommand[][];
    return calls[nth][0];
  }

  describe('частичный платёж', () => {
    it('уменьшает остаток и оставляет долг открытым', async () => {
      const debt = createDebt();
      mockRepository.findById.mockResolvedValue(debt);

      const result = await handler.execute(command({ amount: 300 }));

      expect(result.debt.remainingAmount).toBe(700);
      expect(result.debt.isClosed).toBe(false);
      expect(result.transactionIds).toEqual(['tx-1']);
    });

    it('пишет возврат доходом в категорию возврата мне', async () => {
      mockRepository.findById.mockResolvedValue(createDebt({ debtType: 'given' }));

      await handler.execute(command({ amount: 300 }));

      const tx = txArg(0);
      expect(tx.type).toBe('income');
      expect(tx.categoryId).toBe(DEBT_CATEGORY_IDS.RETURN_TO_ME);
      expect(tx.amount).toBe(300);
      expect(tx.description).toBe('Частичный платёж: Алексей');
      expect(tx.debtId).toBe('debt-1');
    });

    it('по взятому долгу возврат уходит расходом', async () => {
      mockRepository.findById.mockResolvedValue(createDebt({ debtType: 'taken' }));

      await handler.execute(command({ amount: 300 }));

      const tx = txArg(0);
      expect(tx.type).toBe('expense');
      expect(tx.categoryId).toBe(DEBT_CATEGORY_IDS.RETURN_FROM_ME);
    });

    it('долг без движения денег возвращается такой же записью без баланса', async () => {
      mockRepository.findById.mockResolvedValue(createDebt({ transactionId: null }));

      await handler.execute(command({ amount: 300 }));

      expect(txArg(0).isDebtRelated).toBe(false);
    });
  });

  describe('полное погашение', () => {
    it('закрывает долг и запоминает закрывающую транзакцию', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());

      const result = await handler.execute(command({ amount: 1000 }));

      expect(result.debt.remainingAmount).toBe(0);
      expect(result.debt.isClosed).toBe(true);
      expect(result.debt.closeTransactionId).toBe('tx-1');
      expect(txArg(0).description).toBe('Закрытие долга: Алексей');
    });
  });

  describe('переплата', () => {
    it('создаёт вторую запись на излишек в выбранной категории', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());

      const result = await handler.execute(
        command({ amount: 1200, excessCategoryId: 'cat-bonus' }),
      );

      expect(result.transactionIds).toEqual(['tx-1', 'tx-2']);
      expect(txArg(0).amount).toBe(1000);
      expect(txArg(1).amount).toBe(200);
      expect(txArg(1).categoryId).toBe('cat-bonus');
      expect(txArg(1).description).toBe('Переплата по долгу: Алексей');
      expect(result.debt.isClosed).toBe(true);
    });

    it('без категории для излишка отказывает', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());

      await expect(handler.execute(command({ amount: 1200 }))).rejects.toThrow(BadRequestException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('прощение остатка', () => {
    it('закрывает долг, пишет информационную запись и заполняет прощённое', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());

      const result = await handler.execute(command({ amount: 300, forgiveRemainder: true }));

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

      const result = await handler.execute(command({ amount: 0, forgiveRemainder: true }));

      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(txArg(0).categoryId).toBe(DEBT_CATEGORY_IDS.FORGIVEN);
      expect(result.debt.forgivenAmount).toBe(1000);
      expect(result.debt.closeTransactionId).toBe('tx-1');
    });

    it('запись прощения ложится на счёт долга, а не платежа', async () => {
      mockRepository.findById.mockResolvedValue(createDebt({ accountId: 'account-debt' }));

      await handler.execute(command({ amount: 0, forgiveRemainder: true }));

      expect(txArg(0).accountId).toBe('account-debt');
    });
  });

  describe('отказы', () => {
    it('не находит чужой долг', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());
      await expect(handler.execute(command({ userId: 'user-2' }))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('несуществующий долг', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(handler.execute(command())).rejects.toThrow(NotFoundException);
    });

    it('закрытый долг платежей больше не принимает', async () => {
      const debt = createDebt();
      debt.update({ isClosed: true });
      mockRepository.findById.mockResolvedValue(debt);

      await expect(handler.execute(command())).rejects.toThrow(ConflictException);
    });

    it('нулевой платёж без прощения бессмысленен', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());
      await expect(handler.execute(command({ amount: 0 }))).rejects.toThrow(BadRequestException);
    });

    it('отрицательная сумма', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());
      await expect(handler.execute(command({ amount: -5 }))).rejects.toThrow(BadRequestException);
    });
  });

  describe('атомарность', () => {
    it('всё происходит внутри одной транзакции БД', async () => {
      mockRepository.findById.mockResolvedValue(createDebt());

      await handler.execute(command({ amount: 300 }));

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockRepository.save).toHaveBeenCalledWith(expect.any(Debt), mockManager);
      expect(txArg(0).manager).toBe(mockManager);
    });

    it('падение записи не оставляет долг изменённым', async () => {
      const debt = createDebt();
      mockRepository.findById.mockResolvedValue(debt);
      mockCommandBus.execute.mockRejectedValue(new Error('boom'));

      await expect(handler.execute(command({ amount: 300 }))).rejects.toThrow('boom');
      expect(debt.remainingAmountValue).toBe(1000);
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });
});
