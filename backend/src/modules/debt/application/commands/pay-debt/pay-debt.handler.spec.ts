import { Test } from '@nestjs/testing';
import { PayDebtHandler } from './pay-debt.handler';
import { PayDebtCommand } from './pay-debt.command';
import { DebtSettlementService, type PayDebtResultDto } from '../../settlement';

describe('PayDebtHandler', () => {
  const settlement = { pay: jest.fn() };

  async function createHandler(): Promise<PayDebtHandler> {
    const module = await Test.createTestingModule({
      providers: [PayDebtHandler, { provide: DebtSettlementService, useValue: settlement }],
    }).compile();
    return module.get(PayDebtHandler);
  }

  beforeEach(() => jest.clearAllMocks());

  it('передаёт команду сервису расчётов и возвращает его ответ', async () => {
    const result = { settlementId: 'settlement-1' } as PayDebtResultDto;
    settlement.pay.mockResolvedValue(result);
    const command = new PayDebtCommand('user-1', 'debt-1', 300, 'account-1', new Date());

    const handler = await createHandler();

    await expect(handler.execute(command)).resolves.toBe(result);
    expect(settlement.pay).toHaveBeenCalledWith(command);
  });

  it('не перехватывает отказы сервиса', async () => {
    settlement.pay.mockRejectedValue(new Error('boom'));
    const handler = await createHandler();

    await expect(
      handler.execute(new PayDebtCommand('user-1', 'debt-1', 300, 'account-1', new Date())),
    ).rejects.toThrow('boom');
  });
});
