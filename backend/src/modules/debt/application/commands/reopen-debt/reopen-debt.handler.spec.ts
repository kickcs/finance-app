import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { ReopenDebtHandler } from './reopen-debt.handler';
import { ReopenDebtCommand } from './reopen-debt.command';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { Debt } from '../../../domain/aggregates/debt';
import { DeleteTransactionCommand } from '../../../../accounting/application/commands/delete-transaction/delete-transaction.command';

describe('ReopenDebtHandler', () => {
  let handler: ReopenDebtHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTransactionId: jest.fn(),
    findByCloseTransactionId: jest.fn(),
    hasOpenDebtsForTransaction: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    getPaginated: jest.fn(),
  };
  const mockCommandBus = { execute: jest.fn() };
  const mockDataSource = { query: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReopenDebtHandler,
        { provide: DEBT_REPOSITORY, useValue: mockRepository },
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<ReopenDebtHandler>(ReopenDebtHandler);
    jest.clearAllMocks();
    // clearAllMocks оставляет неизрасходованные mockResolvedValueOnce, и кейс,
    // падающий на середине потока, отравляет очередь следующему.
    mockDataSource.query.mockReset();
    mockCommandBus.execute.mockReset();
    mockRepository.save.mockImplementation((debt: Debt) => Promise.resolve(debt));
    mockCommandBus.execute.mockResolvedValue(undefined);
  });

  function createClosedDebt(
    overrides: {
      userId?: string;
      totalAmount?: number;
      closeTransactionId?: string | null;
      forgivenAmount?: number;
      isClosed?: boolean;
    } = {},
  ) {
    const debt = Debt.create({
      id: 'debt-1',
      userId: overrides.userId ?? 'user-1',
      name: 'Test Debt',
      totalAmount: overrides.totalAmount ?? 1000,
      currency: 'USD',
      debtType: 'given',
    });
    debt.update({
      remainingAmount: 0,
      isClosed: overrides.isClosed ?? true,
      closeTransactionId: overrides.closeTransactionId ?? 'tx-close-1',
      forgivenAmount: overrides.forgivenAmount ?? 0,
    });
    return debt;
  }

  /** Первый query — поиск записей прощения, второй — сумма уцелевших возвратов. */
  function mockQueries(forgivenRows: { id: string }[], paid: number) {
    mockDataSource.query
      .mockResolvedValueOnce(forgivenRows)
      .mockResolvedValueOnce([{ paid: String(paid) }]);
  }

  it('deletes the closing transaction and reopens a debt closed by payment', async () => {
    const debt = createClosedDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockQueries([], 0);

    const result = await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockCommandBus.execute).toHaveBeenCalledWith(
      new DeleteTransactionCommand('tx-close-1', 'user-1', true),
    );
    expect(result.isClosed).toBe(false);
    expect(result.remainingAmount).toBe(1000);
    expect(result.closedAt).toBeNull();
    expect(result.closeTransactionId).toBeNull();
    expect(result.forgivenAmount).toBe(0);
  });

  it('also deletes the informational forgiveness record', async () => {
    const debt = createClosedDebt({ forgivenAmount: 400 });
    mockRepository.findById.mockResolvedValue(debt);
    mockQueries([{ id: 'tx-forgiven-1' }], 600);

    const result = await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(mockCommandBus.execute).toHaveBeenCalledWith(
      new DeleteTransactionCommand('tx-forgiven-1', 'user-1', true),
    );
    // 600 уже возвращено платежами до закрытия — остаток только прощённая часть
    expect(result.remainingAmount).toBe(400);
    expect(result.forgivenAmount).toBe(0);
  });

  it('does not delete the same transaction twice when the closing record is the forgiveness one', async () => {
    const debt = createClosedDebt({ closeTransactionId: 'tx-forgiven-1' });
    mockRepository.findById.mockResolvedValue(debt);
    mockQueries([{ id: 'tx-forgiven-1' }], 0);

    await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
  });

  it('deletes transactions before flipping the debt open', async () => {
    const debt = createClosedDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockQueries([], 0);
    const order: string[] = [];
    mockCommandBus.execute.mockImplementation(() => {
      order.push('delete-tx');
      return Promise.resolve(undefined);
    });
    mockRepository.save.mockImplementation((d: Debt) => {
      order.push('save-debt');
      return Promise.resolve(d);
    });

    await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(order).toEqual(['delete-tx', 'save-debt']);
  });

  it('re-reads the debt after deletions so a repository-side reopen is not overwritten', async () => {
    const stale = createClosedDebt();
    const fresh = createClosedDebt({ isClosed: false, closeTransactionId: null });
    fresh.update({ name: 'Renamed by delete-transaction' });
    mockRepository.findById.mockResolvedValueOnce(stale).mockResolvedValueOnce(fresh);
    mockQueries([], 0);

    const result = await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(mockRepository.findById).toHaveBeenCalledTimes(2);
    expect(result.name).toBe('Renamed by delete-transaction');
  });

  it('continues when the closing transaction is already gone', async () => {
    const debt = createClosedDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockQueries([], 0);
    mockCommandBus.execute.mockRejectedValue(new NotFoundException());

    const result = await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(result.isClosed).toBe(false);
  });

  it('rethrows non-NotFound errors from transaction deletion and leaves the debt closed', async () => {
    const debt = createClosedDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockQueries([], 0);
    mockCommandBus.execute.mockRejectedValue(new Error('Database error'));

    await expect(handler.execute(new ReopenDebtCommand('debt-1', 'user-1'))).rejects.toThrow(
      'Database error',
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('never restores a negative remainder', async () => {
    const debt = createClosedDebt({ totalAmount: 1000 });
    mockRepository.findById.mockResolvedValue(debt);
    mockQueries([], 1500);

    const result = await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(result.remainingAmount).toBe(0);
  });

  it('throws NotFoundException when the debt does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(handler.execute(new ReopenDebtCommand('nope', 'user-1'))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ForbiddenException when the debt belongs to someone else', async () => {
    mockRepository.findById.mockResolvedValue(createClosedDebt({ userId: 'other-user' }));

    await expect(handler.execute(new ReopenDebtCommand('debt-1', 'user-1'))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws ConflictException when the debt is already open', async () => {
    mockRepository.findById.mockResolvedValue(createClosedDebt({ isClosed: false }));

    await expect(handler.execute(new ReopenDebtCommand('debt-1', 'user-1'))).rejects.toThrow(
      ConflictException,
    );
    expect(mockCommandBus.execute).not.toHaveBeenCalled();
  });
});
