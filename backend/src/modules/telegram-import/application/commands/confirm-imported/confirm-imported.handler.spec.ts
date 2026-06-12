import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfirmImportedHandler } from './confirm-imported.handler';
import { ConfirmImportedCommand } from './confirm-imported.command';
import { IMPORTED_TRANSACTION_REPOSITORY } from '../../../domain/repositories/imported-transaction.repository.interface';
import { CARD_MAPPING_REPOSITORY } from '../../../domain/repositories/card-mapping.repository.interface';

const basePending = {
  id: 'imp-1',
  userId: 'user-1',
  status: 'pending',
  type: 'expense',
  amount: 50000,
  cardMask: '*1951',
  occurredAt: new Date('2026-06-12T17:11:00Z'),
};

describe('ConfirmImportedHandler', () => {
  let handler: ConfirmImportedHandler;
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
  const cardRepo = {
    findByUserAndCard: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    listCards: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmImportedHandler,
        { provide: IMPORTED_TRANSACTION_REPOSITORY, useValue: importedRepo },
        { provide: CARD_MAPPING_REPOSITORY, useValue: cardRepo },
      ],
    }).compile();
    handler = module.get(ConfirmImportedHandler);
    jest.clearAllMocks();
  });

  it('подтверждает, сохраняет маппинг карты', async () => {
    importedRepo.findById.mockResolvedValue(basePending);
    importedRepo.findTransferCounterpart.mockResolvedValue(null);

    const result = await handler.execute(
      new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', undefined),
    );

    expect(result).toEqual({ success: true, counterpartId: null });
    expect(importedRepo.markConfirmed).toHaveBeenCalledWith('imp-1', 'tx-1');
    expect(cardRepo.upsert).toHaveBeenCalledWith({
      userId: 'user-1',
      cardMask: '*1951',
      accountId: 'acc-1',
    });
  });

  it('NotFound для чужого/несуществующего id', async () => {
    importedRepo.findById.mockResolvedValue(null);
    await expect(
      handler.execute(new ConfirmImportedCommand('user-1', 'nope', 'tx-1', 'acc-1', undefined)),
    ).rejects.toThrow(NotFoundException);

    importedRepo.findById.mockResolvedValue({ ...basePending, userId: 'other' });
    await expect(
      handler.execute(new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', undefined)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('Forbidden, если не pending', async () => {
    importedRepo.findById.mockResolvedValue({ ...basePending, status: 'confirmed' });
    await expect(
      handler.execute(new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', undefined)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('перевод: гасит встречное сообщение той же транзакцией', async () => {
    importedRepo.findById.mockResolvedValue(basePending);
    importedRepo.findTransferCounterpart.mockResolvedValue({ id: 'imp-2' });

    const result = await handler.execute(
      new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', 'acc-2'),
    );

    expect(importedRepo.findTransferCounterpart).toHaveBeenCalledWith({
      userId: 'user-1',
      oppositeType: 'income',
      amount: 50000,
      occurredAt: basePending.occurredAt,
      counterAccountId: 'acc-2',
      excludeId: 'imp-1',
    });
    expect(importedRepo.markConfirmed).toHaveBeenCalledWith('imp-2', 'tx-1');
    expect(result).toEqual({ success: true, counterpartId: 'imp-2' });
  });

  it('перевод без встречного — просто подтверждает', async () => {
    importedRepo.findById.mockResolvedValue(basePending);
    importedRepo.findTransferCounterpart.mockResolvedValue(null);
    const result = await handler.execute(
      new ConfirmImportedCommand('user-1', 'imp-1', 'tx-1', 'acc-1', 'acc-2'),
    );
    expect(result.counterpartId).toBeNull();
  });
});
