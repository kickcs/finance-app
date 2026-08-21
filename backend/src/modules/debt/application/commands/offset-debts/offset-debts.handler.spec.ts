import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { OffsetDebtsHandler } from './offset-debts.handler';
import { OffsetDebtsCommand } from './offset-debts.command';
import { DEBT_REPOSITORY } from '../../../domain/repositories';
import { Debt } from '../../../domain/aggregates/debt';
import { type CreateTransactionCommand } from '../../../../accounting/application/commands/create-transaction/create-transaction.command';
import { DEBT_CATEGORY_IDS } from '../../../../accounting/domain/constants/default-categories';

describe('OffsetDebtsHandler', () => {
  let handler: OffsetDebtsHandler;

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
  const mockManager = {};
  const mockDataSource = {
    query: jest.fn(),
    transaction: jest.fn((cb: (m: typeof mockManager) => Promise<void>) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffsetDebtsHandler,
        { provide: DEBT_REPOSITORY, useValue: mockRepository },
        { provide: CommandBus, useValue: mockCommandBus },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    handler = module.get<OffsetDebtsHandler>(OffsetDebtsHandler);
    jest.clearAllMocks();
    mockDataSource.query.mockReset();
    mockCommandBus.execute.mockReset();
    mockDataSource.query.mockResolvedValue([{ id: 'acc-fallback' }]);
    mockRepository.save.mockImplementation((debt: Debt) => Promise.resolve(debt));
    let counter = 0;
    mockCommandBus.execute.mockImplementation(() =>
      Promise.resolve({ id: `tx-offset-${++counter}` }),
    );
  });

  function makeDebt(
    id: string,
    debtType: 'given' | 'taken',
    remaining: number,
    accountId = 'acc-1',
  ): Debt {
    const debt = Debt.create({
      id,
      userId: 'user-1',
      name: `Долг ${id}`,
      totalAmount: remaining,
      currency: 'UZS',
      debtType,
      personName: 'Эрмурат',
      accountId,
    });
    return debt;
  }

  const command = new OffsetDebtsCommand('user-1', 'Эрмурат', 'UZS');

  it('закрывает меньшую сторону и уменьшает большую', async () => {
    const given = makeDebt('d-given', 'given', 30381);
    const taken = makeDebt('d-taken', 'taken', 137170);
    mockRepository.findActiveByPerson.mockResolvedValue([given, taken]);

    const result = await handler.execute(command);

    expect(result.offsetAmount).toBe(30381);
    expect(given.isClosed).toBe(true);
    expect(given.remainingAmountValue).toBe(0);
    expect(given.closeTransactionId).toBe('tx-offset-1');
    expect(taken.isClosed).toBe(false);
    expect(taken.remainingAmountValue).toBe(106789);
    expect(result.debts).toHaveLength(2);
  });

  it('пишет по информационной записи на каждую сторону', async () => {
    mockRepository.findActiveByPerson.mockResolvedValue([
      makeDebt('d-given', 'given', 500),
      makeDebt('d-taken', 'taken', 500),
    ]);

    await handler.execute(command);

    expect(mockCommandBus.execute).toHaveBeenCalledTimes(2);
    const [first, second] = mockCommandBus.execute.mock.calls.map(
      ([cmd]: [CreateTransactionCommand]) => cmd,
    );
    expect(first.categoryId).toBe(DEBT_CATEGORY_IDS.OFFSET);
    expect(first.isInformational).toBe(true);
    expect(first.isDebtRelated).toBe(false);
    expect(first.type).toBe('income');
    expect(first.debtId).toBe('d-given');
    expect(second.type).toBe('expense');
    expect(second.debtId).toBe('d-taken');
    // Обе записи одной отметкой времени — по ней отмена находит весь зачёт.
    expect(first.date).toEqual(second.date);
  });

  it('гасит несколько долгов одной стороны, начиная со старых', async () => {
    const first = makeDebt('d-old', 'given', 400);
    const second = makeDebt('d-new', 'given', 400);
    const taken = makeDebt('d-taken', 'taken', 500);
    mockRepository.findActiveByPerson.mockResolvedValue([first, second, taken]);

    const result = await handler.execute(command);

    expect(result.offsetAmount).toBe(500);
    expect(first.isClosed).toBe(true);
    expect(second.remainingAmountValue).toBe(300);
    expect(taken.isClosed).toBe(true);
  });

  it('обе стороны закрываются, когда суммы равны', async () => {
    const given = makeDebt('d-given', 'given', 1000);
    const taken = makeDebt('d-taken', 'taken', 1000);
    mockRepository.findActiveByPerson.mockResolvedValue([given, taken]);

    await handler.execute(command);

    expect(given.isClosed).toBe(true);
    expect(taken.isClosed).toBe(true);
  });

  it('подставляет запасной счёт, когда счёт долга удалён', async () => {
    mockRepository.findActiveByPerson.mockResolvedValue([
      makeDebt('d-given', 'given', 100, 'acc-deleted'),
      makeDebt('d-taken', 'taken', 100, 'acc-fallback'),
    ]);

    await handler.execute(command);

    const [first] = mockCommandBus.execute.mock.calls.map(
      ([cmd]: [CreateTransactionCommand]) => cmd,
    );
    expect(first.accountId).toBe('acc-fallback');
  });

  it('отказывается зачитывать, когда встречной стороны нет', async () => {
    mockRepository.findActiveByPerson.mockResolvedValue([makeDebt('d-given', 'given', 100)]);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(mockCommandBus.execute).not.toHaveBeenCalled();
  });

  it('отказывается зачитывать без единого счёта', async () => {
    mockRepository.findActiveByPerson.mockResolvedValue([
      makeDebt('d-given', 'given', 100),
      makeDebt('d-taken', 'taken', 100),
    ]);
    mockDataSource.query.mockResolvedValue([]);

    await expect(handler.execute(command)).rejects.toThrow(BadRequestException);
  });
});
