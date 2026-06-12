import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DismissImportedHandler } from './dismiss-imported.handler';
import { DismissImportedCommand } from './dismiss-imported.command';
import { IMPORTED_TRANSACTION_REPOSITORY } from '../../../domain/repositories/imported-transaction.repository.interface';

const basePending = {
  id: 'imp-1',
  userId: 'user-1',
  status: 'pending',
};

describe('DismissImportedHandler', () => {
  let handler: DismissImportedHandler;
  const importedRepo = {
    insertIfNew: jest.fn(),
    findById: jest.fn(),
    findPendingWithSuggestions: jest.fn(),
    countPending: jest.fn(),
    markConfirmed: jest.fn(),
    markDismissed: jest.fn(),
    findLatestBalance: jest.fn(),
    findTransferCounterpart: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DismissImportedHandler,
        { provide: IMPORTED_TRANSACTION_REPOSITORY, useValue: importedRepo },
      ],
    }).compile();
    handler = module.get(DismissImportedHandler);
    jest.clearAllMocks();
  });

  it('отклоняет pending-импорт', async () => {
    importedRepo.findById.mockResolvedValue(basePending);

    const result = await handler.execute(new DismissImportedCommand('user-1', 'imp-1'));

    expect(result).toEqual({ success: true });
    expect(importedRepo.markDismissed).toHaveBeenCalledWith('imp-1');
  });

  it('NotFound для несуществующего id', async () => {
    importedRepo.findById.mockResolvedValue(null);
    await expect(handler.execute(new DismissImportedCommand('user-1', 'nope'))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Forbidden для чужого item', async () => {
    importedRepo.findById.mockResolvedValue({ ...basePending, userId: 'other' });
    await expect(handler.execute(new DismissImportedCommand('user-1', 'imp-1'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(importedRepo.markDismissed).not.toHaveBeenCalled();
  });

  it('Forbidden, если не pending', async () => {
    importedRepo.findById.mockResolvedValue({ ...basePending, status: 'dismissed' });
    await expect(handler.execute(new DismissImportedCommand('user-1', 'imp-1'))).rejects.toThrow(
      ForbiddenException,
    );
    expect(importedRepo.markDismissed).not.toHaveBeenCalled();
  });
});
