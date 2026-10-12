import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UpdateTransactionHandler } from './update-transaction.handler';
import { UpdateTransactionCommand } from './update-transaction.command';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { DEBT_REPOSITORY } from '../../../../debt/domain/repositories';
import { DomainEventPublisher } from '../../../../../shared';
import { Account } from '../../../domain/aggregates/account';
import { Transaction } from '../../../domain/aggregates/transaction';

describe('UpdateTransactionHandler', () => {
  let handler: UpdateTransactionHandler;

  // Счета живут в «базе» снимками балансов, и каждое чтение отдаёт свежий
  // экземпляр, как настоящий репозиторий.
  let db: Record<string, Record<string, number>>;

  const mockTransactionRepository = {
    findById: jest.fn(),
    findPaymentSibling: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockAccountRepository = {
    findByIdWithBalances: jest.fn((id: string) => {
      const balances = db[id] as Record<string, number> | undefined;
      if (!balances) return Promise.resolve(null);
      return Promise.resolve(
        Account.create(
          id,
          'user-1',
          id,
          'wallet',
          '#000',
          'basic',
          0,
          Object.entries(balances).map(([currency, balance]) => ({ currency, balance })),
        ),
      );
    }),
    save: jest.fn((account: Account) => {
      db[account.id] = Object.fromEntries(
        account.balances.map((b) => [b.currencyCode, b.balanceAmount]),
      );
      return Promise.resolve(account);
    }),
  };

  const mockDebtRepository = { relinkSourceTransaction: jest.fn() };

  const mockEventPublisher = { publishEvents: jest.fn() };

  const mockDataSource = {
    transaction: jest.fn((cb: () => Promise<void>) => cb()),
  };

  const now = new Date('2026-10-12T12:00:00Z');

  const expense = (id: string, accountId: string, amount: number, groupId?: string) => {
    const tx = Transaction.createExpense(
      id,
      'user-1',
      accountId,
      'food',
      amount,
      'UZS',
      now,
      'Ужин',
    );
    if (groupId) tx.joinPaymentGroup(groupId);
    return tx;
  };

  const update = (data: UpdateTransactionCommand['data'], id = 'tx-card') =>
    handler.execute(new UpdateTransactionCommand(id, 'user-1', data));

  const savedTransaction = (id: string) =>
    (mockTransactionRepository.save.mock.calls as [Transaction][])
      .map(([t]) => t)
      .find((t) => t.id === id);

  /** Покупка на 100 000: 60 000 картой и 40 000 наличными. */
  const givenGroup = () => {
    const row = expense('tx-card', 'acc-card', 60_000, 'group-1');
    const sibling = expense('tx-cash', 'acc-cash', 40_000, 'group-1');
    mockTransactionRepository.findById.mockResolvedValue(row);
    mockTransactionRepository.findPaymentSibling.mockResolvedValue(sibling);
    return { row, sibling };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateTransactionHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
        { provide: DEBT_REPOSITORY, useValue: mockDebtRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<UpdateTransactionHandler>(UpdateTransactionHandler);
    jest.clearAllMocks();
    db = {
      'acc-card': { UZS: 440_000 },
      'acc-cash': { UZS: 60_000 },
      'acc-other': { UZS: 1_000_000 },
    };
    mockTransactionRepository.findPaymentSibling.mockResolvedValue(null);
    mockTransactionRepository.save.mockImplementation((t: Transaction) => Promise.resolve(t));
    mockTransactionRepository.delete.mockResolvedValue(undefined);
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
  });

  it('обычная правка суммы двигает баланс', async () => {
    const row = expense('tx-card', 'acc-card', 60_000);
    mockTransactionRepository.findById.mockResolvedValue(row);

    const result = await update({ amount: 50_000 });

    expect(db['acc-card'].UZS).toBe(450_000);
    expect(result.paymentGroupId).toBeNull();
    expect(result.paymentSibling).toBeNull();
  });

  describe('secondPart — объект', () => {
    it('пара есть: получает новый счёт и сумму, балансы пересчитываются', async () => {
      const { sibling } = givenGroup();

      const result = await update({
        amount: 70_000,
        secondPart: { accountId: 'acc-other', amount: 30_000 },
      });

      expect(db['acc-card'].UZS).toBe(430_000);
      expect(db['acc-cash'].UZS).toBe(100_000);
      expect(db['acc-other'].UZS).toBe(970_000);
      expect(savedTransaction('tx-cash')).toBe(sibling);
      expect(sibling.accountId).toBe('acc-other');
      expect(sibling.amountValue).toBe(30_000);
      expect(result.paymentSibling).toEqual({
        id: 'tx-cash',
        accountId: 'acc-other',
        amount: 30_000,
      });
    });

    it('пара есть: общие поля тоже переносятся', async () => {
      const { sibling } = givenGroup();

      await update({
        amount: 70_000,
        categoryId: 'cafe',
        description: 'Кафе',
        secondPart: { accountId: 'acc-cash', amount: 30_000 },
      });

      expect(sibling.categoryId).toBe('cafe');
      expect(sibling.description).toBe('Кафе');
      expect(db['acc-card'].UZS).toBe(430_000);
      expect(db['acc-cash'].UZS).toBe(70_000);
    });

    it('пары нет: создаётся с той же операцией, строка входит в группу', async () => {
      const row = expense('tx-card', 'acc-card', 100_000);
      mockTransactionRepository.findById.mockResolvedValue(row);
      db['acc-card'] = { UZS: 400_000 };
      db['acc-cash'] = { UZS: 100_000 };

      const result = await update({
        amount: 60_000,
        secondPart: { accountId: 'acc-cash', amount: 40_000 },
      });

      expect(db['acc-card'].UZS).toBe(440_000);
      expect(db['acc-cash'].UZS).toBe(60_000);

      const created = (mockTransactionRepository.save.mock.calls as [Transaction][])
        .map(([t]) => t)
        .find((t) => t.id !== 'tx-card');
      expect(created).toBeDefined();
      expect(created!.accountId).toBe('acc-cash');
      expect(created!.amountValue).toBe(40_000);
      expect(created!.typeValue).toBe('expense');
      expect(created!.categoryId).toBe('food');
      expect(created!.description).toBe('Ужин');
      expect(created!.date).toEqual(now);
      expect(created!.currency).toBe('UZS');
      expect(row.paymentGroupId).toBeTruthy();
      expect(created!.paymentGroupId).toBe(row.paymentGroupId);
      expect(result.paymentGroupId).toBe(row.paymentGroupId);
      expect(result.paymentSibling).toEqual({
        id: created!.id,
        accountId: 'acc-cash',
        amount: 40_000,
      });
    });

    it('долговую запись разбить нельзя', async () => {
      const row = Transaction.createExpense(
        'tx-card',
        'user-1',
        'acc-card',
        'debt_given',
        100_000,
        'UZS',
        now,
        undefined,
        true,
        'debt-1',
      );
      mockTransactionRepository.findById.mockResolvedValue(row);

      await expect(
        update({ secondPart: { accountId: 'acc-cash', amount: 40_000 } }),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.save).not.toHaveBeenCalled();
    });

    it('вторая часть на тот же счёт — 400', async () => {
      givenGroup();

      await expect(
        update({ secondPart: { accountId: 'acc-card', amount: 40_000 } }),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.save).not.toHaveBeenCalled();
      expect(mockAccountRepository.save).not.toHaveBeenCalled();
    });

    // Каждый счёт читается один раз и правится одним экземпляром: вторая
    // копия, прочитанная мимо транзакции, затёрла бы первую при сохранении.
    it('счета меняются местами: каждый читается один раз', async () => {
      givenGroup();

      await update({
        accountId: 'acc-cash',
        secondPart: { accountId: 'acc-card', amount: 40_000 },
      });

      expect(db['acc-card'].UZS).toBe(460_000);
      expect(db['acc-cash'].UZS).toBe(40_000);
      const reads = mockAccountRepository.findByIdWithBalances.mock.calls.map(([id]) => id);
      expect(reads.filter((id) => id === 'acc-card')).toHaveLength(1);
      expect(reads.filter((id) => id === 'acc-cash')).toHaveLength(1);
    });
  });

  describe('secondPart — null', () => {
    it('пара удаляется, её списание возвращается, группа обнуляется', async () => {
      const { row } = givenGroup();

      const result = await update({ amount: 100_000, secondPart: null });

      expect(db['acc-card'].UZS).toBe(400_000);
      expect(db['acc-cash'].UZS).toBe(100_000);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-cash', undefined);
      expect(row.paymentGroupId).toBeNull();
      expect(result.paymentGroupId).toBeNull();
      expect(result.paymentSibling).toBeNull();
    });

    it('долги разделения, привязанные к удаляемой паре, переходят на оставшуюся строку', async () => {
      givenGroup();

      await update({ amount: 100_000, secondPart: null });

      expect(mockDebtRepository.relinkSourceTransaction).toHaveBeenCalledWith(
        'tx-cash',
        'tx-card',
        undefined,
      );
    });

    it('пара уже пропала (счёт удалён) — строка просто выходит из группы', async () => {
      const row = expense('tx-card', 'acc-card', 60_000, 'group-1');
      mockTransactionRepository.findById.mockResolvedValue(row);

      await update({ secondPart: null });

      expect(row.paymentGroupId).toBeNull();
      expect(mockTransactionRepository.delete).not.toHaveBeenCalled();
    });

    it('после удаления пары строку можно сделать переводом', async () => {
      const { row } = givenGroup();

      await update({
        type: 'transfer',
        categoryId: 'transfer',
        toAccountId: 'acc-other',
        toAmount: 60_000,
        toCurrency: 'UZS',
        secondPart: null,
      });

      expect(row.typeValue).toBe('transfer');
      expect(db['acc-cash'].UZS).toBe(100_000);
      expect(db['acc-card'].UZS).toBe(440_000);
      expect(db['acc-other'].UZS).toBe(1_060_000);
    });
  });

  describe('secondPart не передан', () => {
    it('описание, категория и дата переносятся на пару без движения балансов', async () => {
      const { sibling } = givenGroup();
      const newDate = new Date('2026-10-01T09:00:00Z');

      const result = await update({ description: 'Кафе', categoryId: 'cafe', date: newDate });

      expect(savedTransaction('tx-cash')).toBe(sibling);
      expect(sibling.description).toBe('Кафе');
      expect(sibling.categoryId).toBe('cafe');
      expect(sibling.date).toEqual(newDate);
      expect(mockAccountRepository.save).not.toHaveBeenCalled();
      expect(result.paymentSibling).toEqual({
        id: 'tx-cash',
        accountId: 'acc-cash',
        amount: 40_000,
      });
    });

    it('смена типа пересчитывает обе части', async () => {
      const { sibling } = givenGroup();

      await update({ type: 'income' });

      expect(sibling.typeValue).toBe('income');
      expect(db['acc-card'].UZS).toBe(560_000);
      expect(db['acc-cash'].UZS).toBe(140_000);
    });

    it('смена валюты переносит эффект пары в новую валюту', async () => {
      const { sibling } = givenGroup();

      await update({ currency: 'USD' });

      expect(sibling.currency).toBe('USD');
      expect(db['acc-card']).toEqual({ UZS: 500_000, USD: -60_000 });
      expect(db['acc-cash']).toEqual({ UZS: 100_000, USD: -40_000 });
    });

    it('правка суммы строки пару не трогает', async () => {
      givenGroup();

      await update({ amount: 50_000 });

      expect(db['acc-card'].UZS).toBe(450_000);
      expect(db['acc-cash'].UZS).toBe(60_000);
    });

    it('перенос строки на счёт пары — 400', async () => {
      givenGroup();

      await expect(update({ accountId: 'acc-cash' })).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.save).not.toHaveBeenCalled();
    });

    it('смена типа на перевод у части группы — 400', async () => {
      givenGroup();

      await expect(
        update({
          type: 'transfer',
          toAccountId: 'acc-other',
          toAmount: 60_000,
          toCurrency: 'UZS',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.save).not.toHaveBeenCalled();
      expect(mockAccountRepository.save).not.toHaveBeenCalled();
    });
  });
});
