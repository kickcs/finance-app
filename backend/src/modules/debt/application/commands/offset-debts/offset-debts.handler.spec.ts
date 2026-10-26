import { Test } from '@nestjs/testing';
import { OffsetDebtsHandler } from './offset-debts.handler';
import { OffsetDebtsCommand } from './offset-debts.command';
import { DebtSettlementService, type OffsetDebtsResultDto } from '../../settlement';

describe('OffsetDebtsHandler', () => {
  const settlement = { offset: jest.fn() };

  async function createHandler(): Promise<OffsetDebtsHandler> {
    const module = await Test.createTestingModule({
      providers: [OffsetDebtsHandler, { provide: DebtSettlementService, useValue: settlement }],
    }).compile();
    return module.get(OffsetDebtsHandler);
  }

  beforeEach(() => jest.clearAllMocks());

  it('передаёт команду сервису расчётов и возвращает его ответ', async () => {
    const result = { settlementId: 'settlement-1' } as OffsetDebtsResultDto;
    settlement.offset.mockResolvedValue(result);
    const command = new OffsetDebtsCommand('user-1', 'Эрмурат', 'UZS');

    const handler = await createHandler();

    await expect(handler.execute(command)).resolves.toBe(result);
    expect(settlement.offset).toHaveBeenCalledWith(command);
  });

  it('не перехватывает отказы сервиса', async () => {
    settlement.offset.mockRejectedValue(new Error('boom'));
    const handler = await createHandler();

    await expect(
      handler.execute(new OffsetDebtsCommand('user-1', 'Эрмурат', 'UZS')),
    ).rejects.toThrow('boom');
  });
});
