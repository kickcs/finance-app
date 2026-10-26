import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReopenDebtHandler } from './reopen-debt.handler';
import { ReopenDebtCommand } from './reopen-debt.command';
import { DebtSettlementService } from '../../settlement';
import { Debt } from '../../../domain/aggregates/debt';

describe('ReopenDebtHandler', () => {
  const settlement = { reopen: jest.fn() };

  async function createHandler(): Promise<ReopenDebtHandler> {
    const module = await Test.createTestingModule({
      providers: [ReopenDebtHandler, { provide: DebtSettlementService, useValue: settlement }],
    }).compile();
    return module.get(ReopenDebtHandler);
  }

  beforeEach(() => jest.clearAllMocks());

  it('отдаёт отмену сервису расчётов и возвращает долг в виде ответа API', async () => {
    const debt = Debt.create({
      id: 'debt-1',
      userId: 'user-1',
      name: 'Долг',
      totalAmount: 300,
      currency: 'UZS',
      debtType: 'given',
    });
    settlement.reopen.mockResolvedValue(debt);
    const handler = await createHandler();

    const response = await handler.execute(new ReopenDebtCommand('debt-1', 'user-1'));

    expect(settlement.reopen).toHaveBeenCalledWith('user-1', 'debt-1');
    expect(response).toMatchObject({ id: 'debt-1', remainingAmount: 300, isClosed: false });
  });

  it('не перехватывает отказы сервиса', async () => {
    settlement.reopen.mockRejectedValue(new ConflictException('Debt is not closed'));
    const handler = await createHandler();

    await expect(handler.execute(new ReopenDebtCommand('debt-1', 'user-1'))).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
