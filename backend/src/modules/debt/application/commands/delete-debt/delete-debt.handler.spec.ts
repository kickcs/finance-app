import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { DeleteDebtHandler } from './delete-debt.handler';
import { DeleteDebtCommand } from './delete-debt.command';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { Debt } from '../../../domain/aggregates/debt';
import { DeleteTransactionCommand } from '../../../../accounting/application/commands/delete-transaction/delete-transaction.command';

describe('DeleteDebtHandler', () => {
  let handler: DeleteDebtHandler;
  const mockRepository = {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    findByTransactionId: jest.fn(),
    hasOpenDebtsForTransaction: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };
  const mockCommandBus = {
    execute: jest.fn(),
  };
  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteDebtHandler,
        { provide: DEBT_REPOSITORY, useValue: mockRepository },
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<DeleteDebtHandler>(DeleteDebtHandler);
    jest.clearAllMocks();
  });

  function createTestDebt(
    overrides: { userId?: string; transactionId?: string; closeTransactionId?: string } = {},
  ) {
    const debt = Debt.create({
      id: 'debt-1',
      userId: overrides.userId ?? 'user-1',
      name: 'Test Debt',
      totalAmount: 1000,
      currency: 'USD',
      debtType: 'given',
    });
    if (overrides.transactionId) {
      debt.setTransactionId(overrides.transactionId);
    }
    if (overrides.closeTransactionId) {
      debt.setCloseTransactionId(overrides.closeTransactionId);
    }
    return debt;
  }

  it('should delete a debt with no linked transactions', async () => {
    const debt = createTestDebt();
    mockRepository.findById.mockResolvedValue(debt);
    mockDataSource.query.mockResolvedValue([]);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await handler.execute(command);

    expect(mockRepository.delete).toHaveBeenCalledWith('debt-1');
    expect(mockCommandBus.execute).not.toHaveBeenCalled();
  });

  it('should delete linked transactions before deleting debt', async () => {
    const debt = createTestDebt({ transactionId: 'tx-1', closeTransactionId: 'tx-close-1' });
    mockRepository.findById.mockResolvedValue(debt);
    mockDataSource.query.mockResolvedValue([{ id: 'tx-partial-1' }]);
    mockCommandBus.execute.mockResolvedValue(undefined);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await handler.execute(command);

    // 3 transactions: tx-1, tx-close-1, tx-partial-1
    expect(mockCommandBus.execute).toHaveBeenCalledTimes(3);
    expect(mockRepository.delete).toHaveBeenCalledWith('debt-1');
  });

  it('should continue if a linked transaction is already deleted (NotFoundException)', async () => {
    const debt = createTestDebt({ transactionId: 'tx-1' });
    mockRepository.findById.mockResolvedValue(debt);
    mockDataSource.query.mockResolvedValue([]);
    mockCommandBus.execute.mockRejectedValue(new NotFoundException());
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await handler.execute(command);

    expect(mockRepository.delete).toHaveBeenCalledWith('debt-1');
  });

  it('should rethrow non-NotFoundException errors from transaction deletion', async () => {
    const debt = createTestDebt({ transactionId: 'tx-1' });
    mockRepository.findById.mockResolvedValue(debt);
    mockDataSource.query.mockResolvedValue([]);
    mockCommandBus.execute.mockRejectedValue(new Error('Database error'));

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await expect(handler.execute(command)).rejects.toThrow('Database error');
  });

  it('should throw NotFoundException when debt does not exist', async () => {
    mockRepository.findById.mockResolvedValue(null);

    const command = new DeleteDebtCommand('non-existent', 'user-1');

    await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when user does not own the debt', async () => {
    const debt = createTestDebt({ userId: 'other-user' });
    mockRepository.findById.mockResolvedValue(debt);

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('should delete source transaction when no other debts reference it', async () => {
    const debt = createTestDebt();
    debt.update({ sourceTransactionId: 'tx-source-1' });
    mockRepository.findById.mockResolvedValue(debt);
    mockDataSource.query.mockResolvedValueOnce([{ exists: false }]).mockResolvedValueOnce([]);
    mockCommandBus.execute.mockResolvedValue(undefined);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await handler.execute(command);

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockCommandBus.execute).toHaveBeenCalledWith(
      new DeleteTransactionCommand('tx-source-1', 'user-1', true),
    );
    expect(mockRepository.delete).toHaveBeenCalledWith('debt-1');
  });

  it('should NOT delete source transaction when other debts still reference it', async () => {
    const debt = createTestDebt();
    debt.update({ sourceTransactionId: 'tx-source-1' });
    mockRepository.findById.mockResolvedValue(debt);
    mockDataSource.query.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([]);
    mockCommandBus.execute.mockResolvedValue(undefined);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await handler.execute(command);

    expect(mockCommandBus.execute).not.toHaveBeenCalled();
    expect(mockRepository.delete).toHaveBeenCalledWith('debt-1');
  });

  it('should deduplicate transaction IDs', async () => {
    // If transactionId and a partial payment tx happen to be the same
    const debt = createTestDebt({ transactionId: 'tx-1' });
    mockRepository.findById.mockResolvedValue(debt);
    mockDataSource.query.mockResolvedValue([{ id: 'tx-1' }]); // same as transactionId
    mockCommandBus.execute.mockResolvedValue(undefined);
    mockRepository.delete.mockResolvedValue(undefined);

    const command = new DeleteDebtCommand('debt-1', 'user-1');

    await handler.execute(command);

    // Only 1 unique transaction to delete, not 2
    expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    expect(mockRepository.delete).toHaveBeenCalledWith('debt-1');
  });
});
