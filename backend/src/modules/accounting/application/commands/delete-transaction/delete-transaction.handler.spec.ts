import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, type EntityManager } from 'typeorm';
import { DeleteTransactionHandler } from './delete-transaction.handler';
import { DeleteTransactionCommand } from './delete-transaction.command';
import { TRANSACTION_REPOSITORY } from '../../../domain/repositories/transaction.repository.interface';
import { ACCOUNT_REPOSITORY } from '../../../domain/repositories/account.repository.interface';
import { DEBT_REPOSITORY } from '../../../../debt/domain/repositories';
import { ReverseSettlementCommand } from '../../../../debt/application/commands/reverse-settlement/reverse-settlement.command';
import { DomainEventPublisher } from '../../../../../shared';
import { Account } from '../../../domain/aggregates/account';
import { Transaction } from '../../../domain/aggregates/transaction';
import { DEBT_CATEGORY_IDS } from '../../../domain/constants/default-categories';

describe('DeleteTransactionHandler', () => {
  let handler: DeleteTransactionHandler;

  const mockTransactionRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByAccountId: jest.fn(),
    findByAccountIdWithIncoming: jest.fn(),
    findByDateRange: jest.fn(),
    save: jest.fn(),
    saveMany: jest.fn(),
    delete: jest.fn(),
    deleteByAccountId: jest.fn(),
    countByAccountId: jest.fn(),
    exists: jest.fn(),
    getPaginated: jest.fn(),
    searchPaginated: jest.fn(),
    getByAccountPaginated: jest.fn(),
    getMonthlyStats: jest.fn(),
    getAnalyticsStats: jest.fn(),
    getDailyStats: jest.fn(),
    getHashtags: jest.fn(),
    findPaymentSibling: jest.fn(),
  };

  const mockAccountRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByIdWithBalances: jest.fn(),
    findAllWithBalances: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    existsForUser: jest.fn(),
    updateOrder: jest.fn(),
  };

  const mockDebtRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTransactionId: jest.fn(),
    hasOpenDebtsForTransaction: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  const mockEventPublisher = {
    publishEvents: jest.fn(),
    publishEventsFromMultiple: jest.fn(),
  };

  const mockCommandBus = { execute: jest.fn() };

  const mockDataSource = {
    transaction: jest.fn((cb: () => Promise<void>) => cb()),
  };

  const now = new Date('2026-03-20T12:00:00Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteTransactionHandler,
        { provide: TRANSACTION_REPOSITORY, useValue: mockTransactionRepository },
        { provide: ACCOUNT_REPOSITORY, useValue: mockAccountRepository },
        { provide: DEBT_REPOSITORY, useValue: mockDebtRepository },
        { provide: DomainEventPublisher, useValue: mockEventPublisher },
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<DeleteTransactionHandler>(DeleteTransactionHandler);
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation((cb: () => Promise<void>) => cb());
    mockEventPublisher.publishEvents.mockResolvedValue(undefined);
    mockAccountRepository.save.mockImplementation((a) => Promise.resolve(a));
    mockTransactionRepository.delete.mockResolvedValue(undefined);
    mockDebtRepository.hasOpenDebtsForTransaction.mockResolvedValue(false);
    mockCommandBus.execute.mockResolvedValue([]);
    mockTransactionRepository.findPaymentSibling.mockResolvedValue(null);
  });

  // Запись расчёта (платёж, переплата, зачёт, отработка, прощение) в ленте не живёт
  // отдельно: уходит расчёт целиком, а порядок и остатки долгов считает его модуль.
  describe('запись расчёта по долгу', () => {
    const returnRecord = (settlementId?: string) =>
      Transaction.createIncome(
        'tx-return',
        'user-1',
        'acc-1',
        DEBT_CATEGORY_IDS.RETURN_TO_ME,
        300,
        'USD',
        now,
        'Закрытие долга: Тимур',
        true,
        'debt-1',
        false,
        settlementId,
      );

    const workLeg = (settlementId?: string) =>
      Transaction.createExpense(
        'tx-work',
        'user-1',
        'acc-1',
        'repair',
        300,
        'USD',
        now,
        'Отработка долга: Тимур',
        false,
        'debt-1',
        false,
        settlementId,
      );

    const informational = (categoryId: string, settlementId?: string) =>
      Transaction.createExpense(
        'tx-info',
        'user-1',
        'acc-1',
        categoryId,
        100,
        'USD',
        now,
        undefined,
        false,
        'debt-1',
        true,
        settlementId,
      );

    it('с settlementId отменяет расчёт целиком и сама ничего не удаляет', async () => {
      mockTransactionRepository.findById.mockResolvedValue(returnRecord('s-1'));

      await handler.execute(new DeleteTransactionCommand('tx-return', 'user-1'));

      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new ReverseSettlementCommand('s-1', 'user-1', undefined),
      );
      expect(mockTransactionRepository.delete).not.toHaveBeenCalled();
      expect(mockAccountRepository.findByIdWithBalances).not.toHaveBeenCalled();
      expect(mockDebtRepository.hasOpenDebtsForTransaction).not.toHaveBeenCalled();
    });

    it('внешнюю транзакцию передаёт в отмену расчёта', async () => {
      const manager = { query: jest.fn() } as unknown as EntityManager;
      mockTransactionRepository.findById.mockResolvedValue(returnRecord('s-1'));

      await handler.execute(new DeleteTransactionCommand('tx-return', 'user-1', false, manager));

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new ReverseSettlementCommand('s-1', 'user-1', manager),
      );
    });

    it.each([
      ['нога работы', () => workLeg('s-1')],
      ['отметка отработки', () => informational(DEBT_CATEGORY_IDS.WORKED_OFF, 's-1')],
      ['запись зачёта', () => informational(DEBT_CATEGORY_IDS.OFFSET, 's-1')],
      ['прощение', () => informational(DEBT_CATEGORY_IDS.FORGIVEN, 's-1')],
    ])('%s тоже уходит вместе с расчётом', async (_name, make) => {
      mockTransactionRepository.findById.mockResolvedValue(make());

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      expect(mockCommandBus.execute).toHaveBeenCalledWith(
        new ReverseSettlementCommand('s-1', 'user-1', undefined),
      );
      expect(mockTransactionRepository.delete).not.toHaveBeenCalled();
    });

    it('ошибка отмены (например, 409 о порядке) уходит наружу, запись остаётся', async () => {
      mockTransactionRepository.findById.mockResolvedValue(returnRecord('s-1'));
      mockCommandBus.execute.mockRejectedValue(new Error('Сначала отмените более поздний расчёт'));

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-return', 'user-1')),
      ).rejects.toThrow('Сначала отмените более поздний расчёт');
      expect(mockTransactionRepository.delete).not.toHaveBeenCalled();
    });

    it('чужая запись расчёта — 403 до отмены', async () => {
      mockTransactionRepository.findById.mockResolvedValue(returnRecord('s-1'));

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-return', 'user-2')),
      ).rejects.toThrow(ForbiddenException);
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    // С отмены расчёта команда приходит с `skipDebtCheck`: запись удаляется как обычная.
    it('под skipDebtCheck запись удаляется, расчёт повторно не отменяется', async () => {
      mockTransactionRepository.findById.mockResolvedValue(workLeg('s-1'));
      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 700 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-work', 'user-1', true));

      expect(mockCommandBus.execute).not.toHaveBeenCalled();
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-work', undefined);
      expect(account.getTotalBalance('USD')).toBe(1000);
    });

    it('под skipDebtCheck прощение и зачёт без расчёта удаляются, долги не трогаются', async () => {
      for (const categoryId of [DEBT_CATEGORY_IDS.FORGIVEN, DEBT_CATEGORY_IDS.OFFSET]) {
        mockTransactionRepository.findById.mockResolvedValue(informational(categoryId));

        await handler.execute(new DeleteTransactionCommand('tx-info', 'user-1', true));

        expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-info', undefined);
      }
      expect(mockDebtRepository.save).not.toHaveBeenCalled();
    });

    // Страховка для записей, до которых не дошла миграция: без связки расчёт не собрать.
    it.each([
      [DEBT_CATEGORY_IDS.OFFSET],
      [DEBT_CATEGORY_IDS.WORKED_OFF],
      [DEBT_CATEGORY_IDS.FORGIVEN],
    ])('запись %s без settlementId из ленты не удаляется — 400', async (categoryId) => {
      mockTransactionRepository.findById.mockResolvedValue(informational(categoryId));

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-info', 'user-1')),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.delete).not.toHaveBeenCalled();
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('нога работы и возврат без settlementId удаляются как обычные записи', async () => {
      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 700 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      for (const record of [workLeg(), returnRecord()]) {
        mockTransactionRepository.findById.mockResolvedValue(record);
        await handler.execute(new DeleteTransactionCommand(record.id, 'user-1'));
        expect(mockTransactionRepository.delete).toHaveBeenCalledWith(record.id, undefined);
      }
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('delete expense', () => {
    it('should reverse expense (credit back) and delete', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 300, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 700 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // Balance should be reversed: 700 + 300 = 1000
      expect(account.getTotalBalance('USD')).toBe(1000);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
      expect(mockEventPublisher.publishEvents).toHaveBeenCalledTimes(2);
    });
  });

  describe('delete income', () => {
    it('should reverse income (debit) and delete', async () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 500, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 1500 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // Balance should be reversed: 1500 - 500 = 1000
      expect(account.getTotalBalance('USD')).toBe(1000);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
    });
  });

  describe('delete transfer', () => {
    it('should reverse both accounts for transfer deletion', async () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-t',
        300,
        'USD',
        300,
        'USD',
        now,
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const fromAccount = Account.create(
        'acc-from',
        'user-1',
        'From',
        'wallet',
        '#000',
        'basic',
        0,
        [{ currency: 'USD', balance: 700 }],
      );
      const toAccount = Account.create('acc-to', 'user-1', 'To', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 800 },
      ]);

      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount) // source account lookup
        .mockResolvedValueOnce(toAccount); // destination account lookup

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // From account: 700 + 300 = 1000 (credit back)
      expect(fromAccount.getTotalBalance('USD')).toBe(1000);
      // To account: 800 - 300 = 500 (debit)
      expect(toAccount.getTotalBalance('USD')).toBe(500);
      expect(mockAccountRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should throw if destination account not found for transfer deletion', async () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-t',
        300,
        'USD',
        300,
        'USD',
        now,
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);

      const fromAccount = Account.create(
        'acc-from',
        'user-1',
        'From',
        'wallet',
        '#000',
        'basic',
        0,
        [{ currency: 'USD', balance: 700 }],
      );
      mockAccountRepository.findByIdWithBalances
        .mockResolvedValueOnce(fromAccount)
        .mockResolvedValueOnce(null);

      await expect(handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'))).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Удаление любой из двух частей удаляет операцию целиком.
  describe('оплата с двух счетов', () => {
    let card: Account;
    let cash: Account;

    const givenGroup = () => {
      const row = Transaction.createExpense(
        'tx-card',
        'user-1',
        'acc-card',
        'food',
        60_000,
        'UZS',
        now,
      );
      const sibling = Transaction.createExpense(
        'tx-cash',
        'user-1',
        'acc-cash',
        'food',
        40_000,
        'UZS',
        now,
      );
      row.joinPaymentGroup('group-1');
      sibling.joinPaymentGroup('group-1');
      mockTransactionRepository.findById.mockResolvedValue(row);
      mockTransactionRepository.findPaymentSibling.mockResolvedValue(sibling);
      return { row, sibling };
    };

    beforeEach(() => {
      card = Account.create('acc-card', 'user-1', 'Card', 'wallet', '#000', 'basic', 0, [
        { currency: 'UZS', balance: 440_000 },
      ]);
      cash = Account.create('acc-cash', 'user-1', 'Cash', 'wallet', '#000', 'basic', 0, [
        { currency: 'UZS', balance: 60_000 },
      ]);
      const accounts: Record<string, Account> = { 'acc-card': card, 'acc-cash': cash };
      mockAccountRepository.findByIdWithBalances.mockImplementation((id: string) =>
        Promise.resolve(accounts[id] ?? null),
      );
    });

    it('удаляет обе части и возвращает оба списания', async () => {
      givenGroup();

      await handler.execute(new DeleteTransactionCommand('tx-card', 'user-1'));

      expect(card.getTotalBalance('UZS')).toBe(500_000);
      expect(cash.getTotalBalance('UZS')).toBe(100_000);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-card', undefined);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-cash', undefined);
      expect(mockAccountRepository.save).toHaveBeenCalledTimes(2);
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('открытый долг на паре тоже запрещает удаление', async () => {
      givenGroup();
      mockDebtRepository.hasOpenDebtsForTransaction.mockImplementation((id: string) =>
        Promise.resolve(id === 'tx-cash'),
      );

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-card', 'user-1')),
      ).rejects.toThrow(BadRequestException);
      expect(mockTransactionRepository.delete).not.toHaveBeenCalled();
    });

    it('пара уже пропала — удаляется одна строка', async () => {
      const row = Transaction.createExpense(
        'tx-card',
        'user-1',
        'acc-card',
        'food',
        60_000,
        'UZS',
        now,
      );
      row.joinPaymentGroup('group-1');
      mockTransactionRepository.findById.mockResolvedValue(row);

      await handler.execute(new DeleteTransactionCommand('tx-card', 'user-1'));

      expect(card.getTotalBalance('UZS')).toBe(500_000);
      expect(mockTransactionRepository.delete).toHaveBeenCalledTimes(1);
    });
  });

  // Внешний менеджер: отмена расчёта снимает несколько записей одной транзакцией БД,
  // поэтому всё читаемое и пишемое обязано идти через него.
  describe('во внешней транзакции', () => {
    const managerQuery = jest.fn();
    const manager = { query: managerQuery } as unknown as EntityManager;

    beforeEach(() => {
      managerQuery.mockReset();
      managerQuery.mockResolvedValue([]);
    });

    const walletWith = (id: string, balance: number, currency = 'USD') =>
      Account.create(id, 'user-1', id, 'wallet', '#000', 'basic', 0, [{ currency, balance }]);

    it('не открывает свою транзакцию и читает запись, счёт и пишет через менеджер', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 300, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);
      const account = walletWith('acc-1', 700);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1', false, manager));

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-1', manager);
      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-1', manager);
      expect(mockAccountRepository.save).toHaveBeenCalledWith(account, manager);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', manager);
      expect(account.getTotalBalance('USD')).toBe(1000);
      expect(mockEventPublisher.publishEvents).toHaveBeenCalledTimes(2);
    });

    it('парную часть оплаты и её счёт читает через менеджер, открытые долги проверяет им же', async () => {
      const row = Transaction.createExpense('tx-card', 'user-1', 'acc-card', 'f', 60, 'USD', now);
      const sibling = Transaction.createExpense(
        'tx-cash',
        'user-1',
        'acc-cash',
        'f',
        40,
        'USD',
        now,
      );
      row.joinPaymentGroup('group-1');
      sibling.joinPaymentGroup('group-1');
      mockTransactionRepository.findById.mockResolvedValue(row);
      mockTransactionRepository.findPaymentSibling.mockResolvedValue(sibling);
      const accounts: Record<string, Account> = {
        'acc-card': walletWith('acc-card', 440),
        'acc-cash': walletWith('acc-cash', 60),
      };
      mockAccountRepository.findByIdWithBalances.mockImplementation((id: string) =>
        Promise.resolve(accounts[id]),
      );

      await handler.execute(new DeleteTransactionCommand('tx-card', 'user-1', false, manager));

      expect(mockTransactionRepository.findPaymentSibling).toHaveBeenCalledWith(row, manager);
      expect(mockDebtRepository.hasOpenDebtsForTransaction).toHaveBeenCalledWith(
        'tx-card',
        manager,
      );
      expect(mockDebtRepository.hasOpenDebtsForTransaction).toHaveBeenCalledWith(
        'tx-cash',
        manager,
      );
      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-card', manager);
      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-cash', manager);
      expect(mockAccountRepository.save).toHaveBeenCalledWith(accounts['acc-card'], manager);
      expect(mockAccountRepository.save).toHaveBeenCalledWith(accounts['acc-cash'], manager);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-card', manager);
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-cash', manager);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('счёт-получатель перевода читает через менеджер', async () => {
      const tx = Transaction.createTransfer(
        'tx-1',
        'user-1',
        'acc-from',
        'acc-to',
        'cat-t',
        300,
        'USD',
        300,
        'USD',
        now,
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);
      const accounts: Record<string, Account> = {
        'acc-from': walletWith('acc-from', 700),
        'acc-to': walletWith('acc-to', 800),
      };
      mockAccountRepository.findByIdWithBalances.mockImplementation((id: string) =>
        Promise.resolve(accounts[id]),
      );

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1', false, manager));

      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-from', manager);
      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-to', manager);
      expect(mockAccountRepository.save).toHaveBeenCalledWith(accounts['acc-to'], manager);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    // Две записи на один счёт в одной транзакции БД: вторая обязана увидеть
    // баланс после первой, иначе её сохранение затрёт первую.
    it('две записи одного счёта не затирают друг друга', async () => {
      const committed = { USD: 400 };
      const pending = new Map<unknown, number>();
      mockAccountRepository.findByIdWithBalances.mockImplementation(
        (id: string, m?: EntityManager) =>
          Promise.resolve(
            walletWith(id, m && pending.has(m) ? (pending.get(m) as number) : committed.USD),
          ),
      );
      mockAccountRepository.save.mockImplementation((a: Account, m?: EntityManager) => {
        if (m) pending.set(m, a.getTotalBalance('USD'));
        else committed.USD = a.getTotalBalance('USD');
        return Promise.resolve(a);
      });
      const first = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      const second = Transaction.createExpense('tx-2', 'user-1', 'acc-1', 'cat-1', 200, 'USD', now);
      mockTransactionRepository.findById.mockImplementation((id: string) =>
        Promise.resolve(id === 'tx-1' ? first : second),
      );

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1', false, manager));
      await handler.execute(new DeleteTransactionCommand('tx-2', 'user-1', false, manager));

      expect(pending.get(manager)).toBe(700);
    });

    it('без менеджера работает как раньше: своя транзакция, чтение без менеджера', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 300, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(walletWith('acc-1', 700));

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockTransactionRepository.findById).toHaveBeenCalledWith('tx-1', undefined);
      expect(mockAccountRepository.findByIdWithBalances).toHaveBeenCalledWith('acc-1', undefined);
    });
  });

  describe('validation', () => {
    it('should throw NotFoundException if transaction not found', async () => {
      mockTransactionRepository.findById.mockResolvedValue(null);

      await expect(
        handler.execute(new DeleteTransactionCommand('tx-nonexistent', 'user-1')),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if transaction belongs to different user', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-2', 'acc-1', 'cat-1', 100, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);

      await expect(handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'))).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if transaction has open debts', async () => {
      const tx = Transaction.createIncome('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockDebtRepository.hasOpenDebtsForTransaction.mockResolvedValue(true);

      await expect(handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should skip debt check if skipDebtCheck is true', async () => {
      const tx = Transaction.createExpense('tx-1', 'user-1', 'acc-1', 'cat-1', 100, 'USD', now);
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockDebtRepository.hasOpenDebtsForTransaction.mockResolvedValue(true);

      const account = Account.create('acc-1', 'user-1', 'Test', 'wallet', '#000', 'basic', 0, [
        { currency: 'USD', balance: 0 },
      ]);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(account);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1', true));

      // Should not throw, debt check was skipped
      expect(mockDebtRepository.hasOpenDebtsForTransaction).not.toHaveBeenCalled();
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
    });
  });

  describe('edge cases', () => {
    it('should handle deletion when account no longer exists', async () => {
      const tx = Transaction.createExpense(
        'tx-1',
        'user-1',
        'acc-deleted',
        'cat-1',
        100,
        'USD',
        now,
      );
      mockTransactionRepository.findById.mockResolvedValue(tx);
      mockAccountRepository.findByIdWithBalances.mockResolvedValue(null);

      await handler.execute(new DeleteTransactionCommand('tx-1', 'user-1'));

      // Should still delete the transaction
      expect(mockTransactionRepository.delete).toHaveBeenCalledWith('tx-1', undefined);
      // Should not try to save a null account
      expect(mockAccountRepository.save).not.toHaveBeenCalled();
    });
  });
});
