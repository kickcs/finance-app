import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DeleteDebtHandler } from './delete-debt.handler';
import { DeleteDebtCommand } from './delete-debt.command';
import { DebtSettlementService } from '../../settlement';

describe('DeleteDebtHandler', () => {
  const settlement = { removeDebt: jest.fn() };

  async function createHandler(): Promise<DeleteDebtHandler> {
    const module = await Test.createTestingModule({
      providers: [DeleteDebtHandler, { provide: DebtSettlementService, useValue: settlement }],
    }).compile();
    return module.get(DeleteDebtHandler);
  }

  beforeEach(() => jest.clearAllMocks());

  it('отдаёт удаление сервису расчётов: пользователь и долг из команды', async () => {
    settlement.removeDebt.mockResolvedValue(undefined);
    const handler = await createHandler();

    await handler.execute(new DeleteDebtCommand('debt-1', 'user-1'));

    expect(settlement.removeDebt).toHaveBeenCalledTimes(1);
    expect(settlement.removeDebt).toHaveBeenCalledWith('user-1', 'debt-1');
  });

  it.each([
    ['404, если долга нет', new NotFoundException('Debt not found')],
    ['403, если долг чужой', new ForbiddenException('Access denied')],
    [
      '409, если зачёт долга заблокирован более поздним расчётом',
      new ConflictException('Сначала отмените более поздний расчёт по долгу «Тимур»'),
    ],
  ])('не перехватывает отказ сервиса: %s', async (_name, error) => {
    settlement.removeDebt.mockRejectedValue(error);
    const handler = await createHandler();

    await expect(handler.execute(new DeleteDebtCommand('debt-1', 'user-1'))).rejects.toBe(error);
  });
});
